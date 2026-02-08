// components/TagFilterSheet.tsx
// Bottom sheet modal for tag filtering

import { Colors } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import type { TagFilterSheetProps } from '../types';

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
  const [draftSelection, setDraftSelection] = useState<string[]>(selectedTags);

  useEffect(() => {
    if (visible) {
      setDraftSelection(selectedTags);
    }
  }, [selectedTags, visible]);

  const toggleTag = useCallback((tagId: string) => {
    setDraftSelection((previous) =>
      previous.includes(tagId)
        ? previous.filter((id) => id !== tagId)
        : [...previous, tagId]
    );
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
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose} />
      <View
        style={[
          styles.container,
          { backgroundColor: palette.background, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.title, { color: palette.text }]}>Bar Tags</Text>

        <FlatList
          data={tags}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isChecked = draftSelection.includes(item.id);
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => toggleTag(item.id)}
                activeOpacity={0.85}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked }}
              >
                <MaterialIcons
                  name={isChecked ? 'check-box' : 'check-box-outline-blank'}
                  size={22}
                  color={isChecked ? highlightColor : palette.text}
                  style={styles.checkbox}
                />
                <Text
                  style={[
                    styles.rowLabel,
                    { color: isChecked ? palette.pillText : palette.text },
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={tags.length === 0 ? styles.emptyContent : undefined}
          ListEmptyComponent={
            <View style={styles.emptyContent}>
              <Text style={[styles.emptyText, { color: palette.filterText }]}>
                No tags available.
              </Text>
            </View>
          }
          style={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={handleClearAll}
            style={[styles.actionButton, styles.actionGhost, { borderColor: palette.pillBorder }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionGhostText, { color: palette.text }]}>Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleApply}
            style={[styles.actionButton, styles.actionPrimary, { backgroundColor: highlightColor }]}
            activeOpacity={0.9}
          >
            <Text style={styles.actionPrimaryText}>Apply Filters</Text>
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
    backgroundColor: 'transparent',
  },
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
    maxHeight: 340,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  checkbox: {
    marginRight: 8,
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
    color: '#ffffff',
  },
});