import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { locationApi, createLocationService, MAP_SORT_OPTIONS } from '@/api/location';
import { useAuth } from '@/lib/AuthContext';

const STORAGE_KEY = 'dashzw_delivery_location';

const LocationContext = createContext(null);

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStored(delivery) {
  if (delivery) localStorage.setItem(STORAGE_KEY, JSON.stringify(delivery));
  else localStorage.removeItem(STORAGE_KEY);
}

export function LocationProvider({ children }) {
  const { isAuthenticated, isGuest } = useAuth();
  const [delivery, setDeliveryState] = useState(() => loadStored());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [permission, setPermission] = useState('prompt');
  const [sort, setSort] = useState('nearest');
  const locationService = useMemo(() => createLocationService(locationApi), []);

  const setDelivery = useCallback((next) => {
    setDeliveryState(next);
    saveStored(next);
  }, []);

  const initLocation = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isAuthenticated && !isGuest) {
        const saved = await locationService.loadDefaultDelivery();
        if (saved?.lat) {
          setDelivery(saved);
          setLoading(false);
          return;
        }
      }

      const stored = loadStored();
      if (stored?.lat) {
        setDelivery(stored);
        setLoading(false);
        return;
      }

      const result = await locationService.detectAndSetDeliveryLocation({ saveAsDefault: isAuthenticated && !isGuest });
      setPermission(result.permission || 'prompt');
      if (result.ok) {
        setDelivery(result.delivery);
      } else if (result.reason === 'denied') {
        setError('Location permission denied — search for an address manually');
      } else {
        setError(result.reason || 'Could not detect location');
      }
    } catch (e) {
      setError(e.message || 'Location unavailable');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isGuest, locationService, setDelivery]);

  useEffect(() => {
    initLocation();
  }, [initLocation]);

  const refreshFromGps = useCallback(async () => {
    setLoading(true);
    try {
      const result = await locationService.detectAndSetDeliveryLocation({ saveAsDefault: isAuthenticated && !isGuest });
      if (result.ok) setDelivery(result.delivery);
      else setError(result.reason || 'GPS unavailable');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isGuest, locationService, setDelivery]);

  const selectAddress = useCallback((address) => {
    const formatted =
      address.formatted_address ||
      [address.street_address, address.suburb, address.city].filter(Boolean).join(', ');
    setDelivery({
      address_id: address.id,
      lat: address.lat,
      lng: address.lng,
      formatted_address: formatted,
      street_address: address.street_address,
      suburb: address.suburb,
      city: address.city,
      delivery_instructions: address.delivery_instructions,
      recipient_name: address.recipient_name,
      phone_number: address.phone_number,
      source: 'saved',
    });
  }, [setDelivery]);

  return (
    <LocationContext.Provider
      value={{
        delivery,
        setDelivery,
        selectAddress,
        loading,
        error,
        permission,
        sort,
        setSort,
        sortOptions: MAP_SORT_OPTIONS,
        refreshFromGps,
        initLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useDeliveryLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useDeliveryLocation must be used within LocationProvider');
  return ctx;
}
