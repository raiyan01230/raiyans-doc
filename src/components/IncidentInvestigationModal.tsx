import React, { useState, useEffect } from 'react';
import { api, SecurityIncident } from '../lib/api';
import {
  ShieldAlert,
  X,
  RefreshCw,
  Server,
  Laptop,
  Radio,
  Globe,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Ban,
  Snowflake,
  Send,
  Eye,
  FileText,
  Activity,
  ArrowRight
} from 'lucide-react';

interface IncidentInvestigationModalProps {
  incidentId: string;
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (message: string, type?: 'info' | 'error' | 'success') => void;
  onNavigateTab?: (tab: string) => void;
}

export const IncidentInvestigationModal: React.FC<IncidentInvestigationModalProps> = ({
  incidentId,
  isOpen,
  onClose,
  onNotify,
  onNavigateTab,
}) => {
  const [data, setData] = useState<{
    incident: SecurityIncident;
    timeline: any[];
    device: any;
    session: any;
    ipIntelligence: any;
    emailLogs: any[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadData = async () => {
    if (!incidentId) return;
    setIsLoading(true);
    try {
      const res = await api.investigateIncident(incidentId);
      setData(res);
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed loading incident investigation data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && incidentId) {
      loadData();
    }
  }, [isOpen, incidentId]);

  if (!isOpen) return null;

  const handleQuarantineSession = async () => {
    if (!data?.session?.id) return;
    setActionInProgress('quarantine_session');
    try {
      await api.quarantineSession(data.session.id);
      onNotify?.(`Session ${data.session.id} successfully quarantined.`, 'success');
      await loadData();
    } catch (err: unknown) {
      onNotify?.('Failed quarantining session', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleBlockIp = async () => {
    if (!data?.ipIntelligence?.ip) return;
    setActionInProgress('block_ip');
    try {
      await api.addBlockedIp({
        ipAddress: data.ipIntelligence.ip,
        reason: `Manual block from Incident ${incidentId}`,
        isPermanent: true,
      });
      onNotify?.(`IP ${data.ipIntelligence.ip} permanently blocked on perimeter.`, 'success');
      await loadData();
    } catch (err: unknown) {
      onNotify?.('Failed blocking IP address', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!incidentId) return;
    setActionInProgress('update_status');
    try {
      await api.updateIncidentStatus(incidentId, newStatus);
      onNotify?.(`Incident status updated to ${newStatus}`, 'info');
      await loadData();
    } catch (err: unknown) {
      onNotify?.('Failed updating incident status', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const incident = data?.incident;
  const ipIntel = data?.ipIntelligence;
  const device = data?.device;
  const session = data?.session;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-mono text-xs overflow-y-auto">
      <div className="bg-neutral-950 border border-neutral-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-neutral-900/90 border-b border-neutral-800 p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-100">INCIDENT INVESTIGATION DOSSIER</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                  {incidentId}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Authentic Real-Time Forensic Analysis &amp; Action Execution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {isLoading ? (
            <div className="p-12 text-center text-neutral-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-neutral-200" />
              <span>Querying Perimeter Storage &amp; Forensic Logs...</span>
            </div>
          ) : !incident ? (
            <div className="p-8 text-center text-red-400 bg-red-950/20 border border-red-900/40 rounded-xl">
              Incident {incidentId} record not found in store.
            </div>
          ) : (
            <>
              {/* Status & Severity Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-neutral-900/50 p-4 rounded-xl border border-neutral-800">
                <div>
                  <div className="text-[10px] text-neutral-500 uppercase mb-1">Severity Level</div>
                  <span
                    className={`inline-block px-2.5 py-1 rounded text-xs font-bold border ${
                      incident.severity === 'CRITICAL'
                        ? 'bg-red-500/20 text-red-400 border-red-500'
                        : incident.severity === 'HIGH'
                        ? 'bg-orange-500/20 text-orange-400 border-orange-500'
                        : 'bg-blue-500/20 text-blue-400 border-blue-500'
                    }`}
                  >
                    {incident.severity}
                  </span>
                </div>

                <div>
                  <div className="text-[10px] text-neutral-500 uppercase mb-1">Current Status</div>
                  <span className="inline-block px-2.5 py-1 rounded text-xs font-bold bg-neutral-800 text-emerald-400 border border-neutral-700">
                    {incident.status}
                  </span>
                </div>

                <div>
                  <div className="text-[10px] text-neutral-500 uppercase mb-1">Detected Time</div>
                  <div className="text-neutral-200 text-xs font-semibold">
                    {new Date(incident.detected_at).toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-neutral-500 uppercase mb-1">Email Status</div>
                  <span className="text-xs font-bold text-sky-400">{incident.email_status}</span>
                </div>
              </div>

              {/* Event Evidence */}
              <div className="bg-neutral-900/40 border border-neutral-800/80 p-4 rounded-xl space-y-2">
                <div className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" /> Evidence &amp; Detected Threat
                </div>
                <div className="text-neutral-200 text-xs bg-neutral-950 p-3 rounded-lg border border-neutral-800 font-mono leading-relaxed">
                  {incident.evidence}
                </div>
              </div>

              {/* Network, Device & Session Triad */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Network IP */}
                <div className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-neutral-300 font-bold">
                    <span className="flex items-center gap-1.5 text-xs">
                      <Globe className="w-3.5 h-3.5 text-sky-400" /> Source IP
                    </span>
                    {ipIntel?.is_blocked && (
                      <span className="text-[10px] text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800">
                        BLOCKED
                      </span>
                    )}
                  </div>
                  <div className="text-sky-300 font-bold text-sm">{incident.source_ip}</div>
                  <div className="text-[11px] text-neutral-400 space-y-1">
                    <div>Location: {incident.country || 'Unknown'}, {incident.region}</div>
                    <div>ISP: {incident.isp || 'Unknown'}</div>
                    <div>VPN / Proxy: {incident.vpn_status} / {incident.proxy_status}</div>
                  </div>
                  <button
                    onClick={handleBlockIp}
                    disabled={actionInProgress === 'block_ip' || ipIntel?.is_blocked}
                    className="w-full mt-2 py-1.5 bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/60 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Ban className="w-3 h-3" /> {ipIntel?.is_blocked ? 'IP Already Blocked' : 'Block IP on Perimeter'}
                  </button>
                </div>

                {/* Device */}
                <div className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-neutral-300 font-bold">
                    <span className="flex items-center gap-1.5 text-xs">
                      <Laptop className="w-3.5 h-3.5 text-cyan-400" /> Device Telemetry
                    </span>
                  </div>
                  <div className="text-neutral-200 font-bold truncate text-xs">
                    {device?.device_label || incident.device_id || 'Unknown Device'}
                  </div>
                  <div className="text-[11px] text-neutral-400 space-y-1">
                    <div>Browser: {device?.browser || 'Chrome'}</div>
                    <div>OS: {device?.os || 'Linux'}</div>
                    <div>Trusted: {device?.is_trusted ? 'YES' : 'NO (Untrusted)'}</div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateTab?.('devices');
                    }}
                    className="w-full mt-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" /> Inspect Device History
                  </button>
                </div>

                {/* Session */}
                <div className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-neutral-300 font-bold">
                    <span className="flex items-center gap-1.5 text-xs">
                      <Radio className="w-3.5 h-3.5 text-emerald-400" /> Session Control
                    </span>
                    <span className="text-[10px] text-orange-400 bg-orange-950/80 px-1.5 py-0.5 rounded border border-orange-800">
                      {session?.status || 'QUARANTINED'}
                    </span>
                  </div>
                  <div className="text-amber-300 font-bold truncate text-xs">
                    {session?.id || incident.session_id || 'ses_unknown'}
                  </div>
                  <div className="text-[11px] text-neutral-400 space-y-1">
                    <div>Created: {session?.created_at ? new Date(session.created_at).toLocaleTimeString() : 'N/A'}</div>
                    <div>Last Active: {session?.last_active_at ? new Date(session.last_active_at).toLocaleTimeString() : 'N/A'}</div>
                  </div>
                  <button
                    onClick={handleQuarantineSession}
                    disabled={actionInProgress === 'quarantine_session' || session?.status === 'QUARANTINED'}
                    className="w-full mt-2 py-1.5 bg-orange-950/60 hover:bg-orange-900 text-orange-300 border border-orange-800/60 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Lock className="w-3 h-3" /> {session?.status === 'QUARANTINED' ? 'Session Quarantined' : 'Quarantine Session'}
                  </button>
                </div>
              </div>

              {/* Action Execution Checklist */}
              <div className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-xl space-y-2">
                <div className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Automated Action Execution Log
                </div>
                <div className="space-y-1.5 pl-2">
                  {(incident.automated_actions || []).map((act: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-neutral-300 text-xs font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{act}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Event Timeline */}
              <div className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-sky-400" /> Forensic Audit Event Timeline ({data?.timeline?.length || 0})
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateTab?.('audit');
                    }}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                  >
                    View All Audit Logs <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(data?.timeline || []).map((evt: any) => (
                    <div key={evt.id} className="bg-neutral-950 p-2.5 rounded border border-neutral-800 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="font-bold text-neutral-200">{evt.event_type}</span>
                        <span className="text-neutral-500 ml-2">IP: {evt.ip_address}</span>
                      </div>
                      <div className="text-neutral-400 font-mono text-[10px]">
                        {new Date(evt.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Incident Resolution Status Controls */}
              <div className="pt-4 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                <div className="text-neutral-400 text-xs">Update Investigation Status:</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleUpdateStatus('INVESTIGATING')}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-amber-300 border border-amber-800/60 rounded text-xs font-semibold cursor-pointer"
                  >
                    Mark Investigating
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('RESOLVED')}
                    className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded text-xs font-semibold cursor-pointer"
                  >
                    Mark Resolved
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('FALSE_POSITIVE')}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-700 rounded text-xs font-semibold cursor-pointer"
                  >
                    False Positive
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
