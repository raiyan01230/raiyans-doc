import React, { useState } from 'react';
import { X, Copy, Check, Eye, EyeOff, Edit3, Trash2, Pin, Calendar, Tag, Shield, AlertTriangle } from 'lucide-react';
import { PrivateRecord } from '../types';

interface RecordDetailModalProps {
  record: PrivateRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (record: PrivateRecord) => void;
  onDelete: (id: string) => Promise<void>;
}

export const RecordDetailModal: React.FC<RecordDetailModalProps> = ({
  record,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !record) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(record.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(record.id);
      onClose();
    } finally {
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        id="record-detail-modal"
        className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/95">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-neutral-800 border border-neutral-700/60 text-xs font-mono text-neutral-300">
              {record.category}
            </span>
            {record.is_pinned && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded">
                <Pin className="w-3 h-3" /> Pinned
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Title */}
          <div>
            <h1 className="text-lg font-medium text-neutral-100 tracking-tight">
              {record.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-neutral-500 font-mono">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-600" />
                Updated: {new Date(record.updated_at).toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-neutral-600">
                ID: {record.id.slice(0, 18)}...
              </span>
            </div>
          </div>

          {/* Tags */}
          {record.tags && record.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag className="w-3 h-3 text-neutral-500" />
              {record.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-950 border border-neutral-800 text-neutral-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Secure Payload Content Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400 font-mono uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                Confidential Payload
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRevealed(!isRevealed)}
                  className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center gap-1.5 transition-colors font-mono text-[11px] cursor-pointer"
                >
                  {isRevealed ? (
                    <>
                      <EyeOff className="w-3 h-3" /> Hide
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" /> Reveal
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded bg-neutral-100 hover:bg-white text-neutral-950 flex items-center gap-1.5 transition-colors font-medium text-[11px] cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy Payload
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="relative rounded-lg bg-neutral-950 border border-neutral-800 p-4 font-mono text-xs text-neutral-200 leading-relaxed overflow-x-auto select-all">
              {isRevealed ? (
                <pre className="whitespace-pre-wrap break-all">{record.content}</pre>
              ) : (
                <div className="text-neutral-500 py-3 flex items-center justify-between">
                  <span>••••••••••••••••••••••••••••••••••••••••••••</span>
                  <span className="text-[11px] text-neutral-600 font-sans">
                    Click 'Reveal' or 'Copy Payload'
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Delete Confirmation Box */}
          {isConfirmingDelete && (
            <div className="p-4 rounded-lg bg-rose-950/60 border border-rose-800/80 space-y-2">
              <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Confirm Irreversible Deletion
              </div>
              <p className="text-xs text-rose-200/80 leading-relaxed">
                Are you sure you want to permanently delete "{record.title}" from your private database?
                This action cannot be undone.
              </p>
              <div className="pt-2 flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs cursor-pointer font-medium flex items-center gap-1.5"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <div>
            {!isConfirmingDelete && (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="px-3 py-1.5 rounded bg-transparent hover:bg-rose-950/50 text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-transparent hover:border-rose-900"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Record
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(record);
              }}
              className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Record
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-neutral-100 hover:bg-white text-neutral-950 text-xs font-medium transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
