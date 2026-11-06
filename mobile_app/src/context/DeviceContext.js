import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

const STORAGE_APP_MODE = '@pst_app_mode';
const STORAGE_SUB_TOKEN = '@pst_sub_token';
const STORAGE_SUB_NAME = '@pst_sub_name';
const STORAGE_SUB_CHILD = '@pst_sub_child';
const STORAGE_SELECTED_DEV_ID = '@pst_selected_device_id';

const DeviceContext = createContext(null);

export const DeviceProvider = ({ children }) => {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState(null);
  const [appMode, setAppModeState] = useState(null); // 'master', 'sub', or null (unselected)
  const [isInitialized, setIsInitialized] = useState(false);

  const [subDeviceToken, setSubDeviceTokenState] = useState('');
  const [subDeviceName, setSubDeviceNameState] = useState('');
  const [subChildName, setSubChildNameState] = useState('');
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Restore persistent settings on mount
  useEffect(() => {
    let isMounted = true;
    const loadPersistedState = async () => {
      try {
        const values = await AsyncStorage.multiGet([
          STORAGE_APP_MODE,
          STORAGE_SUB_TOKEN,
          STORAGE_SUB_NAME,
          STORAGE_SUB_CHILD,
          STORAGE_SELECTED_DEV_ID,
        ]);

        const mode = values[0][1];
        const token = values[1][1];
        const name = values[2][1];
        const child = values[3][1];
        const devId = values[4][1];

        if (isMounted) {
          if (mode) setAppModeState(mode);
          if (token) setSubDeviceTokenState(token);
          if (name) setSubDeviceNameState(name);
          if (child) setSubChildNameState(child);
          if (devId) setSelectedDeviceIdState(parseInt(devId, 10));
        }
      } catch (err) {
        console.warn('[DeviceContext] Error reading storage:', err);
      } finally {
        if (isMounted) {
          setIsInitialized(true);
        }
      }
    };

    loadPersistedState();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update App Mode persistently
  const setAppMode = useCallback(async (mode) => {
    setAppModeState(mode);
    try {
      if (mode) {
        await AsyncStorage.setItem(STORAGE_APP_MODE, mode);
      } else {
        await AsyncStorage.removeItem(STORAGE_APP_MODE);
      }
    } catch (e) {
      console.warn('[DeviceContext] Error saving appMode:', e);
    }
  }, []);

  // Update Sub-Device Token persistently
  const setSubDeviceToken = useCallback(async (token) => {
    setSubDeviceTokenState(token || '');
    try {
      if (token) {
        await AsyncStorage.setItem(STORAGE_SUB_TOKEN, token);
      } else {
        await AsyncStorage.removeItem(STORAGE_SUB_TOKEN);
      }
    } catch (e) {
      console.warn('[DeviceContext] Error saving subDeviceToken:', e);
    }
  }, []);

  // Update Sub-Device Name persistently
  const setSubDeviceName = useCallback(async (name) => {
    setSubDeviceNameState(name || '');
    try {
      if (name) {
        await AsyncStorage.setItem(STORAGE_SUB_NAME, name);
      } else {
        await AsyncStorage.removeItem(STORAGE_SUB_NAME);
      }
    } catch (e) {
      console.warn('[DeviceContext] Error saving subDeviceName:', e);
    }
  }, []);

  // Update Sub-Child Name persistently
  const setSubChildName = useCallback(async (child) => {
    setSubChildNameState(child || '');
    try {
      if (child) {
        await AsyncStorage.setItem(STORAGE_SUB_CHILD, child);
      } else {
        await AsyncStorage.removeItem(STORAGE_SUB_CHILD);
      }
    } catch (e) {
      console.warn('[DeviceContext] Error saving subChildName:', e);
    }
  }, []);

  // Switch Selected Device persistently
  const switchDevice = useCallback(async (id) => {
    setSelectedDeviceIdState(id);
    try {
      if (id) {
        await AsyncStorage.setItem(STORAGE_SELECTED_DEV_ID, String(id));
      }
    } catch (e) {
      console.warn('[DeviceContext] Error saving selectedDeviceId:', e);
    }
  }, []);

  const setSelectedDeviceId = switchDevice;

  // Refresh devices list from backend (only when in master controller mode)
  const refreshDevices = useCallback(async () => {
    try {
      setLoadingDevices(true);
      const res = await api.getMyDevices();
      if (res?.devices) {
        setDevices(res.devices);
        if (!selectedDeviceId && res.devices.length > 0) {
          setSelectedDeviceId(res.devices[0].id);
        }
      }
    } catch (e) {
      console.log('[DeviceContext] Error fetching devices:', e.message);
    } finally {
      setLoadingDevices(false);
    }
  }, [selectedDeviceId, setSelectedDeviceId]);

  useEffect(() => {
    if (appMode === 'master') {
      refreshDevices();
    }
  }, [appMode, refreshDevices]);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) || devices[0] || null;

  return (
    <DeviceContext.Provider
      value={{
        isInitialized,
        devices,
        setDevices,
        selectedDeviceId,
        setSelectedDeviceId,
        selectedDevice,
        switchDevice,
        refreshDevices,
        loadingDevices,
        appMode,
        setAppMode,
        subDeviceToken,
        setSubDeviceToken,
        subDeviceName,
        setSubDeviceName,
        subChildName,
        setSubChildName,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevices = () => {
  const ctx = useContext(DeviceContext);
  if (!ctx) {
    throw new Error('useDevices must be used within a DeviceProvider');
  }
  return ctx;
};
