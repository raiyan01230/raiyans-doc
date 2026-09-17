import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Mail, Send, CheckCircle2, AlertTriangle, Shield, RefreshCw, Server, Clock, Check, X } from 'lucide-react';

interface SecurityEmailViewProps {
  onNotify?: (message: string, type?: 'info' | 'error' | 'success') => void;
}

export const SecurityEmailView: React.FC<SecurityEmailViewProps> = ({ onNotify }) => {
  const [config, setConfig] = useState<{ configured: boolean; recipient: string; from: string; provider: string } | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<any>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cfgRes, notifRes, logsRes] = await Promise.all([
        api.getEmailConfig(),
        api.getNotificationSettings(),
        api.getEmailLogs().catch(() => ({ emailDeliveryLogs: [] })),
      ]);
      setConfig(cfgRes);
      setNotificationSettings(notifRes);
      setDeliveryLogs(logsRes.emailDeliveryLogs || []);
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed loading security email settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSendTestEmail = async () => {
    setIsSendingTest(true);
    try {
      const res = await api.sendTestEmail();
      if (res.success) {
        onNotify?.('Test security email successfully sent via Resend API to raiyan3945@gmail.com', 'success');
      } else {
        onNotify?.(`Test email failed: ${res.reason || 'Unknown error'}`, 'error');
      }
      await loadData();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Test email failed', 'error');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleToggleSetting = async (key: string) => {
    if (!notificationSettings) return;
    const updated = {
      ...notificationSettings,
      [key]: !notificationSettings[key],
    };
    setNotificationSettings(updated);
    setIsSavingSettings(true);
    try {
      await api.updateNotificationSettings(updated);
      onNotify?.('Notification preferences updated', 'info');
    } catch (err: unknown) {
      onNotify?.('Failed updating preferences', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center font-mono text-xs text-neutral-400">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading Security Email &amp; Resend telemetry...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 font-mono">
      {/* Header */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-neutral-200" />
              <h2 className="text-lg font-bold text-neutral-100">Resend Security Email &amp; Notification System</h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Production-grade server-side security event dispatching via Resend API to <span className="text-neutral-200 font-semibold">raiyan3945@gmail.com</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleSendTestEmail}
            disabled={isSendingTest || !config?.configured}
            className="px-4 py-2 bg-neutral-100 hover:bg-white text-neutral-950 font-semibold rounded-lg text-xs flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <Send className={`w-3.5 h-3.5 ${isSendingTest ? 'animate-bounce' : ''}`} />
            {isSendingTest ? 'Dispatching Test Email...' : 'Send Test Security Email'}
          </button>
        </div>

        {/* Status Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-neutral-800 text-xs">
          <div className="bg-neutral-950/80 p-4 rounded-lg border border-neutral-800">
            <div className="text-neutral-500 uppercase text-[10px] mb-1">Email Provider</div>
            <div className="font-bold text-neutral-200 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-neutral-400" /> {config?.provider || 'Resend'}
            </div>
            <div className="text-[10px] text-neutral-500 mt-1">From: {config?.from}</div>
          </div>

          <div className="bg-neutral-950/80 p-4 rounded-lg border border-neutral-800">
            <div className="text-neutral-500 uppercase text-[10px] mb-1">Primary Recipient</div>
            <div className="font-bold text-neutral-200 truncate">{config?.recipient || 'raiyan3945@gmail.com'}</div>
            <div className="text-[10px] text-neutral-500 mt-1">Strict Personal Vault Owner</div>
          </div>

          <div className="bg-neutral-950/80 p-4 rounded-lg border border-neutral-800">
            <div className="text-neutral-500 uppercase text-[10px] mb-1">Integration Status</div>
            <div className="flex items-center gap-2 mt-1">
              {config?.configured ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  <CheckCircle2 className="w-3 h-3" /> Configured &amp; Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                  <AlertTriangle className="w-3 h-3" /> API Key Missing in .env
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notification Preferences Grid */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 backdrop-blur">
        <h3 className="text-sm font-bold text-neutral-200 mb-1 flex items-center gap-2">
          <Shield className="w-4 h-4 text-neutral-400" /> Login &amp; Security Event Trigger Controls
        </h3>
        <p className="text-xs text-neutral-400 mb-6">
          Configure which events trigger real-time notification dispatch to your primary security email.
        </p>

        {notificationSettings && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            {[
              { key: 'successfulLoginEmail', label: 'Successful Login Email' },
              { key: 'failedLoginEmail', label: 'Failed Login Attempt' },
              { key: 'newDeviceEmail', label: 'New Device Detection' },
              { key: 'newCountryEmail', label: 'New Country Access' },
              { key: 'vpnAlert', label: 'VPN Usage Alert' },
              { key: 'proxyAlert', label: 'Proxy / Tor Detection' },
              { key: 'sessionAnomaly', label: 'Session Anomaly Alert' },
              { key: 'suspiciousActivity', label: 'Suspicious Activity' },
              { key: 'criticalIncident', label: 'Critical Threat Incident' },
              { key: 'accountFreeze', label: 'Account Freeze / Lockdown' },
              { key: 'recoveryMode', label: 'Security Recovery Mode' },
              { key: 'emergencyLockdown', label: 'Emergency Lockdown' },
            ].map(item => (
              <label
                key={item.key}
                className="flex items-center justify-between p-3 bg-neutral-950/80 rounded-lg border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-colors"
              >
                <span className="text-neutral-300">{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(notificationSettings[item.key])}
                  onChange={() => handleToggleSetting(item.key)}
                  className="w-4 h-4 accent-neutral-200 rounded cursor-pointer"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Email Delivery Logs */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 backdrop-blur">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-neutral-400" /> Resend Delivery Logs &amp; Audit Trail
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">Real-time status of all outgoing security emails</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Logs
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-neutral-950/80 text-neutral-400 uppercase text-[10px] border-b border-neutral-800">
              <tr>
                <th className="p-3">Status</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Recipient</th>
                <th className="p-3">Provider ID</th>
                <th className="p-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono">
              {deliveryLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-neutral-500">
                    No email delivery logs recorded yet. Trigger a test email or login event.
                  </td>
                </tr>
              ) : (
                deliveryLogs.map(log => (
                  <tr key={log.id} className="hover:bg-neutral-950/40">
                    <td className="p-3">
                      {log.status === 'SENT' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                          <Check className="w-3 h-3" /> SENT
                        </span>
                      ) : log.status === 'FAILED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-bold" title={log.failureReason}>
                          <X className="w-3 h-3" /> FAILED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                          PENDING
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-semibold text-neutral-200 truncate max-w-xs">{log.subject}</td>
                    <td className="p-3 text-neutral-400">{log.recipient}</td>
                    <td className="p-3 text-neutral-500">{log.providerResponseId || 'N/A'}</td>
                    <td className="p-3 text-neutral-400">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
