// hooks/useTagFilters.ts
// Custom hook for managing tag filtering

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo } from 'react';
import type { Bar, SelectedTagEntry, TagFilterOption } from '../types';
import { normalizeTagName } from '../utils/helpers';

export const useTagFilters = (
  bars: Bar[],
  selectedTags: string[],
  setSelectedTags: Dispatch<SetStateAction<string[]>>,
  isFilterSheetVisible: boolean,
  setIsFilterSheetVisible: Dispatch<SetStateAction<boolean>>
) => {

  /**
   * Get available tags from loaded bars
   */
  const availableTags = useMemo<TagFilterOption[]>(() => {
    const tagMap = new Map<string, TagFilterOption>();
    
    bars.forEach((bar) => {
      bar.tags.forEach((tag) => {
        if (!tag.name) {
          return;
        }
        const normalizedName = normalizeTagName(tag.name);
        if (!normalizedName) {
          return;
        }
        const tagId = tag.id ?? normalizedName;
        if (!tagMap.has(tagId)) {
          tagMap.set(tagId, {
            id: tagId,
            name: tag.name,
            normalizedName,
          });
        }
      });
    });
    
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [bars]);

  /**
   * Filter bars by selected tags (client-side)
   * Note: This should ideally be done server-side
   */
  const filteredBars = useMemo(() => {
    if (selectedTags.length === 0) {
      return bars;
    }
    
    const selectedSet = new Set(selectedTags);
    
    return bars.filter((bar) => {
      if (bar.tags.length === 0) {
        return false;
      }
      
      const barTagSet = new Set(
        bar.tags
          .map((tag) => tag.id ?? normalizeTagName(tag.name))
          .filter((value) => value && value.length > 0)
      );
      
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
  const handleApplyFilters = useCallback((nextTags: string[]) => {
    setSelectedTags(nextTags);
  }, [setSelectedTags]);

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