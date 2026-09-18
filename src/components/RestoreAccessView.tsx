import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  UserCheck,
  Globe,
  Smartphone,
  Key,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Activity,
  Layers,
  Lock,
} from 'lucide-react';
import { api } from '../lib/api';
import { MultiLayerEvaluation } from '../types';

interface RestoreAccessViewProps {
  entityId: string;
  onBack?: () => void;
  onNavigateToView?: (path: string) => void;
}

export const RestoreAccessView: React.FC<RestoreAccessViewProps> = ({
  entityId,
  onBack,
  onNavigateToView,
}) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<MultiLayerEvaluation | null>(null);
  const [restoringAction, setRestoringAction] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRestoreDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRestoreDetails(entityId);
      setDetails(data);
      setEvaluation(data.evaluation);
    } catch (err: any) {
      console.error('Fetch restore details error:', err);
      setError(err?.message || 'Failed to load access restoration state from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestoreDetails();
  }, [entityId]);

  const handleExecuteAction = async (action: string) => {
    setRestoringAction(action);
    setActionSuccessMsg(null);
    setError(null);
    try {
      const res = await api.executeRestoreAction(entityId, action);
      if (res.success) {
        setActionSuccessMsg(`Executed: ${res.restoredActions.join(', ')}`);
        setEvaluation(res.evaluation);
        await fetchRestoreDetails();
      } else {
        setError('Restoration action was rejected by server.');
      }
    } catch (err: any) {
      console.error('Execute restore error:', err);
      setError(err?.message || 'Failed to execute restoration action.');
    } finally {
      setRestoringAction(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-neutral-400 font-mono text-xs flex flex-col items-center justify-center space-y-3">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span>EVALUATING MULTI-LAYER ACCESS RESTRICTIONS FOR {entityId}...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-neutral-200">
      {/* Top Breadcrumb & Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 rounded-lg text-neutral-300 font-mono text-xs flex items-center space-x-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>BACK TO BLOCKED MANAGEMENT</span>
        </button>

        <button
          onClick={fetchRestoreDetails}
          className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 rounded-lg text-neutral-300 font-mono text-xs flex items-center space-x-1.5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>RE-EVALUATE RESTRICTIONS</span>
        </button>
      </div>

      {/* Header Banner */}
      <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-mono font-bold text-base text-neutral-100 uppercase tracking-wider">
                ACCESS RESTORATION WORKSPACE
              </h1>
              <p className="text-xs text-neutral-400 font-mono">
                TARGET ENTITY / USER ID: <span className="text-emerald-400 font-bold">{entityId}</span>
              </p>
            </div>
          </div>

          <div>
            {evaluation?.isFullyAccessible ? (
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono text-xs font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>FULLY RESTORED & ACCESSIBLE</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 font-mono text-xs font-bold flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
                <span>RESTRICTIONS ACTIVE</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Messages */}
      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 font-mono text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 font-mono text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Multi-Layer Evaluation Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
        {/* Layer 1: Account Ban / Freeze */}
        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div className="flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-blue-400" />
              <span className="font-bold text-neutral-200">LAYER 1: ACCOUNT BAN & FREEZE</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                evaluation?.accountStatus === 'ACTIVE'
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/20 border border-red-500/30 text-red-400'
              }`}
            >
              {evaluation?.accountStatus}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400">
            {evaluation?.accountBanReason || evaluation?.accountFreezeReason || 'No active account-level ban or freeze.'}
          </p>
          <div className="pt-2 flex justify-end">
            {evaluation?.accountStatus !== 'ACTIVE' ? (
              <button
                onClick={() => handleExecuteAction('UNBAN_ACCOUNT')}
                disabled={Boolean(restoringAction)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {restoringAction === 'UNBAN_ACCOUNT' ? 'UNBANNING...' : 'UNBAN ACCOUNT & UNFREEZE'}
              </button>
            ) : (
              <span className="text-[10px] text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ACCOUNT LEVEL CLEAR</span>
              </span>
            )}
          </div>
        </div>

        {/* Layer 2: IP Blocklist */}
        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div className="flex items-center space-x-2">
              <Globe className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-neutral-200">LAYER 2: IP NETWORK BLOCK</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                evaluation?.ipStatus === 'ALLOWED'
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/20 border border-red-500/30 text-red-400'
              }`}
            >
              {evaluation?.ipStatus}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400">
            {evaluation?.blockedIp ? `Active IP Block on ${evaluation.blockedIp}` : 'No IP address blocks targeting this entity.'}
          </p>
          <div className="pt-2 flex justify-end">
            {evaluation?.ipStatus === 'BLOCKED' ? (
              <button
                onClick={() => handleExecuteAction('UNBLOCK_IP')}
                disabled={Boolean(restoringAction)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {restoringAction === 'UNBLOCK_IP' ? 'UNBLOCKING...' : 'UNBLOCK IP ADDRESS'}
              </button>
            ) : (
              <span className="text-[10px] text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>IP LAYER CLEAR</span>
              </span>
            )}
          </div>
        </div>

        {/* Layer 3: Device Hardware Trust */}
        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-neutral-200">LAYER 3: DEVICE HARDWARE TRUST</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                evaluation?.deviceStatus === 'TRUSTED'
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
              }`}
            >
              {evaluation?.deviceStatus}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400">
            Hardware fingerprint state: {evaluation?.deviceStatus}.
          </p>
          <div className="pt-2 flex justify-end">
            {evaluation?.deviceStatus !== 'TRUSTED' ? (
              <button
                onClick={() => handleExecuteAction('RESTORE_DEVICE')}
                disabled={Boolean(restoringAction)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {restoringAction === 'RESTORE_DEVICE' ? 'RESTORING...' : 'RESTORE DEVICE TRUST'}
              </button>
            ) : (
              <span className="text-[10px] text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>DEVICE HARDWARE TRUSTED</span>
              </span>
            )}
          </div>
        </div>

        {/* Layer 4: Session Quarantine */}
        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div className="flex items-center space-x-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-neutral-200">LAYER 4: SESSION QUARANTINE</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                evaluation?.sessionStatus === 'ACTIVE'
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/20 border border-red-500/30 text-red-400'
              }`}
            >
              {evaluation?.sessionStatus}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400">
            Current token quarantine state: {evaluation?.sessionStatus}.
          </p>
          <div className="pt-2 flex justify-end">
            {evaluation?.sessionStatus === 'QUARANTINED' ? (
              <button
                onClick={() => handleExecuteAction('RELEASE_SESSION')}
                disabled={Boolean(restoringAction)}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {restoringAction === 'RELEASE_SESSION' ? 'RELEASING...' : 'RELEASE SESSION QUARANTINE'}
              </button>
            ) : (
              <span className="text-[10px] text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>SESSION QUARANTINE CLEAR</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Master Action Bar */}
      <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between">
        <div>
          <h3 className="font-mono font-bold text-xs text-neutral-100 uppercase">
            MASTER OVERRIDE: RESTORE ALL ELIGIBLE ACCESS
          </h3>
          <p className="text-xs text-neutral-400 font-mono">
            Applies backend unban, lifts freezes, unblocks IP rules, restores device trust, and releases session quarantine in a single transaction.
          </p>
        </div>

        <button
          onClick={() => handleExecuteAction('RESTORE_ALL_ELIGIBLE')}
          disabled={Boolean(restoringAction) || evaluation?.isFullyAccessible}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-40"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{restoringAction === 'RESTORE_ALL_ELIGIBLE' ? 'RESTORING ALL...' : 'RESTORE ALL ELIGIBLE ACCESS'}</span>
        </button>
      </div>
    </div>
  );
};
