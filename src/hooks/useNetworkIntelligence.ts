import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { IpNetworkIntelligence } from '../types';

export interface NetworkTelemetryHookResult {
  networkInfo: IpNetworkIntelligence | null;
  isLoading: boolean;
  error: string | null;
  customWifiName: string;
  setCustomWifiName: (name: string) => void;
  refreshNetworkIntelligence: () => Promise<void>;
  browserConnection: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
}

export function useNetworkIntelligence(): NetworkTelemetryHookResult {
  const [networkInfo, setNetworkInfo] = useState<IpNetworkIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [customWifiName, setCustomWifiNameState] = useState<string>(() => {
    return localStorage.getItem('vault_custom_wifi') || '';
  });

  const [browserConnection, setBrowserConnection] = useState<{
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  }>({});

  const setCustomWifiName = useCallback((name: string) => {
    setCustomWifiNameState(name);
    if (name.trim()) {
      localStorage.setItem('vault_custom_wifi', name.trim());
    } else {
      localStorage.removeItem('vault_custom_wifi');
    }
  }, []);

  const refreshNetworkIntelligence = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getNetworkIntelligence();
      setNetworkInfo(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed retrieving network telemetry');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshNetworkIntelligence();

    // Check Navigator Connection API if supported
    const navConn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (navConn) {
      const updateConnInfo = () => {
        setBrowserConnection({
          effectiveType: navConn.effectiveType,
          downlink: navConn.downlink,
          rtt: navConn.rtt,
          saveData: navConn.saveData,
        });
      };
      updateConnInfo();
      navConn.addEventListener?.('change', updateConnInfo);
      return () => {
        navConn.removeEventListener?.('change', updateConnInfo);
      };
    }
  }, [refreshNetworkIntelligence]);

  return {
    networkInfo,
    isLoading,
    error,
    customWifiName,
    setCustomWifiName,
    refreshNetworkIntelligence,
    browserConnection,
  };
}
