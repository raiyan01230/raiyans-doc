import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { AccountSecurityStatus, SecuritySession } from '../types';
import {
  Shield,
  Snowflake,
  Flame,
  AlertTriangle,
  Lock,
  Unlock,
  Key,
  Smartphone,
  RefreshCw,
  LogOut,
  Download,
  CheckCircle2,
} from 'lucide-react';

interface SecurityRecoveryViewProps {
  onNotify?: (msg: string, type?: 'info' | 'error') => void;
  onStatusChange?: (status: AccountSecurityStatus) => void;
}

export function SecurityRecoveryView({ onNotify, onStatusChange }: SecurityRecoveryViewProps) {
  const [securityStatus, setSecurityStatus] = useState<AccountSecurityStatus | null>(null);
  const [sessions, setSessions] = useState<SecuritySession[]>([]);
  const [loading, setLoading] = useState(true);

  // Freeze dialog state
  const [freezeReason, setFreezeReason] = useState('');
  const [isFreezing, setIsFreezing] = useState(false);

  // Unfreeze dialog state
  const [unfreezeCode, setUnfreezeCode] = useState('');
  const [isUnfreezing, setIsUnfreezing] = useState(false);

  // Recovery dialog state
  const [recoveryReason, setRecoveryReason] = useState('');
  const [isActivatingRecovery, setIsActivatingRecovery] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const [sec, sess] = await Promise.all([
        api.getSecurityStatus(),
        api.getSecuritySessions(),
      ]);
      setSecurityStatus(sec);
      setSessions(sess.sessions || []);
      onStatusChange?.(sec);
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed loading security status', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freezeReason.trim()) {
      onNotify?.('Please provide a reason for freezing the account', 'error');
      return;
    }

    setIsFreezing(true);
    try {
      const res = await api.freezeAccount(freezeReason.trim());
      setSecurityStatus(res.security);
      onStatusChange?.(res.security);
      onNotify?.('Account has been frozen. Modifying operations are now restricted.', 'info');
      setFreezeReason('');
      await loadStatus();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Freeze operation failed', 'error');
    } finally {
      setIsFreezing(false);
    }
  };

  const handleUnfreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUnfreezing(true);
    try {
      const res = await api.unfreezeAccount(unfreezeCode.trim());
      setSecurityStatus(res.security);
      onStatusChange?.(res.security);
      onNotify?.('Account unfrozen successfully. Full operational access restored.', 'info');
      setUnfreezeCode('');
      await loadStatus();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Unfreeze failed', 'error');
    } finally {
      setIsUnfreezing(false);
    }
  };

  const handleToggleRecovery = async () => {
    if (!securityStatus) return;
    setIsActivatingRecovery(true);
    try {
      if (securityStatus.is_recovery_mode) {
        const res = await api.deactivateRecoveryMode();
        setSecurityStatus(res.security);
        onStatusChange?.(res.security);
        onNotify?.('Recovery Mode deactivated. Standard operating profile active.', 'info');
      } else {
        const res = await api.activateRecoveryMode(recoveryReason.trim() || 'Manual emergency trigger');
        setSecurityStatus(res.security);
        onStatusChange?.(res.security);
        onNotify?.('Recovery Mode ACTIVATED. Emergency security toolkit unlocked.', 'info');
      }
      setRecoveryReason('');
      await loadStatus();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Recovery state update failed', 'error');
    } finally {
      setIsActivatingRecovery(false);
    }
  };

  const handleEmergencyAction = async (action: 'terminate_other_sessions' | 'emergency_backup') => {
    try {
      const res = await api.executeEmergencyAction(action);
      onNotify?.(res.message, 'info');
      await loadStatus();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Emergency action failed', 'error');
    }
  };

  const isFrozen = securityStatus?.is_frozen;
  const isRecovery = securityStatus?.is_recovery_mode;

  return (
    <div className="space-y-6">
      {/* Top Banner Status */}
      <div
        className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          isFrozen
            ? 'bg-blue-950/40 border-blue-800 text-blue-200'
            : isRecovery
            ? 'bg-amber-950/40 border-amber-800 text-amber-200'
            : 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-lg border ${
              isFrozen
                ? 'bg-blue-900/60 border-blue-700 text-blue-300'
                : isRecovery
                ? 'bg-amber-900/60 border-amber-700 text-amber-300 animate-pulse'
                : 'bg-emerald-900/60 border-emerald-700 text-emerald-300'
            }`}
          >
            {isFrozen ? (
              <Snowflake className="w-6 h-6" />
            ) : isRecovery ? (
              <Flame className="w-6 h-6" />
            ) : (
              <Shield className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="text-sm font-semibold font-mono uppercase tracking-wider flex items-center gap-2">
              <span>
                SYSTEM STATUS:{' '}
                {isFrozen ? 'ACCOUNT FROZEN' : isRecovery ? 'RECOVERY MODE ACTIVE' : 'SECURE & OPERATIONAL'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              {isFrozen
                ? `Read-only containment active: ${securityStatus?.freeze_reason || 'Administrative hold'}`
                : isRecovery
                ? 'Emergency incident protocol engaged. Access to emergency controls granted.'
                : 'All database vaults, file storage, and audit systems enforcing standard RLS.'}
            </p>
          </div>
        </div>

        <button
          onClick={loadStatus}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300 transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh State</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Freeze / Unfreeze Management */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Snowflake className="w-4 h-4 text-blue-400" />
              <span className="font-mono text-xs font-semibold text-neutral-100 uppercase">
                ACCOUNT FREEZE ENFORCEMENT
              </span>
            </div>
            <span
              className={`px-2 py-0.5 text-[10px] font-mono uppercase rounded border ${
                isFrozen
                  ? 'bg-blue-950 text-blue-300 border-blue-800'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}
            >
              {isFrozen ? 'Frozen' : 'Unfrozen'}
            </span>
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed">
            Freezing the account immediately enforces a server-side read-only state.
            Any attempts to create, update, or delete records, upload files, or alter credentials
            will be rejected by the server API.
          </p>

          {isFrozen ? (
            <div className="space-y-3 bg-blue-950/20 border border-blue-900/60 p-3 rounded-lg text-xs font-mono">
              <div className="text-neutral-400 text-[11px]">
                <span className="text-blue-300 font-semibold">Frozen At:</span>{' '}
                {securityStatus?.frozen_at ? new Date(securityStatus.frozen_at).toLocaleString() : 'N/A'}
              </div>
              <div className="text-neutral-400 text-[11px]">
                <span className="text-blue-300 font-semibold">Initiated By:</span>{' '}
                {securityStatus?.frozen_by || 'Admin'}
              </div>
              <div className="text-neutral-400 text-[11px]">
                <span className="text-blue-300 font-semibold">Reason:</span> {securityStatus?.freeze_reason}
              </div>

              <form onSubmit={handleUnfreeze} className="pt-2 space-y-2">
                <label className="text-[11px] text-neutral-300 block">
                  Enter Security Code to Unfreeze:
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Enter security code"
                    value={unfreezeCode}
                    onChange={e => setUnfreezeCode(e.target.value)}
                    className="flex-1 bg-neutral-950 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={isUnfreezing}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Unfreeze</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <form onSubmit={handleFreeze} className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-neutral-400 block mb-1">
                  Freeze Reason (Required for Audit Trail):
                </label>
                <input
                  type="text"
                  placeholder="e.g., Potential credential compromise detected"
                  value={freezeReason}
                  onChange={e => setFreezeReason(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 rounded-lg focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={isFreezing}
                className="w-full py-2 bg-blue-950/70 hover:bg-blue-900 border border-blue-800 text-blue-300 rounded-lg text-xs font-mono font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isFreezing ? 'Freezing Account...' : 'Freeze Account (Immediate Server Lock)'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Card 2: Recovery Mode & Emergency Toolkit */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="font-mono text-xs font-semibold text-neutral-100 uppercase">
                RECOVERY MODE CONTROLS
              </span>
            </div>
            <span
              className={`px-2 py-0.5 text-[10px] font-mono uppercase rounded border ${
                isRecovery
                  ? 'bg-amber-950 text-amber-300 border-amber-800'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}
            >
              {isRecovery ? 'ACTIVE' : 'STANDBY'}
            </span>
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed">
            Recovery mode is an emergency incident response state. When active, it unlocks
            administrative containment actions to isolate compromised sessions and safeguard vaults.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleRecovery}
              disabled={isActivatingRecovery}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 ${
                isRecovery
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
                  : 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{isRecovery ? 'Deactivate Recovery Mode' : 'Activate Recovery Mode'}</span>
            </button>
          </div>

          {isRecovery && (
            <div className="pt-2 border-t border-neutral-800/80 space-y-3">
              <span className="text-[11px] font-mono text-amber-300 uppercase tracking-wider block">
                Emergency Incident Toolkit:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => handleEmergencyAction('terminate_other_sessions')}
                  className="p-2.5 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 rounded-lg text-left text-xs font-mono text-neutral-300 flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-red-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-neutral-200">Revoke Other Sessions</div>
                    <div className="text-[10px] text-neutral-500">Kick all other connected devices</div>
                  </div>
                </button>

                <button
                  onClick={() => handleEmergencyAction('emergency_backup')}
                  className="p-2.5 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 rounded-lg text-left text-xs font-mono text-neutral-300 flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4 text-purple-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-neutral-200">Emergency Vault Backup</div>
                    <div className="text-[10px] text-neutral-500">Initiate verified SHA-256 pipeline</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Sessions List */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-neutral-400" />
            <span className="font-mono text-xs font-semibold text-neutral-100 uppercase">
              ACTIVE SESSIONS & CONNECTED CLIENTS ({sessions.length})
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {sessions.length === 0 ? (
            <div className="py-6 text-center text-xs font-mono text-neutral-500">
              No other active sessions detected.
            </div>
          ) : (
            sessions.map(sess => (
              <div
                key={sess.id}
                className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-neutral-900 rounded border border-neutral-800 text-neutral-400">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-200">{sess.device_summary}</span>
                      {sess.is_current && (
                        <span className="px-1.5 py-0.2 text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">
                          CURRENT SESSION
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-500 flex items-center gap-3 mt-0.5">
                      <span>IP: {sess.ip_address}</span>
                      <span>Connected: {new Date(sess.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-neutral-400">
                  Last Active: {new Date(sess.last_active_at).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
