import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, type ImageSourcePropType } from 'react-native';

import heroFallback from '@/assets/images/light_logo.png';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ThemeName } from '@/types';

type EventDetailsProps = {
	title?: string;
	description?: string;
	image?: ImageSourcePropType | null;
	dateLabel?: string;
	timeLabel?: string;
	locationLabel?: string;
	tagLabel?: string;
	recurrencePattern?: string;
	crossesMidnight?: boolean;
	onPressLocation?: () => void;
	barName?: string;
	onPressBarDetails?: () => void;
	actionButtons?: { key: string; iconName: React.ComponentProps<typeof FontAwesome>['name']; onPress: () => void }[];
	onPressViewBarEvents?: () => void;
	showActionSection?: boolean;
	barActionsEnabled?: boolean;
};

export default function EventDetails({
	title,
	description,
	image,
	dateLabel,
	timeLabel,
	locationLabel,
	tagLabel,
	recurrencePattern,
	crossesMidnight,
	onPressLocation,
	barName,
	onPressBarDetails,
	actionButtons,
	onPressViewBarEvents,
	showActionSection = true,
	barActionsEnabled = true,
}: EventDetailsProps) {
	const colorScheme = useColorScheme();
	const theme = (colorScheme ?? 'light') as ThemeName;
	const palette = Colors[theme];

	const source = image ?? heroFallback;
	const canPressBar = Boolean(barName && onPressBarDetails);
	const shouldShowActions = Boolean(showActionSection && actionButtons && actionButtons.length > 0);

	return (
		<View style={styles.stack}>
			<View style={[styles.card, { borderColor: palette.border }]}> 
				<Image source={source} style={styles.hero} resizeMode="cover" />
			</View>

			<View style={[styles.card, { backgroundColor: palette.cardSurface, borderColor: palette.border }]}> 
				<View style={styles.content}>
					{tagLabel ? (
						<View style={[styles.tagPill, { backgroundColor: palette.pillBackground, borderColor: palette.pillBorder }]}> 
							<Text style={[styles.tagText, { color: palette.pillText }]} numberOfLines={1}>
								{tagLabel}
							</Text>
						</View>
					) : null}

					{title ? (
						<Text style={[styles.title, { color: palette.cardTitle }]} numberOfLines={2}>
							{title}
						</Text>
					) : null}

					{description ? (
						<Text style={[styles.description, { color: palette.cardSubtitle }]} numberOfLines={3}>
							{description}
						</Text>
					) : null}
				</View>
			</View>

			<View style={[styles.card, { backgroundColor: palette.cardSurface, borderColor: palette.border }]}> 
				<View style={styles.content}>
					<Text style={[styles.title, { color: palette.cardTitle }]} numberOfLines={2}>
						Where & When
					</Text>
					<View style={styles.metaRow}>
						<Text style={[styles.metaLabel, { color: palette.cardTitle }]}>Date</Text>
						{dateLabel ? (
							<Text style={[styles.metaText, { color: palette.cardText }]} numberOfLines={1}>
								{dateLabel}
							</Text>
						) : null}
					</View>
					<View style={styles.metaRow}>
						<Text style={[styles.metaLabel, { color: palette.cardTitle }]}>Time</Text>
						{timeLabel ? (
							<Text style={[styles.metaText, { color: palette.cardText }]} numberOfLines={1}>
								{timeLabel}
							</Text>
						) : null}
					</View>
					<View style={styles.metaRow}>
						<Text style={[styles.metaLabel, { color: palette.cardTitle }]}>Location</Text>
						{locationLabel ? (
							<TouchableOpacity
								disabled={!onPressLocation}
								onPress={onPressLocation}
								activeOpacity={onPressLocation ? 0.8 : 1}
								accessibilityRole={onPressLocation ? 'button' : undefined}
								accessibilityLabel={onPressLocation ? `View ${locationLabel} details` : undefined}
							>
								<Text
									style={[styles.metaText, onPressLocation ? styles.metaLink : null, { color: palette.cardText }]}
									numberOfLines={1}
								>
									{locationLabel}
								</Text>
							</TouchableOpacity>
						) : null}
					</View>
					{recurrencePattern ? (
						<View style={styles.metaRow}>
							<Text style={[styles.metaLabel, { color: palette.cardTitle }]}>Recurring Event</Text>
							<Text style={[styles.metaText, { color: palette.cardText }]} numberOfLines={1}>
								{recurrencePattern}
							</Text>
						</View>
					) : null}
					{crossesMidnight ? (
						<Text style={[styles.metaFootnote, { color: palette.cardSubtitle }]}>Note: event crosses midnight</Text>
					) : null}
				</View>
			</View>

			{barName || shouldShowActions ? (
				<View style={[styles.card, styles.actionCard, { backgroundColor: palette.cardSurface, borderColor: palette.border }]}> 
					<Text style={[styles.title, { color: palette.cardTitle }]} numberOfLines={2}>
                        {'Contacts & Links'}
					</Text>

					{shouldShowActions ? (
						<View style={styles.actionList}>
							<View style={[styles.iconButtonRow, { borderColor: palette.border }]}> 
								{actionButtons?.map((button) => (
									<TouchableOpacity
										key={button.key}
										onPress={button.onPress}
										style={[styles.iconCircleButton, { borderColor: palette.tint }]}
										activeOpacity={0.85}
										accessibilityRole="button"
										accessibilityLabel={button.key}
									>
										<FontAwesome name={button.iconName} size={16} color={palette.tint} />
									</TouchableOpacity>
								))}
							</View>
						</View>
					) : null}
				</View>
			) : null}
            <View>      
                <TouchableOpacity
								onPress={barActionsEnabled ? onPressViewBarEvents : undefined}
								style={[styles.fullWidthButton, !barActionsEnabled && styles.fullWidthButtonDisabled, { backgroundColor: palette.tint }]}
								activeOpacity={0.9}
								disabled={!barActionsEnabled}
							>
								<Text style={styles.fullWidthButtonText}>See all upcoming events</Text>
				</TouchableOpacity>
            </View>
		</View>
	);
}

