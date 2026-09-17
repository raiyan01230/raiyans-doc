import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, Shield, X, Mail } from 'lucide-react';
import { api } from '../lib/api';

export default function IncidentsView() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadIncidents = async () => {
    try {
      const res = await api.getIncidents();
      setIncidents(res.incidents || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.updateIncidentStatus(id, status);
      loadIncidents();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="p-4 text-neutral-400 font-mono text-sm">Loading security incidents...</div>;
  if (error) return <div className="p-4 text-red-400 font-mono text-sm">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium tracking-tight text-neutral-200">Security Incident Database</h2>
        <div className="px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-md text-xs font-mono text-neutral-400">
          {incidents.length} Records
        </div>
      </div>

      <div className="grid gap-4">
        {incidents.length === 0 ? (
          <div className="p-8 border border-neutral-800 rounded-xl bg-neutral-900/40 text-center text-neutral-400 font-mono text-sm">
            No security incidents detected.
          </div>
        ) : (
          incidents.map((incident) => (
            <div key={incident.incident_id} className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900/50 flex flex-col">
              <div className={`px-4 py-3 border-b flex items-center justify-between ${
                incident.severity === 'CRITICAL' ? 'bg-red-950/40 border-red-900/50' : 
                incident.severity === 'HIGH' ? 'bg-amber-950/40 border-amber-900/50' : 
                'bg-neutral-900 border-neutral-800'
              }`}>
                <div className="flex items-center gap-3">
                  {incident.severity === 'CRITICAL' || incident.severity === 'HIGH' ? (
                    <ShieldAlert className={`w-4 h-4 ${incident.severity === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'}`} />
                  ) : (
                    <Shield className="w-4 h-4 text-blue-400" />
                  )}
                  <span className="font-mono text-sm font-medium text-neutral-200">{incident.event_type}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                    incident.severity === 'CRITICAL' ? 'bg-red-950 text-red-300 border-red-800' :
                    incident.severity === 'HIGH' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                    'bg-blue-950 text-blue-300 border-blue-800'
                  }`}>
                    {incident.severity}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                    incident.status === 'RESOLVED' || incident.status === 'CLOSED' || incident.status === 'FALSE_POSITIVE' 
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                    incident.status === 'CONTAINED' ? 'bg-indigo-950 text-indigo-300 border-indigo-800' :
                    'bg-neutral-800 text-neutral-300 border-neutral-700'
                  }`}>
                    {incident.status}
                  </span>
                </div>
                <div className="text-xs font-mono text-neutral-500">
                  {new Date(incident.detected_at).toLocaleString()}
                </div>
              </div>
              
              <div className="p-4 grid md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-mono text-neutral-500 mb-1">Threat Evidence</div>
                    <div className="text-neutral-300">{incident.evidence}</div>
                  </div>
                  <div>
                    <div className="text-xs font-mono text-neutral-500 mb-1">Automated Actions</div>
                    {incident.automated_actions && incident.automated_actions.length > 0 ? (
                      <ul className="space-y-1">
                        {incident.automated_actions.map((act: string, i: number) => (
                          <li key={i} className="flex items-center gap-1.5 text-neutral-300 text-xs">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            {act}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-neutral-500 text-xs italic">No automated actions taken</div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                     <Mail className="w-4 h-4 text-neutral-500" />
                     <span className="text-xs font-mono text-neutral-400">Email Alert: <span className={incident.email_status === 'EMAIL_SENT' ? 'text-emerald-400' : incident.email_status === 'EMAIL_FAILED' ? 'text-red-400' : 'text-amber-400'}>{incident.email_status}</span></span>
                  </div>
                </div>

                <div className="space-y-3 bg-neutral-900/60 p-3 rounded-lg border border-neutral-800 font-mono text-xs">
                  <div className="text-neutral-500 border-b border-neutral-800 pb-2 mb-2">Network Source</div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-neutral-500">IP:</span>
                    <span className="text-neutral-300 truncate">{incident.source_ip}</span>
                    
                    <span className="text-neutral-500">Location:</span>
                    <span className="text-neutral-300 truncate">{incident.city}, {incident.country}</span>
                    
                    <span className="text-neutral-500">ISP/ASN:</span>
                    <span className="text-neutral-300 truncate">{incident.isp} ({incident.asn})</span>
                    
                    <span className="text-neutral-500">VPN/Proxy:</span>
                    <span className={`${incident.vpn_status === 'Detected' || incident.proxy_status === 'Detected' ? 'text-amber-400' : 'text-neutral-300'}`}>
                      VPN: {incident.vpn_status} | Proxy: {incident.proxy_status}
                    </span>
                  </div>
                </div>
              </div>

              {['DETECTED', 'INVESTIGATING', 'CONTAINED'].includes(incident.status) && (
                <div className="px-4 py-3 bg-neutral-900/40 border-t border-neutral-800 flex gap-2 justify-end">
                  <button 
                    onClick={() => handleUpdateStatus(incident.incident_id, 'FALSE_POSITIVE')}
                    className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 text-xs font-mono hover:bg-neutral-800 transition-colors"
                  >
                    Mark False Positive
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(incident.incident_id, 'RESOLVED')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono hover:bg-emerald-500/20 transition-colors"
                  >
                    Resolve Incident
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
