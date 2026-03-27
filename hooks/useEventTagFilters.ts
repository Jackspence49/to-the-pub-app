// hooks/useEventTagFilters.ts
// Manages event tag fetching, selection state, and filter sheet visibility

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EventTag } from '../types/index';
import { EVENT_TAGS_ENDPOINT } from '../utils/constants';
import { extractTagItems, mapToEventTag } from '../utils/Eventmappers';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

const normalizeTagIds = (ids: string[]): string[] =>
  Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));

export const useEventTagFilters = (initialTagIds: string[] = []) => {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialTagIds);
  const [availableTags, setAvailableTags] = useState<EventTag[]>([]);
  const [areTagsLoading, setAreTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);

  // Apply deep-link initial tags once on mount; ignore subsequent changes
  const hasAppliedInitialTagsRef = useRef(false);
  useEffect(() => {
    if (hasAppliedInitialTagsRef.current) return;
    setSelectedTagIds(initialTagIds);
    hasAppliedInitialTagsRef.current = true;
  }, [initialTagIds]);

  const fetchAvailableTags = useCallback(async () => {
    if (!API_BASE_URL) {
      setTagsError('Set EXPO_PUBLIC_API_URL in your .env file to load event tags.');
      setAvailableTags([]);
      return;
    }

    setAreTagsLoading(true);
    try {
      setTagsError(null);
      const response = await fetch(EVENT_TAGS_ENDPOINT);
      if (!response.ok) {
        throw new Error(`Failed to fetch tags (status ${response.status})`);
      }
      const payload = await response.json();
      setAvailableTags(extractTagItems(payload).map(mapToEventTag));
    } catch (err) {
      setTagsError(err instanceof Error ? err.message : 'Unable to load event tags right now.');
    } finally {
      setAreTagsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailableTags();
  }, [fetchAvailableTags]);

  // Names of currently selected tags, for display
  const selectedTagNames = useMemo(
    () => availableTags.filter((tag) => selectedTagIds.includes(tag.id)).map((tag) => tag.name),
    [availableTags, selectedTagIds]
  );

  const handleApplyFilters = useCallback((nextTagIds: string[]) => {
    setSelectedTagIds(normalizeTagIds(nextTagIds));
    setIsFilterSheetVisible(false);
  }, []);

  const handleClearTags = useCallback(() => {
    setSelectedTagIds([]);
  }, []);

  const openFilterSheet = useCallback(() => {
    setIsFilterSheetVisible(true);
  }, []);

  const closeFilterSheet = useCallback(() => {
    setIsFilterSheetVisible(false);
  }, []);

  return {
    selectedTagIds,
    availableTags,
    areTagsLoading,
    tagsError,
    isFilterSheetVisible,
    selectedTagNames,
    fetchAvailableTags,
    handleApplyFilters,
    handleClearTags,
    openFilterSheet,
    closeFilterSheet,
  };
};
