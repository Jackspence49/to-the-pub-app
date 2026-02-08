// Custom hook for managing location with caching
import * as Location from 'expo-location';
import { useCallback, useRef, useState } from 'react';
import type { Coordinates, LocationCache } from '../types/index';
import { DEFAULT_COORDS, LOCATION_CACHE_TTL_MS } from '../utils/constants';

export const useLocationCache = () => {
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);
  const [locationDeniedPermanently, setLocationDeniedPermanently] = useState(false);
  
  const permissionStatusRef = useRef<Location.PermissionStatus | null>(null);
  const lastCoordsRef = useRef<LocationCache | null>(null);

  //Ensure location permission is granted
  const ensureLocationPermission = useCallback(async (): Promise<boolean> => {
    if (permissionStatusRef.current === 'granted') {
      return true;
    }
    
    const current = await Location.getForegroundPermissionsAsync();
    permissionStatusRef.current = current.status;
    
    if (current.status === 'granted') {
      setLocationDeniedPermanently(false);
      return true;
    }
    
    if (!current.canAskAgain) {
      setLocationDeniedPermanently(true);
      console.warn('Location permission permanently denied; using fallback coordinates.');
      return false;
    }
    
    const requested = await Location.requestForegroundPermissionsAsync();
    permissionStatusRef.current = requested.status;
    
    if (requested.status === 'granted') {
      setLocationDeniedPermanently(false);
      return true;
    }
    
    if (!requested.canAskAgain) {
      setLocationDeniedPermanently(true);
      console.warn('Location permission permanently denied; using fallback coordinates.');
    }
    
    return false;
  }, []);

  /**
   * Refresh user location with caching
   */
  const refreshUserLocation = useCallback(async (): Promise<Coordinates | null> => {
    try {
      const hasPermission = await ensureLocationPermission();
      if (!hasPermission) {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords: Coordinates = {
        lat: location.coords.latitude,
        lon: location.coords.longitude,
      };

      lastCoordsRef.current = {
        coords,
        fetchedAt: Date.now(),
      };

      setUserCoords(coords);
      return coords;
    } catch (err) {
      console.warn('Failed to get current position:', err);
      return null;
    }
  }, [ensureLocationPermission]);

  // Get cached location if still fresh
  const getCachedLocation = useCallback((): Coordinates | null => {
    const cached = lastCoordsRef.current;
    if (cached && Date.now() - cached.fetchedAt < LOCATION_CACHE_TTL_MS) {
      return cached.coords;
    }
    return null;
  }, []);

  // Get current coordinates (cached or fresh)
  const getCurrentCoordinates = useCallback(async (): Promise<Coordinates> => {
    const cached = getCachedLocation();
    if (cached) {
      return cached;
    }

    const fresh = await refreshUserLocation();
    return fresh ?? userCoords ?? DEFAULT_COORDS;
  }, [getCachedLocation, refreshUserLocation, userCoords]);

  return {
    userCoords,
    locationDeniedPermanently,
    ensureLocationPermission,
    refreshUserLocation,
    getCachedLocation,
    getCurrentCoordinates,
    permissionStatusRef,
    lastCoordsRef,
  };
};