// hooks/useSearch.ts
// Manages search query state, debounced bar search, and results

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { searchBar } from '../types/index';
import { NORMALIZED_BASE_URL, SEARCH_DEBOUNCE_MS } from '../utils/constants';

export const useSearch = () => {
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<searchBar[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const trimmedQuery = query.trim();
	const canSearch = useMemo(() => trimmedQuery.length >= 2, [trimmedQuery]);

	const performSearch = useCallback(async (searchTerm: string, signal: AbortSignal, attempt = 0) => {
		if (!NORMALIZED_BASE_URL) {
			setError('Set EXPO_PUBLIC_API_URL to search for bars.');
			return;
		}
		try {
			setError(null);
			setIsLoading(true);
			const response = await fetch(
				`${NORMALIZED_BASE_URL}/bars/search/name?q=${encodeURIComponent(searchTerm)}`,
				{ signal }
			);
			if (!response.ok) throw new Error('Unable to search right now.');
			const payload = await response.json();
			const data = Array.isArray(payload?.data) ? payload.data : payload;
			setResults(
				Array.isArray(data)
					? data
						.filter((item) => item.id != null && String(item.id).trim() !== '')
						.map((item) => ({
							id: String(item.id),
							name: item.name ?? 'Unnamed bar',
							address_city: item.address_city ?? item.city ?? '',
							address_state: item.address_state ?? item.state ?? '',
						}))
					: []
			);
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') return;
			if (attempt < 1 && !signal.aborted) {
				await new Promise((res) => setTimeout(res, 1000));
				return performSearch(searchTerm, signal, attempt + 1);
			}
			setError(err instanceof Error ? err.message : 'Unexpected error occurred.');
		} finally {
			if (!signal.aborted) setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		const term = trimmedQuery;
		if (!term || term.length < 2) {
			setResults([]);
			setError(null);
			setIsLoading(false);
			return;
		}
		const controller = new AbortController();
		const timer = setTimeout(() => {
			performSearch(term, controller.signal);
		}, SEARCH_DEBOUNCE_MS);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [performSearch, trimmedQuery]);

	return { query, setQuery, results, isLoading, error, canSearch, effectiveQuery: trimmedQuery };
};