const styles = StyleSheet.create({
	stack: {
		gap: 16,
	},
	card: {
		borderRadius: 16,
		overflow: 'hidden',
		borderWidth: 1,
	},
	hero: {
		width: '100%',
		height: 220,
	},
	content: {
		padding: 16,
		gap: 8,
	},
	actionCard: {
		padding: 20,
		gap: 16,
	},
	tagPill: {
		alignSelf: 'flex-start',
		borderRadius: 999,
		borderWidth: 1,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	tagText: {
		fontSize: 12,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.3,
	},
	title: {
		fontSize: 20,
		fontWeight: '700',
	},
	description: {
		fontSize: 15,
		lineHeight: 20,
	},
	metaRow: {
		flexDirection: 'column',
		gap: 4,
		marginTop: 6,
	},
	metaLabel: {
		fontSize: 13,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.2,
	},
	metaText: {
		fontSize: 14,
		fontWeight: '600',
	},
	metaLink: {
		textDecorationLine: 'underline',
	},
	metaFootnote: {
		fontSize: 13,
		fontStyle: 'italic',
	},
	barLinkSection: {
		gap: 8,
	},
	barLinkButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 0,
		paddingVertical: 0,
		alignSelf: 'flex-start',
	},
	barLinkIcon: {
		marginRight: 8,
	},
	barLinkText: {
		fontSize: 19,
		fontWeight: '700',
	},
	actionList: {
		gap: 12,
	},
	iconButtonRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 12,
		padding: 4,
		borderWidth: 1,
		borderRadius: 14,
	},
	iconCircleButton: {
		width: 54,
		height: 54,
		borderRadius: 27,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
	},
	fullWidthButton: {
		marginTop: 8,
		borderRadius: 999,
		paddingVertical: 14,
		alignItems: 'center',
	},
	fullWidthButtonDisabled: {
		opacity: 0.5,
	},
	fullWidthButtonText: {
		fontSize: 15,
		fontWeight: '600',
		color: '#f8fafc',
	},
});