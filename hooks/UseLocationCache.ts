// Custom hook for managing location with caching
import * as Location from 'expo-location';
import { useCallback, useRef, useState } from 'react';
import type { Coordinates, LocationCache } from '../types/index';
import { DEFAULT_COORDS, LOCATION_CACHE_TTL_MS } from '../utils/constants';

// Hook to manage location with caching and permission handling
export const useLocationCache = () => {
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);
  const [locationDeniedPermanently, setLocationDeniedPermanently] = useState(false);
  
  const permissionStatusRef = useRef<Location.PermissionStatus | null>(null);
  const lastCoordsRef = useRef<LocationCache | null>(null);

  // Permission flow: ensureLocationPermission() checks the stored status first; 
  // If unknown, it reads foreground permission, short-circuits on granted,otherwise requests it. 
  // If the OS won’t allow more prompts, it flags locationDeniedPermanently and falls back to defaults.
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

  //Fetching: refreshUserLocation() calls ensureLocationPermission(), 
  //Then uses Location.getCurrentPositionAsync() with balanced accuracy to get lat/lon, 
  //stores them with a timestamp in lastCoordsRef, and updates userCoords state.
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

  // Caching: getCachedLocation() returns the last coords 
  // If they’re newer than LOCATION_CACHE_TTL_MS; otherwise null.
  const getCachedLocation = useCallback((): Coordinates | null => {
    const cached = lastCoordsRef.current;
    if (cached && Date.now() - cached.fetchedAt < LOCATION_CACHE_TTL_MS) {
      return cached.coords;
    }
    return null;
  }, []);

  // Main getter: getCurrentCoordinates() returns cached coords if fresh; else tries a fresh fetch; 
  // If that fails, returns the last known userCoords state or DEFAULT_COORDS as a final fallback.
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