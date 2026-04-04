// components/barTagFilterSheet.tsx

import { Colors } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TagFilterSheetProps } from '../types';

const UNCATEGORIZED = 'Other';

export const TagFilterSheet = ({
  visible,
  tags,
  selectedTags,
  onApply,
  onClose,
  theme,
}: TagFilterSheetProps) => {
  const palette = Colors[theme];
  const highlightColor = palette.filterActivePill;
  const insets = useSafeAreaInsets();
  const [draftSelection, setDraftSelection] = useState<string[]>(selectedTags);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);
  const categoryYRef = useRef<Map<string, number>>(new Map());

  // Group tags by category
  const groups = useMemo(() => {
    const map = new Map<string, typeof tags>();
    for (const tag of tags) {
      const key = tag.category ?? UNCATEGORIZED;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tag);
    }
    // Sort categories alphabetically, UNCATEGORIZED last
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    });
  }, [tags]);

  useEffect(() => {
    if (visible) {
      setDraftSelection(selectedTags);
      // Default: all categories collapsed
      setExpandedCategories(new Set());
    }
  }, [visible, selectedTags]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
        // Scroll so the header + first tag are visible
        const y = categoryYRef.current.get(category);
        if (y !== undefined) {
          requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ y, animated: true });
          });
        }
      }
      return next;
    });
  }, []);

  const draftSelectionSet = useMemo(() => new Set(draftSelection), [draftSelection]);

  const toggleTag = useCallback((tagId: string) => {
    setDraftSelection((previous) => {
      const has = previous.includes(tagId);
      return has ? previous.filter((id) => id !== tagId) : [...previous, tagId];
    });
  }, []);

  const handleApply = useCallback(() => {
    onApply(draftSelection);
    onClose();
  }, [draftSelection, onApply, onClose]);

  const handleClearAll = useCallback(() => {
    setDraftSelection([]);
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose} />
      <View
        style={[
          styles.container,
          { backgroundColor: palette.background, borderColor: palette.border, paddingBottom: Math.max(24, insets.bottom) },
        ]}
        accessibilityViewIsModal
      >
        <Text style={[styles.title, { color: palette.text }]}>Bar Tags</Text>

        <ScrollView
          ref={scrollRef}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {groups.length === 0 ? (
            <View style={styles.emptyContent}>
              <Text style={[styles.emptyText, { color: palette.filterText }]}>
                No tags available.
              </Text>
            </View>
          ) : (
            groups.map(([category, categoryTags]) => {
              const isExpanded = expandedCategories.has(category);
              const selectedCount = categoryTags.filter((t) =>
                draftSelectionSet.has(t.id)
              ).length;

              return (
                <View
                  key={category}
                  onLayout={(e) => categoryYRef.current.set(category, e.nativeEvent.layout.y)}
                >
                  <TouchableOpacity
                    style={[
                      styles.categoryHeader,
                      { borderBottomColor: palette.border },
                    ]}
                    onPress={() => toggleCategory(category)}
activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`${category}${selectedCount > 0 ? `, ${selectedCount} selected` : ''}`}
                    accessibilityHint="Double tap to expand or collapse"
                    accessibilityState={{ expanded: isExpanded }}
                  >
                    <Text style={[styles.categoryLabel, { color: palette.text }]}>
                      {category}
                    </Text>
                    {selectedCount > 0 && (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: highlightColor },
                        ]}
                      >
                        <Text style={[styles.badgeText, { color: palette.filterTextActive }]}>{selectedCount}</Text>
                      </View>
                    )}
                    <MaterialIcons
                      name={isExpanded ? 'expand-less' : 'expand-more'}
                      size={22}
                      color={palette.text}
                    />
                  </TouchableOpacity>

                  {isExpanded &&
                    categoryTags.map((item) => {
                      const isChecked = draftSelectionSet.has(item.id);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.row}
                          onPress={() => toggleTag(item.id)}
                          activeOpacity={0.85}
                          accessibilityRole="checkbox"
                          accessibilityLabel={item.name}
                          accessibilityState={{ checked: isChecked }}
                        >
                          <MaterialIcons
                            name={
                              isChecked
                                ? 'check-box'
                                : 'check-box-outline-blank'
                            }
                            size={22}
                            color={isChecked ? highlightColor : palette.text}

                          />
                          <Text
                            style={[
                              styles.rowLabel,
                              {
                                color: isChecked
                                  ? palette.pillText
                                  : palette.text,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={handleClearAll}
            style={[
              styles.actionButton,
              styles.actionGhost,
              { borderColor: palette.pillBorder },
            ]}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionGhostText, { color: palette.text }]}>
              Clear All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleApply}
            style={[
              styles.actionButton,
              styles.actionPrimary,
              { backgroundColor: highlightColor },
            ]}
            activeOpacity={0.9}
          >
            <Text style={[styles.actionPrimaryText, { color: palette.filterTextActive }]}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default TagFilterSheet;

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '65%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 8,
    gap: 8,
  },
  rowLabel: {
    fontSize: 15,
    flex: 1,
  },
  emptyContent: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionGhost: {
    backgroundColor: 'transparent',
  },
  actionPrimary: {
    borderWidth: 0,
  },
  actionGhostText: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
