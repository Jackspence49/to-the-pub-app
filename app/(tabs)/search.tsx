import { Stack, useRouter } from 'expo-router';
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

export default function SearchScreen() {
	const colorScheme = useColorScheme();
	const theme = (colorScheme ?? 'light') as ThemeName;
	const palette = Colors[theme];
	const borderColor = theme === 'light' ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.18)';
	const router = useRouter();

	const [query, setQuery] = useState('');
	const [results, setResults] = useState<BarSearchResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const canSearch = useMemo(() => query.trim().length >= 2, [query]);

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
		const term = query.trim();
		if (!term || term.length < 2) {
			setResults([]);
			setError(null);
			setIsLoading(false);
			return;
		}
		const controller = new AbortController();
		performSearch(term, controller.signal);
		return () => controller.abort();
	}, [performSearch, query]);

	const renderResult = ({ item }: { item: BarSearchResult }) => {
		return (
			<TouchableOpacity
				style={[
					styles.resultCard,
					theme === 'light' ? styles.resultCardLight : styles.resultCardDark,
					{ borderColor },
				]}
				activeOpacity={0.85}
				onPress={() =>
					router.push({
						pathname: '/bar/[barId]',
						params: { barId: item.id, barName: item.name },
					})
				}
				accessibilityRole="button"
				accessibilityLabel={`Open ${item.name}`}
			>
				<Text style={[styles.resultName, { color: palette.text }]}>{item.name}</Text>
				<Text style={[styles.resultLocation, { color: theme === 'light' ? '#475569' : '#cbd5f5' }]}>
					{[item.address_city, item.address_state].filter(Boolean).join(', ') || 'Location coming soon'}
				</Text>
			</TouchableOpacity>
		);
	};

	const helperText = useMemo(() => {
		if (!canSearch) {
			return 'Start typing to find a bar (min 2 characters).';
		}
		if (isLoading) {
			return 'Searching…';
		}
		if (error) {
			return error;
		}
		if (results.length === 0) {
			return 'No bars found yet. Try another name?';
		}
		return null;
	}, [canSearch, error, isLoading, results.length]);

	return (
		<View style={[styles.container, { backgroundColor: palette.background }]}
		>
			<Stack.Screen options={{ title: 'Search', headerLargeTitle: false }} />
			<View style={styles.searchBarWrapper}>
				<TextInput
					placeholder="Search for a bar"
					placeholderTextColor={theme === 'light' ? '#94a3b8' : '#64748b'}
					style={[styles.searchInput, { color: palette.text, borderColor }]}
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
						style={[styles.clearButton, { backgroundColor: theme === 'light' ? '#e2e8f0' : '#1e293b' }]}
						accessibilityRole="button"
						accessibilityLabel="Clear search"
					>
						<Text style={{ color: theme === 'light' ? '#0f172a' : '#e2e8f0', fontWeight: '600' }}>×</Text>
					</TouchableOpacity>
				) : null}
			</View>

			{isLoading && results.length === 0 ? (
				<View style={styles.statusWrapper}>
					<ActivityIndicator color={palette.tint} />
				</View>
			) : null}

			<FlatList
				data={results}
				keyExtractor={(item) => item.id}
				renderItem={renderResult}
				contentContainerStyle={styles.resultsList}
				keyboardShouldPersistTaps="handled"
				ListEmptyComponent={
					helperText ? (
						<View style={styles.statusWrapper}>
							<Text style={[styles.helperText, { color: theme === 'light' ? '#475569' : '#cbd5f5' }]}>{helperText}</Text>
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
		paddingHorizontal: 20,
		paddingVertical: 24,
		gap: 12,
	},
	resultCard: {
		borderWidth: 1,
		borderRadius: 16,
		padding: 16,
		marginBottom: 12,
	},
	resultCardLight: {
		backgroundColor: '#ffffff',
	},
	resultCardDark: {
		backgroundColor: '#111827',
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
