import { Colors } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';


import type { Event, EventTag } from '@/types/index';

export type EventCardTokens = {
	cardBackground: string;
	cardBorder: string;
	filterActivePill: string;
	filterTextActive: string;
	cardTitle: string;
	cardSubtitle: string;
	pillBackground: string;
	pillText: string;
	iconSelected: string;
};

export type EventCardProps = {
	event: Event;
	availableTags: EventTag[];
	distanceUnit?: string;
	onPress?: () => void;
};

const formatEventTime = (value?: string): string => {
	if (!value) {
		return 'Time TBD';
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return 'Time TBD';
	}

	return new Intl.DateTimeFormat('en-US', {
		hour: 'numeric',
		minute: '2-digit',
	}).format(date);
};

const formatDistance = (value: number | undefined, unit: string): string | null => {
	if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
		return null;
	}

	if (value < 0.1) {
		return `< 0.1 ${unit} away`;
	}

	const formatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: value < 10 ? 1 : 0,
	});

	return `${formatter.format(value)} ${unit} away`;
};

const resolveTagNames = (event: Event, availableTags: EventTag[]) => {
	const tagIds = Array.from(
		new Set([event.event_tag_id].filter(Boolean) as string[]),
	).slice(0, 3);

	return tagIds.map((tagId) => availableTags.find((tag) => tag.id === tagId)?.name || tagId);
};

const EventCard = ({ event, availableTags, distanceUnit = 'miles', onPress }: EventCardProps) => {
	const theme = useColorScheme() ?? 'dark';
	const palette = Colors[theme];
	const barName = event.bar_name;
	const startTimeLabel = formatEventTime(event.start_time);
	const endTimeLabel = formatEventTime(event.end_time);
	const distanceLabel = formatDistance(event.distanceMiles, distanceUnit);
    
	const tagsToRender = useMemo(() => resolveTagNames(event, availableTags), [availableTags, event]);
	const eventTagName = tagsToRender[0];

	return (
		<TouchableOpacity
			activeOpacity={0.92}
			disabled={!onPress}
			onPress={onPress}
			style={[
				styles.card,
				{
					backgroundColor: palette.background,
					borderColor: palette.border,
				},
			]}
		>
			<View style={[styles.cardBody, { backgroundColor: palette.cardSurface }]}>
				{eventTagName ? (
					<View
						style={[
							styles.eventTagPill,
							{
								backgroundColor: palette.filterActivePill,
							},
						]}
					>
						<Text style={[styles.eventTagLabel, { color: palette.filterTextActive }]}>{eventTagName}</Text>
					</View>
				) : null}
				<Text style={[styles.eventTitle, { color: palette.cardTitle }]}>{event.title}</Text>
				<View style={[styles.eventTitleDivider, { backgroundColor: palette.border }]} />
				<View style={styles.eventBarRow}>
					<MaterialIcons name="location-on" size={18} color={palette.iconSelected} style={styles.eventBarIcon} />
					<Text style={[styles.eventBarName, { color: palette.cardSubtitle }]}>{barName}</Text>
				</View>
				{distanceLabel ? (
					<View style={styles.metaRow}>
						<View
							style={[
								styles.distancePill,
								{
									backgroundColor: palette.pillBackground,
								},
							]}
						>
							<Text style={[styles.metaDistanceText, { color: palette.pillText }]}>{distanceLabel}</Text>
						</View>
					</View>
				) : null}
				<View style={styles.scheduleBlock}>
					<View style={styles.timeRowSimple}>
						<MaterialIcons name="schedule" size={18} color={palette.iconSelected} style={styles.timeIcon} />
						<View style={styles.timePair}>
							<Text style={[styles.timeLabelInline, { color: palette.cardSubtitle }]}>Start</Text>
							<Text style={[styles.timeValueInline, { color: palette.cardTitle }]}>{startTimeLabel}</Text>
						</View>
						<MaterialIcons name="arrow-forward" size={16} color={palette.cardSubtitle} style={styles.timeArrowIcon} />
						<View style={styles.timePair}>
							<Text style={[styles.timeLabelInline, { color: palette.cardSubtitle }]}>End</Text>
							<Text style={[styles.timeValueInline, { color: palette.cardTitle }]}>{endTimeLabel}</Text>
						</View>
					</View>
				</View>
			</View>
		</TouchableOpacity>
	);
};

export default EventCard;

const styles = StyleSheet.create({
	card: {
		marginHorizontal: 20,
		marginTop: 20,
		borderRadius: 18,
		overflow: 'hidden',
		borderWidth: 1,
		shadowOffset: { width: 0, height: 4 },
		elevation: 2,
	},
	cardBody: {
		padding: 18,
	},
	eventBarRow: {
		marginTop: 4,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	eventBarIcon: {
		opacity: 0.9,
	},
	eventBarName: {
		fontSize: 16,
		fontWeight: '600',
		letterSpacing: 0.25,
		textTransform: 'none',
	},
	eventTagPill: {
		alignSelf: 'flex-start',
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		marginBottom: 10,
	},
	eventTagLabel: {
		fontSize: 13,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.4,
	},
	eventTitle: {
		fontSize: 20,
		fontWeight: '700',
		marginTop: 2,
	},
	eventTitleDivider: {
		height: 1,
		marginTop: 20,
		marginBottom: 8,
		borderRadius: 999,
		width: '100%',
		alignSelf: 'stretch',
	},
	metaRow: {
		marginTop: 12,
		flexDirection: 'row',
		alignItems: 'center',
		flexWrap: 'wrap',
		gap: 8,
	},
	distancePill: {
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 4,
	},
	metaDistanceText: {
		fontSize: 13,
		fontWeight: '500',
	},
	scheduleBlock: {
		marginTop: 8,
		gap: 12,
	},
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
	timeIcon: {
		opacity: 0.85,
	},
	timeArrowIcon: {
		marginHorizontal: 2,
		opacity: 0.7,
	},
	timeLabelInline: {
		fontSize: 12,
		fontWeight: '600',
		letterSpacing: 0.2,
		textTransform: 'uppercase',
	},
	timeValueInline: {
		fontSize: 16,
		fontWeight: '700',
	},
});
