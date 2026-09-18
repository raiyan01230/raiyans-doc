import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  UserX,
  Globe,
  Smartphone,
  Key,
  Flag,
  History,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Search,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { api } from '../lib/api';
import { CentralBlockedOverview, BlockedAccountEntity } from '../types';
import { UnbanAccountModal } from './UnbanAccountModal';

interface CentralBlockedHubViewProps {
  initialTab?: string; // 'accounts' | 'ip' | 'devices' | 'sessions' | 'countries' | 'history'
  onNavigateToView?: (path: string) => void;
}

export const CentralBlockedHubView: React.FC<CentralBlockedHubViewProps> = ({
  initialTab = 'all',
  onNavigateToView,
}) => {
  const [overview, setOverview] = useState<CentralBlockedOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountToUnban, setSelectedAccountToUnban] = useState<BlockedAccountEntity | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const fetchBlockedData = async () => {
    setLoading(true);
    try {
      const data = await api.getCentralBlockedOverview();
      setOverview(data);
    } catch (err: any) {
      console.error('Fetch central blocked overview error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedData();
  }, []);

  const handleUnblockIp = async (ip: string) => {
    try {
      await api.unblockIpAddress(ip);
      setActionSuccessMsg(`IP Address ${ip} unblocked successfully.`);
      await fetchBlockedData();
    } catch (err: any) {
      console.error('Unblock IP error:', err);
    }
  };

  const handleRestoreDevice = async (deviceId: string) => {
    try {
      await api.restoreDeviceTrust(deviceId);
      setActionSuccessMsg(`Device hardware trust restored for ${deviceId}.`);
      await fetchBlockedData();
    } catch (err: any) {
      console.error('Restore device error:', err);
    }
  };

  const handleReleaseSession = async (sessionId: string) => {
    try {
      await api.releaseSessionQuarantine(sessionId);
      setActionSuccessMsg(`Session quarantine released for session ${sessionId}.`);
      await fetchBlockedData();
    } catch (err: any) {
      console.error('Release session error:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center font-mono text-xs text-neutral-400 flex flex-col items-center justify-center space-y-3">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        <span>LOADING CENTRAL BLOCKED MANAGEMENT HUB FROM SERVER...</span>
      </div>
    );
  }

  const counts = overview?.counts || {
    totalBlocked: 0,
    bannedAccounts: 0,
    blockedIps: 0,
    revokedDevices: 0,
    quarantinedSessions: 0,
    blockedCountries: 0,
  };

  return (
    <div className="space-y-6 font-sans text-neutral-200">
      {/* Top Banner & Stats Overview */}
      <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-mono font-bold text-base text-neutral-100 uppercase tracking-wider">
                CENTRAL BLOCKED & BAN MANAGEMENT HUB
              </h1>
              <p className="text-xs text-neutral-400 font-mono">
                Server-enforced access restriction console across accounts, IPs, devices, sessions, and countries.
              </p>
            </div>
          </div>

          <button
            onClick={fetchBlockedData}
            className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 hover:bg-neutral-800 rounded-lg text-neutral-300 font-mono text-xs flex items-center space-x-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>SYNC FROM SERVER</span>
          </button>
        </div>

        {/* Counter Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 font-mono text-xs">
          <div
            onClick={() => setActiveTab('all')}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              activeTab === 'all' ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-950/60 border-neutral-800 hover:bg-neutral-800/50'
            }`}
          >
            <span className="text-neutral-500 text-[10px] block">TOTAL RESTRICTED</span>
            <span className="font-bold text-base text-neutral-100">{counts.totalBlocked}</span>
          </div>

          <div
            onClick={() => setActiveTab('accounts')}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              activeTab === 'accounts' ? 'bg-red-500/20 border-red-500/40' : 'bg-neutral-950/60 border-neutral-800 hover:bg-neutral-800/50'
            }`}
          >
            <span className="text-red-400 text-[10px] block">BANNED ACCOUNTS</span>
            <span className="font-bold text-base text-red-400">{counts.bannedAccounts}</span>
          </div>

          <div
            onClick={() => setActiveTab('ip')}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              activeTab === 'ip' ? 'bg-purple-500/20 border-purple-500/40' : 'bg-neutral-950/60 border-neutral-800 hover:bg-neutral-800/50'
            }`}
          >
            <span className="text-purple-400 text-[10px] block">BLOCKED IPs</span>
            <span className="font-bold text-base text-purple-400">{counts.blockedIps}</span>
          </div>

          <div
            onClick={() => setActiveTab('devices')}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              activeTab === 'devices' ? 'bg-amber-500/20 border-amber-500/40' : 'bg-neutral-950/60 border-neutral-800 hover:bg-neutral-800/50'
            }`}
          >
            <span className="text-amber-400 text-[10px] block">REVOKED DEVICES</span>
            <span className="font-bold text-base text-amber-400">{counts.revokedDevices}</span>
          </div>

          <div
            onClick={() => setActiveTab('sessions')}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              activeTab === 'sessions' ? 'bg-cyan-500/20 border-cyan-500/40' : 'bg-neutral-950/60 border-neutral-800 hover:bg-neutral-800/50'
            }`}
          >
            <span className="text-cyan-400 text-[10px] block">QUARANTINED SESSIONS</span>
            <span className="font-bold text-base text-cyan-400">{counts.quarantinedSessions}</span>
          </div>

          <div
            onClick={() => setActiveTab('countries')}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              activeTab === 'countries' ? 'bg-blue-500/20 border-blue-500/40' : 'bg-neutral-950/60 border-neutral-800 hover:bg-neutral-800/50'
            }`}
          >
            <span className="text-blue-400 text-[10px] block">RESTRICTED COUNTRIES</span>
            <span className="font-bold text-base text-blue-400">{counts.blockedCountries}</span>
          </div>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionSuccessMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 font-mono text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-neutral-400 hover:text-neutral-200 text-[10px]">
            DISMISS
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-neutral-800 space-x-1 font-mono text-xs overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3.5 py-2 border-b-2 font-semibold transition-colors flex items-center space-x-1.5 shrink-0 ${
            activeTab === 'all' ? 'border-neutral-100 text-neutral-100' : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <span>ALL RESTRICTIONS</span>
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-3.5 py-2 border-b-2 font-semibold transition-colors flex items-center space-x-1.5 shrink-0 ${
            activeTab === 'accounts' ? 'border-red-500 text-red-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <UserX className="w-3.5 h-3.5" />
          <span>BLOCKED PEOPLE / ACCOUNTS ({overview?.blockedAccounts?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('ip')}
          className={`px-3.5 py-2 border-b-2 font-semibold transition-colors flex items-center space-x-1.5 shrink-0 ${
            activeTab === 'ip' ? 'border-purple-500 text-purple-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>BLOCKED IPs ({overview?.blockedIPs?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('devices')}
          className={`px-3.5 py-2 border-b-2 font-semibold transition-colors flex items-center space-x-1.5 shrink-0 ${
            activeTab === 'devices' ? 'border-amber-500 text-amber-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>BLOCKED DEVICES ({overview?.blockedDevices?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3.5 py-2 border-b-2 font-semibold transition-colors flex items-center space-x-1.5 shrink-0 ${
            activeTab === 'history' ? 'border-blue-500 text-blue-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>BLOCK HISTORY</span>
        </button>
      </div>

      {/* TAB CONTENT: ACCOUNTS */}
      {(activeTab === 'all' || activeTab === 'accounts') && (
        <div className="space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-neutral-300 uppercase tracking-wider text-xs flex items-center space-x-1.5">
              <UserX className="w-4 h-4 text-red-400" />
              <span>BLOCKED ACCOUNTS & PERSONS</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {overview?.blockedAccounts?.map((account) => (
              <div key={account.account_id} className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-neutral-100 text-sm">{account.display_name}</span>
                    <span className="text-neutral-400 text-xs">({account.email})</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${account.status === 'BANNED' ? 'bg-red-500/20 border border-red-500/40 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {account.status}
                  </span>
                </div>

                <p className="text-neutral-300 text-xs">Reason: <span className="text-neutral-400">{account.reason}</span></p>

                <div className="flex items-center justify-between text-[11px] text-neutral-500 border-t border-neutral-800/80 pt-2">
                  <span>Blocked by: {account.blocked_by} at {new Date(account.blocked_at).toLocaleString()}</span>
                  <div className="flex space-x-2">
                    {account.status === 'BANNED' && (
                      <button
                        onClick={() => setSelectedAccountToUnban(account)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold transition-colors flex items-center space-x-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>UNBAN ACCOUNT</span>
                      </button>
                    )}
                    {onNavigateToView && (
                      <button
                        onClick={() => onNavigateToView(`/security/restore/${account.user_id}`)}
                        className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded font-bold transition-colors flex items-center space-x-1"
                      >
                        <span>RESTORE WORKSPACE</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: IPs */}
      {(activeTab === 'all' || activeTab === 'ip') && (
        <div className="space-y-3 font-mono text-xs pt-4">
          <h2 className="font-bold text-neutral-300 uppercase tracking-wider text-xs flex items-center space-x-1.5">
            <Globe className="w-4 h-4 text-purple-400" />
            <span>BLOCKED IP ADDRESSES</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overview?.blockedIPs?.map((ip) => (
              <div key={ip.id} className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-300 text-sm">{ip.ip_address}</span>
                  <button
                    onClick={() => handleUnblockIp(ip.ip_address)}
                    className="px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded font-bold text-[10px]"
                  >
                    UNBLOCK IP
                  </button>
                </div>
                <p className="text-neutral-400 text-[11px]">{ip.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: HISTORY */}
      {(activeTab === 'history') && (
        <div className="space-y-3 font-mono text-xs">
          <h2 className="font-bold text-neutral-300 uppercase tracking-wider text-xs flex items-center space-x-1.5">
            <History className="w-4 h-4 text-blue-400" />
            <span>SECURITY AUDIT BLOCK HISTORY</span>
          </h2>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto p-3">
            <table className="w-full text-left">
              <thead>
                <tr className="text-neutral-500 text-[10px] border-b border-neutral-800 pb-2">
                  <th className="p-2">TIMESTAMP</th>
                  <th className="p-2">TYPE</th>
                  <th className="p-2">LABEL / ENTITY</th>
                  <th className="p-2">STATE CHANGE</th>
                  <th className="p-2">ACTOR</th>
                  <th className="p-2">REASON</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-[11px]">
                {overview?.blockHistory?.map((evt) => (
                  <tr key={evt.event_id}>
                    <td className="p-2 text-neutral-400">{new Date(evt.timestamp).toLocaleString()}</td>
                    <td className="p-2 font-bold text-purple-400">{evt.entity_type}</td>
                    <td className="p-2 text-neutral-200">{evt.entity_label}</td>
                    <td className="p-2">
                      <span className="text-red-400">{evt.previous_state}</span> → <span className="text-emerald-400 font-bold">{evt.new_state}</span>
                    </td>
                    <td className="p-2 text-neutral-400">{evt.actor}</td>
                    <td className="p-2 text-neutral-300 truncate max-w-[200px]">{evt.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unban Account Modal */}
      <UnbanAccountModal
        isOpen={Boolean(selectedAccountToUnban)}
        onClose={() => setSelectedAccountToUnban(null)}
        account={selectedAccountToUnban}
        onUnbanSuccess={() => {
          fetchBlockedData();
          setActionSuccessMsg(`ACCOUNT UNBANNED ON SERVER: ${selectedAccountToUnban?.email}`);
        }}
        onOpenRestoreView={(userId) => {
          if (onNavigateToView) onNavigateToView(`/security/restore/${userId}`);
        }}
      />
    </div>
  );
};
