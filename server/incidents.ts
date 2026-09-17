import crypto from 'crypto';
import { sendSecurityEmail } from '../src/lib/security-email';
import { store } from './store';
import { terminateSession } from './sessionSecurity';

export type IncidentSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'DETECTED' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'FALSE_POSITIVE' | 'CLOSED';

export interface SecurityIncident {
  incident_id: string;
  severity: IncidentSeverity;
  event_type: string;
  status: IncidentStatus;
  detected_at: string;
  resolved_at?: string;
  source_ip: string;
  country?: string;
  region?: string;
  city?: string;
  asn?: string;
  isp?: string;
  vpn_status?: string;
  proxy_status?: string;
  device_id?: string;
  session_id?: string;
  user_id?: string;
  evidence: string;
  automated_actions: string[];
  email_status: 'EMAIL_PENDING' | 'EMAIL_SENT' | 'EMAIL_FAILED' | 'EMAIL_RETRYING' | 'EMAIL_SKIPPED';
  created_at: string;
  updated_at: string;
}

export const incidentStore = new Map<string, SecurityIncident>();
export const sessionQuarantine = new Set<string>();
export const frozenAccounts = new Set<string>();

export async function createIncident(params: Partial<SecurityIncident>) {
  const incident_id = params.incident_id || `inc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const now = new Date().toISOString();
  
  const incident: SecurityIncident = {
    incident_id,
    severity: params.severity || 'INFO',
    event_type: params.event_type || 'Unknown Event',
    status: params.status || 'DETECTED',
    detected_at: now,
    source_ip: params.source_ip || '127.0.0.1',
    country: params.country || 'Unknown',
    region: params.region || 'Unknown',
    city: params.city || 'Unknown',
    asn: params.asn || 'AS-UNKNOWN',
    isp: params.isp || 'Unknown ISP',
    vpn_status: params.vpn_status || 'Not Detected',
    proxy_status: params.proxy_status || 'Not Detected',
    device_id: params.device_id || `dev_${Date.now()}`,
    session_id: params.session_id || `ses_${Date.now()}`,
    user_id: params.user_id,
    evidence: params.evidence || 'Security rule threshold exceeded.',
    automated_actions: params.automated_actions || ['✓ Security event recorded', '✓ Telemetry logged'],
    email_status: 'EMAIL_PENDING',
    created_at: now,
    updated_at: now,
  };

  incidentStore.set(incident_id, incident);

  if (incident.severity === 'HIGH' || incident.severity === 'CRITICAL') {
    // Quarantine session automatically
    if (incident.session_id) {
      terminateSession(incident.session_id);
      sessionQuarantine.add(incident.session_id);
      incident.automated_actions.push('✓ Session terminated & quarantined');
      incident.status = 'CONTAINED';
    }

    // Freeze account for CRITICAL if configured
    if (incident.severity === 'CRITICAL' && incident.user_id) {
       store.accountSecurity.set(incident.user_id, {
         user_id: incident.user_id,
         is_frozen: true,
         frozen_at: now,
         frozen_by: 'SECURITY_AUTOMATION',
         freeze_reason: `Critical Security Incident: ${incident.incident_id}`,
         is_recovery_mode: false,
         recovery_activated_at: null,
         recovery_reason: null,
         recovery_verification_required: false,
         updated_at: now,
       });
       incident.automated_actions.push('✓ Account frozen');
    }

    // Block IP for CRITICAL
    if (incident.severity === 'CRITICAL' && incident.source_ip) {
       store.blockedIPs.push({
         id: `blk-${Date.now()}`,
         ip_address: incident.source_ip,
         is_cidr: false,
         reason: `Critical Security Incident: ${incident.incident_id}`,
         created_at: now,
         is_active: true,
         blocked_by: 'SECURITY_AUTOMATION',
         is_permanent: true,
         expires_at: null,
       });
       incident.automated_actions.push('✓ Source IP Blocked');
    }

    // Trigger Email
    triggerEmergencyEmail(incident);
  }

  return incident;
}

async function triggerEmergencyEmail(incident: SecurityIncident) {
  const subject = `[PRIVATE VAULT] ${incident.severity} SECURITY INCIDENT — ${incident.event_type}`;
  
  const res = await sendSecurityEmail({
    subject,
    eventSummary: incident.evidence,
    eventType: incident.event_type,
    severity: incident.severity,
    incidentId: incident.incident_id,
    deviceId: incident.device_id,
    sessionId: incident.session_id,
    ipId: `ip_${(incident.source_ip || '127_0_0_1').replace(/[^a-zA-Z0-9]/g, '_')}`,
    details: {
      status: incident.status,
      ipAddress: incident.source_ip,
      country: incident.country,
      region: incident.region,
      city: incident.city,
      asn: incident.asn,
      isp: incident.isp,
      vpn: incident.vpn_status === 'Detected' || incident.vpn_status === 'true',
      proxy: incident.proxy_status === 'Detected' || incident.proxy_status === 'true',
      actionsTaken: incident.automated_actions,
      evidence: [incident.evidence],
    },
  });

  const existing = incidentStore.get(incident.incident_id);
  if (existing) {
    if (res.success) {
      existing.email_status = 'EMAIL_SENT';
    } else if (res.reason === 'unconfigured' || res.reason?.includes('RESEND_API_KEY')) {
      existing.email_status = 'EMAIL_SKIPPED';
    } else {
      existing.email_status = 'EMAIL_FAILED';
    }
    existing.updated_at = new Date().toISOString();
  }
}
