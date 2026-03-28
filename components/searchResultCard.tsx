import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/theme';
import type { ThemeName, searchBar } from '../types/index';

type SearchResultCardProps = {
	bar: searchBar;
	theme: ThemeName;
	onPress: () => void;
};

export const SearchResultCard = ({ bar, theme, onPress }: SearchResultCardProps) => {
	const palette = Colors[theme];

	return (
		<TouchableOpacity
			style={[styles.resultCard, { backgroundColor: palette.cardSurface, borderColor: palette.border }]}
			activeOpacity={0.85}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`Open ${bar.name}`}
		>
			<Text style={[styles.resultName, { color: palette.cardTitle }]}>{bar.name}</Text>
			<Text style={[styles.resultLocation, { color: palette.cardSubtitle }]}>
				{[bar.address_city, bar.address_state].filter(Boolean).join(', ') || 'Location coming soon'}
			</Text>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	resultCard: {
		borderTopWidth: StyleSheet.hairlineWidth,
		borderRadius: 0,
		padding: 16,
		marginBottom: 0,
	},
	resultName: {
		fontSize: 17,
		fontWeight: '600',
	},
	resultLocation: {
		marginTop: 4,
		fontSize: 14,
	},
});
