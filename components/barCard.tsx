// Individual bar display component

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import type { BarCardProps } from '../types';
import { formatDistanceLabel, openExternalLink } from '../utils/helpers';
import { formatClosingTimeLabel } from '../utils/Timeformatters';

export const BarCard = ({ bar, theme, onPress }: BarCardProps) => {
  const palette = Colors[theme];
  const cardTitle = palette.cardTitle;
  const cardSubtitle = palette.cardSubtitle;
  const cardText = palette.cardText;
  const cardSurface = palette.cardSurface;
  const cardBorder = palette.border;
  const pillBackground = palette.pillBackground;
  const pillBorder = palette.border;
  const pillText = palette.pillText;
  const iconSelected = palette.iconSelected;

  const distanceLabel = formatDistanceLabel(bar.distanceMiles);
  const addressLabel = bar.addressLabel ?? 'Location coming soon';
  const closingLabel = formatClosingTimeLabel(bar.closesToday);

  const detailParts: string[] = [];
  if (distanceLabel) {
    detailParts.push(distanceLabel);
  }
  if (closingLabel) {
    detailParts.push(`Closes ${closingLabel}`);
  }
  const detailLine = detailParts.join(' • ');

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardSurface, borderColor: cardBorder }]}
      activeOpacity={0.9}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.barName, { color: cardTitle }]} numberOfLines={1}>
          {bar.name}
        </Text>
      </View>

      <View>
        <Text style={[styles.addressText, { color: cardSubtitle }]} numberOfLines={2}>
          {addressLabel}
        </Text>
      </View>

      {detailLine ? (
        <View style={styles.distanceDetailRow}>
          <MaterialIcons
            name="location-on"
            size={16}
            color={iconSelected}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.distanceDetail, { color: cardText }]}>{detailLine}</Text>
        </View>
      ) : null}

      {bar.tags.length > 0 ? (
        <View style={styles.tagList}>
          {bar.tags.slice(0, 4).map((tag) => (
            <View
              key={tag.id}
              style={[styles.tagPill, { backgroundColor: pillBackground, borderColor: pillBorder }]}
            >
              <Text style={[styles.tagText, { color: pillText }]} numberOfLines={1}>
                {tag.name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {(bar.instagram || bar.twitter || bar.facebook) && (
        <View style={styles.socialRow}>
          {bar.instagram ? (
            <TouchableOpacity
              onPress={() => openExternalLink(bar.instagram)}
              style={[styles.socialButton, { borderColor: palette.pillBorder }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="instagram" size={16} color={palette.pillText} />
            </TouchableOpacity>
          ) : null}
          {bar.twitter ? (
            <TouchableOpacity
              onPress={() => openExternalLink(bar.twitter)}
              style={[styles.socialButton, { borderColor: palette.pillBorder }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="twitter" size={16} color={palette.pillText} />
            </TouchableOpacity>
          ) : null}
          {bar.facebook ? (
            <TouchableOpacity
              onPress={() => openExternalLink(bar.facebook)}
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
  barName: {
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