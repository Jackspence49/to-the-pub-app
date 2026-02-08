// components/EmptyStates.tsx
// Empty states and banner components

import { Colors } from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SelectedTagEntry, ThemeName } from '../types';

// Empty state when no bars are available
export const BarsEmptyState = ({
  error,
  onRetry,
  theme,
}: {
  error: string | null;
  onRetry: () => void;
  theme: ThemeName;
}) => {
  const palette = Colors[theme];
  const networkErrorText = palette.networkErrorText;
  const networkErrorButton = palette.networkErrorButton;
  const networkErrorBackground = palette.networkErrorBackground;
  const networkErrorBorder = palette.networkErrorBorder;

  return (
    <View
      style={[
        styles.emptyState,
        error
          ? {
              backgroundColor: networkErrorBackground,
              borderColor: networkErrorBorder,
              borderWidth: 1,
              borderRadius: 12,
              paddingVertical: 18,
              paddingHorizontal: 24,
              width: '90%',
              alignSelf: 'center',
            }
          : null,
      ]}
    >
      <Text style={[styles.emptyTitle, { color: networkErrorText }]}>
        {error ? 'Unable to load bars' : 'No bars to show'}
      </Text>
      <Text style={[styles.emptyDescription, { color: networkErrorText }]}>
        {error ? error : 'Check back soon for nearby watering holes.'}
      </Text>
      {error ? (
        <TouchableOpacity
          style={[styles.retryButton, { borderColor: networkErrorButton }]}
          onPress={onRetry}
        >
          <Text style={[styles.retryButtonText, { color: networkErrorButton }]}>Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// Error banner
export const ErrorBanner = ({ message, theme }: { message: string; theme: ThemeName }) => {
  const palette = Colors[theme];
  const warningBackground = palette.warningBackground;
  const warningBorder = palette.warningBorder;
  const warningText = palette.warningText;

  return (
    <View
      style={[
        styles.errorBanner,
        {
          backgroundColor: warningBackground,
          borderColor: warningBorder,
          borderWidth: 1,
        },
      ]}
    >
      <Text style={[styles.errorBannerTitle, { color: warningText }]}>Unable to refresh</Text>
      <Text style={[styles.errorBannerMessage, { color: warningText }]}>{message}</Text>
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
  const warningBackground = palette.warningBackground;
  const warningBorder = palette.warningBorder;
  const warningText = palette.warningText;
  const actionButton = palette.actionButton;
  const dismissButton = palette.dismissButton;

  return (
    <View
      style={[
        styles.errorBanner,
        {
          backgroundColor: warningBackground,
          borderColor: warningBorder,
          borderWidth: 1,
        },
      ]}
    >
      <Text style={[styles.errorBannerTitle, { color: warningText }]}>Location disabled</Text>
      <Text style={[styles.errorBannerMessage, { color: warningText }]}>
        Enable location in system settings to see nearby bars.
      </Text>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
        <TouchableOpacity
          onPress={onOpenSettings}
          style={[styles.retryButton, { borderColor: actionButton }]}
        >
          <Text style={[styles.retryButtonText, { color: actionButton }]}>Open settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRetry}
          style={[styles.retryButton, { borderColor: dismissButton }]}
        >
          <Text style={[styles.retryButtonText, { color: dismissButton }]}>Retry</Text>
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
  const pillBorder = palette.border;
  const filterActivePill = palette.filterActivePill;
  const actionButton = palette.actionButton;
  const warningText = palette.warningText;
  const cardSubtitle = palette.cardSubtitle;

  return (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyTitle, { color: warningText }]}>
        No Open Bars Match Those Tags
      </Text>
      <Text style={[styles.emptyDescription, { color: cardSubtitle }]}>
        Try removing a few filters to see more watering holes.
      </Text>
      <View style={styles.selectedFilterTags}>
        {selectedTagEntries.map((entry) => (
          <View
            key={entry.normalized}
            style={[
              styles.selectedFilterTagPill,
              { backgroundColor: filterActivePill, borderColor: pillBorder },
            ]}
          >
            <Text style={[styles.selectedFilterTagText, { color: palette.filterTextActive }]}>
              {entry.label}
            </Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.retryButton, { borderColor: actionButton }]}
        onPress={onClear}
      >
        <Text style={[styles.retryButtonText, { color: actionButton }]}>Clear filters</Text>
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