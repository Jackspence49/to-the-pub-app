// Custom hook for managing tag filtering
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Bar, SelectedTagEntry, TagFilterOption } from '../types';
import { TAGS_ENDPOINT } from '../utils/constants';
import { normalizeTagName } from '../utils/helpers';

export const useTagFilters = (
  bars: Bar[],
  selectedTags: string[],
  setSelectedTags: Dispatch<SetStateAction<string[]>>,
  isFilterSheetVisible: boolean,
  setIsFilterSheetVisible: Dispatch<SetStateAction<boolean>>
) => {

  const [availableTags, setAvailableTags] = useState<TagFilterOption[]>([]);
  const [areTagsLoading, setAreTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);

  // Load tags from the backend 
  useEffect(() => {
    let cancelled = false;

    const fetchTags = async () => {
      setAreTagsLoading(true);
      try {
        setTagsError(null);
        const response = await fetch(TAGS_ENDPOINT);
        if (!response.ok) {
          throw new Error(`Failed to fetch tags (status ${response.status})`);
        }

        const payload = await response.json();
        const rawItems = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : [];

        const tagMap = new Map<string, TagFilterOption>();

        rawItems.forEach((tag: any) => {
          const name = typeof tag?.name === 'string' ? tag.name.trim() : '';
          if (!name) {
            return;
          }

          const normalizedName = normalizeTagName(name);
          if (!normalizedName) {
            return;
          }

          // Require backend tag ids so API calls send ids instead of normalized names
          const tagId = typeof tag?.id === 'string' ? tag.id.trim() : '';
          if (!tagId || tagMap.has(tagId)) {
            return;
          }

          tagMap.set(tagId, {
            id: tagId,
            name,
            normalizedName,
          });
        });

        if (!cancelled) {
          setAvailableTags(Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (err) {
        if (!cancelled) {
          setTagsError(err instanceof Error ? err.message : 'Unable to load tags right now.');
          setAvailableTags([]);
        }
      } finally {
        if (!cancelled) {
          setAreTagsLoading(false);
        }
      }
    };

    fetchTags();

    return () => {
      cancelled = true;
    };
  }, []);

  // Filter bars by selected tags (client-side) Note: This should ideally be done server-side
  const filteredBars = useMemo(() => {
    if (selectedTags.length === 0) {
      return bars;
    }
    
    const selectedSet = new Set(selectedTags.map((id) => id.trim()).filter(Boolean));
    
    return bars.filter((bar) => {
      if (bar.tags.length === 0) {
        return false;
      }
      
      // Prefer backend tag ids for matching; fall back to normalized names only if ids are missing
      const tagIds = bar.tags
        .map((tag) => (typeof tag.id === 'string' ? tag.id.trim() : ''))
        .filter((value) => value.length > 0);

      const fallbackNames = tagIds.length
        ? []
        : bar.tags
            .map((tag) => normalizeTagName(tag.name))
            .filter((value) => value && value.length > 0);

      const barTagSet = new Set([...tagIds, ...fallbackNames]);
      
      // Bar must have ALL selected tags (AND logic)
      for (const tag of selectedSet.values()) {
        if (!barTagSet.has(tag)) {
          return false;
        }
      }
      
      return true;
    });
  }, [bars, selectedTags]);

  /**
   * Get selected tag entries with labels
   */
  const selectedTagEntries = useMemo<SelectedTagEntry[]>(() => {
    if (selectedTags.length === 0) {
      return [];
    }
    
    const lookup = new Map(availableTags.map((tag) => [tag.id, tag.name]));
    
    return selectedTags.map((id) => ({
      normalized: id,
      label: lookup.get(id) ?? id,
    }));
  }, [availableTags, selectedTags]);

  /**
   * Apply filter changes
   */
  const handleApplyFilters = useCallback(
    (nextTags: string[]) => {
      setSelectedTags(nextTags.map((tagId) => tagId.trim()).filter(Boolean));
    },
    [setSelectedTags]
  );

  /**
   * Open filter sheet
   */
  const openFilterSheet = useCallback(() => {
    setIsFilterSheetVisible(true);
  }, [setIsFilterSheetVisible]);

  /**
   * Close filter sheet
   */
  const closeFilterSheet = useCallback(() => {
    setIsFilterSheetVisible(false);
  }, [setIsFilterSheetVisible]);

  /**
   * Clear all filters
   */
  const handleClearFilters = useCallback(() => {
    setSelectedTags([]);
  }, [setSelectedTags]);

  /**
   * Remove a specific tag
   */
  const handleRemoveTag = useCallback((tagId: string) => {
    setSelectedTags((prev) => prev.filter((id) => id !== tagId));
  }, [setSelectedTags]);

  return {
    selectedTags,
    availableTags,
    areTagsLoading,
    tagsError,
    filteredBars,
    selectedTagEntries,
    isFilterSheetVisible,
    handleApplyFilters,
    openFilterSheet,
    closeFilterSheet,
    handleClearFilters,
    handleRemoveTag,
  };
};