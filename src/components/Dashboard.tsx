import React, { useState, useEffect, useCallback, useTransition } from 'react';
import {
  Search,
  Plus,
  Lock,
  LogOut,
  Pin,
  Calendar,
  Database,
  ShieldCheck,
  ChevronRight,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Edit3,
  Tag,
  AlertCircle,
  RefreshCw,
  FolderLock,
  Layers,
  Key,
  Activity,
  ShieldAlert,
  Ban,
  Gauge,
  Download,
  Snowflake,
  Flame,
  CheckCircle2,
  X,
  Laptop,
  Radio,
  Globe,
  Sliders,
  Mail,
} from 'lucide-react';
import { api, getClientDeviceId } from '../lib/api';
import { getSupabaseClient } from '../lib/supabase';
import {
  PrivateRecord,
  RecordCategory,
  RECORD_CATEGORIES,
  UserSession,
  ServerConfig,
  VaultStats,
  AccountSecurityStatus,
  SyncConflict,
} from '../types';
import { RecordModal } from './RecordModal';
import { RecordDetailModal } from './RecordDetailModal';
import { AuditMonitoringView } from './AuditMonitoringView';
import { SecurityRecoveryView } from './SecurityRecoveryView';
import { IpBlocklistView } from './IpBlocklistView';
import { StorageManagerView } from './StorageManagerView';
import { SystemHealthView } from './SystemHealthView';
import { BackupManagerView } from './BackupManagerView';
import { DeviceManagementView } from './DeviceManagementView';
import { SessionSecurityView } from './SessionSecurityView';
import { NetworkSecurityView } from './NetworkSecurityView';
import { SecurityEmailView } from './SecurityEmailView';
import { SyncConflictModal } from './SyncConflictModal';
import { IncidentInvestigationModal } from './IncidentInvestigationModal';
import { ActionConfirmationModal, ActionTargetPayload } from './ActionConfirmationModal';

interface DashboardProps {
  userSession: UserSession;
  serverConfig: ServerConfig | null;
  onLogout: () => void;
  onOpenSetupGuide: () => void;
}

type ActiveNavTab =
  | 'vault'
  | 'files'
  | 'devices'
  | 'sessions'
  | 'network'
  | 'audit'
  | 'security'
  | 'blocklist'
  | 'health'
  | 'backups'
  | 'email-security';

