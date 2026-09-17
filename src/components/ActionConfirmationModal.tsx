import React, { useState } from 'react';
import { api } from '../lib/api';
import { ShieldAlert, AlertTriangle, Lock, Ban, Snowflake, Flame, RefreshCw, X } from 'lucide-react';

export interface ActionTargetPayload {
  type:
    | 'freeze_session'
    | 'revoke_session'
    | 'block_ip'
    | 'untrust_device'
    | 'freeze_account'
    | 'lockdown'
    | 'revoke_all_sessions';
  targetId?: string;
}

interface ActionConfirmationModalProps {
  actionPayload: ActionTargetPayload | null;
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (message: string, type?: 'info' | 'error' | 'success') => void;
  onSuccessAction?: () => void;
}

export const ActionConfirmationModal: React.FC<ActionConfirmationModalProps> = ({
  actionPayload,
  isOpen,
  onClose,
  onNotify,
  onSuccessAction,
}) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [securityCode, setSecurityCode] = useState('');

  if (!isOpen || !actionPayload) return null;

  const getActionDetails = () => {
    switch (actionPayload.type) {
      case 'freeze_session':
        return {
          title: 'FREEZE / QUARANTINE SESSION',
          icon: Lock,
          color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
          description: `You are requesting an immediate security quarantine for Session ID ${actionPayload.targetId || 'target'}. This session will be restricted from reading or writing vault records.`,
          buttonText: 'CONFIRM SESSION QUARANTINE',
        };
      case 'block_ip':
        return {
          title: 'PERMANENT PERIMETER IP BLOCK',
          icon: Ban,
          color: 'text-red-400 bg-red-500/10 border-red-500/30',
          description: `You are requesting an immediate network perimeter block for IP ${actionPayload.targetId || 'target'}. All future network requests from this IP will be dropped.`,
          buttonText: 'CONFIRM IP BLOCK',
        };
      case 'untrust_device':
        return {
          title: 'REVOKE DEVICE TRUST & TERMINATE',
          icon: ShieldAlert,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
          description: `You are requesting to mark Device ${actionPayload.targetId || 'target'} as UNTRUSTED and terminate its active sessions.`,
          buttonText: 'CONFIRM DEVICE REVOCATION',
        };
      case 'freeze_account':
        return {
          title: 'EMERGENCY ACCOUNT FREEZE',
          icon: Snowflake,
          color: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
          description: `You are initiating an emergency account freeze. Modifying vault operations will be restricted until unfrozen with your admin security code.`,
          buttonText: 'CONFIRM ACCOUNT FREEZE',
        };
      case 'lockdown':
        return {
          title: 'GLOBAL EMERGENCY LOCKDOWN',
          icon: Flame,
          color: 'text-red-500 bg-red-500/20 border-red-500',
          description: `You are activating Global Emergency Lockdown. File previews, downloads, and modifying routes will be blocked immediately for all sessions.`,
          buttonText: 'ACTIVATE EMERGENCY LOCKDOWN',
        };
      case 'revoke_all_sessions':
        return {
          title: 'REVOKE ALL OTHER SESSIONS',
          icon: ShieldAlert,
          color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
          description: `You are revoking all active sessions except your current device session. All other devices will be signed out immediately.`,
          buttonText: 'CONFIRM REVOKE ALL SESSIONS',
        };
      default:
        return {
          title: 'CONFIRM SECURITY ACTION',
          icon: ShieldAlert,
          color: 'text-neutral-200 bg-neutral-800 border-neutral-700',
          description: 'Confirm execution of backend security control.',
          buttonText: 'EXECUTE ACTION',
        };
    }
  };

  const details = getActionDetails();
  const IconComponent = details.icon;

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      if (actionPayload.type === 'freeze_session' && actionPayload.targetId) {
        await api.quarantineSession(actionPayload.targetId);
        onNotify?.(`Session ${actionPayload.targetId} successfully quarantined.`, 'success');
      } else if (actionPayload.type === 'block_ip' && actionPayload.targetId) {
        const cleanIp = actionPayload.targetId.replace(/^ip_/, '').replace(/_/g, '.');
        await api.addBlockedIp({
          ipAddress: cleanIp,
          reason: 'Direct security action execution from email alert link',
          isPermanent: true,
        });
        onNotify?.(`IP ${cleanIp} permanently blocked on perimeter.`, 'success');
      } else if (actionPayload.type === 'untrust_device' && actionPayload.targetId) {
        await api.untrustDevice(actionPayload.targetId);
        onNotify?.(`Device ${actionPayload.targetId} trust revoked.`, 'success');
      } else if (actionPayload.type === 'freeze_account') {
        await api.freezeAccount('Direct security action requested by vault owner');
        onNotify?.('Account successfully frozen. Modifying routes restricted.', 'success');
      } else if (actionPayload.type === 'lockdown') {
        await api.freezeAccount('Emergency Global Security Lockdown Active');
        onNotify?.('GLOBAL EMERGENCY LOCKDOWN ACTIVATED.', 'success');
      } else if (actionPayload.type === 'revoke_all_sessions') {
        const res = await api.revokeAllSessions();
        onNotify?.(res.message || 'All other active sessions revoked.', 'success');
      }

      onSuccessAction?.();
      onClose();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Action execution failed', 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-mono text-xs">
      <div className="bg-neutral-950 border border-neutral-800 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${details.color}`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100">{details.title}</h3>
              <p className="text-[10px] text-neutral-400">Authenticated Security Route Control</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800 text-neutral-300 leading-relaxed text-xs">
          {details.description}
        </div>

        <div className="bg-amber-950/20 border border-amber-800/40 p-3 rounded-lg text-amber-300 text-[11px] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>All security action executions are cryptographically recorded in your audit log chain.</span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-lg font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Executing Action...
              </>
            ) : (
              details.buttonText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
