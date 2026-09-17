import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { BackupItem } from '../types';
import {
  Download,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  FileCheck,
  HardDrive,
  Plus,
} from 'lucide-react';

interface BackupManagerViewProps {
  onNotify?: (msg: string, type?: 'info' | 'error') => void;
  onRestoreComplete?: () => void;
}

export function BackupManagerView({ onNotify, onRestoreComplete }: BackupManagerViewProps) {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const res = await api.getBackups();
      setBackups(res.backups || []);
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed loading backups', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  // Poll if any backup is running or verifying
  useEffect(() => {
    const hasActiveJob = backups.some(b => b.status === 'Pending' || b.status === 'Running' || b.status === 'Verifying');
    if (!hasActiveJob) return;

    const timer = setInterval(() => {
      loadBackups();
    }, 1500);

    return () => clearInterval(timer);
  }, [backups]);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    try {
      const res = await api.createBackup();
      onNotify?.(res.message || 'Full backup pipeline initiated', 'info');
      await loadBackups();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Backup initiation failed', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async (backup: BackupItem) => {
    if (
      !window.confirm(
        `RESTORE WARNING: Restoring from "${backup.filename}" will replace current vault records with the ${backup.record_count} records saved in this backup. Proceed?`
      )
    ) {
      return;
    }

    setRestoringId(backup.id);
    try {
      const res = await api.restoreBackup(backup.id);
      onNotify?.(res.message, 'info');
      onRestoreComplete?.();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Restoration failed', 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this backup archive permanently?')) return;
    try {
      await api.deleteBackup(id);
      onNotify?.('Backup archive removed', 'info');
      await loadBackups();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const handleDownload = (backup: BackupItem) => {
    const token = sessionStorage.getItem('vault_auth_token');
    const downloadUrl = `/api/backups/${encodeURIComponent(backup.id)}/download`;
    // Trigger download with auth token in query or direct fetch
    fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = backup.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        onNotify?.(`Downloaded verified archive ${backup.filename}`, 'info');
      })
      .catch(err => {
        onNotify?.(err.message || 'Download error', 'error');
      });
  };

  const getStatusBadge = (status: BackupItem['status']) => {
    if (status === 'Completed') {
      return (
        <span className="px-2 py-0.5 text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-mono font-semibold flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          <span>VERIFIED</span>
        </span>
      );
    }
    if (status === 'Verifying') {
      return (
        <span className="px-2 py-0.5 text-[10px] bg-purple-950 text-purple-300 border border-purple-800 rounded font-mono animate-pulse">
          VERIFYING SHA-256...
        </span>
      );
    }
    if (status === 'Running' || status === 'Pending') {
      return (
        <span className="px-2 py-0.5 text-[10px] bg-sky-950 text-sky-300 border border-sky-800 rounded font-mono animate-pulse">
          BACKING UP...
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[10px] bg-red-950 text-red-300 border border-red-800 rounded font-mono">
        FAILED
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-100 font-mono flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-purple-400" />
            <span>VAULT FULL BACKUP & VERIFICATION PIPELINE</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Cryptographically verified snapshots of database records, files metadata, and security settings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadBackups}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleCreateBackup}
            disabled={isCreating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-950/80 hover:bg-purple-900 border border-purple-800 rounded-lg text-xs font-mono text-purple-300 transition-colors font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isCreating ? 'Initiating Pipeline...' : 'Create Full Backup'}</span>
          </button>
        </div>
      </div>

      {/* Backups List */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-neutral-900/90 text-neutral-400 text-[11px] border-b border-neutral-800">
              <tr>
                <th className="py-2.5 px-3">BACKUP ARCHIVE</th>
                <th className="py-2.5 px-3">STATUS</th>
                <th className="py-2.5 px-3">SIZE</th>
                <th className="py-2.5 px-3">RECORDS / FILES</th>
                <th className="py-2.5 px-3">SHA-256 CHECKSUM</th>
                <th className="py-2.5 px-3">CREATED</th>
                <th className="py-2.5 px-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500">
                    <ShieldCheck className="w-6 h-6 mx-auto mb-2 text-neutral-600" />
                    <span>No backups created yet. Click "Create Full Backup" to generate one.</span>
                  </td>
                </tr>
              ) : (
                backups.map(b => (
                  <tr key={b.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-neutral-100 flex items-center gap-2">
                      <FileCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="truncate max-w-xs">{b.filename}</span>
                    </td>
                    <td className="py-2.5 px-3">{getStatusBadge(b.status)}</td>
                    <td className="py-2.5 px-3 text-neutral-400 whitespace-nowrap">
                      {b.size_bytes ? `${(b.size_bytes / 1024).toFixed(1)} KB` : 'Pending'}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-400">
                      {b.record_count} records • {b.file_count} files
                    </td>
                    <td className="py-2.5 px-3 text-neutral-500 font-mono text-[10px]" title={b.checksum_sha256}>
                      {b.checksum_sha256 ? `${b.checksum_sha256.substring(0, 16)}...` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-400 whitespace-nowrap">
                      {new Date(b.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {b.status === 'Completed' && (
                          <>
                            <button
                              onClick={() => handleDownload(b)}
                              className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-purple-300"
                              title="Download backup archive"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRestore(b)}
                              disabled={restoringId === b.id}
                              className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-emerald-300"
                              title="Restore vault from this backup"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${restoringId === b.id ? 'animate-spin' : ''}`} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-red-400"
                          title="Delete archive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
