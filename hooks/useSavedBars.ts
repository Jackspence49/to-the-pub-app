// hooks/useSavedBars.ts
// Manages persisting recently visited bars to AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { searchBar } from '../types/index';
import { MAX_SAVED_BARS, SAVED_BARS_KEY } from '../utils/constants';

export const useSavedBars = () => {
	const [savedBars, setSavedBars] = useState<searchBar[]>([]);

	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				const stored = await AsyncStorage.getItem(SAVED_BARS_KEY);
				if (!mounted) return;
				if (stored) {
					const parsed = JSON.parse(stored);
					if (Array.isArray(parsed)) setSavedBars(parsed.slice(0, MAX_SAVED_BARS));
				}
			} catch {
				// Ignore corrupted storage
			}
		})();
		return () => {
			mounted = false;
		};
	}, []);

	const persist = useCallback(async (bars: searchBar[]) => {
		try {
			await AsyncStorage.setItem(SAVED_BARS_KEY, JSON.stringify(bars.slice(0, MAX_SAVED_BARS)));
		} catch {
			// Best effort; ignore persistence errors
		}
	}, []);

	const saveBar = useCallback(
		(bar: searchBar) => {
			setSavedBars((previous) => {
				const next = [bar, ...previous.filter((entry) => entry.id !== bar.id)].slice(0, MAX_SAVED_BARS);
				persist(next);
				return next;
			});
		},
		[persist]
	);

	const removeSavedBar = useCallback(
		(barId: string) => {
			setSavedBars((previous) => {
				const next = previous.filter((entry) => entry.id !== barId);
				persist(next);
				return next;
			});
		},
		[persist]
	);

	const clearSavedBars = useCallback(async () => {
		setSavedBars([]);
		try {
			await AsyncStorage.removeItem(SAVED_BARS_KEY);
		} catch {
			// Best effort
		}
	}, []);

	return { savedBars, saveBar, removeSavedBar, clearSavedBars };
};
