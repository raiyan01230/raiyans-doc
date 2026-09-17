import React, { useState } from 'react';
import { SyncConflict, PrivateRecord } from '../types';
import { api } from '../lib/api';
import {
  AlertTriangle,
  GitMerge,
  Server,
  Laptop,
  Check,
  X,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface SyncConflictModalProps {
  conflict: SyncConflict | null;
  onResolved: (updatedRecord: PrivateRecord) => void;
  onClose: () => void;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  conflict,
  onResolved,
  onClose,
}) => {
  const [resolutionMode, setResolutionMode] = useState<'keep_server' | 'keep_client' | 'merge'>('merge');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!conflict) return null;

  const handleResolve = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await api.resolveConflict({
        recordId: conflict.recordId,
        resolution: resolutionMode,
        clientContent: conflict.clientRecord.content,
        clientTitle: conflict.clientRecord.title,
        clientTags: conflict.clientRecord.tags,
      });
      onResolved(res.record);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed resolving sync conflict');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h2 className="text-base font-semibold text-neutral-100 font-mono">
              Concurrent Multi-Device Sync Conflict
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">
          Record <span className="font-mono text-neutral-100 font-semibold">&ldquo;{conflict.serverRecord.title}&rdquo;</span> was modified on another device while you had unsaved edits. Select how you want to reconcile the conflicting versions:
        </p>

        {errorMessage && (
          <div className="p-3 bg-rose-950/70 border border-rose-800 rounded-lg text-xs text-rose-200">
            {errorMessage}
          </div>
        )}

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          {/* Server Version */}
          <div className="bg-neutral-950/80 p-3.5 rounded-lg border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-neutral-400 text-[11px] pb-1 border-b border-neutral-800">
              <span className="flex items-center gap-1">
                <Server className="w-3.5 h-3.5 text-neutral-400" />
                Server Version (v{conflict.serverVersion})
              </span>
              <span className="text-[10px]">{new Date(conflict.serverRecord.updated_at).toLocaleTimeString()}</span>
            </div>
            <div className="text-neutral-200 font-semibold">{conflict.serverRecord.title}</div>
            <div className="bg-neutral-900/90 p-2 rounded text-[11px] text-neutral-300 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
              {conflict.serverRecord.content || '(empty)'}
            </div>
          </div>

          {/* Client Version */}
          <div className="bg-neutral-950/80 p-3.5 rounded-lg border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-neutral-400 text-[11px] pb-1 border-b border-neutral-800">
              <span className="flex items-center gap-1">
                <Laptop className="w-3.5 h-3.5 text-neutral-400" />
                Your Device Edit (v{conflict.clientVersion})
              </span>
              <span className="text-[10px]">Unsynced</span>
            </div>
            <div className="text-neutral-200 font-semibold">{conflict.clientRecord.title}</div>
            <div className="bg-neutral-900/90 p-2 rounded text-[11px] text-neutral-300 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
              {conflict.clientRecord.content || '(empty)'}
            </div>
          </div>
        </div>

        {/* Resolution Selector */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-mono text-neutral-400 uppercase tracking-wider block">
            Resolution Action
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setResolutionMode('merge')}
              className={`p-2.5 rounded-lg border text-xs font-mono text-left transition-colors cursor-pointer ${
                resolutionMode === 'merge'
                  ? 'bg-neutral-800 border-neutral-300 text-neutral-100 ring-1 ring-neutral-400'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              <div className="font-semibold flex items-center gap-1 mb-0.5">
                <GitMerge className="w-3.5 h-3.5 text-neutral-300" /> Merge Both
              </div>
              <div className="text-[10px] text-neutral-400">Append changes together</div>
            </button>

            <button
              type="button"
              onClick={() => setResolutionMode('keep_client')}
              className={`p-2.5 rounded-lg border text-xs font-mono text-left transition-colors cursor-pointer ${
                resolutionMode === 'keep_client'
                  ? 'bg-neutral-800 border-neutral-300 text-neutral-100 ring-1 ring-neutral-400'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              <div className="font-semibold flex items-center gap-1 mb-0.5">
                <Laptop className="w-3.5 h-3.5 text-neutral-300" /> Keep My Edit
              </div>
              <div className="text-[10px] text-neutral-400">Overwrite server record</div>
            </button>

            <button
              type="button"
              onClick={() => setResolutionMode('keep_server')}
              className={`p-2.5 rounded-lg border text-xs font-mono text-left transition-colors cursor-pointer ${
                resolutionMode === 'keep_server'
                  ? 'bg-neutral-800 border-neutral-300 text-neutral-100 ring-1 ring-neutral-400'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              <div className="font-semibold flex items-center gap-1 mb-0.5">
                <Server className="w-3.5 h-3.5 text-neutral-300" /> Keep Server
              </div>
              <div className="text-[10px] text-neutral-400">Discard local modifications</div>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-mono rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleResolve}
            disabled={isSubmitting}
            className="px-4 py-1.5 bg-neutral-100 hover:bg-white text-neutral-950 font-medium text-xs font-mono rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <span className="w-3 h-3 border border-neutral-950 border-t-transparent rounded-full animate-spin"></span>
                <span>Resolving...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Reconcile Record</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
