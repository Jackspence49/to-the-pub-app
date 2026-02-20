import { Stack, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	Keyboard,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ThemeName = keyof typeof Colors;

type BarSearchResult = {
	id: string;
	name: string;
	address_city?: string;
	address_state?: string;
	city?: string;
	state?: string;
};

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');
const SAVED_BARS_KEY = 'ttp-saved-bars';
const MAX_SAVED_BARS = 50;

export default function SearchScreen() {
	const colorScheme = useColorScheme();
	const theme = (colorScheme ?? 'light') as ThemeName;
	const palette = Colors[theme];
	const borderColor = palette.border;
	const router = useRouter();

	const [query, setQuery] = useState('');
	const [results, setResults] = useState<BarSearchResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [savedBars, setSavedBars] = useState<BarSearchResult[]>([]);

	const trimmedQuery = query.trim();
	const canSearch = useMemo(() => trimmedQuery.length >= 2, [trimmedQuery]);

	const persistSavedBars = useCallback(async (bars: BarSearchResult[]) => {
		try {
			await SecureStore.setItemAsync(SAVED_BARS_KEY, JSON.stringify(bars.slice(0, MAX_SAVED_BARS)));
		} catch {
			// Best effort; ignore persistence errors
		}
	}, []);

	const saveBar = useCallback(
		(bar: BarSearchResult) => {
			setSavedBars((previous) => {
				const next = [bar, ...previous.filter((entry) => entry.id !== bar.id)].slice(0, MAX_SAVED_BARS);
				persistSavedBars(next);
				return next;
			});
		},
		[persistSavedBars]
	);

	useEffect(() => {
		let mounted = true;

		(async () => {
			try {
				const storedBars = await SecureStore.getItemAsync(SAVED_BARS_KEY);
				if (!mounted) return;
				if (storedBars) {
					const parsedBars = JSON.parse(storedBars);
					if (Array.isArray(parsedBars)) {
						setSavedBars(parsedBars.slice(0, MAX_SAVED_BARS));
					}
				}
			} catch {
				// Ignore corrupted storage
			}
		})();

		return () => {
			mounted = false;
		};
	}, []);

	const performSearch = useCallback(
		async (searchTerm: string, signal: AbortSignal) => {
			if (!normalizedBaseUrl) {
				setError('Set EXPO_PUBLIC_API_URL to search for bars.');
				return;
			}
			try {
				setError(null);
				setIsLoading(true);
				const response = await fetch(
					`${normalizedBaseUrl}/bars/search/name?q=${encodeURIComponent(searchTerm)}`,
					{ signal }
				);
				if (!response.ok) {
					throw new Error('Unable to search right now.');
				}
				const payload = await response.json();
				const data: BarSearchResult[] = Array.isArray(payload?.data) ? payload.data : payload;
				setResults(
					Array.isArray(data)
						? data.map((item) => ({
							id: String(item.id ?? ''),
							name: item.name ?? 'Unnamed bar',
							address_city: item.address_city ?? item.city ?? '',
							address_state: item.address_state ?? item.state ?? '',
						}))
						: []
				);
			} catch (err) {
				if (err instanceof Error && err.name === 'AbortError') {
					return;
				}
				setError(err instanceof Error ? err.message : 'Unexpected error occurred.');
			} finally {
				setIsLoading(false);
			}
		},
		[]
	);

	useEffect(() => {
		const term = trimmedQuery;
		if (!term || term.length < 2) {
			setResults([]);
			setError(null);
			setIsLoading(false);
			return;
		}
		const controller = new AbortController();
		performSearch(term, controller.signal);
		return () => controller.abort();
	}, [performSearch, trimmedQuery]);

	const handlePressResult = useCallback(
		(bar: BarSearchResult) => {
			saveBar(bar);
			router.push({
				pathname: '/bar/[barId]',
				params: { barId: bar.id, barName: bar.name },
			});
		},
		[router, saveBar]
	);

	const renderResult = ({ item }: { item: BarSearchResult }) => {
		return (
			<TouchableOpacity
				style={[styles.resultCard, { backgroundColor: palette.cardSurface, borderColor }]}
				activeOpacity={0.85}
				onPress={() => handlePressResult(item)}
				accessibilityRole="button"
				accessibilityLabel={`Open ${item.name}`}
			>
				<Text style={[styles.resultName, { color: palette.cardTitle }]}>{item.name}</Text>
				<Text style={[styles.resultLocation, { color: palette.cardSubtitle }]}>
					{[item.address_city, item.address_state].filter(Boolean).join(', ') || 'Location coming soon'}
				</Text>
			</TouchableOpacity>
		);
	};

	const showRecentBars = !canSearch && savedBars.length > 0;
	const listData = showRecentBars ? savedBars : results;

	const helperText = useMemo(() => {
		if (showRecentBars) {
			return null;
		}
		if (!canSearch) {
			return 'Start typing to find a bar (min 2 characters).';
		}
		if (isLoading) {
			return 'Searching…';
		}
		if (error) {
			return error;
		}
		if (listData.length === 0) {
			return 'No bars found yet. Try another name?';
		}
		return null;
	}, [canSearch, error, isLoading, listData.length, showRecentBars]);

	return (
		<View style={[styles.container, { backgroundColor: palette.background }]}>
			<Stack.Screen options={{ title: 'Search', headerLargeTitle: false }} />
			<View style={styles.searchBarWrapper}>
				<TextInput
					placeholder="Search for a bar"
					placeholderTextColor={palette.cardSubtitle}
					style={[
						styles.searchInput,
						{ color: palette.cardTitle, borderColor, backgroundColor: palette.cardSurface },
					]}
					value={query}
					onChangeText={setQuery}
					autoCapitalize="none"
					autoCorrect={false}
					returnKeyType="search"
					onSubmitEditing={Keyboard.dismiss}
				/>
				{query ? (
					<TouchableOpacity
						onPress={() => setQuery('')}
						style={[styles.clearButton, { backgroundColor: palette.pillBackground, borderColor }]}
						accessibilityRole="button"
						accessibilityLabel="Clear search"
					>
						<Text style={{ color: palette.cardTitle, fontWeight: '600' }}>×</Text>
					</TouchableOpacity>
				) : null}
			</View>

			{showRecentBars ? (
				<View style={styles.sectionHeaderRow}>
					<Text style={[styles.sectionTitle, { color: palette.cardTitle }]}>Recent</Text>
				</View>
			) : null}

			{isLoading && results.length === 0 ? (
				<View style={styles.statusWrapper}>
					<ActivityIndicator color={palette.tint} />
				</View>
			) : null}

			<FlatList
				data={listData}
				keyExtractor={(item) => item.id}
				renderItem={renderResult}
				contentContainerStyle={styles.resultsList}
				keyboardShouldPersistTaps="handled"
				ListEmptyComponent={
					helperText ? (
						<View style={styles.statusWrapper}>
							<Text style={[styles.helperText, { color: palette.cardSubtitle }]}>{helperText}</Text>
						</View>
					) : null
				}
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
		paddingHorizontal: 0,
		paddingVertical: 24,
		gap: 0,
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
	resultCard: {
		borderWidth: 0,
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
