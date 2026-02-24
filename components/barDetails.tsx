import { Colors } from '@/constants/theme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
	ActivityIndicator,
	Linking,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	useColorScheme,
	View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { HERO_MAP_DELTA } from '..//utils/constants';
import { Bar, BarHours } from '../types/index';



export type ContactAction = {
	key: string;
	iconName: React.ComponentProps<typeof FontAwesome>['name'];
	label?: string;
	onPress: () => void;
	accessibilityLabel: string;
};

type BarsProps = {
	bar: Bar | null;
	isLoading: boolean;
	error: string | null;
	onRetry: () => void;
	onViewUpcomingEvents: () => void;
	onPressOpenMap?: () => void;
};



const HERO_MAP_STYLE = [
	{ featureType: 'road.highway', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
	{ featureType: 'road.highway', elementType: 'labels', stylers: [{ visibility: 'off' }] },
	{ featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
	{ featureType: 'road.highway.controlled_access', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

const DAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ensureProtocol = (value: string) => (value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`);

const formatHourToken = (value?: string | null) => {
	if (!value || typeof value !== 'string') {
		return null;
	}
	const normalized = value.includes(':') ? value : `${value.padStart(2, '0')}:00`;
	const [hourPart, minutePart] = normalized.split(':');
	const date = new Date();
	date.setHours(Number(hourPart) || 0, Number(minutePart) || 0, 0, 0);
	return new Intl.DateTimeFormat('en-US', {
		hour: 'numeric',
		minute: '2-digit',
	}).format(date);
};

const buildAddressLabel = (bar?: Bar | null) => {
	if (!bar) {
		return null;
	}
	const segments = [bar.address_street, [bar.address_city, bar.address_state].filter(Boolean).join(', '), bar.address_zip]
		.map((segment) => segment?.trim())
		.filter((segment) => segment && segment.length > 0);
	return segments.length > 0 ? segments.join(' ') : null;
};

const computeCoordinates = (bar?: Bar | null) => {
	if (!bar?.latitude || !bar?.longitude) {
		return null;
	}
	const latitude = Number(bar.latitude);
	const longitude = Number(bar.longitude);
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		return null;
	}
	return { latitude, longitude };
};

const createHeroRegion = (coordinates: ReturnType<typeof computeCoordinates>): Region | null => {
	if (!coordinates) {
		return null;
	}
	return {
		latitude: coordinates.latitude,
		longitude: coordinates.longitude,
		latitudeDelta: HERO_MAP_DELTA.latitudeDelta,
		longitudeDelta: HERO_MAP_DELTA.longitudeDelta,
	};
};

const openExternal = async (url?: string) => {
	if (!url) {
		return;
	}
	try {
		await Linking.openURL(ensureProtocol(url));
	} catch (error) {
		console.warn('Unable to open URL', error);
	}
};

const openPhone = async (phone?: string) => {
	if (!phone) {
		return;
	}
	const digits = phone.replace(/[^0-9+]/g, '');
	if (!digits) {
		return;
	}
	try {
		await Linking.openURL(`tel:${digits}`);
	} catch (error) {
		console.warn('Unable to open dialer', error);
	}
};

const openMapsForAddress = async (address?: string) => {
	if (!address) {
		return;
	}
	const encoded = encodeURIComponent(address);
	const url = Platform.OS === 'ios'
		? `http://maps.apple.com/?q=${encoded}`
		: `https://www.google.com/maps/search/?api=1&query=${encoded}`;
	try {
		await Linking.openURL(url);
	} catch (error) {
		console.warn('Unable to open maps', error);
	}
};

const buildContactActions = (bar?: Bar | null): ContactAction[] => {
	if (!bar) {
		return [];
	}
	const actions: ContactAction[] = [];
	if (bar.website) {
		actions.push({
			key: 'website',
			iconName: 'globe',
			label: 'Website',
			onPress: () => openExternal(bar.website),
			accessibilityLabel: `Open ${bar.name} website`,
		});
	}
	if (bar.phone) {
		actions.push({
			key: 'phone',
			iconName: 'phone',
			label: 'Call',
			onPress: () => openPhone(bar.phone),
			accessibilityLabel: `Call ${bar.name}`,
		});
	}
	return actions;
};

const buildSocialActions = (bar?: Bar | null): ContactAction[] => {
	if (!bar) {
		return [];
	}
	const actions: ContactAction[] = [];
	if (bar.instagram) {
		actions.push({
			key: 'instagram',
			iconName: 'instagram',
			onPress: () => openExternal(bar.instagram),
			accessibilityLabel: `Open ${bar.name} Instagram`,
		});
	}
	if (bar.facebook) {
		actions.push({
			key: 'facebook',
			iconName: 'facebook',
			onPress: () => openExternal(bar.facebook),
			accessibilityLabel: `Open ${bar.name} Facebook`,
		});
	}
	if (bar.twitter) {
		actions.push({
			key: 'twitter',
			iconName: 'twitter',
			onPress: () => openExternal(bar.twitter),
			accessibilityLabel: `Open ${bar.name} Twitter`,
		});
	}
	return actions;
};

type GroupedHoursRow = {
	dayLabel: string;
	valueLabel: string;
	days: number[];
};

const createHourValueLabel = (hour: BarHours) => {
	if (hour.is_closed) {
		return 'Closed';
	}
	const openLabel = formatHourToken(hour.opens_at);
	const closeLabel = formatHourToken(hour.closes_at);
	if (openLabel && closeLabel) {
		return `${openLabel} - ${closeLabel}${hour.crosses_midnight ? ' *' : ''}`;
	}
	return 'Hours coming soon';
};

const buildDayLabel = (days: number[]) => {
	if (!days.length) {
		return '';
	}
	const sorted = [...new Set(days)].sort((a, b) => a - b);
	const ranges: { start: number; end: number }[] = [];
	let start = sorted[0];
	let prev = sorted[0];
	for (let i = 1; i < sorted.length; i += 1) {
		const current = sorted[i];
		const isConsecutive = current === prev + 1;
		if (!isConsecutive) {
			ranges.push({ start, end: prev });
			start = current;
		}
		prev = current;
	}
	ranges.push({ start, end: prev });

	if (ranges.length > 1 && ranges[0].start === 0 && ranges[ranges.length - 1].end === 6) {
		const mergedStart = ranges[ranges.length - 1].start;
		const mergedEnd = ranges[0].end;
		const middle = ranges.slice(1, ranges.length - 1);
		ranges.splice(0, ranges.length, { start: mergedStart, end: mergedEnd }, ...middle);
	}

	const formatRange = ({ start: rangeStart, end: rangeEnd }: { start: number; end: number }) => {
		if (rangeStart === rangeEnd) {
			return DAY_ABBREVIATIONS[rangeStart] ?? `Day ${rangeStart}`;
		}
		return `${DAY_ABBREVIATIONS[rangeStart] ?? `Day ${rangeStart}`} - ${DAY_ABBREVIATIONS[rangeEnd] ?? `Day ${rangeEnd}`}`;
	};

	return ranges.map(formatRange).join(', ');
};

const groupHoursBySchedule = (hours?: BarHours[]): GroupedHoursRow[] => {
	if (!hours || hours.length === 0) {
		return [];
	}
	const map = new Map<string, number[]>();
	hours.forEach((hour) => {
		const valueLabel = createHourValueLabel(hour);
		const existing = map.get(valueLabel) ?? [];
		map.set(valueLabel, [...existing, hour.day_of_week]);
	});
	return Array.from(map.entries())
		.map(([valueLabel, days]) => ({
			days: days.sort((a, b) => a - b),
			valueLabel,
			dayLabel: buildDayLabel(days),
		}))
		.sort((a, b) => (a.days[0] ?? 0) - (b.days[0] ?? 0));
};

export default function BarDetails({
	bar,
	isLoading,
	error,
	onRetry,
	onViewUpcomingEvents,
	onPressOpenMap,
}: BarsProps) {
	const theme = useColorScheme() ?? 'dark';
	const palette = Colors[theme];

	const styles = useMemo(() => createStyles(palette), [palette]);
	const addressLabel = useMemo(() => buildAddressLabel(bar), [bar]);
	const coordinates = useMemo(() => computeCoordinates(bar), [bar]);
	const heroRegion = useMemo<Region | null>(() => createHeroRegion(coordinates), [coordinates]);
	const groupedHours = useMemo(() => groupHoursBySchedule(bar?.hours), [bar?.hours]);
	const todayIndex = useMemo(() => new Date().getDay(), []);
	const contactActions = useMemo(() => buildContactActions(bar), [bar]);
	const socialActions = useMemo(() => buildSocialActions(bar), [bar]);
	const typeTags = useMemo(
		() => (bar?.tags ?? []).filter((tag) => (tag.category ?? '').toLowerCase() === 'type'),
		[bar?.tags],
	);
	const amenityTags = useMemo(
		() => (bar?.tags ?? []).filter((tag) => (tag.category ?? '').toLowerCase() === 'amenity'),
		[bar?.tags],
	);
	const handleOpenMap = useMemo(() => {
		if (onPressOpenMap) {
			return onPressOpenMap;
		}
		if (addressLabel) {
			return () => openMapsForAddress(addressLabel);
		}
		return null;
	}, [addressLabel, onPressOpenMap]);

	if (isLoading) {
		return (
			<View style={styles.centerContent}>
				<ActivityIndicator color={palette.activePill} size="large" />
				<Text style={[styles.statusText, { color: palette.text }]}>Loading bar details...</Text>
			</View>
		);
	}

	if (error) {
		return (
			<View style={styles.centerContent}>
				<Text style={[styles.errorTitle, { color: palette.text }]}>Unable to load bar</Text>
				<Text style={[styles.errorDescription, { color: theme === 'light' ? '#4b5563' : '#94a3b8' }]}>{error}</Text>
				<TouchableOpacity style={[styles.retryButton, { borderColor: palette.activePill }]} onPress={onRetry}>
					<Text style={[styles.retryButtonText, { color: palette.activePill }]}>Try again</Text>
				</TouchableOpacity>
			</View>
		);
	}

	if (!bar) {
		return null;
	}

	return (
		<ScrollView
			style={styles.scrollView}
			contentContainerStyle={styles.scrollContent}
			contentInsetAdjustmentBehavior="never"
			showsVerticalScrollIndicator={false}
		>
				{/* Map */}
				{heroRegion && coordinates ? (
					<View style={styles.heroMapWrapper}>
						<MapView
							style={styles.heroMap}
							initialRegion={heroRegion}
							customMapStyle={HERO_MAP_STYLE}
							pointerEvents="none"
							scrollEnabled={false}
							zoomEnabled={false}
							rotateEnabled={false}
							pitchEnabled={false}
						>
							<Marker
								coordinate={coordinates}
								title={bar.name}
								description={addressLabel ?? undefined}
								pinColor={palette.actionButton}
								flat
							/>
						</MapView>
					</View>
				) : null}

			<View style={styles.pageContent}>
				{/* Bar Details */}
				<View style={styles.section}>
					{typeTags.length > 0 ? (
						<View style={styles.typeRow}>
							<Text style={[styles.typeValue, { color: palette.cardSubtitle }]}>{typeTags.map((tag) => tag.name).join(' · ')}</Text>
						</View>
					) : null}
					<Text style={[styles.eventTitle, { color: palette.cardTitle }]}>{bar.name}</Text>
					{bar.description ? (
						<Text style={[styles.sectionValue, { color: palette.cardSubtitle }]}>
							{bar.description}
						</Text>
					) : null}
					{amenityTags.length > 0 ? (
						<View style={styles.tagsBlock}>
							<View style={styles.tagContainer}>
								{amenityTags.map((tag) => (
									<View
										key={tag.id}
										style={[
											styles.tagPill,
											{ borderColor: palette.pillBorder, backgroundColor: palette.pillBackground },
										]}
									>
										<Text style={[styles.tagText, { color: palette.pillText }]}>{tag.name}</Text>
									</View>
								))}
							</View>
						</View>
					) : null}
				</View>

				{/* Address */}
				<View style={styles.section}>
					<Text style={[styles.sectionLabel, { color: palette.pillText }]}> 
						Location
					</Text>
					{addressLabel ? (
						<View style={styles.addressBlock}>
							<Text style={[styles.addressText, { color: palette.cardSubtitle }]}>
								{addressLabel}
							</Text>
						{handleOpenMap ? (
							<TouchableOpacity
								onPress={handleOpenMap}
								style={[styles.externalBtn, { backgroundColor: palette.actionButton }]}
								activeOpacity={0.9}
								accessibilityRole="button"
								accessibilityLabel="Get Directions"
							>
								<Text style={[styles.externalBtnText, { color: palette.filterTextActive }]}>Get Directions</Text>
							</TouchableOpacity>
						) : null}
							</View>
					) : null}
				</View>
					
				{/* Hours */}
				{groupedHours.length > 0 ? (
					<View style={[styles.section]}>
						<Text style={[styles.sectionLabel]}>Hours</Text>
						{groupedHours.map((hour) => {
							const isTodayRange = hour.days.includes(todayIndex);
							return (
								<View
									key={`${hour.dayLabel}-${hour.valueLabel}`}
									style={[styles.hourRow, isTodayRange && styles.hourRowToday]}
								>
									<Text style={[styles.hourDay, { color: palette.text }, isTodayRange && styles.hourTodayText]}>{hour.dayLabel}</Text>
									<Text style={[styles.hourValue, { color: palette.text }, isTodayRange && styles.hourTodayText]}>{hour.valueLabel}</Text>
								</View>
							);
						})}
					</View>
				) : null}

				{/* Contact */}
				{contactActions.length > 0 ? (
					<>
					<Text style={[styles.sectionLabel, { color: palette.pillText, marginTop: socialActions.length > 0 ? 12 : 0 }]}>Contact</Text>
					<View style={styles.contactList}>
						{contactActions.map((action) => (
							<TouchableOpacity
								key={action.key}
								onPress={action.onPress}
								accessibilityRole="button"
								accessibilityLabel={action.accessibilityLabel}
								style={[styles.contactActionButton, { borderColor: palette.pillBorder, backgroundColor: palette.pillBackground }]}
								activeOpacity={0.8}
							>
								<FontAwesome name={action.iconName} size={18} color={palette.pillText} />
								<Text style={[styles.contactActionText, { color: palette.filterText }]}>{action.label ?? action.key}</Text>
							</TouchableOpacity>
							))}
					</View>
					</>
				) : null}

				{/* Socials */}
				{socialActions.length > 0 ? (
					<View style={styles.section}>
						<Text style={[styles.sectionLabel, { color: palette.pillText }]}>Socials</Text>
						<View style={styles.contactRow}>
							{socialActions.map((action) => (
								<TouchableOpacity
									key={action.key}
									onPress={action.onPress}
									accessibilityRole="button"
									accessibilityLabel={action.accessibilityLabel}
									style={[styles.contactIconButton, { borderColor: palette.pillBorder, backgroundColor: palette.pillBackground }]}
									activeOpacity={0.8}
								>
									<FontAwesome name={action.iconName} size={18} color={palette.pillText} />
								</TouchableOpacity>
							))}
						</View>
					</View>
				) : null}
						

					{/* Upcoming Events */}
					<View style={styles.sectionEnd}> 
						<TouchableOpacity
							onPress={onViewUpcomingEvents}
							accessibilityRole="button"
							accessibilityLabel={`See upcoming events at ${bar.name}`}
							style={[styles.externalBtn, { backgroundColor: palette.actionButton }]}
							activeOpacity={0.85}
						>
							<Text style={[styles.externalBtnText, { color: palette.filterTextActive }]}>See upcoming events</Text>
						</TouchableOpacity>
					</View>
			</View>
			</ScrollView>
		);
	}

const createStyles = (palette: typeof Colors[keyof typeof Colors]) => StyleSheet.create({
	
	// ── Map
	heroMapWrapper: {
		width: '100%',
		height: 250,
		overflow: 'hidden',
	},
	heroMap: {
		width: '100%',
		height: '100%',
    	overflow: "hidden",
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
    fontWeight: "700",
    marginBottom: 6,
	color: palette.pillText,
  },
  sectionValue: {
    fontSize: 16,
    fontWeight: "400",
  },


//Bar Info
	typeValue: {
		fontSize: 16,
		fontWeight: '600',
		flexShrink: 1,
		textAlign: 'right',
		marginBottom: 4,
	},
	eventTitle: {
		 fontSize: 30,
		 fontWeight: "900",
		 marginBottom: 4,
	},
		 
// Address
	addressBlock: {
 marginTop: 6,
    gap: 8,
  },
  addressText: {
    fontSize: 16,
    marginBottom: 4,
  },
	pageContent: {
		paddingHorizontal: 20,
	},

	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingBottom: 40,
	},
	bodyContent: {
		width: '100%',
		paddingHorizontal: 20,
		gap: 20,
	},

	heroContent: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		paddingHorizontal: 20,
		paddingBottom: 60,
		paddingTop: 80,
		gap: 12,
	},
	heroTitle: {
		fontSize: 34,
		fontWeight: '800',
		color: '#ffffff',
	},
	heroSection: {
		gap: 12,
	},
	heroSectionOverlap: {
		marginTop: -48,
	},
	contactRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 12,
	},
	contactList: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 10,
	},
	heroAddressLabel: {
		fontSize: 12,
		fontWeight: '700',
		letterSpacing: 0.8,
		textTransform: 'uppercase',
		marginTop: 4,
	},
	heroAddressText: {
		fontSize: 15,
		lineHeight: 22,
		marginTop: 2,
	},
	eventsButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 999,
		borderWidth: 1,
		paddingHorizontal: 18,
		paddingVertical: 12,
		marginTop: 8,
	},
	eventsButtonText: {
		fontSize: 15,
		fontWeight: '600',
	},
	contactIconButton: {
		width: 48,
		height: 48,
		borderRadius: 999,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
	},
	contactActionButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 12,
		borderWidth: 1,
	},
	contactActionText: {
		fontSize: 15,
		fontWeight: '700',
	},
	contactIconButtonLight: {
		borderColor: 'rgba(15, 23, 42, 0.08)',
		backgroundColor: '#ffffff',
	},
	contactIconButtonDark: {
		borderColor: 'rgba(255, 255, 255, 0.16)',
		backgroundColor: '#0f172a',
	},
	barName: {
		fontSize: 28,
		fontWeight: '700',
	},
	barDescription: {
		fontSize: 16,
		lineHeight: 24,
	},
	card: {
		borderRadius: 16,
		padding: 16,
		gap: 12,
		borderWidth: 1,
	},
	cardLight: {
		backgroundColor: '#ffffff',
		borderColor: 'rgba(15, 23, 42, 0.08)',
		shadowColor: '#0f172a',
		shadowOpacity: 0.05,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 4 },
		elevation: 2,
	},
	cardDark: {
		backgroundColor: '#1b1f23',
		borderColor: 'rgba(255, 255, 255, 0.12)',
		shadowColor: '#000',
		shadowOpacity: 0.2,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 4 },
		elevation: 2,
	},
	cardLabel: {
		fontSize: 14,
		fontWeight: '600',
	},
	cardValue: {
		fontSize: 16,
		marginTop: 4,
	},
	typeRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
	},

	sectionHeading: {
		fontSize: 18,
		fontWeight: '600',
		marginBottom: 8,
	},
	tagsBlock: {
		marginTop: 12,
		gap: 8,
	},
	tagContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	tagPill: {
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 999,
		borderWidth: 1,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	tagText: {
		fontSize: 14,
		fontWeight: '600',
	},
	hourRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: 6,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: 'rgba(148, 163, 184, 0.3)',
		paddingHorizontal: 10,
		marginVertical: 2,
	},
	hourRowToday: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: 6,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: 'rgba(148, 163, 184, 0.3)',
		backgroundColor: 'rgba(148, 163, 184, 0.12)',
		borderRadius: 10,
		paddingHorizontal: 10,
		marginVertical: 2,
	},
	hourDay: {
		fontSize: 15,
		fontWeight: '600',
	},
	hourValue: {
		fontSize: 15,
	},
	hourTodayText: {
		fontWeight: '800',
	},
	hourFootnote: {
		marginTop: 8,
		fontSize: 13,
		fontStyle: 'italic',
	},
	centerContent: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 24,
		gap: 12,
	},
	statusText: {
		fontSize: 16,
	},
	errorTitle: {
		fontSize: 20,
		fontWeight: '700',
	},
	errorDescription: {
		textAlign: 'center',
		fontSize: 15,
	},
	retryButton: {
		marginTop: 8,
		borderWidth: 1,
		borderRadius: 999,
		paddingHorizontal: 20,
		paddingVertical: 10,
	},
	retryButtonText: {
		fontSize: 15,
		fontWeight: '600',
	},
	externalBtn: {
    	borderRadius: 12,
    	paddingVertical: 14,
    	alignItems: "center",
    	justifyContent: "center",
 	 },
  externalBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
