import React, { useEffect, useState } from 'react';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Users,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { api } from '../lib/api';
import { OwnerAccessLink } from '../types';

export const AccessLinksView: React.FC = () => {
  const [links, setLinks] = useState<OwnerAccessLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [label, setLabel] = useState('External Compliance Auditor');
  const [recipient, setRecipient] = useState('auditor@security.org');
  const [scope, setScope] = useState('read_only');
  const [expirationHours, setExpirationHours] = useState(24);
  const [maxUses, setMaxUses] = useState(5);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const res = await api.getAccessLinks();
      setLinks(res.links || []);
    } catch (err: any) {
      console.error('Fetch access links error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleCreateLink = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await api.createAccessLink({
        label,
        recipient,
        scope,
        expirationHours,
        maxUses,
      });
      if (res.success) {
        setShowCreateModal(false);
        await fetchLinks();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create access link.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await api.revokeAccessLink(id);
      await fetchLinks();
    } catch (err: any) {
      console.error('Revoke error:', err);
    }
  };

  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 font-sans text-neutral-200">
      {/* Header */}
      <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-mono font-bold text-base text-neutral-100 uppercase tracking-wider">
              OWNER PASSWORDLESS ACCESS LINKS
            </h1>
            <p className="text-xs text-neutral-400 font-mono">
              Generate time-bound, scoped passwordless links with full server revocation.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs rounded-lg transition-colors flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>GENERATE NEW LINK</span>
        </button>
      </div>

      {/* Links List */}
      {loading ? (
        <div className="p-8 text-center font-mono text-xs text-neutral-400">
          LOADING ACCESS LINKS FROM SERVER...
        </div>
      ) : links.length === 0 ? (
        <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-xl text-center font-mono text-xs text-neutral-400 space-y-2">
          <p>NO ACCESS LINKS GENERATED YET.</p>
          <p className="text-[11px] text-neutral-500">Create scoped access links for auditors or external inspectors.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 font-mono text-xs">
          {links.map((link) => (
            <div
              key={link.id}
              className={`p-4 bg-neutral-900 border rounded-xl space-y-3 transition-colors ${
                link.is_revoked ? 'border-red-500/30 bg-neutral-950/60 opacity-60' : 'border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2.5">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-neutral-100 text-sm">{link.label}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 border border-purple-500/30 text-purple-300 uppercase font-semibold">
                    {link.scope}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {link.is_revoked ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 border border-red-500/30 text-red-400 font-bold uppercase">
                      REVOKED
                    </span>
                  ) : (
                    <button
                      onClick={() => handleRevoke(link.id)}
                      className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded transition-colors text-[11px]"
                    >
                      REVOKE ACCESS
                    </button>
                  )}
                </div>
              </div>

              {/* URL Display */}
              <div className="flex items-center space-x-2 bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                <input
                  readOnly
                  value={link.link_url}
                  className="bg-transparent text-neutral-300 font-mono text-xs w-full focus:outline-none"
                />
                <button
                  onClick={() => handleCopyUrl(link.link_url, link.id)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-200 bg-neutral-900 rounded border border-neutral-800 transition-colors shrink-0"
                >
                  {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-neutral-400">
                <div>Recipient: <strong className="text-neutral-200">{link.recipient}</strong></div>
                <div>Created By: <strong className="text-neutral-200">{link.created_by}</strong></div>
                <div>Uses: <strong className="text-neutral-200">{link.current_uses} / {link.max_uses}</strong></div>
                <div>Expires: <strong className="text-amber-400">{new Date(link.expires_at).toLocaleDateString()}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl max-w-lg w-full p-5 space-y-4 text-xs font-mono">
            <h2 className="font-bold text-sm text-neutral-100 uppercase border-b border-neutral-800 pb-2">
              CREATE PASSWORDLESS ACCESS LINK
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-neutral-400 mb-1">LINK LABEL / PURPOSE:</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">RECIPIENT EMAIL / NAME:</label>
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">EXPIRATION HOURS:</label>
                  <select
                    value={expirationHours}
                    onChange={(e) => setExpirationHours(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200 focus:border-purple-500 focus:outline-none"
                  >
                    <option value={1}>1 Hour</option>
                    <option value={24}>24 Hours</option>
                    <option value={72}>3 Days</option>
                    <option value={168}>7 Days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1">MAX USES:</label>
                  <input
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3.5 py-1.5 text-neutral-400 hover:text-neutral-200 rounded"
              >
                CANCEL
              </button>
              <button
                onClick={handleCreateLink}
                disabled={creating}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded"
              >
                {creating ? 'CREATING...' : 'GENERATE LINK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
