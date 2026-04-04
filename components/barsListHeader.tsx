import { Colors } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SelectedTagEntry, TagFilterOption, ThemeName } from '../types';
import { ErrorBanner, LocationPermissionBanner } from './barEmptyStates';

type Props = {
  locationDeniedPermanently: boolean;
  availableTags: TagFilterOption[];
  selectedTags: string[];
  selectedTagEntries: SelectedTagEntry[];
  tagsError: string | null;
  barsCount: number;
  errorMessage: string | null;
  theme: ThemeName;
  onOpenSettings: () => void;
  onRetryLocation: () => void;
  onRetryTags: () => void;
  onRetry: () => void;
  onOpenFilterSheet: () => void;
  onClearFilters: () => void;
  onRemoveTag: (normalized: string) => void;
};

export function BarsListHeader({
  locationDeniedPermanently,
  availableTags,
  selectedTags,
  selectedTagEntries,
  tagsError,
  barsCount,
  errorMessage,
  theme,
  onOpenSettings,
  onRetryLocation,
  onRetryTags,
  onRetry,
  onOpenFilterSheet,
  onClearFilters,
  onRemoveTag,
}: Props) {
  const palette = Colors[theme];

  const shouldRender =
    locationDeniedPermanently ||
    availableTags.length > 0 ||
    selectedTags.length > 0 ||
    !!tagsError ||
    !!errorMessage;

  if (!shouldRender) return null;

  return (
    <View style={styles.listHeader}>
      <Text style={[styles.screenTitle, { color: palette.cardTitle }]}>Open Bars</Text>

      {locationDeniedPermanently ? (
        <LocationPermissionBanner
          theme={theme}
          onOpenSettings={onOpenSettings}
          onRetry={onRetryLocation}
        />
      ) : null}

      {tagsError ? (
        <TouchableOpacity onPress={onRetryTags} activeOpacity={0.7}>
          <Text style={[styles.tagsErrorText, { color: palette.warningText }]}>
            Unable to load filters — tap to retry
          </Text>
        </TouchableOpacity>
      ) : null}

      {availableTags.length > 0 || selectedTags.length > 0 ? (
        <View style={[styles.filterCard, { backgroundColor: palette.background }]}>
          <View style={styles.filterButtonRow}>
            <TouchableOpacity
              onPress={onOpenFilterSheet}
              style={[
                styles.filterButton,
                styles.filterButtonLarge,
                { backgroundColor: palette.actionButton },
              ]}
              activeOpacity={0.9}
            >
              <MaterialIcons
                name="tune"
                size={18}
                color={palette.filterTextActive}
                style={styles.filterButtonIcon}
              />
              <Text style={[styles.filterButtonText, { color: palette.filterTextActive }]}>
                Filters{selectedTags.length ? ` (${selectedTags.length})` : ''}
              </Text>
            </TouchableOpacity>
            {selectedTags.length ? (
              <TouchableOpacity
                onPress={onClearFilters}
                style={[styles.inlineClearButton, { borderColor: palette.filterActivePill }]}
                activeOpacity={0.85}
              >
                <Text style={[styles.inlineClearText, { color: palette.filterActivePill }]}>
                  Clear All
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {selectedTagEntries.length ? (
            <View style={styles.selectedTagChipRow}>
              {selectedTagEntries.map((entry) => (
                <View
                  key={entry.normalized}
                  style={[
                    styles.selectedTagChip,
                    { borderColor: palette.border, backgroundColor: palette.filterContainer },
                  ]}
                >
                  <Text
                    style={[styles.selectedTagChipLabel, { color: palette.pillText }]}
                    numberOfLines={1}
                  >
                    {entry.label}
                  </Text>
                  <TouchableOpacity
                    onPress={() => onRemoveTag(entry.normalized)}
                    style={[
                      styles.selectedTagChipClose,
                      { backgroundColor: palette.filterContainer },
                    ]}
                    hitSlop={6}
                  >
                    <MaterialIcons name="close" size={14} color={palette.text} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {errorMessage && barsCount === 0 ? (
        <View
          style={[
            styles.errorCard,
            { backgroundColor: palette.networkErrorBackground, borderColor: palette.networkErrorBorder },
          ]}
        >
          <Text style={[styles.errorCardTitle, { color: palette.networkErrorText }]}>
            Unable to load bars
          </Text>
          <Text style={[styles.errorCardMessage, { color: palette.networkErrorText }]}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            style={[styles.errorCardRetry, { borderColor: palette.networkErrorButton }]}
            onPress={onRetry}
          >
            <Text style={[styles.errorCardRetryText, { color: palette.networkErrorButton }]}>
              Try again
            </Text>
          </TouchableOpacity>
        </View>
      ) : errorMessage && barsCount > 0 ? (
        <ErrorBanner message={errorMessage} theme={theme} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  listHeader: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  filterCard: {
    borderRadius: 16,
    gap: 12,
  },
  filterButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    minWidth: 140,
  },
  filterButtonLarge: {
    minHeight: 48,
  },
  filterButtonIcon: {
    marginRight: 8,
  },
  filterButtonText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  inlineClearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  inlineClearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedTagChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  selectedTagChipLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  selectedTagChipClose: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsErrorText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  errorCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  errorCardMessage: {
    fontSize: 13,
  },
  errorCardRetry: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorCardRetryText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
