import { MaterialIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import {
	ActivityIndicator,
	FlatList,
	Keyboard,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
	useColorScheme,
	type ListRenderItem,
} from 'react-native';
import { Colors } from '../../constants/theme';

// Types
import type { searchBar } from '../../types/index';

// Utils
import { MAX_QUERY_LENGTH } from '../../utils/constants';

// Custom hooks
import { useSavedBars } from '../../hooks/useSavedBars';
import { useSearch } from '../../hooks/useSearch';

// Components
import { SearchResultCard } from '../../components/searchResultCard';

export default function SearchScreen() {
	const theme = useColorScheme() ?? 'dark';
	const palette = Colors[theme];
	const router = useRouter();

	const { query, setQuery, results, isLoading, error, canSearch } = useSearch();
	const { savedBars, saveBar, clearSavedBars } = useSavedBars();

	const handlePressResult = useCallback(
		(bar: searchBar) => {
			saveBar(bar);
			router.push({ pathname: '/bar/[barId]', params: { barId: bar.id, barName: bar.name } });
		},
		[router, saveBar]
	);

	const renderItem = useCallback<ListRenderItem<searchBar>>(
		({ item }) => <SearchResultCard bar={item} theme={theme} onPress={() => handlePressResult(item)} />,
		[handlePressResult, theme]
	);

	const showRecentBars = !canSearch && savedBars.length > 0;
	const listData = showRecentBars ? savedBars : results;

	const listEmptyComponent = useMemo(() => {
		if (showRecentBars || isLoading) return null;
		const text = !canSearch
			? 'Start typing to find a bar (min 2 characters).'
			: error ?? (listData.length === 0 ? 'No bars found yet. Try another name?' : null);
		if (!text) return null;
		return (
			<View style={styles.statusWrapper}>
				<Text style={[styles.helperText, { color: palette.cardSubtitle }]}>{text}</Text>
			</View>
		);
	}, [canSearch, error, isLoading, listData.length, showRecentBars, palette]);

	return (
		<View style={[styles.container, { backgroundColor: palette.background }]}>
			<Stack.Screen options={{ title: 'Search', headerLargeTitle: false }} />
			<View style={styles.searchBarWrapper}>
				<TextInput
					placeholder="Search for a bar"
					placeholderTextColor={palette.cardSubtitle}
					style={[
						styles.searchInput,
						{ color: palette.cardTitle, borderColor: palette.border, backgroundColor: palette.cardSurface },
					]}
					value={query}
					onChangeText={setQuery}
					autoCapitalize="none"
					autoCorrect={false}
					returnKeyType="search"
					onSubmitEditing={Keyboard.dismiss}
					maxLength={MAX_QUERY_LENGTH}
				/>
				{query ? (
					<TouchableOpacity
						onPress={() => setQuery('')}
						style={[styles.clearButton, { backgroundColor: palette.pillBackground, borderColor: palette.border }]}
						accessibilityRole="button"
						accessibilityLabel="Clear search"
					>
						<MaterialIcons name="close" size={16} color={palette.cardTitle} />
					</TouchableOpacity>
				) : null}
			</View>

			{showRecentBars ? (
				<View style={styles.sectionHeaderRow}>
					<Text style={[styles.sectionTitle, { color: palette.cardTitle }]}>Recent</Text>
					<TouchableOpacity
						onPress={clearSavedBars}
						accessibilityRole="button"
						accessibilityLabel="Clear recent bars"
					>
						<Text style={[styles.clearRecentText, { color: palette.cardSubtitle }]}>Clear</Text>
					</TouchableOpacity>
				</View>
			) : null}

			{isLoading && results.length === 0 ? (
				<View style={styles.statusWrapper}>
					<ActivityIndicator color={palette.actionButton} />
				</View>
			) : null}

			<FlatList
				data={listData}
				keyExtractor={(item) => item.id}
				renderItem={renderItem}
				contentContainerStyle={styles.resultsList}
				keyboardShouldPersistTaps="handled"
				ListEmptyComponent={listEmptyComponent}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	searchBarWrapper: {
		flexDirection: 'row',
		alignItems: 'center',
		marginHorizontal: 20,
		marginTop: 16,
	},
	searchInput: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 999,
		paddingVertical: 12,
		paddingHorizontal: 18,
		fontSize: 16,
	},
	clearButton: {
		marginLeft: 12,
		width: 36,
		height: 36,
		borderRadius: 999,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	statusWrapper: {
		paddingHorizontal: 24,
		paddingVertical: 32,
	},
	helperText: {
		textAlign: 'center',
		fontSize: 15,
	},
	resultsList: {
		paddingVertical: 24,
	},
	sectionHeaderRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginHorizontal: 20,
		marginTop: 12,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '700',
	},
	clearRecentText: {
		fontSize: 14,
	},
});
