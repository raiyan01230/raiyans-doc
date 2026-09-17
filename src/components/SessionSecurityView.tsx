import React, { useState, useEffect } from 'react';
import { api, getCurrentSessionId } from '../lib/api';
import { ActiveSessionRecord } from '../types';
import {
  ShieldAlert,
  ShieldCheck,
  LogOut,
  RefreshCw,
  Clock,
  Globe,
  Laptop,
  AlertTriangle,
  Zap,
  MapPin,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface SessionSecurityViewProps {
  onNotify?: (msg: string, type?: 'info' | 'error') => void;
  onCurrentSessionTerminated?: () => void;
}

export const SessionSecurityView: React.FC<SessionSecurityViewProps> = ({
  onNotify,
  onCurrentSessionTerminated,
}) => {
  const [sessions, setSessions] = useState<ActiveSessionRecord[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const currentSessionId = getCurrentSessionId();

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const [sessRes, anomRes] = await Promise.all([
        api.getActiveSessions(),
        api.getSessionAnomalies().catch(() => ({ anomalies: [] })),
      ]);
      setSessions(sessRes.sessions || []);
      setAnomalies(anomRes.anomalies || []);
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed loading sessions', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleTerminateSession = async (sessionId: string) => {
    if (!window.confirm('Terminate this session immediately? The client will be disconnected.')) {
      return;
    }
    setIsProcessing(sessionId);
    try {
      await api.terminateSession(sessionId);
      onNotify?.('Session terminated', 'info');

      if (sessionId === currentSessionId) {
        onCurrentSessionTerminated?.();
      } else {
        await loadSessions();
      }
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed terminating session', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRevokeOthers = async () => {
    if (!window.confirm('Revoke all other active sessions? All other logged-in devices will be logged out.')) {
      return;
    }
    setIsProcessing('others');
    try {
      const res = await api.revokeAllOtherSessions();
      onNotify?.(`Revoked ${res.revokedCount} other active session(s).`, 'info');
      await loadSessions();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed revoking sessions', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono mb-1">
            <span>ACTIVE SESSIONS</span>
            <Zap className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="text-2xl font-mono text-neutral-100 font-semibold">{sessions.length}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Concurrently authenticated tokens</div>
        </div>

        <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono mb-1">
            <span>SESSION ANOMALIES</span>
            <ShieldAlert className={`w-4 h-4 ${anomalies.length > 0 ? 'text-amber-400' : 'text-emerald-500'}`} />
          </div>
          <div className={`text-2xl font-mono font-semibold ${anomalies.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {anomalies.length}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {anomalies.length > 0 ? 'Hijacking risk or IP drift detected' : 'No hijacking signals detected'}
          </div>
        </div>

        <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono mb-1">
            <span>EMERGENCY LOCKDOWN</span>
            <LogOut className="w-4 h-4 text-rose-500" />
          </div>
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={sessions.length <= 1 || isProcessing === 'others'}
            className="w-full mt-1.5 py-1 px-3 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-mono rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isProcessing === 'others' ? 'Revoking...' : 'Revoke All Other Sessions'}
          </button>
        </div>
      </div>

      {/* Hijacking / Anomalies Warning Banner */}
      {anomalies.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 font-mono text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>SESSION HIJACKING &amp; RUNTIME ANOMALY DETECTIONS ({anomalies.length})</span>
          </div>
          <div className="space-y-2">
            {anomalies.map((anom, idx) => (
              <div key={idx} className="bg-neutral-900/90 border border-amber-900/60 p-3 rounded-lg text-xs space-y-1">
                <div className="flex items-center justify-between font-mono">
                  <span className="font-semibold text-amber-200">{anom.type}</span>
                  <span className="text-[10px] text-neutral-400">{new Date(anom.detectedAt).toLocaleTimeString()}</span>
                </div>
                <p className="text-neutral-300 text-[11px]">{anom.description}</p>
                <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-3">
                  <span>Session: {anom.sessionId?.substring(0, 10)}...</span>
                  {anom.initialIp && <span>Initial IP: {anom.initialIp} &rarr; Current: {anom.currentIp}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Sessions List */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Active Authenticated Sessions
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Live sessions bound to cryptographically fingerprinted devices and IP signatures.
            </p>
          </div>
          <button
            type="button"
            onClick={loadSessions}
            disabled={isLoading}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {isLoading && sessions.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 font-mono text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-neutral-500" />
            Loading active sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 font-mono text-xs">
            No active sessions recorded.
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/80">
            {sessions.map((sess) => {
              const isCurrent = sess.sessionId === currentSessionId;
              const hasAnomaly = anomalies.some(a => a.sessionId === sess.sessionId);

              return (
                <div
                  key={sess.sessionId}
                  className={`p-4 transition-colors ${
                    isCurrent ? 'bg-neutral-800/30' : 'hover:bg-neutral-800/20'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Laptop className="w-4 h-4 text-neutral-400 shrink-0" />
                        <span className="text-sm font-medium text-neutral-100 font-mono">
                          {sess.deviceLabel || 'Authorized Device'}
                        </span>

                        {isCurrent && (
                          <span className="px-2 py-0.5 bg-sky-950 text-sky-300 border border-sky-800 text-[10px] font-mono rounded">
                            THIS DEVICE / CURRENT SESSION
                          </span>
                        )}

                        {hasAnomaly && (
                          <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-mono rounded">
                            ANOMALY DETECTED
                          </span>
                        )}

                        <span className="px-2 py-0.5 bg-emerald-950/60 text-emerald-300 border border-emerald-800 text-[10px] font-mono rounded">
                          ACTIVE
                        </span>
                      </div>

                      {/* Network & Device Details */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400 font-mono pt-1">
                        <span>IP: {sess.ipAddress}</span>
                        {sess.city && (
                          <span>
                            • Location: {sess.city}, {sess.country}
                          </span>
                        )}
                        {sess.coordinates && (
                          <span>
                            • Coordinates: {sess.coordinates.latitude}, {sess.coordinates.longitude} (±{sess.coordinates.accuracyMeters}m)
                          </span>
                        )}
                        <span>• Device ID: {sess.deviceId?.substring(0, 12)}...</span>
                      </div>

                      {/* Timestamps */}
                      <div className="flex flex-wrap items-center gap-x-4 text-[10px] text-neutral-500 font-mono pt-1">
                        <span>Logged in: {new Date(sess.createdAt).toLocaleString()}</span>
                        <span>Last active: {new Date(sess.lastActiveAt).toLocaleString()}</span>
                        <span>Expires: {new Date(sess.expiresAt).toLocaleString()}</span>
                        <span>Session ID: {sess.sessionId?.substring(0, 16)}...</span>
                      </div>
                    </div>

                    {/* Terminate Action */}
                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTerminateSession(sess.sessionId)}
                        disabled={isProcessing === sess.sessionId}
                        className="px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-mono rounded transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{isCurrent ? 'Log Out' : 'Terminate'}</span>
                      </button>
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
