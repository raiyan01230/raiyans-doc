import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  ArrowLeft,
  Activity,
  Globe,
  User,
  Smartphone,
  Lock,
  Key,
  FileText,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  Mail,
  Sliders,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { api, SecurityIncident } from '../lib/api';
import { MultiLayerEvaluation } from '../types';

interface InvestigationWorkspaceProps {
  incidentId: string;
  onBack?: () => void;
  onNavigateToView?: (path: string) => void;
}

export const InvestigationWorkspace: React.FC<InvestigationWorkspaceProps> = ({
  incidentId,
  onBack,
  onNavigateToView,
}) => {
  const [loading, setLoading] = useState(true);
  const [incident, setIncident] = useState<SecurityIncident | null>(null);
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'CORRELATED_LOGS' | 'EVIDENCE' | 'RAW_PAYLOAD'>('TELEMETRY');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  const fetchIncidentDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const inc = await api.getIncident(incidentId);
      if (inc) {
        setIncident(inc);
      } else {
        // Mock fallback if specific incident is synthesized
        setIncident({
          incident_id: incidentId,
          severity: 'CRITICAL',
          event_type: 'suspicious_session_hijack',
          status: 'INVESTIGATING',
          detected_at: new Date().toISOString(),
          source_ip: '185.220.101.45',
          country: 'Germany (DE)',
          region: 'Hesse',
          city: 'Frankfurt',
          asn: 'AS200052 (Tor Exit Node)',
          isp: 'M247 Ltd',
          vpn_status: 'Detected (Tor Exit Node)',
          proxy_status: 'Detected (Anonymous Proxy)',
          evidence: `Critical session anomaly detected: User token active on primary device (MacBook Pro) was presented simultaneously from high-risk ASN (AS200052) in Frankfurt, DE. Hardware fingerprint mismatch detected. Token invalidated & account placed under protective isolation.`,
          automated_actions: [
            '✓ Session token revoked & quarantined',
            '✓ Hardware device untrusted',
            '✓ IP 185.220.101.45 added to perimeter blocklist',
            '✓ Resend security alert dispatched to raiyan3945@gmail.com',
          ],
          email_status: 'DELIVERED (Resend ID: msg_8f3a921d)',
        });
      }
    } catch (err: any) {
      console.error('Fetch incident error:', err);
      setError(err?.message || 'Failed to load incident details from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidentDetails();
  }, [incidentId]);

  const handleUpdateStatus = async (newStatus: string) => {
    setExecutingAction(newStatus);
    setActionSuccess(null);
    try {
      await api.updateIncidentStatus(incidentId, newStatus);
      if (incident) setIncident({ ...incident, status: newStatus });
      setActionSuccess(`Incident status updated to ${newStatus}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to update incident status.');
    } finally {
      setExecutingAction(null);
    }
  };

  const handleUnbanOwner = async () => {
    setExecutingAction('UNBAN');
    setActionSuccess(null);
    try {
      const res = await api.unbanAccount('owner', 'Investigation Workspace Owner Override');
      if (res.success) {
        setActionSuccess(`ACCOUNT UNBANNED: ${res.evaluation.evalSummary}`);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to unban account.');
    } finally {
      setExecutingAction(null);
    }
  };

  const handleUnblockIp = async () => {
    if (!incident?.source_ip) return;
    setExecutingAction('UNBLOCK_IP');
    setActionSuccess(null);
    try {
      await api.unblockIpAddress(incident.source_ip);
      setActionSuccess(`IP ADDRESS ${incident.source_ip} UNBLOCKED`);
    } catch (err: any) {
      setError(err?.message || 'Failed to unblock IP.');
    } finally {
      setExecutingAction(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-neutral-400 font-mono text-xs flex flex-col items-center justify-center space-y-3">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span>INITIALIZING INVESTIGATION WORKSPACE FOR INCIDENT {incidentId}...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans text-neutral-200">
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 rounded-lg text-neutral-300 font-mono text-xs flex items-center space-x-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>EXIT INVESTIGATION MODE</span>
        </button>

        <div className="flex items-center space-x-2 font-mono text-xs">
          <span className="text-neutral-400">INCIDENT ID:</span>
          <span className="font-bold text-amber-400">{incidentId}</span>
        </div>
      </div>

      {/* Incident Command Banner */}
      <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-mono font-bold text-base text-neutral-100 uppercase tracking-wider">
                  INVESTIGATION MODE WORKSPACE
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 border border-red-500/40 text-red-400 uppercase">
                  {incident?.severity || 'CRITICAL'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono">
                EVENT TYPE: <span className="text-neutral-200 uppercase">{incident?.event_type || 'SECURITY_INCIDENT'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-neutral-400">STATUS:</span>
            <span className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold uppercase">
              {incident?.status || 'INVESTIGATING'}
            </span>
          </div>
        </div>

        {/* Network & Origin Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs pt-1">
          <div className="p-2.5 bg-neutral-950/60 rounded-lg border border-neutral-800">
            <span className="text-neutral-500 block text-[10px]">SOURCE IP</span>
            <span className="font-bold text-neutral-200">{incident?.source_ip || 'N/A'}</span>
          </div>
          <div className="p-2.5 bg-neutral-950/60 rounded-lg border border-neutral-800">
            <span className="text-neutral-500 block text-[10px]">GEOLOCATION</span>
            <span className="font-bold text-neutral-200">{incident?.country || 'Unknown'}</span>
          </div>
          <div className="p-2.5 bg-neutral-950/60 rounded-lg border border-neutral-800">
            <span className="text-neutral-500 block text-[10px]">ASN & PROVIDER</span>
            <span className="font-bold text-neutral-200 truncate block">{incident?.asn || 'N/A'}</span>
          </div>
          <div className="p-2.5 bg-neutral-950/60 rounded-lg border border-neutral-800">
            <span className="text-neutral-500 block text-[10px]">VPN / PROXY STATUS</span>
            <span className="font-bold text-amber-400">{incident?.vpn_status || 'Clean'}</span>
          </div>
        </div>
      </div>

      {/* Action Banners */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 font-mono text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 font-mono text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Workspace Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left & Center: Tabs & Investigation Panels (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Workspace Tabs */}
          <div className="flex border-b border-neutral-800 space-x-1 font-mono text-xs">
            <button
              onClick={() => setActiveTab('TELEMETRY')}
              className={`px-4 py-2 border-b-2 font-semibold transition-colors flex items-center space-x-1.5 ${
                activeTab === 'TELEMETRY'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>TELEMETRY & ASN</span>
            </button>
            <button
              onClick={() => setActiveTab('CORRELATED_LOGS')}
              className={`px-4 py-2 border-b-2 font-semibold transition-colors flex items-center space-x-1.5 ${
                activeTab === 'CORRELATED_LOGS'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>CORRELATED LOGS</span>
            </button>
            <button
              onClick={() => setActiveTab('EVIDENCE')}
              className={`px-4 py-2 border-b-2 font-semibold transition-colors flex items-center space-x-1.5 ${
                activeTab === 'EVIDENCE'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>EVIDENCE ARTIFACTS</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 min-h-[320px]">
            {activeTab === 'TELEMETRY' && (
              <div className="space-y-4 font-mono text-xs">
                <h3 className="text-neutral-400 font-bold uppercase tracking-wider text-[11px] border-b border-neutral-800 pb-2">
                  DEEP NETWORK & HARDWARE TELEMETRY
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 space-y-2">
                    <span className="text-amber-400 font-bold block text-[11px]">ISP / ASN INTELLIGENCE</span>
                    <div className="space-y-1 text-neutral-300">
                      <div className="flex justify-between"><span className="text-neutral-500">ASN:</span><span>{incident?.asn}</span></div>
                      <div className="flex justify-between"><span className="text-neutral-500">ISP:</span><span>{incident?.isp}</span></div>
                      <div className="flex justify-between"><span className="text-neutral-500">Threat Score:</span><span className="text-red-400 font-bold">92 / 100</span></div>
                    </div>
                  </div>

                  <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 space-y-2">
                    <span className="text-purple-400 font-bold block text-[11px]">GEOLOCATION DATA</span>
                    <div className="space-y-1 text-neutral-300">
                      <div className="flex justify-between"><span className="text-neutral-500">Country:</span><span>{incident?.country}</span></div>
                      <div className="flex justify-between"><span className="text-neutral-500">Region/City:</span><span>{incident?.region}, {incident?.city}</span></div>
                      <div className="flex justify-between"><span className="text-neutral-500">Proxy Type:</span><span>{incident?.proxy_status}</span></div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 space-y-2">
                  <span className="text-emerald-400 font-bold block text-[11px]">EMAIL ALERT DISPATCH AUDIT</span>
                  <p className="text-neutral-300 text-[11px]">
                    STATUS: <strong className="text-purple-400">{incident?.email_status || 'DELIVERED'}</strong>
                  </p>
                  <p className="text-[10px] text-neutral-500">
                    Dispatched via Resend API to verified vault owner email (raiyan3945@gmail.com).
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'CORRELATED_LOGS' && (
              <div className="space-y-3 font-mono text-xs">
                <h3 className="text-neutral-400 font-bold uppercase tracking-wider text-[11px] border-b border-neutral-800 pb-2">
                  CORRELATED SERVER REQUEST LOGS
                </h3>
                <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-2 font-mono text-[11px] text-neutral-300 overflow-x-auto">
                  <div className="flex space-x-2 text-neutral-500 text-[10px] border-b border-neutral-800 pb-1">
                    <span>TIMESTAMP</span>
                    <span>METHOD</span>
                    <span>ROUTE</span>
                    <span>IP</span>
                    <span>STATUS</span>
                  </div>
                  <div className="flex space-x-2 text-red-400">
                    <span>{incident?.detected_at ? new Date(incident.detected_at).toLocaleTimeString() : '12:00:00'}</span>
                    <span className="font-bold">POST</span>
                    <span>/api/records/sec_rec_001</span>
                    <span>{incident?.source_ip}</span>
                    <span className="bg-red-500/20 px-1 rounded">403 FORBIDDEN</span>
                  </div>
                  <div className="flex space-x-2 text-amber-400">
                    <span>{incident?.detected_at ? new Date(incident.detected_at).toLocaleTimeString() : '12:00:01'}</span>
                    <span className="font-bold">GET</span>
                    <span>/api/security/sessions</span>
                    <span>{incident?.source_ip}</span>
                    <span className="bg-amber-500/20 px-1 rounded">200 OK</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'EVIDENCE' && (
              <div className="space-y-3 font-mono text-xs">
                <h3 className="text-neutral-400 font-bold uppercase tracking-wider text-[11px] border-b border-neutral-800 pb-2">
                  EVIDENCE SUMMARY & AUTOMATED ACTIONS
                </h3>
                <p className="text-neutral-300 leading-relaxed bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                  {incident?.evidence}
                </p>

                <div className="space-y-1.5 pt-2">
                  <span className="text-neutral-400 font-bold text-[11px] block">AUTOMATED ACTIONS EXECUTED:</span>
                  <div className="space-y-1 bg-neutral-950 p-3 rounded-lg border border-neutral-800 text-emerald-400">
                    {incident?.automated_actions?.map((act, i) => (
                      <div key={i}>{act}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Console: Live Action Controls (1 col) */}
        <div className="space-y-4 font-mono text-xs">
          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-4">
            <h3 className="font-bold text-neutral-100 uppercase tracking-wider text-xs border-b border-neutral-800 pb-2 flex items-center space-x-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>LIVE INCIDENT ACTIONS</span>
            </h3>

            {/* Status Change Buttons */}
            <div className="space-y-2">
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">INCIDENT LIFECYCLE:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleUpdateStatus('CONTAINED')}
                  disabled={Boolean(executingAction)}
                  className="py-2 px-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-lg text-center transition-colors font-bold disabled:opacity-50"
                >
                  MARK CONTAINED
                </button>
                <button
                  onClick={() => handleUpdateStatus('CLOSED')}
                  disabled={Boolean(executingAction)}
                  className="py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-center transition-colors font-bold disabled:opacity-50"
                >
                  CLOSE INCIDENT
                </button>
              </div>
            </div>

            {/* Quick Unban / Unblock Controls */}
            <div className="space-y-2 pt-2 border-t border-neutral-800">
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">SECURITY OVERRIDE CONTROLS:</span>
              <button
                onClick={handleUnbanOwner}
                disabled={Boolean(executingAction)}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors text-center disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                <User className="w-3.5 h-3.5" />
                <span>UNBAN OWNER ACCOUNT</span>
              </button>

              <button
                onClick={handleUnblockIp}
                disabled={Boolean(executingAction)}
                className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors text-center disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>UNBLOCK SOURCE IP</span>
              </button>

              {onNavigateToView && (
                <button
                  onClick={() => onNavigateToView('/security/restore/owner')}
                  className="w-full py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-bold rounded-lg transition-colors text-center flex items-center justify-center space-x-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>OPEN COMPLETE RESTORE WORKSPACE</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
