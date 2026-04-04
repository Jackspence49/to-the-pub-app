// components/eventEmptyStates.tsx
// Empty state components for the events screen

import { Colors } from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SelectedTagEntry, ThemeName } from '../types';

export const EventsEmptyState = ({
  selectedTagEntries,
  onClear,
  theme,
}: {
  selectedTagEntries: SelectedTagEntry[];
  onClear: () => void;
  theme: ThemeName;
}) => {
  const palette = Colors[theme];
  const hasFilters = selectedTagEntries.length > 0;

  return (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyTitle, { color: palette.filterText }]}>
        {hasFilters ? 'No Events Match Those Tags' : 'Nothing scheduled yet'}
      </Text>
      <Text style={[styles.emptyDescription, { color: palette.filterText }]}>
        {hasFilters
          ? 'Try removing a few filters to see more events.'
          : 'Check back soon for upcoming events near you.'}
      </Text>
      {hasFilters && (
        <>
          <View style={styles.tagPillRow}>
            {selectedTagEntries.map((entry) => (
              <View
                key={entry.normalized}
                style={[
                  styles.tagPill,
                  { backgroundColor: palette.filterActivePill, borderColor: palette.border },
                ]}
              >
                <Text style={[styles.tagPillText, { color: palette.filterTextActive }]}>
                  {entry.label}
                </Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.clearButton, { borderColor: palette.actionButton }]}
            onPress={onClear}
          >
            <Text style={[styles.clearButtonText, { color: palette.actionButton }]}>
              Clear filters
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};
const styles = StyleSheet.create({
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
  tagPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
  },
  tagPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagPillText: {
    fontSize: 14,
  },
  clearButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