export const Dashboard: React.FC<DashboardProps> = ({
  userSession,
  serverConfig,
  onLogout,
  onOpenSetupGuide,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('vault');

  // Vault records state
  const [records, setRecords] = useState<PrivateRecord[]>([]);
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Security status & alerts state
  const [securityStatus, setSecurityStatus] = useState<AccountSecurityStatus | null>(null);
  const [anomalyCount, setAnomalyCount] = useState(0);

  // Real-time synchronization & conflict state
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [activeConflict, setActiveConflict] = useState<SyncConflict | null>(null);

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PrivateRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<PrivateRecord | null>(null);

  // Action & Incident route deep-linking state
  const [investigatingIncidentId, setInvestigatingIncidentId] = useState<string | null>(null);
  const [actionConfirmation, setActionConfirmation] = useState<ActionTargetPayload | null>(null);

  // Route path parser for direct deep links (e.g. /security/incidents/inc_123, /security/actions/freeze-session/ses_456)
  const parseCurrentPathRoute = useCallback(() => {
    const path = window.location.pathname;

    if (path.startsWith('/security/incidents/')) {
      const parts = path.split('/security/incidents/')[1].split('/');
      const incId = parts[0];
      if (incId) {
        setInvestigatingIncidentId(incId);
        setActiveTab('audit');
      }
    } else if (path.startsWith('/security/devices/')) {
      setActiveTab('devices');
    } else if (path.startsWith('/security/sessions/')) {
      setActiveTab('sessions');
    } else if (path.startsWith('/security/ip/')) {
      setActiveTab('blocklist');
    } else if (path.startsWith('/security/actions/freeze-session/')) {
      const sesId = path.split('/security/actions/freeze-session/')[1];
      setActionConfirmation({ type: 'freeze_session', targetId: sesId });
    } else if (path.startsWith('/security/actions/block-ip/')) {
      const ipId = path.split('/security/actions/block-ip/')[1];
      setActionConfirmation({ type: 'block_ip', targetId: ipId });
    } else if (path.startsWith('/security/actions/untrust-device/')) {
      const devId = path.split('/security/actions/untrust-device/')[1];
      setActionConfirmation({ type: 'untrust_device', targetId: devId });
    } else if (path === '/security/actions/freeze-account') {
      setActionConfirmation({ type: 'freeze_account' });
    } else if (path === '/security/actions/lockdown') {
      setActionConfirmation({ type: 'lockdown' });
    } else if (path === '/security/actions/revoke-all-sessions') {
      setActionConfirmation({ type: 'revoke_all_sessions' });
    } else if (path === '/security/email-alerts') {
      setActiveTab('email-security');
    } else if (path === '/security/monitoring') {
      setActiveTab('health');
    } else if (path === '/security/recovery') {
      setActiveTab('security');
    } else if (path === '/security/devices') {
      setActiveTab('devices');
    } else if (path === '/security/sessions') {
      setActiveTab('sessions');
    } else if (path === '/security/audit') {
      setActiveTab('audit');
    } else if (path === '/security') {
      setActiveTab('security');
    }
  }, []);

  useEffect(() => {
    parseCurrentPathRoute();
    window.addEventListener('popstate', parseCurrentPathRoute);
    return () => window.removeEventListener('popstate', parseCurrentPathRoute);
  }, [parseCurrentPathRoute]);

  // Quick action states
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'info' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Poll security status and active anomalies
  const refreshGlobalSecurityStatus = useCallback(async () => {
    try {
      const [sec, anom] = await Promise.all([
        api.getSecurityStatus(),
        api.getAnomalies(),
      ]);
      setSecurityStatus(sec);
      setAnomalyCount(anom.totalCount || 0);
    } catch {
      // Ignore background fetch error
    }
  }, []);

  useEffect(() => {
    refreshGlobalSecurityStatus();
    const interval = setInterval(refreshGlobalSecurityStatus, 15000);
    return () => clearInterval(interval);
  }, [refreshGlobalSecurityStatus]);

  // Real-Time SSE Stream across all connected devices
  useEffect(() => {
    if (!userSession.token) return;
    const deviceId = getClientDeviceId();
    const sseUrl = `/api/realtime/stream?token=${encodeURIComponent(
      userSession.token
    )}&deviceId=${encodeURIComponent(deviceId)}`;
    let es: EventSource | null = null;

    try {
      es = new EventSource(sseUrl);

      es.onopen = () => {
        setIsRealtimeConnected(true);
      };

      es.onerror = () => {
        setIsRealtimeConnected(false);
      };

      es.addEventListener('connected', () => {
        setIsRealtimeConnected(true);
      });

      es.addEventListener('heartbeat', () => {
        setIsRealtimeConnected(true);
      });

      es.addEventListener('record_created', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.record) {
            setRecords((prev) => {
              if (prev.some((r) => r.id === payload.record.id)) return prev;
              return [payload.record, ...prev];
            });
            showNotification(`Realtime sync: "${payload.record.title}" added`, 'info');
          }
        } catch {}
      });

      es.addEventListener('record_updated', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.record) {
            setRecords((prev) =>
              prev.map((r) => (r.id === payload.record.id ? payload.record : r))
            );
            setViewingRecord((prev) =>
              prev && prev.id === payload.record.id ? payload.record : prev
            );
          }
        } catch {}
      });

      es.addEventListener('record_deleted', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.id) {
            setRecords((prev) => prev.filter((r) => r.id !== payload.id));
            setViewingRecord((prev) => (prev && prev.id === payload.id ? null : prev));
          }
        } catch {}
      });

      es.addEventListener('sync_conflict', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          setActiveConflict(payload);
          showNotification(
            `Concurrent sync conflict detected on "${payload.serverRecord?.title || 'record'}"`,
            'error'
          );
        } catch {}
      });

      es.addEventListener('other_sessions_revoked', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const currentSessionId = localStorage.getItem('vault_session_id');
          if (payload.currentSessionId && payload.currentSessionId !== currentSessionId) {
            showNotification('Your session was revoked from another authorized device.', 'error');
            setTimeout(() => handleUserLogout(), 1500);
          }
        } catch {}
      });

      es.addEventListener('device_revoked', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.deviceId === deviceId) {
            showNotification('This device has been revoked by the vault owner.', 'error');
            setTimeout(() => handleUserLogout(), 1500);
          }
        } catch {}
      });
    } catch (err) {
      console.warn('EventSource initialization warning:', err);
    }

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [userSession.token]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setDebouncedQuery(searchQuery.trim());
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch records
  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let data: { records: PrivateRecord[] };
      if (debouncedQuery) {
        data = await api.searchRecords(debouncedQuery, selectedCategory);
      } else {
        data = await api.getRecords(selectedCategory);
      }
      setRecords(data.records);
      api.getStats().then(setStats).catch(() => {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to query private database.');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, selectedCategory]);

  useEffect(() => {
    if (activeTab === 'vault') {
      fetchRecords();
    }
  }, [fetchRecords, activeTab]);

  const handleCopyContent = (e: React.MouseEvent, record: PrivateRecord) => {
    e.stopPropagation();
    navigator.clipboard.writeText(record.content);
    setCopiedId(record.id);
    showNotification('Record content copied to clipboard', 'info');
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleToggleReveal = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveRecord = async (input: {
    title: string;
    category: RecordCategory;
    content: string;
    is_pinned?: boolean;
    tags?: string[];
  }) => {
    try {
      if (editingRecord) {
        const res = await api.updateRecord(editingRecord.id, input);
        setRecords(prev => prev.map(r => (r.id === editingRecord.id ? res.record : r)));
        if (viewingRecord && viewingRecord.id === editingRecord.id) {
          setViewingRecord(res.record);
        }
        showNotification('Record updated successfully', 'info');
      } else {
        const res = await api.createRecord(input);
        setRecords(prev => [res.record, ...prev]);
        showNotification('Record created in private vault', 'info');
      }
      api.getStats().then(setStats).catch(() => {});
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Operation failed', 'error');
      throw err;
    }
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await api.deleteRecord(id);
      setRecords(prev => prev.filter(r => r.id !== id));
      if (viewingRecord && viewingRecord.id === id) {
        setViewingRecord(null);
      }
      api.getStats().then(setStats).catch(() => {});
      showNotification('Record deleted from database', 'info');
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const handleOpenEdit = (record: PrivateRecord) => {
    setEditingRecord(record);
    setIsRecordModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setIsRecordModalOpen(true);
  };

  const handleUserLogout = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    await api.logout().catch(() => {});
    onLogout();
  };

  const isFrozen = securityStatus?.is_frozen;
  const isRecovery = securityStatus?.is_recovery_mode;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Toast Banner */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-mono shadow-2xl backdrop-blur-md ${
              toast.type === 'error'
                ? 'bg-red-950/90 border-red-800 text-red-200'
                : 'bg-neutral-900/90 border-neutral-700 text-neutral-200'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-neutral-400 hover:text-neutral-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header / Control Bar */}
      <header className="border-b border-neutral-800/80 bg-neutral-900/70 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Brand & Security Status */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700/80 flex items-center justify-center text-neutral-300">
              <Lock className="w-4 h-4 text-neutral-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-neutral-100 font-mono">
                  VAULT // 01
                </span>

                {isFrozen && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/90 border border-blue-800 text-blue-300">
                    <Snowflake className="w-3 h-3" />
                    <span>FROZEN</span>
                  </span>
                )}

                {isRecovery && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/90 border border-amber-800 text-amber-300 animate-pulse">
                    <Flame className="w-3 h-3 text-amber-400" />
                    <span>RECOVERY ACTIVE</span>
                  </span>
                )}

                {!isFrozen && !isRecovery && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/90 text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    RLS ENFORCED
                  </span>
                )}

                {/* Real-time SSE sync status */}
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isRealtimeConnected
                        ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                        : 'bg-neutral-600'
                    }`}
                  ></span>
                  <span className="hidden md:inline">
                    {isRealtimeConnected ? 'LIVE SYNC' : 'SYNC DISCONNECTED'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onOpenSetupGuide}
              className="text-xs text-neutral-400 hover:text-neutral-200 px-2.5 py-1.5 rounded-md hover:bg-neutral-800/60 transition-colors border border-neutral-800 font-mono flex items-center gap-1.5"
              title="Database Schema & Configuration"
            >
              <Database className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden md:inline">Schema & SQL</span>
            </button>

            <div className="h-4 w-px bg-neutral-800 hidden sm:block"></div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-neutral-400 hidden sm:inline">
                @{userSession.username || 'raiyan'}
              </span>

              <button
                onClick={handleUserLogout}
                className="p-1.5 text-neutral-400 hover:text-red-300 hover:bg-neutral-800/60 rounded-md transition-colors border border-neutral-800"
                title="Disconnect & Lock Vault"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Global Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-neutral-800/50 py-1.5">
          <button
            onClick={() => setActiveTab('vault')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'vault'
                ? 'bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            <span>Records Vault</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'files'
                ? 'bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <FolderLock className="w-3.5 h-3.5 text-sky-400" />
            <span>Private Storage</span>
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'devices'
                ? 'bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 text-cyan-400" />
            <span>Devices & Trust</span>
          </button>

          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'sessions'
                ? 'bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active Sessions</span>
          </button>

          <button
            onClick={() => setActiveTab('network')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'network'
                ? 'bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>Network &amp; Policy</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Behavioral Audit</span>
            {anomalyCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-amber-950 text-amber-300 border border-amber-800 rounded font-bold">
                {anomalyCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'security'
                ? 'bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Security & Recovery</span>
          </button>

          <button
            onClick={() => setActiveTab('blocklist')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'blocklist'
                ? 'bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Ban className="w-3.5 h-3.5 text-red-400" />
            <span>IP Blocklist</span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'health'
                ? 'bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Gauge className="w-3.5 h-3.5 text-teal-400" />
            <span>Health & Performance</span>
          </button>

          <button
            onClick={() => setActiveTab('backups')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'backups'
                ? 'bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span>Full Backups</span>
          </button>

          <button
            onClick={() => setActiveTab('email-security')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'email-security'
                ? 'bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-amber-400" />
            <span>Security Email &amp; Resend</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {/* SUBVIEW 1: RECORDS VAULT */}
        {activeTab === 'vault' && (
          <div className="space-y-6">
            {/* Top Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-neutral-900/50 border border-neutral-800/80 p-3 sm:p-4 rounded-xl">
                <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
                  Total Vault Records
                </span>
                <div className="text-xl sm:text-2xl font-mono text-neutral-100 mt-1 font-semibold">
                  {stats ? stats.totalRecords : records.length}
                </div>
              </div>

              <div className="bg-neutral-900/50 border border-neutral-800/80 p-3 sm:p-4 rounded-xl">
                <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
                  Pinned Records
                </span>
                <div className="text-xl sm:text-2xl font-mono text-neutral-100 mt-1 font-semibold flex items-center gap-2">
                  <Pin className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>
                    {stats ? stats.pinnedCount : records.filter(r => r.is_pinned).length}
                  </span>
                </div>
              </div>

              <div className="bg-neutral-900/50 border border-neutral-800/80 p-3 sm:p-4 rounded-xl">
                <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
                  Active Categories
                </span>
                <div className="text-xl sm:text-2xl font-mono text-neutral-100 mt-1 font-semibold">
                  {stats ? Object.keys(stats.categoryCounts).length : RECORD_CATEGORIES.length}
                </div>
              </div>

              <div className="bg-neutral-900/50 border border-neutral-800/80 p-3 sm:p-4 rounded-xl">
                <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
                  Database Isolation
                </span>
                <div className="text-sm font-mono text-emerald-400 mt-2 flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Row Level Security</span>
                </div>
              </div>
            </div>

            {/* Action & Filter Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search titles, tags, or content..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-900/80 border border-neutral-800 pl-9 pr-4 py-2 text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 rounded-lg focus:outline-none focus:border-neutral-600 font-mono transition-colors"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={fetchRecords}
                  disabled={isLoading}
                  className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg transition-colors cursor-pointer"
                  title="Refresh records"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={handleOpenCreate}
                  disabled={isFrozen}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-mono font-semibold rounded-lg transition-colors ${
                    isFrozen
                      ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                      : 'bg-neutral-200 hover:bg-white text-neutral-950 shadow-md cursor-pointer'
                  }`}
                  title={isFrozen ? 'Account is frozen (read-only)' : 'Create Record'}
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Record</span>
                </button>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {['All', ...RECORD_CATEGORIES].map(cat => {
                const count =
                  cat === 'All'
                    ? stats?.totalRecords ?? records.length
                    : stats?.categoryCounts[cat] ?? 0;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 border ${
                      isSelected
                        ? 'bg-neutral-800 text-neutral-100 border-neutral-600 font-medium'
                        : 'bg-neutral-900/60 text-neutral-400 border-neutral-800/80 hover:bg-neutral-800/60 hover:text-neutral-300'
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-neutral-700 text-neutral-200'
                          : 'bg-neutral-800 text-neutral-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Records List Container */}
            <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-xl overflow-hidden">
              {isLoading && records.length === 0 ? (
                <div className="p-12 text-center text-neutral-500 font-mono text-xs flex flex-col items-center justify-center space-y-2">
                  <div className="w-4 h-4 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin"></div>
                  <span>QUERYING DATABASE VAULT...</span>
                </div>
              ) : error ? (
                <div className="p-8 text-center text-red-400 font-mono text-xs flex flex-col items-center justify-center space-y-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span>{error}</span>
                  <button
                    onClick={fetchRecords}
                    className="mt-2 text-neutral-300 underline text-xs"
                  >
                    Retry Query
                  </button>
                </div>
              ) : records.length === 0 ? (
                <div className="p-12 text-center text-neutral-500 font-mono text-xs flex flex-col items-center justify-center space-y-3">
                  <FolderLock className="w-8 h-8 text-neutral-600 stroke-[1.5]" />
                  <p className="text-neutral-400">
                    {debouncedQuery
                      ? `No records found matching "${debouncedQuery}" in category "${selectedCategory}".`
                      : `No records in category "${selectedCategory}".`}
                  </p>
                  <button
                    onClick={handleOpenCreate}
                    disabled={isFrozen}
                    className="text-xs text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Create First Record
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-neutral-800/60">
                  {records.map(record => {
                    const isRevealed = revealedIds.has(record.id);
                    return (
                      <div
                        key={record.id}
                        onClick={() => setViewingRecord(record)}
                        className="p-4 hover:bg-neutral-800/30 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        {/* Title & Metadata */}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {record.is_pinned && (
                              <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                            )}
                            <h3 className="text-sm font-semibold text-neutral-100 truncate group-hover:text-white transition-colors">
                              {record.title}
                            </h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800/90 text-neutral-300 border border-neutral-700/60 shrink-0">
                              {record.category}
                            </span>
                          </div>

                          {/* Content Masked / Revealed preview */}
                          <div className="font-mono text-xs text-neutral-400 max-w-xl truncate">
                            {isRevealed ? (
                              <span className="text-neutral-200 select-all">
                                {record.content.substring(0, 80)}
                                {record.content.length > 80 ? '...' : ''}
                              </span>
                            ) : (
                              <span className="tracking-widest text-neutral-500 select-none">
                                ••••••••••••••••••••••••••••••••
                              </span>
                            )}
                          </div>

                          {/* Tags & Timestamp */}
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500 font-mono">
                            <span>
                              Updated {new Date(record.updated_at).toLocaleDateString()}
                            </span>
                            {record.tags && record.tags.length > 0 && (
                              <>
                                <span>•</span>
                                <div className="flex items-center gap-1">
                                  {record.tags.map(tag => (
                                    <span
                                      key={tag}
                                      className="text-neutral-400 bg-neutral-800/40 px-1.5 py-0.2 rounded text-[10px]"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                          <button
                            onClick={e => handleToggleReveal(e, record.id)}
                            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
                            title={isRevealed ? 'Mask content' : 'Reveal content'}
                          >
                            {isRevealed ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={e => handleCopyContent(e, record)}
                            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
                            title="Copy to clipboard"
                          >
                            {copiedId === record.id ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleOpenEdit(record);
                            }}
                            disabled={isFrozen}
                            className={`p-1.5 rounded transition-colors ${
                              isFrozen
                                ? 'text-neutral-600 cursor-not-allowed'
                                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                            }`}
                            title="Edit record"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (confirm(`Delete "${record.title}" permanently?`)) {
                                handleDeleteRecord(record.id);
                              }
                            }}
                            disabled={isFrozen}
                            className={`p-1.5 rounded transition-colors ${
                              isFrozen
                                ? 'text-neutral-600 cursor-not-allowed'
                                : 'text-neutral-400 hover:text-red-400 hover:bg-neutral-800'
                            }`}
                            title="Delete record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBVIEW 2: PRIVATE STORAGE */}
        {activeTab === 'files' && <StorageManagerView onNotify={showNotification} />}

        {/* SUBVIEW: DEVICES & HARDWARE INTELLIGENCE */}
        {activeTab === 'devices' && <DeviceManagementView onNotify={showNotification} />}

        {/* SUBVIEW: ACTIVE SESSIONS & HIJACKING MONITOR */}
        {activeTab === 'sessions' && (
          <SessionSecurityView
            onNotify={showNotification}
            onCurrentSessionTerminated={handleUserLogout}
          />
        )}

        {/* SUBVIEW: NETWORK INTELLIGENCE & SECURITY POLICY */}
        {activeTab === 'network' && <NetworkSecurityView onNotify={showNotification} />}

        {/* SUBVIEW 3: BEHAVIORAL AUDIT */}
        {activeTab === 'audit' && <AuditMonitoringView onNotify={showNotification} />}

        {/* SUBVIEW 4: SECURITY & RECOVERY */}
        {activeTab === 'security' && (
          <SecurityRecoveryView
            onNotify={showNotification}
            onStatusChange={st => setSecurityStatus(st)}
          />
        )}

        {/* SUBVIEW 5: IP BLOCKLIST */}
        {activeTab === 'blocklist' && <IpBlocklistView onNotify={showNotification} />}

        {/* SUBVIEW 6: HEALTH & METRICS */}
        {activeTab === 'health' && <SystemHealthView onNotify={showNotification} />}

        {/* SUBVIEW 7: FULL BACKUPS */}
        {activeTab === 'backups' && (
          <BackupManagerView
            onNotify={showNotification}
            onRestoreComplete={() => {
              fetchRecords();
              setActiveTab('vault');
            }}
          />
        )}

        {/* SUBVIEW 8: SECURITY EMAIL & RESEND */}
        {activeTab === 'email-security' && <SecurityEmailView onNotify={showNotification} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950/80 py-4 text-center text-neutral-600 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PRIVATE SERVER VAULT • ENCRYPTED ENDPOINTS</span>
          <span>NO PUBLIC SEARCH INDEXING • ROBOTS DISALLOWED</span>
        </div>
      </footer>

      {/* Record Create / Edit Modal */}
      <RecordModal
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          setEditingRecord(null);
        }}
        onSave={handleSaveRecord}
        initialData={editingRecord}
      />

      {/* Record Detail Modal */}
      <RecordDetailModal
        record={viewingRecord}
        onClose={() => setViewingRecord(null)}
        onEdit={handleOpenEdit}
        onDelete={handleDeleteRecord}
      />

      {/* Real-time Multi-Device Sync Conflict Reconciliation Modal */}
      {activeConflict && (
        <SyncConflictModal
          conflict={activeConflict}
          onResolved={(updatedRecord) => {
            setRecords((prev) =>
              prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r))
            );
            setViewingRecord((prev) =>
              prev && prev.id === updatedRecord.id ? updatedRecord : prev
            );
            setActiveConflict(null);
            showNotification('Sync conflict resolved and reconciled successfully', 'info');
          }}
          onClose={() => setActiveConflict(null)}
        />
      )}

      {/* Incident Investigation Dossier Modal */}
      {investigatingIncidentId && (
        <IncidentInvestigationModal
          incidentId={investigatingIncidentId}
          isOpen={Boolean(investigatingIncidentId)}
          onClose={() => setInvestigatingIncidentId(null)}
          onNotify={showNotification}
          onNavigateTab={(tab) => setActiveTab(tab as ActiveNavTab)}
        />
      )}

      {/* Action Execution Confirmation Modal */}
      {actionConfirmation && (
        <ActionConfirmationModal
          actionPayload={actionConfirmation}
          isOpen={Boolean(actionConfirmation)}
          onClose={() => setActionConfirmation(null)}
          onNotify={showNotification}
          onSuccessAction={() => {
            refreshGlobalSecurityStatus();
          }}
        />
      )}
    </div>
  );
};
