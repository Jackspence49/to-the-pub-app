import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ThemeName } from '@/types';

type Palette = (typeof Colors)[ThemeName];

type EventDetailsProps = {
	title?: string;
	description?: string;
	image?: ImageSourcePropType | null;
	dateLabel?: string;
  startTimeLabel?: string;
  endTimeLabel?: string;
	locationLabel?: string;
  addressLabel?: string;
	tagLabel?: string;
	recurrencePattern?: string;
	crossesMidnight?: boolean;
	onPressLocation?: () => void;
  onPressOpenMap?: () => void;
	barName?: string;
	onPressBarDetails?: () => void;
  actionButtons?: {
    key: string;
    label: string;
    iconName: React.ComponentProps<typeof FontAwesome>['name'];
    onPress: () => void;
  }[];
	onPressViewBarEvents?: () => void;
	showActionSection?: boolean;
	barActionsEnabled?: boolean;
};

export default function EventDetails({
	title,
	description,
	dateLabel,
	locationLabel,
	tagLabel,
	recurrencePattern,
	onPressLocation,
	barName,
	onPressBarDetails,
	actionButtons,
	onPressViewBarEvents,
	showActionSection = true,
	barActionsEnabled = true,
  startTimeLabel,
  endTimeLabel,
  addressLabel,
  onPressOpenMap,
}: EventDetailsProps) {
	const colorScheme = useColorScheme();
	const theme = (colorScheme ?? 'light') as ThemeName;
  const palette = Colors[theme];
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(palette), [palette]);

  const heroTopPadding = Math.max(insets.top + 8, 20);
  const navBackGutter = 52; // keeps the pill visually aligned with the back arrow

  const startTimeDisplay = startTimeLabel ?? (endTimeLabel ? 'Start time TBD' : 'Time coming soon');
  const endTimeDisplay = endTimeLabel ?? (startTimeLabel ? 'End time TBD' : 'Time coming soon');

  const shouldShowActions = Boolean(showActionSection && actionButtons && actionButtons.length > 0);

	return (
    <View style={[{ backgroundColor: palette.background }]}>
      {/* Header */}
      <View style={styles.heroWrapper}>
    <View style={[styles.hero, { backgroundColor: palette.iconSelected, paddingTop: heroTopPadding }]}> 
        <View style={[styles.heroTopRow, { paddingLeft: navBackGutter }]}>
          <View style={[styles.tagPill, { backgroundColor: palette.pillBackground, borderColor: palette.pillBorder }]}> 
            <Text style={[styles.tagPillText, { color: palette.pillText }]}>
              {tagLabel}
            </Text>
          </View>
        </View>
          <Text style={[styles.eventTitle, { color: palette.cardTitle }]}> 
            {title}
          </Text>
        </View>
      </View>

			{/* Date */}
			<View style={[styles.section, { borderBottomColor: palette.border }]}>
				<Text style={[styles.sectionLabel, { color: palette.pillText }]}>
     				Date
    		</Text>
        <View style={styles.dateRow}>
          <IconSymbol name="calendar" size={24} color={palette.iconSelected} style={styles.icon} />
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
				<Text style={[styles.sectionLabel, { color: palette.pillText }]}>
     				Time
    		</Text>
				<View style={styles.timeRowSimple}>
					<MaterialIcons name="schedule" size={24} color={palette.iconSelected} style={styles.icon} />
						<View style={styles.timePair}>
							<Text style={[styles.timeLabelInline, { color: palette.cardSubtitle }]}>Start</Text>
              <Text style={[styles.timeValueInline, { color: palette.cardTitle }]}>{startTimeDisplay}</Text>
						</View>
						<MaterialIcons name="arrow-forward" size={16} color={palette.cardSubtitle} style={styles.timeArrowIcon} />
						<View style={styles.timePair}>
							<Text style={[styles.timeLabelInline, { color: palette.cardSubtitle }]}>End</Text>
              <Text style={[styles.timeValueInline, { color: palette.cardTitle }]}>{endTimeDisplay}</Text>
						</View>
					</View>
			</View>

      {/* Venue */}
      <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: palette.pillText }]}> 
                Venue
            </Text>
          {locationLabel ? (
            <TouchableOpacity
              style={styles.venueRow}
              disabled={!onPressLocation}
              onPress={onPressLocation}
              activeOpacity={onPressLocation ? 0.8 : 1}
              accessibilityRole={onPressLocation ? 'button' : undefined}
              accessibilityLabel={onPressLocation ? `View ${locationLabel} details` : undefined}
            >
              <MaterialIcons name="location-on" size={24} color={palette.iconSelected} style={styles.icon} />
              <View style={styles.venueTextBlock}>
                <Text
                  style={[styles.sectionValue, onPressLocation ? styles.barName : null, { color: palette.cardTitle }]}
                >
                  {locationLabel}
                </Text>
              </View>
          </TouchableOpacity>
          ) : null}
          {addressLabel ? (
            <View style={styles.addressBlock}>
              <Text style={[styles.addressText, { color: palette.cardSubtitle }]}>
                {addressLabel}
              </Text>
              {onPressOpenMap ? (
                <TouchableOpacity
                  onPress={onPressOpenMap}
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

      {/* Description */}
      {description ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.pillText }]}> 
       		 About
          </Text>
          <Text style={[styles.sectionValue, { color: palette.cardSubtitle }]}>
        			{description}
          </Text>
        </View>
      ) : null}


			{/* Contact */}
      {shouldShowActions ? (
        <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: palette.pillText }]}>
              Contact & Links
            </Text>
            <View style={styles.contactRow}>
                {actionButtons?.map((button) => (
                  <TouchableOpacity
                    key={button.key}
                    onPress={button.onPress}
                    style={[styles.contactButton, { borderColor: palette.pillBorder, backgroundColor: palette.pillBackground }]}
                    activeOpacity={0.85}
                    accessibilityRole="button"
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
            <View style={styles.section}>      
                <TouchableOpacity
					onPress={barActionsEnabled ? onPressViewBarEvents : undefined}
					style={[styles.externalBtn, { backgroundColor: palette.actionButton }]}
					activeOpacity={0.9}
					disabled={!barActionsEnabled}
				>
					<Text style={[styles.externalBtnText, { color: palette.filterTextActive }]}>See all upcoming events</Text>
				</TouchableOpacity>
            </View>
		</View>
	);
}


const createStyles = (palette: Palette) => StyleSheet.create({
  heroWrapper: {
    marginHorizontal: -20,
  },

  hero: {
    width: "100%",
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  heroTopRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingRight: 20,
  },
  tagPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 8,
	
  },
  tagPillText: {
    fontSize: 15,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  eventTitle: {
    fontSize: 40,
    fontWeight: "900",
  },

  // ── Body
  body: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  section: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  sectionLast: {
    paddingBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  sectionValue: {
    fontSize: 16,
    fontWeight: "400",
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateContent: {
    flexDirection: 'column',
    gap: 6,
  },

  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  venueTextBlock: {
    flex: 1,
  },

  addressBlock: {
    marginTop: 6,
    gap: 8,
  },

  // ── Recurrence badge
  recurrenceBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  recurrenceBadgeText: {
    fontSize: 16,
    fontWeight: "400",
  },

  // ── Venue
  barName: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,

  },
  addressText: {
    fontSize: 16,
    marginBottom: 4,
  },
  mapButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGoldText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  btnOutline: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  btnOutlineText: {
    color: "#a09080",
    fontSize: 13,
    fontWeight: "500",
  },

  // ── Contact cards
  contactRow: {
    flexDirection: "row",
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
    alignItems: "center",
    justifyContent: "center",
  },
  externalBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // ── Time row
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
	timeRow: {
		flexDirection: 'row',
		marginTop: 12,
		borderWidth: 1,
		borderColor: '#e5e7eb',
		borderRadius: 12,
		backgroundColor: '#f9fafb',
		overflow: 'hidden',
	},
	timeColumn: {
		flex: 1,
		paddingVertical: 12,
		paddingHorizontal: 14,
	},
	timeColumnRight: {
		borderLeftWidth: 1,
		borderLeftColor: '#e5e7eb',
	},
	timeLabel: {
		fontSize: 12,
		fontWeight: '600',
		color: '#6b7280',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	timeValue: {
		marginTop: 6,
		fontSize: 16,
		fontWeight: '600',
		color: '#111827',
	},
});