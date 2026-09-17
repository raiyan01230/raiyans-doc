import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { IpNetworkIntelligence, SecurityPolicyConfig } from '../types';
import { useNetworkIntelligence } from '../hooks/useNetworkIntelligence';
import {
  Globe,
  Wifi,
  Shield,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Lock,
  MapPin,
  Save,
  Check,
  Server,
  AlertTriangle,
  Sliders,
  History,
} from 'lucide-react';

interface NetworkSecurityViewProps {
  onNotify?: (msg: string, type?: 'info' | 'error') => void;
}

export const NetworkSecurityView: React.FC<NetworkSecurityViewProps> = ({ onNotify }) => {
  const {
    networkInfo,
    isLoading: isNetworkLoading,
    customWifiName,
    setCustomWifiName,
    refreshNetworkIntelligence,
    browserConnection,
  } = useNetworkIntelligence();

  const [ipHistory, setIpHistory] = useState<any[]>([]);
  const [policy, setPolicy] = useState<SecurityPolicyConfig | null>(null);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(true);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [pendingPolicy, setPendingPolicy] = useState<Partial<SecurityPolicyConfig>>({});
  const [isEditingWifi, setIsEditingWifi] = useState(false);

  const loadPolicyAndHistory = async () => {
    setIsLoadingPolicy(true);
    try {
      const [histRes, polRes] = await Promise.all([
        api.getIpHistory().catch(() => ({ ipHistory: [] })),
        api.getSecurityPolicy(),
      ]);
      setIpHistory(histRes.ipHistory || []);
      setPolicy(polRes);
      setPendingPolicy(polRes);
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed loading policy data', 'error');
    } finally {
      setIsLoadingPolicy(false);
    }
  };

  useEffect(() => {
    loadPolicyAndHistory();
  }, []);

  const handleRefreshAll = async () => {
    await Promise.all([
      refreshNetworkIntelligence(),
      loadPolicyAndHistory(),
    ]);
    onNotify?.('Network intelligence telemetry refreshed', 'info');
  };

  const handleSavePolicy = async () => {
    setIsSavingPolicy(true);
    try {
      const res = await api.updateSecurityPolicy(pendingPolicy);
      setPolicy(res.policy);
      setPendingPolicy(res.policy);
      onNotify?.('Security policy updated successfully', 'info');
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed updating policy', 'error');
    } finally {
      setIsSavingPolicy(false);
    }
  };

  const handleTrustIp = async (ip: string, currentTrusted: boolean) => {
    try {
      const res = await api.trustIp(ip, !currentTrusted);
      onNotify?.(`IP ${ip} trust status set to ${res.isTrusted ? 'Trusted' : 'Untrusted'}`, 'info');
      await handleRefreshAll();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed updating IP trust', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Network Intelligence Header Card */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-800">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
              <Globe className="w-4 h-4 text-neutral-300" />
              Observed Ingress Network &amp; Host Intelligence
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Live telemetry captured directly from the current client socket connection.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isNetworkLoading}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isNetworkLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {networkInfo ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-neutral-950/80 p-3.5 rounded-lg border border-neutral-800 font-mono">
              <div className="text-[10px] uppercase text-neutral-500 mb-1 flex items-center gap-1">
                <Globe className="w-3 h-3 text-neutral-400" /> Public IP Address
              </div>
              <div className="text-sm font-semibold text-neutral-100 truncate">
                {networkInfo.ip}
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">
                Family: {networkInfo.ipFamily} • Timezone: {networkInfo.timezone || 'UTC'}
              </div>
            </div>

            <div className="bg-neutral-950/80 p-3.5 rounded-lg border border-neutral-800 font-mono">
              <div className="text-[10px] uppercase text-neutral-500 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-neutral-400" /> ISP &amp; Wi-Fi Name
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingWifi(!isEditingWifi)}
                  className="text-[10px] text-neutral-400 hover:text-neutral-200 underline cursor-pointer"
                >
                  {isEditingWifi ? 'Done' : 'Set Wi-Fi'}
                </button>
              </div>
              {isEditingWifi ? (
                <div className="mt-1 space-y-1">
                  <input
                    type="text"
                    value={customWifiName}
                    onChange={(e) => {
                      setCustomWifiName(e.target.value);
                      localStorage.setItem('vault_custom_wifi', e.target.value);
                    }}
                    placeholder="Enter Wi-Fi name..."
                    className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-100 font-mono focus:outline-none focus:ring-1 focus:ring-neutral-400"
                  />
                  <div className="text-[9px] text-neutral-500 truncate">ISP: {networkInfo.isp}</div>
                </div>
              ) : (
                <>
                  <div className="text-sm font-semibold text-neutral-100 truncate">
                    {customWifiName ? `Wi-Fi: ${customWifiName}` : (networkInfo.isp || networkInfo.organization || 'Direct ISP')}
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-1">
                    ASN: {networkInfo.asn || 'Internal'} • Org: {networkInfo.organization || 'N/A'}
                  </div>
                </>
              )}
            </div>

            <div className="bg-neutral-950/80 p-3.5 rounded-lg border border-neutral-800 font-mono">
              <div className="text-[10px] uppercase text-neutral-500 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-neutral-400" /> Geographic Origin
              </div>
              <div className="text-sm font-semibold text-neutral-100 truncate">
                {networkInfo.city ? `${networkInfo.city}, ` : ''}{networkInfo.country || 'Unknown'}
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">
                {networkInfo.approxLatitude && networkInfo.approxLongitude
                  ? `${networkInfo.approxLatitude.toFixed(4)}, ${networkInfo.approxLongitude.toFixed(4)}`
                  : 'Coordinates pending'}
              </div>
            </div>

            <div className="bg-neutral-950/80 p-3.5 rounded-lg border border-neutral-800 font-mono">
              <div className="text-[10px] uppercase text-neutral-500 mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3 text-neutral-400" /> VPN / Proxy Inspection
              </div>
              <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  networkInfo.vpn?.status === 'Detected' ? 'bg-rose-500' : 'bg-emerald-500'
                }`}></span>
                <span className={networkInfo.vpn?.status === 'Detected' ? 'text-rose-300' : 'text-emerald-300'}>
                  {networkInfo.vpn?.status === 'Detected' ? 'Anonymizer Active' : 'Direct Link Verified'}
                </span>
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">
                Conn: {networkInfo.connectionType || 'Broadband/Fiber'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center p-6 font-mono text-xs text-neutral-500">
            Observing incoming connection parameters...
          </div>
        )}
      </div>

      {/* Configurable Security Policy Panel */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-800">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-neutral-300" />
              Fail-Closed Security Policy &amp; Access Controls
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Enforce strict personal-vault perimeter security policies. Non-compliant connections will be rejected.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSavePolicy}
            disabled={isSavingPolicy}
            className="px-3.5 py-1.5 bg-neutral-100 hover:bg-white text-neutral-950 font-medium rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSavingPolicy ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Apply Policy</span>
          </button>
        </div>

        {policy && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Require Exact Location */}
            <div className="bg-neutral-950/70 p-3.5 rounded-lg border border-neutral-800/80 flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-neutral-200 font-mono">
                  Mandatory Browser Geolocation (Fail-Closed)
                </div>
                <div className="text-[11px] text-neutral-400">
                  Deny access immediately if high-accuracy GPS browser location is not granted.
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(pendingPolicy.requireExactLocation)}
                onChange={(e) =>
                  setPendingPolicy((prev) => ({ ...prev, requireExactLocation: e.target.checked }))
                }
                className="mt-1 w-4 h-4 accent-neutral-200 cursor-pointer"
              />
            </div>

            {/* Strict Device Recognition */}
            <div className="bg-neutral-950/70 p-3.5 rounded-lg border border-neutral-800/80 flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-neutral-200 font-mono">
                  Strict Device Recognition &amp; Trust
                </div>
                <div className="text-[11px] text-neutral-400">
                  Require devices to be explicitly trusted before authorizing vault read/write operations.
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(pendingPolicy.strictDeviceRecognition)}
                onChange={(e) =>
                  setPendingPolicy((prev) => ({ ...prev, strictDeviceRecognition: e.target.checked }))
                }
                className="mt-1 w-4 h-4 accent-neutral-200 cursor-pointer"
              />
            </div>

            {/* Block Datacenter ASN */}
            <div className="bg-neutral-950/70 p-3.5 rounded-lg border border-neutral-800/80 flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-neutral-200 font-mono">
                  Block Datacenter &amp; Hosting ASNs
                </div>
                <div className="text-[11px] text-neutral-400">
                  Reject requests originating from AWS, GCP, DigitalOcean, Hetzner, etc.
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(pendingPolicy.blockDatacenterAsn)}
                onChange={(e) =>
                  setPendingPolicy((prev) => ({ ...prev, blockDatacenterAsn: e.target.checked }))
                }
                className="mt-1 w-4 h-4 accent-neutral-200 cursor-pointer"
              />
            </div>

            {/* Block VPN & Proxies */}
            <div className="bg-neutral-950/70 p-3.5 rounded-lg border border-neutral-800/80 flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-neutral-200 font-mono">
                  Block Commercial VPNs &amp; Proxies
                </div>
                <div className="text-[11px] text-neutral-400">
                  Enforce direct residential/cellular connection only.
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(pendingPolicy.blockVpnAndProxies)}
                onChange={(e) =>
                  setPendingPolicy((prev) => ({ ...prev, blockVpnAndProxies: e.target.checked }))
                }
                className="mt-1 w-4 h-4 accent-neutral-200 cursor-pointer"
              />
            </div>

            {/* Inactivity Timeout */}
            <div className="bg-neutral-950/70 p-3.5 rounded-lg border border-neutral-800/80 space-y-1.5 font-mono">
              <div className="text-xs font-semibold text-neutral-200">
                Session Inactivity Timeout (Minutes)
              </div>
              <div className="text-[11px] text-neutral-400">
                Automatically invalidate sessions idle longer than this duration.
              </div>
              <input
                type="number"
                min="5"
                max="1440"
                value={pendingPolicy.sessionInactivityTimeoutMinutes ?? 30}
                onChange={(e) =>
                  setPendingPolicy((prev) => ({
                    ...prev,
                    sessionInactivityTimeoutMinutes: Number(e.target.value),
                  }))
                }
                className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-100 font-mono focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
            </div>

            {/* Max Concurrent Sessions */}
            <div className="bg-neutral-950/70 p-3.5 rounded-lg border border-neutral-800/80 space-y-1.5 font-mono">
              <div className="text-xs font-semibold text-neutral-200">
                Max Concurrent Active Sessions
              </div>
              <div className="text-[11px] text-neutral-400">
                Upper limit on simultaneous authenticated devices.
              </div>
              <input
                type="number"
                min="1"
                max="10"
                value={pendingPolicy.maxActiveSessions ?? 3}
                onChange={(e) =>
                  setPendingPolicy((prev) => ({
                    ...prev,
                    maxActiveSessions: Number(e.target.value),
                  }))
                }
                className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-100 font-mono focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* Observed IP History Table */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
              <History className="w-4 h-4 text-neutral-400" />
              Observed IP History Registry
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Historical IP addresses observed contacting this personal vault.
            </p>
          </div>
        </div>

        {ipHistory.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 font-mono text-xs">
            No historical IP entries logged.
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/80">
            {ipHistory.map((item, idx) => (
              <div key={idx} className="p-3.5 hover:bg-neutral-800/20 transition-colors font-mono text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-200">{item.ipAddress}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase ${
                        item.isTrusted
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {item.isTrusted ? 'Trusted IP' : 'Observed'}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      {item.isp || 'ISP'} • {item.asn || 'ASN'} • {item.country || 'Origin'}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      Requests: {item.requestCount} • First: {new Date(item.firstSeenAt).toLocaleString()} • Last: {new Date(item.lastSeenAt).toLocaleString()}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTrustIp(item.ipAddress, item.isTrusted)}
                    className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-mono rounded self-start sm:self-center transition-colors cursor-pointer"
                  >
                    {item.isTrusted ? 'Revoke Trust' : 'Mark Trusted'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
