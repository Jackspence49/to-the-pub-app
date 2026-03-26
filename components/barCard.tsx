// Import necessary modules and types
import { Colors } from '@/constants/theme';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import type { BarCardProps } from '../types';
import { formatCityAddress, formatDistanceLabel, openExternalLink } from '../utils/helpers';



export const BarCard = ({ Bar, onPress }: BarCardProps) => {
  const theme  = useColorScheme() ?? 'dark';
  const palette = Colors[theme];

  const distanceLabel = formatDistanceLabel(Bar.distance_miles);
  const addressLabel = formatCityAddress(Bar.address_city, Bar.address_state);
  const closingLabel = (() => {
    if (!Bar.closes_at) return null;
    const [h, m] = Bar.closes_at.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  })();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: palette.cardSurface, borderColor: palette.border }]}
      activeOpacity={0.9}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.BarName, { color: palette.cardTitle }]} numberOfLines={1}>
          {Bar.name}
        </Text>
      </View>

      <View>
        <Text style={[styles.addressText, { color: palette.cardSubtitle }]} numberOfLines={2}>
          {addressLabel}
        </Text>
      </View>

      {(distanceLabel || closingLabel) ? (
        <View style={styles.distanceDetailRow}>
          <MaterialIcons
            name="location-on"
            size={16}
            color={palette.iconSelected}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.distanceDetail, { color: palette.cardText }]}>
            {[distanceLabel, closingLabel ? `Closes ${closingLabel}` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ) : null}

      {Bar.tags.length > 0 ? (
        <View style={styles.tagList}>
          {Bar.tags.slice(0, 4).map((tag) => (
            <View
              key={tag.id}
              style={[styles.tagPill, { backgroundColor: palette.pillBackground, borderColor: palette.pillBorder }]}
            >
              <Text style={[styles.tagText, { color: palette.pillText }]} numberOfLines={1}>
                {tag.name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {(Bar.instagram || Bar.twitter || Bar.facebook) && (
        <View style={styles.socialRow}>
          {Bar.instagram ? (
            <TouchableOpacity
              onPress={() => openExternalLink(Bar.instagram)}
              style={[styles.socialButton, { borderColor: palette.pillBorder }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="instagram" size={16} color={palette.pillText} />
            </TouchableOpacity>
          ) : null}
          {Bar.twitter ? (
            <TouchableOpacity
              onPress={() => openExternalLink(Bar.twitter)}
              style={[styles.socialButton, { borderColor: palette.pillBorder }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="twitter" size={16} color={palette.pillText} />
            </TouchableOpacity>
          ) : null}
          {Bar.facebook ? (
            <TouchableOpacity
              onPress={() => openExternalLink(Bar.facebook)}
              style={[styles.socialButton, { borderColor: palette.pillBorder }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="facebook-square" size={16} color={palette.pillText} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default BarCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 20,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  BarName: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  addressText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 8,
  },
  distanceDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  distanceDetail: {
    fontSize: 14,
    fontWeight: '500',
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
});