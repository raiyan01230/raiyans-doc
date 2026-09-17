import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { BlockedIP } from '../types';
import {
  Ban,
  Plus,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Globe,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface IpBlocklistViewProps {
  onNotify?: (msg: string, type?: 'info' | 'error') => void;
}

export function IpBlocklistView({ onNotify }: IpBlocklistViewProps) {
  const [blockedIps, setBlockedIps] = useState<BlockedIP[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Form state
  const [isAdding, setIsAdding] = useState(false);
  const [ipInput, setIpInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [isCidr, setIsCidr] = useState(false);
  const [isPermanent, setIsPermanent] = useState(true);
  const [expiresDays, setExpiresDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);

  const loadBlockedIps = async () => {
    setLoading(true);
    try {
      const res = await api.getBlockedIps();
      setBlockedIps(res.blockedIps || []);
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed loading IP blocklist', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlockedIps();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipInput.trim()) {
      onNotify?.('Please provide an IP address or CIDR range', 'error');
      return;
    }
    if (!reasonInput.trim()) {
      onNotify?.('Please specify a reason for this block', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.addBlockedIp({
        ipAddress: ipInput.trim(),
        isCidr,
        reason: reasonInput.trim(),
        isPermanent,
        expiresDays: isPermanent ? undefined : expiresDays,
      });

      onNotify?.(`IP / Range ${ipInput.trim()} blocked successfully`, 'info');
      setIpInput('');
      setReasonInput('');
      setIsAdding(false);
      await loadBlockedIps();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed adding block entry', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, ip: string) => {
    if (!window.confirm(`Unblock IP address ${ip}? This will restore access immediately.`)) {
      return;
    }

    try {
      await api.deleteBlockedIp(id);
      onNotify?.(`IP ${ip} has been removed from blocklist`, 'info');
      await loadBlockedIps();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed removing block', 'error');
    }
  };

  const activeCount = blockedIps.filter(b => b.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-100 font-mono flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-400" />
            <span>IP & CIDR ACCESS BLOCKLIST</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Incoming requests matching these IPs or CIDR subnets are dropped at the edge with HTTP 403.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadBlockedIps}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-800 rounded-lg text-xs font-mono text-red-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Block Entry</span>
          </button>
        </div>
      </div>

      {/* Add Form Accordion */}
      {isAdding && (
        <form
          onSubmit={handleAddSubmit}
          className="bg-neutral-900/90 border border-neutral-800 p-5 rounded-xl space-y-4 font-mono text-xs shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="font-semibold text-neutral-200 uppercase">Create New Security Block</span>
            <span className="text-neutral-500 text-[11px]">Enforced via server middleware</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-neutral-400 mb-1">Target IP Address or CIDR Range:</label>
              <input
                type="text"
                placeholder="e.g. 192.168.1.100 or 10.0.0.0/24"
                value={ipInput}
                onChange={e => {
                  setIpInput(e.target.value);
                  if (e.target.value.includes('/')) setIsCidr(true);
                }}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 rounded-lg focus:outline-none focus:border-red-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">Reason for Block (Audit Log):</label>
              <input
                type="text"
                placeholder="e.g. Repeated malicious scanning or unauthorized attempts"
                value={reasonInput}
                onChange={e => setReasonInput(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 rounded-lg focus:outline-none focus:border-red-600 font-mono"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1 text-[11px] text-neutral-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isCidr}
                onChange={e => setIsCidr(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-950 text-red-600"
              />
              <span>Is Subnet / CIDR notation (e.g. /24)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPermanent}
                onChange={e => setIsPermanent(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-950 text-red-600"
              />
              <span>Permanent Block (No expiration)</span>
            </label>

            {!isPermanent && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-400">Expires in:</span>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={expiresDays}
                  onChange={e => setExpiresDays(parseInt(e.target.value, 10) || 7)}
                  className="w-16 bg-neutral-950 border border-neutral-800 px-2 py-1 rounded text-center"
                />
                <span className="text-neutral-400">days</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg font-semibold"
            >
              {submitting ? 'Enforcing...' : 'Enforce Block'}
            </button>
          </div>
        </form>
      )}

      {/* Blocklist Table */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-neutral-900/90 text-neutral-400 text-[11px] border-b border-neutral-800">
              <tr>
                <th className="py-2.5 px-3">IP / CIDR SUBNET</th>
                <th className="py-2.5 px-3">TYPE</th>
                <th className="py-2.5 px-3">STATUS</th>
                <th className="py-2.5 px-3">REASON</th>
                <th className="py-2.5 px-3">BLOCKED BY</th>
                <th className="py-2.5 px-3">EXPIRES</th>
                <th className="py-2.5 px-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
              {blockedIps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500">
                    <ShieldCheck className="w-6 h-6 mx-auto mb-2 text-neutral-600" />
                    <span>No IP addresses or CIDR ranges currently blocked.</span>
                  </td>
                </tr>
              ) : (
                blockedIps.map(b => (
                  <tr key={b.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-neutral-100 flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{b.ip_address}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 text-[10px] bg-neutral-800 text-neutral-300 border border-neutral-700 rounded">
                        {b.is_cidr ? 'CIDR Subnet' : 'Single IP'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {b.is_active ? (
                        <span className="px-1.5 py-0.5 text-[10px] bg-red-950 text-red-300 border border-red-800 rounded font-semibold">
                          ENFORCED
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-[10px] bg-neutral-800 text-neutral-400 border border-neutral-700 rounded">
                          EXPIRED
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-300 max-w-xs truncate" title={b.reason}>
                      {b.reason}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-400">{b.blocked_by}</td>
                    <td className="py-2.5 px-3 text-neutral-400 whitespace-nowrap">
                      {b.is_permanent
                        ? 'Permanent'
                        : b.expires_at
                        ? new Date(b.expires_at).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {b.is_active && (
                        <button
                          onClick={() => handleDelete(b.id, b.ip_address)}
                          className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-red-300 rounded transition-colors text-[11px]"
                          title="Unblock this IP"
                        >
                          Unblock
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
