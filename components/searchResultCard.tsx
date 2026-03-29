import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/theme';
import type { ThemeName, searchBar } from '../types/index';

type SearchResultCardProps = {
	bar: searchBar;
	theme: ThemeName;
	onPress: () => void;
	onRemove?: () => void;
};

export const SearchResultCard = ({ bar, theme, onPress, onRemove }: SearchResultCardProps) => {
	const palette = Colors[theme];

	return (
		<TouchableOpacity
			style={[styles.resultCard, { backgroundColor: palette.cardSurface, borderColor: palette.border }]}
			activeOpacity={0.85}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`Open ${bar.name}`}
		>
			<View style={styles.cardRow}>
				<View style={styles.cardText}>
					<Text style={[styles.resultName, { color: palette.cardTitle }]}>{bar.name}</Text>
					<Text style={[styles.resultLocation, { color: palette.cardSubtitle }]}>
						{[bar.address_city, bar.address_state].filter(Boolean).join(', ') || 'Location coming soon'}
					</Text>
				</View>
				{onRemove ? (
					<TouchableOpacity
						onPress={onRemove}
						hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
						accessibilityRole="button"
						accessibilityLabel={`Remove ${bar.name} from recents`}
					>
						<MaterialIcons name="close" size={18} color={palette.cardSubtitle} />
					</TouchableOpacity>
				) : null}
			</View>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	resultCard: {
		borderTopWidth: StyleSheet.hairlineWidth,
		borderRadius: 0,
		padding: 14,
		marginBottom: 0,
	},
	cardRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	cardText: {
		flex: 1,
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
