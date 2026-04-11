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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
	const insets = useSafeAreaInsets();

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
					style={styles.row}
					onPress={() => toggleTag(item.id)}
					activeOpacity={0.85}
					accessibilityRole="radio"
					accessibilityState={{ selected: isChecked }}
				>
					<MaterialIcons
						name={isChecked ? 'radio-button-checked' : 'radio-button-unchecked'}
						size={22}
						color={isChecked ? highlightColor : palette.text}
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
		},
		[selectedTagIds, highlightColor, palette.text, palette.pillText, toggleTag]
	);

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
				<Text style={[styles.title, { color: palette.text }]}>Filter Events</Text>

				{isLoading ? (
					<View style={styles.stateRow}>
						<ActivityIndicator color={highlightColor} />
						<Text style={[styles.stateText, { color: palette.text }]}>Loading tags...</Text>
					</View>
				) : error ? (
					<View style={styles.stateColumn}>
						<Text style={[styles.stateErrorText, { color: palette.networkErrorText }]}>{error}</Text>
						{onRetry && (
							<TouchableOpacity
								onPress={onRetry}
								style={[styles.retryButton, { borderColor: highlightColor }]}
								activeOpacity={0.85}
							>
								<Text style={[styles.retryText, { color: highlightColor }]}>Retry</Text>
							</TouchableOpacity>
						)}
					</View>
				) : (
					<FlatList
						data={tags}
						keyExtractor={(item) => item.id}
						renderItem={renderTagRow}
						contentContainerStyle={tags.length === 0 ? styles.emptyContent : undefined}
						ListEmptyComponent={
							<View style={styles.emptyState}>
								<Text style={[styles.stateText, { color: palette.filterText }]}>No tags available.</Text>
							</View>
						}
						style={tags.length > 0 ? styles.list : undefined}
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
	scrim: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.4)',
	},
	container: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		maxHeight: '65%',
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
	stateRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	stateColumn: {
		gap: 8,
	},
	stateText: {
		fontSize: 14,
	},
	stateErrorText: {
		fontSize: 14,
		fontWeight: '600',
	},
	retryButton: {
		alignSelf: 'flex-start',
		borderRadius: 999,
		borderWidth: 1,
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	retryText: {
		fontSize: 14,
		fontWeight: '600',
	},
	emptyContent: {
		flexGrow: 1,
	},
	emptyState: {
		alignItems: 'center',
		paddingVertical: 24,
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
});
