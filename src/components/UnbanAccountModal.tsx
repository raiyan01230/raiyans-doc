import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldAlert,
  Activity,
  FileText,
} from 'lucide-react';
import { api } from '../lib/api';
import { BlockedAccountEntity, MultiLayerEvaluation } from '../types';

interface UnbanAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: BlockedAccountEntity | null;
  onUnbanSuccess?: () => void;
  onOpenRestoreView?: (userId: string) => void;
}

export const UnbanAccountModal: React.FC<UnbanAccountModalProps> = ({
  isOpen,
  onClose,
  account,
  onUnbanSuccess,
  onOpenRestoreView,
}) => {
  const [unbanReason, setUnbanReason] = useState('Owner manual identity verification & access restoration');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultEvaluation, setResultEvaluation] = useState<MultiLayerEvaluation | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !account) return null;

  const handleConfirmUnban = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.unbanAccount(account.user_id, unbanReason);
      if (res.success) {
        setIsSuccess(true);
        setResultEvaluation(res.evaluation);
        if (onUnbanSuccess) onUnbanSuccess();
      } else {
        setError('UNBAN FAILED: Server rejected unban request.');
      }
    } catch (err: any) {
      console.error('Unban error:', err);
      setError(err?.message || 'UNBAN FAILED: Failed to communicate with security control server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl max-w-xl w-full overflow-hidden shadow-2xl text-neutral-200 text-xs">
        {/* Header */}
        <div className="p-4 bg-neutral-950/60 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-mono font-semibold text-sm text-neutral-100 uppercase tracking-wider">
                {isSuccess ? 'UNBAN SUCCESSFUL' : 'UNBAN ACCOUNT CONFIRMATION'}
              </h2>
              <p className="text-[10px] text-neutral-400">
                Server-Enforced Access Control Override
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {!isSuccess ? (
            <>
              {/* Target Account Summary */}
              <div className="bg-neutral-950/80 p-3.5 rounded-lg border border-neutral-800/80 space-y-2">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-400 font-mono text-[11px]">ACCOUNT IDENTIFIER:</span>
                  <span className="font-mono font-bold text-neutral-100 text-[11px]">{account.email}</span>
                </div>
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-400 font-mono text-[11px]">ACCOUNT ID:</span>
                  <span className="font-mono text-neutral-300 text-[11px]">{account.user_id}</span>
                </div>
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-400 font-mono text-[11px]">CURRENT STATUS:</span>
                  <span className="font-mono font-bold px-2 py-0.5 rounded text-[10px] bg-red-500/20 border border-red-500/30 text-red-400">
                    {account.status}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-400 font-mono text-[11px]">BAN REASON:</span>
                  <span className="font-mono text-neutral-300 text-right text-[11px] max-w-[240px] truncate">
                    {account.reason}
                  </span>
                </div>
                {account.incident_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 font-mono text-[11px]">RELATED INCIDENT:</span>
                    <span className="font-mono text-amber-400 text-[11px]">{account.incident_id}</span>
                  </div>
                )}
              </div>

              {/* Unban Reason Form */}
              <div>
                <label className="block text-[11px] font-mono text-neutral-300 mb-1.5 uppercase">
                  UNBAN AUDIT REASON / JUSTIFICATION:
                </label>
                <textarea
                  value={unbanReason}
                  onChange={(e) => setUnbanReason(e.target.value)}
                  rows={2}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 font-mono text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Enter reason for lifting account ban..."
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center space-x-2 text-red-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Warning Notice */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300/90 text-[11px] space-y-1">
                <div className="font-semibold flex items-center space-x-1 font-mono">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>SECURITY EVALUATION NOTICE</span>
                </div>
                <p>
                  Unbanning this account will remove the account-level ban in the backend store and log an official security audit record. Any remaining perimeter restrictions (IP blocks, untrusted device tokens, or quarantined sessions) will be evaluated automatically.
                </p>
              </div>
            </>
          ) : (
            /* Unban Successful Result Screen */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 space-y-2">
                <div className="flex items-center space-x-2 font-mono font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>UNBAN SUCCESSFUL</span>
                </div>
                <p className="text-xs text-emerald-300/90">
                  The backend server has confirmed that the ban for <strong className="text-emerald-200">{account.email}</strong> was successfully removed and updated to <span className="font-mono text-xs uppercase bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">ACTIVE</span>.
                </p>
              </div>

              {/* Status Breakdown */}
              <div className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800 space-y-2 font-mono text-xs">
                <div className="flex justify-between border-b border-neutral-800 pb-1.5">
                  <span className="text-neutral-400">Account State:</span>
                  <span className="text-emerald-400 font-bold">ACTIVE</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-1.5">
                  <span className="text-neutral-400">Ban State:</span>
                  <span className="text-emerald-400 font-bold">REMOVED</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-1.5">
                  <span className="text-neutral-400">Audit Record:</span>
                  <span className="text-blue-400">CREATED & SIGNED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Notification Email:</span>
                  <span className="text-purple-400">DISPATCHED (Resend)</span>
                </div>
              </div>

              {/* Multi-Layer Evaluation Notice */}
              {resultEvaluation && resultEvaluation.hasRemainingRestrictions ? (
                <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-lg space-y-2">
                  <div className="flex items-center space-x-2 text-red-400 font-mono font-bold text-xs">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>ACCOUNT BAN REMOVED BUT ACCESS STILL RESTRICTED BY:</span>
                  </div>
                  <ul className="space-y-1 font-mono text-[11px] text-red-300 pl-6 list-disc">
                    {resultEvaluation.activeRestrictions.map((rst, idx) => (
                      <li key={idx} className="font-semibold">{rst}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-neutral-400 pt-1">
                    To completely clear all perimeter restrictions, navigate to the Complete Restore Workspace.
                  </p>
                  {onOpenRestoreView && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenRestoreView(account.user_id);
                      }}
                      className="w-full mt-2 py-2 px-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 font-mono text-xs rounded-lg transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <span>OPEN COMPLETE RESTORE WORKSPACE</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center space-x-2 text-emerald-300 font-mono text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>ALL SECURITY RESTRICTIONS CLEARED — NEW LOGINS ALLOWED SUBJECT TO POLICY</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-950/60 border-t border-neutral-800 flex items-center justify-end space-x-2">
          {!isSuccess ? (
            <>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 text-neutral-400 hover:text-neutral-200 font-mono text-xs rounded-lg hover:bg-neutral-800 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmUnban}
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-semibold text-xs rounded-lg transition-colors flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">UNBANNING ON SERVER...</span>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>CONFIRM UNBAN</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-mono text-xs rounded-lg transition-colors"
            >
              CLOSE
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
