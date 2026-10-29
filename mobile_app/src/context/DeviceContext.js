import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api } from '../api/client';

const DeviceContext = createContext(null);

export const DeviceProvider = ({ children }) => {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [appMode, setAppMode] = useState('master'); // 'master' (Main Controller) or 'sub' (Child / Sub-Device)
  const [subDeviceToken, setSubDeviceToken] = useState('');
  const [subDeviceName, setSubDeviceName] = useState('');
  const [subChildName, setSubChildName] = useState('');
  const [loadingDevices, setLoadingDevices] = useState(false);

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
  }, [selectedDeviceId]);

  useEffect(() => {
    if (appMode === 'master') {
      refreshDevices();
    }
  }, [appMode, refreshDevices]);

  const switchDevice = (id) => {
    setSelectedDeviceId(id);
  };

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) || devices[0] || null;

  return (
    <DeviceContext.Provider
      value={{
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

