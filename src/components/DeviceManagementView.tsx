import React, { useState, useEffect } from 'react';
import { api, getClientDeviceId } from '../lib/api';
import { RecognizedDevice } from '../types';
import {
  Laptop,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  Cpu,
  Monitor,
  Globe,
  Clock,
  Key,
  Layers,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface DeviceManagementViewProps {
  onNotify?: (msg: string, type?: 'info' | 'error') => void;
}

export const DeviceManagementView: React.FC<DeviceManagementViewProps> = ({ onNotify }) => {
  const [devices, setDevices] = useState<RecognizedDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const currentDeviceId = getClientDeviceId();

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const res = await api.getDevices();
      setDevices(res.devices || []);
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed loading devices', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleTrust = async (deviceId: string) => {
    setIsProcessing(deviceId);
    try {
      await api.trustDevice(deviceId);
      onNotify?.('Device marked as trusted', 'info');
      await loadDevices();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed trusting device', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleUntrust = async (deviceId: string) => {
    setIsProcessing(deviceId);
    try {
      await api.untrustDevice(deviceId);
      onNotify?.('Device trust revoked', 'info');
      await loadDevices();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed untrusting device', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRevoke = async (deviceId: string) => {
    if (!window.confirm('Are you sure you want to revoke this device? All its active sessions will be instantly terminated.')) {
      return;
    }
    setIsProcessing(deviceId);
    try {
      const res = await api.revokeDevice(deviceId);
      onNotify?.(`Device revoked. ${res.terminatedSessionsCount} active session(s) terminated.`, 'info');
      await loadDevices();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed revoking device', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleSaveLabel = async (deviceId: string) => {
    if (!editLabel.trim()) return;
    setIsProcessing(deviceId);
    try {
      await api.renameDevice(deviceId, editLabel.trim());
      onNotify?.('Device label updated', 'info');
      setEditingId(null);
      await loadDevices();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed updating device label', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  const trustedCount = devices.filter(d => d.trustStatus === 'trusted').length;
  const untrustedCount = devices.filter(d => d.trustStatus === 'untrusted').length;
  const revokedCount = devices.filter(d => d.trustStatus === 'revoked').length;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono mb-1">
            <span>TOTAL KNOWN DEVICES</span>
            <Laptop className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="text-2xl font-mono text-neutral-100 font-semibold">{devices.length}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Fingerprinted hardware profiles</div>
        </div>

        <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono mb-1">
            <span>TRUSTED DEVICES</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-mono text-emerald-400 font-semibold">{trustedCount}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Authorized for private vault</div>
        </div>

        <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono mb-1">
            <span>UNTRUSTED / PENDING</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-mono text-amber-400 font-semibold">{untrustedCount}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Requires manual trust approval</div>
        </div>

        <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono mb-1">
            <span>REVOKED ACCESS</span>
            <X className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-mono text-rose-400 font-semibold">{revokedCount}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Access permanently severed</div>
        </div>
      </div>

      {/* Main Device Management Table */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-neutral-400" />
              Device Recognition &amp; Trust Registry
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Cryptographically fingerprinted client hardware. Unrecognized or untrusted devices can be blocked.
            </p>
          </div>
          <button
            type="button"
            onClick={loadDevices}
            disabled={isLoading}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {isLoading && devices.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 font-mono text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-neutral-500" />
            Scanning device database...
          </div>
        ) : devices.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 font-mono text-xs">
            No devices currently registered.
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/80">
            {devices.map((device) => {
              const isCurrent = device.deviceId === currentDeviceId;
              const isEditing = editingId === device.deviceId;

              return (
                <div
                  key={device.deviceId}
                  className={`p-4 transition-colors ${
                    isCurrent ? 'bg-neutral-800/30' : 'hover:bg-neutral-800/20'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Device Label & Status */}
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {device.os?.toLowerCase().includes('android') || device.os?.toLowerCase().includes('ios') ? (
                          <Smartphone className="w-4 h-4 text-neutral-400 shrink-0" />
                        ) : (
                          <Laptop className="w-4 h-4 text-neutral-400 shrink-0" />
                        )}

                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              className="px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-xs text-neutral-100 font-mono focus:outline-none focus:ring-1 focus:ring-neutral-400"
                              placeholder="e.g. Personal M3 Max"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveLabel(device.deviceId)}
                              className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-neutral-100 font-mono">
                              {device.customLabel || device.deviceLabel || 'Unnamed Device'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(device.deviceId);
                                setEditLabel(device.customLabel || device.deviceLabel || '');
                              }}
                              className="text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                              title="Rename device"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {isCurrent && (
                          <span className="px-2 py-0.5 bg-sky-950 text-sky-300 border border-sky-800 text-[10px] font-mono rounded">
                            CURRENT CLIENT
                          </span>
                        )}

                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono uppercase rounded border ${
                            device.trustStatus === 'trusted'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                              : device.trustStatus === 'untrusted'
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                              : 'bg-rose-950/60 text-rose-300 border-rose-800'
                          }`}
                        >
                          {device.trustStatus}
                        </span>
                      </div>

                      {/* Device Specs & Location */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400 font-mono pt-1">
                        <span>
                          {device.browser || 'Browser'} on {device.os || 'OS'}
                        </span>
                        {device.screenResolution && <span>• {device.screenResolution}</span>}
                        {device.hardwareConcurrency && (
                          <span>• {device.hardwareConcurrency} Cores</span>
                        )}
                        {device.lastIpAddress && <span>• IP: {device.lastIpAddress}</span>}
                        {device.lastLocation && (
                          <span>
                            • {device.lastLocation.city ? `${device.lastLocation.city}, ` : ''}
                            {device.lastLocation.country || ''}
                          </span>
                        )}
                      </div>

                      {/* WebGL GPU info if captured */}
                      {device.webglRenderer && (
                        <div className="text-[11px] text-neutral-500 font-mono flex items-center gap-1.5 pt-0.5">
                          <Cpu className="w-3 h-3 text-neutral-500 shrink-0" />
                          <span className="truncate">GPU: {device.webglRenderer}</span>
                        </div>
                      )}

                      {/* Fingerprint ID & Timing */}
                      <div className="flex flex-wrap items-center gap-x-4 text-[10px] text-neutral-500 font-mono pt-1">
                        <span>Fingerprint: {device.fingerprintHash?.substring(0, 16)}...</span>
                        <span>First seen: {new Date(device.firstSeenAt).toLocaleString()}</span>
                        <span>Last seen: {new Date(device.lastSeenAt).toLocaleString()}</span>
                        <span>Total logins: {device.loginCount}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {device.trustStatus !== 'trusted' && (
                        <button
                          type="button"
                          onClick={() => handleTrust(device.deviceId)}
                          disabled={isProcessing === device.deviceId}
                          className="px-2.5 py-1 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-xs font-mono rounded transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Trust Device
                        </button>
                      )}

                      {device.trustStatus === 'trusted' && (
                        <button
                          type="button"
                          onClick={() => handleUntrust(device.deviceId)}
                          disabled={isProcessing === device.deviceId}
                          className="px-2.5 py-1 bg-amber-950/70 hover:bg-amber-900 border border-amber-800 text-amber-300 text-xs font-mono rounded transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Untrust
                        </button>
                      )}

                      {device.trustStatus !== 'revoked' && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(device.deviceId)}
                          disabled={isProcessing === device.deviceId}
                          className="px-2.5 py-1 bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-mono rounded transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Revoke Access
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
