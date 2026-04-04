// components/barEmptyStates.tsx
// Empty states and banner components for the bars screen

import { Colors } from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SelectedTagEntry, ThemeName } from '../types';

// Empty state when no bars are available
export const BarsEmptyState = ({ theme }: { theme: ThemeName }) => {
  const palette = Colors[theme];

  return (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>No Bars To Show</Text>
      <Text style={[styles.emptyDescription, { color: palette.cardSubtitle }]}>
        Check back soon for nearby watering holes.
      </Text>
    </View>
  );
};

// Error banner
export const ErrorBanner = ({ message, theme }: { message: string; theme: ThemeName }) => {
  const palette = Colors[theme];

  return (
    <View
      style={[
        styles.errorBanner,
        {
          backgroundColor: palette.warningBackground,
          borderColor: palette.warningBorder,
          borderWidth: 1,
        },
      ]}
    >
      <Text style={[styles.errorBannerTitle, { color: palette.warningText }]}>Unable to refresh</Text>
      <Text style={[styles.errorBannerMessage, { color: palette.warningText }]}>{message}</Text>
    </View>
  );
};

// Location permission banner
export const LocationPermissionBanner = ({
  theme,
  onOpenSettings,
  onRetry,
}: {
  theme: ThemeName;
  onOpenSettings: () => void;
  onRetry: () => void;
}) => {
  const palette = Colors[theme];

  return (
    <View
      style={[
        styles.errorBanner,
        {
          backgroundColor: palette.warningBackground,
          borderColor: palette.warningBorder,
          borderWidth: 1,
        },
      ]}
    >
      <Text style={[styles.errorBannerTitle, { color: palette.warningText }]}>Location disabled</Text>
      <Text style={[styles.errorBannerMessage, { color: palette.warningText }]}>
        Enable location in system settings to see nearby bars.
      </Text>
      <View style={styles.bannerButtonRow}>
        <TouchableOpacity
          onPress={onOpenSettings}
          style={[styles.retryButton, { borderColor: palette.actionButton }]}
        >
          <Text style={[styles.retryButtonText, { color: palette.actionButton }]}>Open settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRetry}
          style={[styles.retryButton, { borderColor: palette.dismissButton }]}
        >
          <Text style={[styles.retryButtonText, { color: palette.dismissButton }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Empty state when no bars match selected filters
export const FilteredEmptyState = ({
  selectedTagEntries,
  onClear,
  theme,
}: {
  selectedTagEntries: SelectedTagEntry[];
  onClear: () => void;
  theme: ThemeName;
}) => {
  const palette = Colors[theme];

  return (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyTitle, { color: palette.warningText }]}>
        No Open Bars Match Those Tags
      </Text>
      <Text style={[styles.emptyDescription, { color: palette.cardSubtitle }]}>
        Try removing a few filters to see more watering holes.
      </Text>
      <View style={styles.selectedFilterTags}>
        {selectedTagEntries.map((entry) => (
          <View
            key={entry.normalized}
            style={[
              styles.selectedFilterTagPill,
              { backgroundColor: palette.filterActivePill, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.selectedFilterTagText, { color: palette.filterTextActive }]}>
              {entry.label}
            </Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.retryButton, { borderColor: palette.actionButton }]}
        onPress={onClear}
      >
        <Text style={[styles.retryButtonText, { color: palette.actionButton }]}>Clear filters</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  errorBanner: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  errorBannerMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  bannerButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  selectedFilterTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  selectedFilterTagPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectedFilterTagText: {
    fontSize: 14,
  },
});
