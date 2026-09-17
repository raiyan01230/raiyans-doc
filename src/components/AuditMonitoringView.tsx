import React, { useState, useEffect, useId } from 'react';
import { api } from '../lib/api';
import { AuditEvent, AnomalyAlert, AuditChainVerificationReport } from '../types';
import {
  ShieldAlert,
  Activity,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Filter,
  Eye,
  X,
  AlertTriangle,
  Info,
  ShieldCheck,
  Hash,
  Link,
  Lock,
} from 'lucide-react';

interface AuditMonitoringViewProps {
  onNotify?: (msg: string, type?: 'info' | 'error') => void;
}

export function AuditMonitoringView({ onNotify }: AuditMonitoringViewProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  // Cryptographic audit chain verification states
  const [integrityReport, setIntegrityReport] = useState<AuditChainVerificationReport | null>(null);
  const [isVerifyingIntegrity, setIsVerifyingIntegrity] = useState(false);

  const searchInputId = useId();
  const filterSelectId = useId();

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsRes, anomaliesRes] = await Promise.all([
        api.getAuditEvents(filterType, search),
        api.getAnomalies(),
      ]);
      setEvents(eventsRes.events || []);
      setAnomalies(anomaliesRes.anomalies || []);
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed loading audit events', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    setIsVerifyingIntegrity(true);
    try {
      const report = await api.verifyAuditIntegrity();
      setIntegrityReport(report);
      if (report.isValid) {
        onNotify?.(`Audit chain verified: ${report.totalRecords} blocks cryptographically valid.`, 'info');
      } else {
        onNotify?.(`WARNING: Audit chain broken! ${report.brokenLinks?.length || 0} invalid block(s) detected.`, 'error');
      }
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Audit verification failed', 'error');
    } finally {
      setIsVerifyingIntegrity(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const getEventBadge = (type: string, success: boolean) => {
    let color = 'bg-neutral-800 text-neutral-300 border-neutral-700';
    if (!success) {
      color = 'bg-red-950/60 text-red-300 border-red-800';
    } else if (type.includes('login')) {
      color = 'bg-emerald-950/50 text-emerald-300 border-emerald-800';
    } else if (type.includes('frozen') || type.includes('recovery')) {
      color = 'bg-amber-950/50 text-amber-300 border-amber-800';
    } else if (type.includes('file')) {
      color = 'bg-sky-950/50 text-sky-300 border-sky-800';
    } else if (type.includes('record')) {
      color = 'bg-indigo-950/50 text-indigo-300 border-indigo-800';
    } else if (type.includes('backup')) {
      color = 'bg-purple-950/50 text-purple-300 border-purple-800';
    }

    return (
      <span className={`px-2 py-0.5 text-[11px] font-mono rounded border uppercase ${color}`}>
        {type.replace(/_/g, ' ')}
      </span>
    );
  };

  const distinctIps = new Set(events.map(e => e.ip_address)).size;
  const successRate =
    events.length > 0
      ? Math.round((events.filter(e => e.success).length / events.length) * 100)
      : 100;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono mb-1">
            <span>AUDIT EVENTS</span>
            <Activity className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="text-2xl font-mono text-neutral-100 font-semibold">{events.length}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Recorded legitimate actions</div>
        </div>

        <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono mb-1">
            <span>ACTIVE ANOMALIES</span>
            <ShieldAlert
              className={`w-4 h-4 ${
                anomalies.length > 0 ? 'text-amber-400 animate-pulse' : 'text-emerald-500'
              }`}
            />
          </div>
          <div
            className={`text-2xl font-mono font-semibold ${
              anomalies.length > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {anomalies.length}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {anomalies.length > 0 ? 'Investigate alerts below' : 'Zero active anomalies detected'}
          </div>
        </div>

        <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono mb-1">
            <span>AUTH SUCCESS RATE</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-mono text-neutral-100 font-semibold">{successRate}%</div>
          <div className="text-[11px] text-neutral-500 mt-1">Audit stream integrity</div>
        </div>

        <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono mb-1">
            <span>UNIQUE CLIENT IPS</span>
            <Terminal className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="text-2xl font-mono text-neutral-100 font-semibold">{distinctIps}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Across monitored sessions</div>
        </div>
      </div>

      {/* Real Anomaly Detection Panel */}
      {anomalies.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 font-mono text-xs font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>BEHAVIORAL ANOMALY DETECTIONS ({anomalies.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {anomalies.map(a => (
              <div
                key={a.id}
                className="bg-neutral-900/90 border border-amber-900/60 p-3 rounded-lg text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-100">{a.title}</span>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-mono uppercase rounded ${
                      a.severity === 'critical'
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : a.severity === 'high'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    {a.severity}
                  </span>
                </div>
                <p className="text-neutral-400 text-[11px] leading-relaxed">{a.description}</p>
                <div className="text-[10px] font-mono text-neutral-500 pt-1 flex items-center justify-between">
                  <span>Trigger count: {a.triggering_event_count}</span>
                  <span>{new Date(a.detected_at).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cryptographic SHA-256 Hash Chain Integrity Verification Card */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="text-xs font-semibold text-neutral-100 font-mono">
                Cryptographic Audit Chain Integrity (SHA-256)
              </h3>
              <p className="text-[11px] text-neutral-400">
                Verifies tamper-evident cryptographic hash linkage (`prev_hash` &rarr; `hash`) across all logged events.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleVerifyIntegrity}
            disabled={isVerifyingIntegrity}
            className="px-3 py-1.5 bg-neutral-100 hover:bg-white text-neutral-950 font-medium rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-center"
          >
            {isVerifyingIntegrity ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Hashing Blocks...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Verify Audit Chain</span>
              </>
            )}
          </button>
        </div>

        {integrityReport && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
              <div className="bg-neutral-950/80 p-2.5 rounded border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block uppercase">Chain Status</span>
                <span className={`font-semibold flex items-center gap-1 mt-0.5 ${
                  integrityReport.isValid ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {integrityReport.isValid ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Tamper-Free / Verified</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Tampering Detected!</span>
                    </>
                  )}
                </span>
              </div>

              <div className="bg-neutral-950/80 p-2.5 rounded border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block uppercase">Blocks Verified</span>
                <span className="text-neutral-200 font-semibold mt-0.5 block">
                  {integrityReport.totalRecords} linked blocks
                </span>
              </div>

              <div className="bg-neutral-950/80 p-2.5 rounded border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block uppercase">Verification Time</span>
                <span className="text-neutral-200 font-semibold mt-0.5 block">
                  {new Date(integrityReport.verifiedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div className="bg-neutral-950/90 p-2.5 rounded border border-neutral-800/80 font-mono text-[10px] space-y-1 text-neutral-400">
              <div className="truncate">
                <span className="text-neutral-500">Genesis Hash: </span>
                <span className="text-neutral-300">{integrityReport.genesisHash}</span>
              </div>
              <div className="truncate">
                <span className="text-neutral-500">Head Block Hash: </span>
                <span className="text-neutral-300">{integrityReport.currentHeadHash}</span>
              </div>
            </div>

            {integrityReport.brokenLinks && integrityReport.brokenLinks.length > 0 && (
              <div className="p-3 bg-rose-950/70 border border-rose-800 rounded-lg text-xs font-mono text-rose-200 space-y-1">
                <div className="font-semibold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Corrupted / Tampered Blocks Identified:
                </div>
                {integrityReport.brokenLinks.map((blk, i) => (
                  <div key={i} className="text-[11px] text-rose-300/90 pl-5">
                    Block Index #{blk.index} (Event ID: {blk.id}) &bull; Reason: {blk.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <label htmlFor={searchInputId} className="sr-only">
            Search audit logs
          </label>
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id={searchInputId}
            type="text"
            placeholder="Search IP, event, resource..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-neutral-900/80 border border-neutral-800 pl-9 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 rounded-lg focus:outline-none focus:border-neutral-600 font-mono"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 bg-neutral-900/80 border border-neutral-800 px-2 py-1 rounded-lg text-xs font-mono text-neutral-400">
            <Filter className="w-3.5 h-3.5" />
            <label htmlFor={filterSelectId} className="sr-only">
              Filter by event type
            </label>
            <select
              id={filterSelectId}
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-transparent border-none text-neutral-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-neutral-900">All Events</option>
              <option value="login" className="bg-neutral-900">Login</option>
              <option value="logout" className="bg-neutral-900">Logout</option>
              <option value="failed_login" className="bg-neutral-900">Failed Login</option>
              <option value="record_created" className="bg-neutral-900">Record Created</option>
              <option value="record_updated" className="bg-neutral-900">Record Updated</option>
              <option value="record_deleted" className="bg-neutral-900">Record Deleted</option>
              <option value="file_uploaded" className="bg-neutral-900">File Uploaded</option>
              <option value="file_downloaded" className="bg-neutral-900">File Downloaded</option>
              <option value="file_previewed" className="bg-neutral-900">File Previewed</option>
              <option value="file_deleted" className="bg-neutral-900">File Deleted</option>
              <option value="account_frozen" className="bg-neutral-900">Account Frozen</option>
              <option value="account_unfrozen" className="bg-neutral-900">Account Unfrozen</option>
              <option value="backup_created" className="bg-neutral-900">Backup Created</option>
            </select>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-3 py-1.5 rounded-lg text-xs font-mono text-neutral-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/90 text-neutral-400 font-mono text-[11px] border-b border-neutral-800">
              <tr>
                <th className="py-2.5 px-3">TIMESTAMP (UTC)</th>
                <th className="py-2.5 px-3">EVENT TYPE</th>
                <th className="py-2.5 px-3">STATUS</th>
                <th className="py-2.5 px-3">IP ADDRESS</th>
                <th className="py-2.5 px-3">DEVICE / CLIENT</th>
                <th className="py-2.5 px-3">TARGET RESOURCE</th>
                <th className="py-2.5 px-3 text-right">DETAILS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono text-neutral-300">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500">
                    {loading ? 'Querying behavioral log stream...' : 'No audit events found matching query.'}
                  </td>
                </tr>
              ) : (
                events.map(evt => (
                  <tr key={evt.event_id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="py-2 px-3 text-neutral-400 whitespace-nowrap">
                      {new Date(evt.timestamp).toISOString().replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {getEventBadge(evt.event_type, evt.success)}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {evt.success ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>OK</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-[11px]">
                          <XCircle className="w-3 h-3" />
                          <span>DENIED</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-neutral-300 whitespace-nowrap font-mono">
                      {evt.ip_address}
                    </td>
                    <td className="py-2 px-3 text-neutral-400 truncate max-w-[180px]" title={evt.user_agent}>
                      {evt.device_summary || evt.user_agent.substring(0, 30)}
                    </td>
                    <td className="py-2 px-3 text-neutral-400 truncate max-w-[140px]">
                      {evt.resource_type ? `${evt.resource_type}: ${evt.resource_id || ''}` : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => setSelectedEvent(evt)}
                        className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
                        title="View payload metadata"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl max-w-xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-neutral-400" />
                <span className="font-mono text-xs font-semibold text-neutral-100">
                  EVENT METADATA: {selectedEvent.event_id}
                </span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                  <span className="text-neutral-500 block">Event Type</span>
                  <span className="text-neutral-200">{selectedEvent.event_type}</span>
                </div>
                <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                  <span className="text-neutral-500 block">IP Address</span>
                  <span className="text-neutral-200">{selectedEvent.ip_address}</span>
                </div>
                <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                  <span className="text-neutral-500 block">User Agent</span>
                  <span className="text-neutral-300 text-[10px] break-all">{selectedEvent.user_agent}</span>
                </div>
                <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                  <span className="text-neutral-500 block">Timestamp (UTC)</span>
                  <span className="text-neutral-200">{selectedEvent.timestamp}</span>
                </div>
              </div>

              <div>
                <span className="text-neutral-400 text-[11px] block mb-1">Attached Event Metadata:</span>
                <pre className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg text-[11px] text-emerald-400 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedEvent.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-mono text-neutral-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
