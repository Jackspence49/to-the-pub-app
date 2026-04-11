// components/eventTagFilterSheet.tsx

import { Colors } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import {
	ActivityIndicator,
	FlatList,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import type { EventTag, EventTagFilterSheetProps } from '../types';

export const EventTagFilterSheet = ({
	visible,
	tags,
	selectedTagIds,
	onApply,
	onClose,
	onRetry,
	isLoading,
	error,
	theme,
}: EventTagFilterSheetProps) => {
	const palette = Colors[theme];
	const highlightColor = palette.filterActivePill;
	const toggleTag = useCallback(
		(tagId: string) => {
			const next = selectedTagIds.includes(tagId) ? [] : [tagId];
			onApply(next);
			onClose();
		},
		[selectedTagIds, onApply, onClose]
	);

	const renderTagRow = useCallback(
		({ item }: { item: EventTag }) => {
			const isChecked = selectedTagIds.includes(item.id);
			return (
				<TouchableOpacity
					style={styles.filterRow}
					onPress={() => toggleTag(item.id)}
					activeOpacity={0.8}
					accessibilityRole="radio"
					accessibilityState={{ selected: isChecked }}
				>
					<MaterialIcons
						name={isChecked ? 'radio-button-checked' : 'radio-button-unchecked'}
						size={22}
						color={isChecked ? highlightColor : palette.cardTitle}
						style={styles.filterRowCheckbox}
					/>
					<Text style={[styles.filterRowLabel, { color: palette.cardTitle }]} numberOfLines={1}>
						{item.name}
					</Text>
				</TouchableOpacity>
			);
		},
		[selectedTagIds, highlightColor, palette.cardTitle, toggleTag]
	);

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			presentationStyle="overFullScreen"
			onRequestClose={onClose}
		>
			<Pressable style={styles.sheetScrim} onPress={onClose} />
			<View
				style={[
					styles.sheetContainer,
					{ backgroundColor: palette.container, borderColor: palette.border },
				]}
			>
				<Text style={[styles.sheetTitle, { color: palette.cardTitle }]}>Filter Events</Text>

				{isLoading ? (
					<View style={styles.filterStateRow}>
						<ActivityIndicator color={highlightColor} />
						<Text style={[styles.filterStateText, { color: palette.cardTitle }]}>Loading tags...</Text>
					</View>
				) : error ? (
					<View style={styles.filterStateColumn}>
						<Text style={[styles.filterStateErrorText, { color: palette.networkErrorText }]}>{error}</Text>
						{onRetry && (
							<TouchableOpacity
								onPress={onRetry}
								style={[styles.filterStateRetryButton, { borderColor: highlightColor }]}
								activeOpacity={0.85}
							>
								<Text style={[styles.filterStateRetryText, { color: highlightColor }]}>Retry</Text>
							</TouchableOpacity>
						)}
					</View>
				) : (
					<FlatList
						data={tags}
						keyExtractor={(item) => item.id}
						renderItem={renderTagRow}
						contentContainerStyle={tags.length === 0 ? styles.filterEmptyContent : undefined}
						ListEmptyComponent={
							<View style={styles.filterEmptyState}>
								<Text style={[styles.filterStateText, { color: palette.cardSubtitle }]}>No tags available.</Text>
							</View>
						}
						style={styles.filterList}
						showsVerticalScrollIndicator={false}
						keyboardShouldPersistTaps="handled"
					/>
				)}
			</View>
		</Modal>
	);
};

export default EventTagFilterSheet;

const styles = StyleSheet.create({
	sheetScrim: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'transparent',
	},
	sheetContainer: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		borderTopLeftRadius: 22,
		borderTopRightRadius: 22,
		borderWidth: 1,
		padding: 20,
		maxHeight: '50%',
		shadowColor: '#000',
		shadowOpacity: 0.25,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: -4 },
		elevation: 10,
	},
	sheetTitle: {
		fontSize: 18,
		fontWeight: '700',
		textAlign: 'center',
		marginBottom: 14,
	},
	filterStateRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	filterStateColumn: {
		gap: 8,
	},
	filterStateText: {
		fontSize: 14,
	},
	filterStateErrorText: {
		fontSize: 14,
		fontWeight: '600',
	},
	filterStateRetryButton: {
		alignSelf: 'flex-start',
		borderRadius: 999,
		borderWidth: 1,
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	filterStateRetryText: {
		fontSize: 14,
		fontWeight: '600',
	},
	filterList: {
		marginTop: 14,
	},
	filterEmptyContent: {
		flexGrow: 1,
	},
	filterEmptyState: {
		alignItems: 'center',
		paddingVertical: 20,
	},
	filterRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 10,
		paddingHorizontal: 4,
		gap: 12,
	},
	filterRowCheckbox: {
		marginLeft: 4,
	},
	filterRowLabel: {
		fontSize: 15,
		fontWeight: '600',
		flexShrink: 1,
	},
});
