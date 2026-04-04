import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { LocationPermissionBanner } from './barEmptyStates';
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import { Colors } from '../constants/theme';
import type { SelectedTagEntry, ThemeName } from '../types/index';
import { RadiusSelector } from './radiusSelector';

type EventsListHeaderProps = {
	theme: ThemeName;
	selectedTagIds: string[];
	selectedTagEntries: SelectedTagEntry[];
	searchRadius: number;
	areTagsLoading: boolean;
	tagsError: string | null;
	error: string | null;
	locationDeniedPermanently: boolean;
	onOpenFilterSheet: () => void;
	onRemoveTag: (tagId: string) => void;
	onRadiusChange: (value: number) => void;
	onRetryTags: () => void;
	onRetryEvents: () => void;
	onOpenSettings: () => void;
	onRetryLocation: () => void;
};

export const EventsListHeader = ({
	theme,
	selectedTagIds,
	selectedTagEntries,
	searchRadius,
	areTagsLoading,
	tagsError,
	error,
	locationDeniedPermanently,
	onOpenFilterSheet,
	onRemoveTag,
	onRadiusChange,
	onRetryTags,
	onRetryEvents,
	onOpenSettings,
	onRetryLocation,
}: EventsListHeaderProps) => {
	const palette = Colors[theme];
	const highlightColor = palette.filterActivePill;

	return (
		<View style={[styles.listHeader, { backgroundColor: palette.background }]}>
			<Text style={[styles.screenTitle, { color: palette.cardTitle }]}>Upcoming Events</Text>

			{locationDeniedPermanently ? (
				<View style={styles.locationBannerWrapper}>
					<LocationPermissionBanner
						theme={theme}
						onOpenSettings={onOpenSettings}
						onRetry={onRetryLocation}
					/>
				</View>
			) : null}

			<View style={styles.headerControlsRow}>
				<View style={styles.filterButtonRow}>
					<TouchableOpacity
						onPress={onOpenFilterSheet}
						style={[styles.filterButton, styles.filterButtonLarge, { backgroundColor: palette.actionButton }]}
						activeOpacity={0.9}
						accessibilityLabel={selectedTagIds.length ? `Filters, ${selectedTagIds.length} active` : 'Filters'}
						accessibilityRole="button"
					>
						<MaterialIcons name="tune" size={18} color={palette.filterTextActive} style={styles.filterButtonIcon} />
						<Text style={[styles.filterButtonText, { color: palette.filterTextActive }]}>
							Filters{selectedTagIds.length ? ` (${selectedTagIds.length})` : ''}
						</Text>
					</TouchableOpacity>
				</View>
				<View style={styles.radiusColumn}>
					<RadiusSelector value={searchRadius} onChange={onRadiusChange} theme={theme} />
				</View>
			</View>

			{selectedTagEntries.length ? (
				<View style={styles.selectedTagChipRow}>
					{selectedTagEntries.map((entry) => (
						<View
							key={entry.normalized}
							style={[styles.selectedTagChip, { borderColor: palette.border, backgroundColor: palette.filterContainer }]}
						>
							<Text style={[styles.selectedTagChipLabel, { color: palette.pillText }]} numberOfLines={1}>
								{entry.label}
							</Text>
							<TouchableOpacity
								onPress={() => onRemoveTag(entry.normalized)}
								style={[styles.selectedTagChipClose, { backgroundColor: palette.filterContainer }]}
								hitSlop={6}
							>
								<MaterialIcons name="close" size={14} color={palette.text} />
							</TouchableOpacity>
						</View>
					))}
				</View>
			) : null}

			{tagsError ? (
				<TouchableOpacity
					onPress={onRetryTags}
					style={[styles.filterLoadRow, { borderColor: highlightColor }]}
					accessibilityLabel="Could not load tags. Tap to retry."
					accessibilityRole="button"
				>
					<Text style={[styles.filterLoadText, { color: palette.cardTitle }]}>Could not load tags. Tap to retry.</Text>
				</TouchableOpacity>
			) : null}

			{areTagsLoading ? (
				<View style={styles.filterLoadRow}>
					<ActivityIndicator size="small" color={highlightColor} />
					<Text style={[styles.filterLoadText, { color: palette.cardSubtitle }]}>Loading tags...</Text>
				</View>
			) : null}

			{error ? (
				<View
					style={[
						styles.errorBanner,
						{ backgroundColor: palette.networkErrorBackground, borderColor: palette.networkErrorBorder },
					]}
				>
					<Text style={[styles.errorTitle, { color: palette.networkErrorText }]}>Unable to load events</Text>
					<Text style={[styles.errorDescription, { color: palette.networkErrorText }]}>{error}</Text>
					<TouchableOpacity
						style={[styles.retryButton, { backgroundColor: palette.networkErrorBackground, borderColor: palette.networkErrorBorder }]}
						onPress={onRetryEvents}
						accessibilityLabel="Try again"
						accessibilityRole="button"
					>
						<Text style={[styles.retryButtonText, { color: palette.networkErrorText }]}>Try again</Text>
					</TouchableOpacity>
				</View>
			) : null}
		</View>
	);
};

const styles = StyleSheet.create({
	listHeader: {
		paddingTop: 12,
		paddingHorizontal: 20,
		paddingBottom: 12,
		zIndex: 30,
		elevation: 30,
		overflow: 'visible',
		position: 'relative',
	},
	screenTitle: {
		fontSize: 26,
		fontWeight: '700',
	},
	headerControlsRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12,
		marginTop: 16,
		flexWrap: 'wrap',
		position: 'relative',
		overflow: 'visible',
	},
	filterButtonRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		flexShrink: 0,
	},
	radiusColumn: {
		flex: 1,
		minWidth: 0,
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
	selectedTagChipRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginTop: 8,
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
		fontWeight: '700',
	},
	selectedTagChipClose: {
		width: 20,
		height: 20,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
	},
	filterLoadRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: 8,
		paddingVertical: 6,
		paddingHorizontal: 10,
		borderRadius: 8,
		borderWidth: 1,
	},
	filterLoadText: {
		fontSize: 13,
	},
	errorBanner: {
		marginTop: 12,
		padding: 14,
		borderRadius: 12,
		borderWidth: 1,
		gap: 6,
	},
	errorTitle: {
		fontSize: 15,
		fontWeight: '700',
	},
	errorDescription: {
		fontSize: 13,
	},
	retryButton: {
		marginTop: 4,
		alignSelf: 'flex-start',
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 8,
		borderWidth: 1,
	},
	retryButtonText: {
		fontSize: 13,
		fontWeight: '600',
	},
	locationBannerWrapper: {
		marginTop: 16,
	},
});
