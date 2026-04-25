import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import type { EventDetailsProps, ThemeName } from '@/types';

type Palette = (typeof Colors)[ThemeName];

export default function EventDetails({
	title,
	description,
	dateLabel,
	locationLabel,
	tagLabel,
	recurrencePattern,
	onPressLocation,
	actionButtons,
	onPressViewBarEvents,
	showActionSection = true,
	horizontalInset = 0,
	startTimeLabel,
	endTimeLabel,
	addressLabel,
	onPressOpenMap,
}: EventDetailsProps) {
	const theme = useColorScheme() ?? 'dark';
	const palette = Colors[theme];
	const insets = useSafeAreaInsets();
	const styles = React.useMemo(() => createStyles(palette, horizontalInset), [palette, horizontalInset]);

	const heroTopPadding = Math.max(insets.top + 8, 20);

	const startTimeDisplay = startTimeLabel ?? (endTimeLabel ? 'Start time TBD' : 'Time coming soon');
	const endTimeDisplay = endTimeLabel ?? (startTimeLabel ? 'End time TBD' : 'Time coming soon');

	const shouldShowActions = Boolean(showActionSection && actionButtons && actionButtons.length > 0);

	return (
		<View style={[{ backgroundColor: palette.background }]}>
			{/* Header */}
			<View style={styles.heroWrapper}>
				<View style={[styles.hero, { backgroundColor: palette.iconSelected, paddingTop: heroTopPadding }]}>
					{tagLabel ? (
						<View style={styles.heroTopRow}>
							<View style={[styles.tagPill, { backgroundColor: palette.pillBackground, borderColor: palette.pillBorder }]}>
								<Text style={[styles.tagPillText, { color: palette.pillText }]}>
									{tagLabel}
								</Text>
							</View>
						</View>
					) : null}
					<Text style={[styles.eventTitle, { color: palette.cardTitle }]}>
						{title}
					</Text>
				</View>
			</View>

			{/* Date */}
			<View style={[styles.section, { borderBottomColor: palette.border }]}>
				<Text style={[styles.sectionLabel, { color: palette.pillText }]}>Date</Text>
				<View style={styles.dateRow}>
					<IconSymbol name='calendar' size={24} color={palette.iconSelected} style={styles.icon} />
					<View style={styles.dateContent}>
						<Text style={[styles.sectionValue, { color: palette.cardTitle }]}>
							{dateLabel}
						</Text>
						{recurrencePattern ? (
							<View style={[styles.recurrenceBadge, { borderColor: palette.warningBorder }]}>
								<Text style={[styles.recurrenceBadgeText, { color: palette.cardTitle }]}>
									{`Repeats ${recurrencePattern}`}
								</Text>
							</View>
						) : null}
					</View>
				</View>
			</View>

			{/* Hours */}
			<View style={styles.section}>
				<Text style={[styles.sectionLabel, { color: palette.pillText }]}>Time</Text>
				<View style={styles.timeRowSimple}>
					<MaterialIcons name='schedule' size={24} color={palette.iconSelected} style={styles.icon} />
					<View style={styles.timePair}>
						<Text style={[styles.timeLabelInline, { color: palette.cardSubtitle }]}>Start</Text>
						<Text style={[styles.timeValueInline, { color: palette.cardTitle }]}>{startTimeDisplay}</Text>
					</View>
					<MaterialIcons name='arrow-forward' size={16} color={palette.cardSubtitle} style={styles.timeArrowIcon} />
					<View style={styles.timePair}>
						<Text style={[styles.timeLabelInline, { color: palette.cardSubtitle }]}>End</Text>
						<Text style={[styles.timeValueInline, { color: palette.cardTitle }]}>{endTimeDisplay}</Text>
					</View>
				</View>
			</View>

			{/* Venue */}
			<View style={styles.section}>
				<Text style={[styles.sectionLabel, { color: palette.pillText }]}>Venue</Text>
				{locationLabel ? (
					<TouchableOpacity
						style={styles.venueRow}
						disabled={!onPressLocation}
						onPress={onPressLocation}
						activeOpacity={onPressLocation ? 0.8 : 1}
						accessibilityRole={onPressLocation ? 'button' : undefined}
						accessibilityLabel={onPressLocation ? `View ${locationLabel} details` : undefined}
					>
						<View style={styles.venueTextBlock}>
							<MaterialIcons name='location-on' size={24} color={palette.iconSelected} style={styles.icon} />
							<Text style={[styles.sectionValue, onPressLocation ? styles.barName : null, { color: palette.cardTitle }]}>
								{locationLabel}
							</Text>
						</View>
					</TouchableOpacity>
				) : null}
				{addressLabel ? (
					<>
						<View style={styles.addressBlock}>
							<Text style={[styles.addressText, { color: palette.cardSubtitle }]}>
								{addressLabel}
							</Text>
							{onPressOpenMap ? (
								<TouchableOpacity
									onPress={onPressOpenMap}
									style={[styles.externalBtn, { backgroundColor: palette.actionButton }]}
									activeOpacity={0.9}
									accessibilityRole='button'
									accessibilityLabel='Get Directions'
								>
									<Text style={[styles.externalBtnText, { color: palette.filterTextActive }]}>Get Directions</Text>
								</TouchableOpacity>
							) : null}
						</View>
					</>
				) : null}
			</View>

			{/* Description */}
			{description ? (
				<View style={styles.section}>
					<Text style={[styles.sectionLabel, { color: palette.pillText }]}>About</Text>
					<Text style={[styles.sectionValue, { color: palette.cardSubtitle }]}>
						{description}
					</Text>
				</View>
			) : null}

			{/* Contact */}
			{shouldShowActions ? (
				<View style={styles.section}>
					<Text style={[styles.sectionLabel, { color: palette.pillText }]}>Contact & Links</Text>
					<View style={styles.contactRow}>
						{actionButtons?.map((button) => (
							<TouchableOpacity
								key={button.key}
								onPress={button.onPress}
								style={[styles.contactButton, { borderColor: palette.pillBorder, backgroundColor: palette.pillBackground }]}
								activeOpacity={0.85}
								accessibilityRole='button'
								accessibilityLabel={button.label}
							>
								<View style={styles.contactButtonContent}>
									<FontAwesome name={button.iconName} size={20} color={palette.pillText} />
									<Text style={[styles.contactLabel, { color: palette.filterText }]}>{button.label}</Text>
								</View>
							</TouchableOpacity>
						))}
					</View>
				</View>
			) : null}

			{/* More Information */}
			<View style={styles.sectionEnd}>
				<TouchableOpacity
					onPress={onPressViewBarEvents}
					style={[styles.externalBtn, { backgroundColor: palette.actionButton }]}
					activeOpacity={0.9}
					accessibilityRole='button'
					accessibilityLabel='See all upcoming events at this venue'
				>
					<Text style={[styles.externalBtnText, { color: palette.filterTextActive }]}>See all upcoming events</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}

const createStyles = (palette: Palette, horizontalInset: number) => StyleSheet.create({

	// ── Header
	heroWrapper: {
		marginHorizontal: -horizontalInset,
	},
	hero: {
		width: '100%',
		overflow: 'hidden',
		paddingHorizontal: 20,
		paddingBottom: 10,
	},
	heroTopRow: {
		width: '100%',
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 12,
		paddingRight: 20,
		paddingLeft: 52,
	},
	tagPill: {
		alignSelf: 'flex-start',
		borderRadius: 999,
		borderWidth: 1,
		paddingHorizontal: 15,
		paddingVertical: 8,
	},
	tagPillText: {
		fontSize: 15,
		fontWeight: '700',
		textTransform: 'uppercase',
	},
	eventTitle: {
		fontSize: 40,
		fontWeight: '900',
	},

	// ── Sections
	section: {
		paddingVertical: 16,
		borderBottomWidth: 1,
		borderBottomColor: palette.border,
	},
	sectionEnd: {
		paddingVertical: 16,
	},
	sectionLabel: {
		fontSize: 16,
		fontWeight: '700',
		marginBottom: 6,
	},
	sectionValue: {
		fontSize: 16,
		fontWeight: '400',
	},

	// ── Date
	dateRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	dateContent: {
		flexDirection: 'column',
		gap: 6,
	},
	recurrenceBadge: {
		alignSelf: 'flex-start',
		borderWidth: 1,
		borderRadius: 100,
		paddingHorizontal: 12,
		paddingVertical: 4,
	},
	recurrenceBadgeText: {
		fontSize: 16,
		fontWeight: '400',
	},

	// ── Venue
	venueRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginTop: 4,
	},
	venueTextBlock: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
	},
	addressBlock: {
		marginTop: 6,
		gap: 8,
	},
	barName: {
		fontSize: 20,
		fontWeight: '700',
		marginBottom: 4,
		textDecorationLine: 'underline',
	},
	addressText: {
		fontSize: 16,
		marginBottom: 4,
	},

	// ── Contacts
	contactRow: {
		flexDirection: 'row',
		gap: 10,
		flexWrap: 'wrap',
	},
	contactButton: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 12,
		paddingVertical: 10,
		paddingHorizontal: 14,
	},
	contactButtonContent: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	contactLabel: {
		fontSize: 14,
		fontWeight: '700',
	},

	// ── External link button
	externalBtn: {
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: 'center',
		justifyContent: 'center',
	},
	externalBtnText: {
		fontSize: 14,
		fontWeight: '700',
	},

	// ── Hours
	timeRowSimple: {
		marginTop: 8,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		flexWrap: 'wrap',
	},
	timePair: {
		flexDirection: 'column',
		gap: 2,
	},
	icon: {
		opacity: 0.85,
		marginRight: 8,
	},
	timeArrowIcon: {
		marginHorizontal: 2,
		opacity: 0.7,
	},
	timeLabelInline: {
		fontSize: 16,
		fontWeight: '600',
		letterSpacing: 0.2,
	},
	timeValueInline: {
		fontSize: 16,
		fontWeight: '600',
	},
});
