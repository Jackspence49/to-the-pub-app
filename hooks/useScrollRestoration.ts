import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { FlatList, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';

export function useScrollRestoration<T>(itemCount: number) {
  const listRef = useRef<FlatList<T>>(null);
  const lastScrollOffsetRef = useRef(0);
  const restorePendingRef = useRef(false);

  const restoreScrollPosition = useCallback(() => {
    const offset = Math.max(0, lastScrollOffsetRef.current);
    if (listRef.current && offset > 0) {
      listRef.current.scrollToOffset({ offset, animated: false });
    }
  }, []);

  // Set restore-pending on focus and attempt after a short delay (handles animated tab transitions)
  useFocusEffect(
    useCallback(() => {
      restorePendingRef.current = true;
      const timer = setTimeout(() => {
        restoreScrollPosition();
        restorePendingRef.current = false;
      }, 50);
      return () => {
        clearTimeout(timer);
        restorePendingRef.current = true;
      };
    }, [restoreScrollPosition])
  );

  // Attempt restore once data has loaded if a restore is still pending
  useEffect(() => {
    if (restorePendingRef.current && itemCount > 0) {
      restoreScrollPosition();
      restorePendingRef.current = false;
    }
  }, [itemCount, restoreScrollPosition]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      lastScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
    },
    []
  );

  return { listRef, handleScroll };
}
