import {
  CreateRecordInput,
  PrivateRecord,
  ServerConfig,
  UpdateRecordInput,
  VaultStats,
  AuditEvent,
  AnomalyAlert,
  AccountSecurityStatus,
  BlockedIP,
  SecuritySession,
  StorageHealthMetrics,
  FileMetadata,
  ErrorLogItem,
  ErrorMetricsSummary,
  PerformanceMetricsSummary,
  RequestLogItem,
  RequestMetricsSummary,
  BackupItem,
  ClientDeviceTelemetry,
  RecognizedDevice,
  ActiveSessionRecord,
  IpNetworkIntelligence,
  SecurityPolicyConfig,
  AuditChainVerificationReport,
  SyncConflict,
} from '../types';

let currentAuthToken: string | null = null;
let currentSessionId: string | null = null;

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
  if (token) {
    sessionStorage.setItem('vault_auth_token', token);
  } else {
    sessionStorage.removeItem('vault_auth_token');
  }
}

export function getStoredAuthToken(): string | null {
  if (currentAuthToken) return currentAuthToken;
  currentAuthToken = sessionStorage.getItem('vault_auth_token');
  return currentAuthToken;
}

export function setCurrentSessionId(sessionId: string | null) {
  currentSessionId = sessionId;
  if (sessionId) {
    sessionStorage.setItem('vault_session_id', sessionId);
  } else {
    sessionStorage.removeItem('vault_session_id');
  }
}

export function getCurrentSessionId(): string | null {
  if (currentSessionId) return currentSessionId;
  currentSessionId = sessionStorage.getItem('vault_session_id');
  return currentSessionId;
}

export function getClientDeviceId(): string {
  let id = localStorage.getItem('vault_client_device_id');
  if (!id) {
    id = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('vault_client_device_id', id);
  }
  return id;
}

export function getClientDeviceLabel(): string {
  return localStorage.getItem('vault_device_label') || '';
}

export function setClientDeviceLabel(label: string) {
  localStorage.setItem('vault_device_label', label);
}

// Gathers real, non-spoofed hardware & browser environment telemetry
export function getClientDeviceTelemetry(): ClientDeviceTelemetry {
  let webglVendor: string | undefined;
  let webglRenderer: string | undefined;

  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        webglVendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || undefined;
        webglRenderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || undefined;
      }
    }
  } catch {
    // Canvas context not available
  }

  let audioLatency: number | undefined;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      audioLatency = (ctx as any).baseLatency || undefined;
      ctx.close();
    }
  } catch {
    // Audio context not available
  }

  return {
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    screenColorDepth: window.screen.colorDepth,
    screenPixelDepth: window.screen.pixelDepth,
    devicePixelRatio: window.devicePixelRatio || 1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    timezoneOffset: new Date().getTimezoneOffset(),
    language: navigator.language || 'en',
    languages: [...(navigator.languages || [])],
    platform: navigator.platform || 'unknown',
    hardwareConcurrency: navigator.hardwareConcurrency || 1,
    deviceMemory: (navigator as any).deviceMemory || undefined,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    webglVendor,
    webglRenderer,
    audioLatency,
  };
}

// Request helper injecting authorization, device ID, and session ID
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredAuthToken();
  const sessionId = getCurrentSessionId();
  const deviceId = getClientDeviceId();
  const deviceLabel = getClientDeviceLabel();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-device-id': deviceId,
    ...(deviceLabel ? { 'x-device-label': deviceLabel } : {}),
    ...(sessionId ? { 'x-session-id': sessionId } : {}),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorObj = new Error(data.message || data.error || `Request failed with status ${response.status}`);
    (errorObj as any).status = response.status;
    (errorObj as any).data = data;
    throw errorObj;
  }

  return data as T;
}

export const api = {
  // Public Configuration
  async getServerConfig(): Promise<ServerConfig> {
    return request<ServerConfig>('/api/config');
  },

  // Security Handshake & Pre-Connect Gate
  async preConnectSecurity(payload: {
    clientDeviceId: string;
    telemetry: ClientDeviceTelemetry;
    userLocation?: { latitude: number; longitude: number; accuracyMeters: number };
  }): Promise<{
    networkInfo: IpNetworkIntelligence;
    device: RecognizedDevice;
    recognitionState: 'recognized_trusted' | 'recognized_untrusted' | 'new_device';
    isNewDevice: boolean;
    policy: SecurityPolicyConfig;
    accessAllowed: boolean;
    policyViolations: string[];
    denialReason?: string;
    requiresMfa?: boolean;
  }> {
    return request('/api/security/pre-connect', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Security Code Login & Backup Code Verification
  async codeLogin(payload: {
    username: string;
    code: string;
    authMethod: 'code' | 'backup';
    securityAnswers?: {
      favColor?: string;
      motherName?: string;
      age?: string;
      crushName?: string;
    };
    clientDeviceId?: string;
    telemetry?: ClientDeviceTelemetry;
    userLocation?: { latitude: number; longitude: number; accuracyMeters: number };
  }): Promise<{
    user: { id: string; username: string; email: string };
    token: string;
    session?: ActiveSessionRecord;
    device?: RecognizedDevice;
    isNewDevice?: boolean;
    networkInfo?: IpNetworkIntelligence;
    isDemoMode: boolean;
  }> {
    const res = await request<{
      user: { id: string; username: string; email: string };
      token: string;
      session?: ActiveSessionRecord;
      device?: RecognizedDevice;
      isNewDevice?: boolean;
      networkInfo?: IpNetworkIntelligence;
      isDemoMode: boolean;
    }>('/api/auth/code-login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.session?.sessionId) {
      setCurrentSessionId(res.session.sessionId);
    }
    if (res.device?.customLabel || res.device?.deviceLabel) {
      setClientDeviceLabel(res.device.customLabel || res.device.deviceLabel);
    }

    return res;
  },

  // Logout
  async logout(): Promise<{ success: boolean }> {
    return request('/api/auth/logout', { method: 'POST' });
  },

  // Vault Stats
  async getStats(): Promise<VaultStats> {
    return request<VaultStats>('/api/stats');
  },

  // Records CRUD
  async getRecords(category?: string): Promise<{ records: PrivateRecord[] }> {
    const query = category && category !== 'All' ? `?category=${encodeURIComponent(category)}` : '';
    return request<{ records: PrivateRecord[] }>(`/api/records${query}`);
  },

  async searchRecords(queryText: string, category?: string): Promise<{ records: PrivateRecord[] }> {
    const params = new URLSearchParams();
    params.set('q', queryText);
    if (category && category !== 'All') {
      params.set('category', category);
    }
    return request<{ records: PrivateRecord[] }>(`/api/records/search?${params.toString()}`);
  },

  async getRecord(id: string): Promise<{ record: PrivateRecord }> {
    return request<{ record: PrivateRecord }>(`/api/records/${encodeURIComponent(id)}`);
  },

  async createRecord(payload: CreateRecordInput): Promise<{ record: PrivateRecord }> {
    return request<{ record: PrivateRecord }>('/api/records', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateRecord(id: string, payload: UpdateRecordInput): Promise<{ record: PrivateRecord }> {
    return request<{ record: PrivateRecord }>(`/api/records/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteRecord(id: string): Promise<{ success: boolean; id: string }> {
    return request<{ success: boolean; id: string }>(`/api/records/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // -------------------------------------------------------------
  // 1. BEHAVIORAL MONITORING & AUDIT LOGS
  // -------------------------------------------------------------
  async getAuditEvents(type?: string, search?: string): Promise<{ events: AuditEvent[]; totalCount: number }> {
    const params = new URLSearchParams();
    if (type && type !== 'all') params.set('type', type);
    if (search) params.set('search', search);
    return request(`/api/audit/events?${params.toString()}`);
  },

  async getAnomalies(): Promise<{ anomalies: AnomalyAlert[]; totalCount: number; evaluatedAt: string }> {
    return request('/api/audit/anomalies');
  },

  // -------------------------------------------------------------
  // 2. RECOVERY MODE & 3. FREEZE ACCOUNT
  // -------------------------------------------------------------
  async getSecurityStatus(): Promise<AccountSecurityStatus> {
    return request<AccountSecurityStatus>('/api/security/status');
  },

  async freezeAccount(reason: string): Promise<{ success: boolean; message: string; security: AccountSecurityStatus }> {
    return request('/api/security/freeze', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async unfreezeAccount(securityCode?: string): Promise<{ success: boolean; message: string; security: AccountSecurityStatus }> {
    return request('/api/security/unfreeze', {
      method: 'POST',
      body: JSON.stringify({ securityCode }),
    });
  },

  async activateRecoveryMode(reason?: string): Promise<{ success: boolean; message: string; security: AccountSecurityStatus }> {
    return request('/api/security/recovery/activate', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async deactivateRecoveryMode(): Promise<{ success: boolean; message: string; security: AccountSecurityStatus }> {
    return request('/api/security/recovery/deactivate', {
      method: 'POST',
    });
  },

  async executeEmergencyAction(action: 'terminate_other_sessions' | 'emergency_backup'): Promise<{ success: boolean; message: string }> {
    return request('/api/security/recovery/emergency-action', {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },

  // -------------------------------------------------------------
  // 4. IP BLOCKLIST
  // -------------------------------------------------------------
  async getBlockedIps(): Promise<{ blockedIps: BlockedIP[]; activeCount: number }> {
    return request('/api/security/blocked-ips');
  },

  async addBlockedIp(payload: {
    ipAddress: string;
    isCidr?: boolean;
    reason: string;
    isPermanent?: boolean;
    expiresDays?: number;
  }): Promise<{ success: boolean; item: BlockedIP }> {
    return request('/api/security/blocked-ips', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteBlockedIp(id: string): Promise<{ success: boolean; id: string }> {
    return request(`/api/security/blocked-ips/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // Legacy Security Sessions
  async getSecuritySessions(): Promise<{ sessions: SecuritySession[] }> {
    return request('/api/security/sessions');
  },

  // -------------------------------------------------------------
  // 5. STORAGE HEALTH & FILES
  // -------------------------------------------------------------
  async getStorageHealth(): Promise<StorageHealthMetrics> {
    return request<StorageHealthMetrics>('/api/storage/health');
  },

  async listFiles(folder?: string, search?: string): Promise<{ files: FileMetadata[]; folders: string[]; totalFiles: number }> {
    const params = new URLSearchParams();
    if (folder && folder !== 'all') params.set('folder', folder);
    if (search) params.set('search', search);
    return request(`/api/files?${params.toString()}`);
  },

  async uploadFiles(files: File[], folderPath: string = '/'): Promise<{ success: boolean; files: FileMetadata[]; message: string }> {
    const token = getStoredAuthToken();
    const formData = new FormData();
    formData.append('folder_path', folderPath);
    files.forEach(f => {
      const filename = (f as any).customName || f.name || 'uploaded_file';
      formData.append('files', f, filename);
    });

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/files/upload', {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed uploading files');
    }
    return data;
  },

  async getFileToken(fileId: string): Promise<{ token: string; expiresInSeconds: number }> {
    return request(`/api/files/${encodeURIComponent(fileId)}/token`);
  },

  async updateFile(id: string, payload: { filename?: string; folder_path?: string }): Promise<{ success: boolean; file: FileMetadata }> {
    return request(`/api/files/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteFile(id: string): Promise<{ success: boolean; id: string }> {
    return request(`/api/files/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // -------------------------------------------------------------
  // 6. ERROR MONITORING
  // -------------------------------------------------------------
  async getErrors(status?: 'all' | 'unresolved' | 'resolved'): Promise<{ errors: ErrorLogItem[] }> {
    const query = status && status !== 'all' ? `?status=${status}` : '';
    return request(`/api/monitoring/errors${query}`);
  },

  async getErrorMetrics(): Promise<ErrorMetricsSummary> {
    return request<ErrorMetricsSummary>('/api/monitoring/errors/metrics');
  },

  async resolveError(errorId: string): Promise<{ success: boolean; id: string }> {
    return request(`/api/monitoring/errors/${encodeURIComponent(errorId)}/resolve`, {
      method: 'POST',
    });
  },

  // -------------------------------------------------------------
  // 7. PERFORMANCE MONITORING
  // -------------------------------------------------------------
  async getPerformanceMetrics(): Promise<PerformanceMetricsSummary> {
    return request<PerformanceMetricsSummary>('/api/monitoring/performance');
  },

  // -------------------------------------------------------------
  // 8. REQUEST MONITORING
  // -------------------------------------------------------------
  async getRequests(method?: string, status?: string, search?: string): Promise<{ requests: RequestLogItem[] }> {
    const params = new URLSearchParams();
    if (method && method !== 'all') params.set('method', method);
    if (status && status !== 'all') params.set('status', status);
    if (search) params.set('search', search);
    return request(`/api/monitoring/requests?${params.toString()}`);
  },

  async getRequestMetrics(): Promise<RequestMetricsSummary> {
    return request<RequestMetricsSummary>('/api/monitoring/requests/metrics');
  },

  // -------------------------------------------------------------
  // 9. FULL BACKUP SYSTEM
  // -------------------------------------------------------------
  async getBackups(): Promise<{ backups: BackupItem[] }> {
    return request<{ backups: BackupItem[] }>('/api/backups');
  },

  async createBackup(): Promise<{ success: boolean; message: string; backup: BackupItem }> {
    return request('/api/backups/create', {
      method: 'POST',
    });
  },

  async restoreBackup(backupId: string): Promise<{ success: boolean; message: string; recordCount: number }> {
    return request(`/api/backups/${encodeURIComponent(backupId)}/restore`, {
      method: 'POST',
    });
  },

  async deleteBackup(backupId: string): Promise<{ success: boolean; id: string }> {
    return request(`/api/backups/${encodeURIComponent(backupId)}`, {
      method: 'DELETE',
    });
  },

  // -------------------------------------------------------------
  // 10. DEVICE RECOGNITION & TRUST MANAGEMENT
  // -------------------------------------------------------------
  async getDevices(): Promise<{ devices: RecognizedDevice[]; totalCount: number }> {
    return request<{ devices: RecognizedDevice[]; totalCount: number }>('/api/devices');
  },

  async trustDevice(deviceId: string): Promise<{ success: boolean; device: RecognizedDevice }> {
    return request(`/api/devices/${encodeURIComponent(deviceId)}/trust`, {
      method: 'POST',
    });
  },

  async untrustDevice(deviceId: string): Promise<{ success: boolean; device: RecognizedDevice }> {
    return request(`/api/devices/${encodeURIComponent(deviceId)}/untrust`, {
      method: 'POST',
    });
  },

  async revokeDevice(deviceId: string): Promise<{ success: boolean; device: RecognizedDevice; terminatedSessionsCount: number }> {
    return request(`/api/devices/${encodeURIComponent(deviceId)}/revoke`, {
      method: 'POST',
    });
  },

  async renameDevice(deviceId: string, customLabel: string): Promise<{ success: boolean; device: RecognizedDevice }> {
    return request(`/api/devices/${encodeURIComponent(deviceId)}/label`, {
      method: 'PUT',
      body: JSON.stringify({ customLabel }),
    });
  },

  // -------------------------------------------------------------
  // 11. ACTIVE SESSION SECURITY & LIFECYCLE
  // -------------------------------------------------------------
  async getActiveSessions(): Promise<{ sessions: ActiveSessionRecord[]; totalCount: number }> {
    return request<{ sessions: ActiveSessionRecord[]; totalCount: number }>('/api/sessions/active');
  },

  async terminateSession(sessionId: string): Promise<{ success: boolean; sessionId: string }> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  },

  async revokeAllOtherSessions(): Promise<{ success: boolean; revokedCount: number }> {
    return request('/api/sessions/revoke-others', {
      method: 'POST',
    });
  },

  async getSessionAnomalies(): Promise<{ anomalies: any[]; totalCount: number }> {
    return request('/api/sessions/anomalies');
  },

  // -------------------------------------------------------------
  // 12. NETWORK ACCESS & OBSERVED IP INTELLIGENCE
  // -------------------------------------------------------------
  async getNetworkIntelligence(): Promise<IpNetworkIntelligence> {
    return request<IpNetworkIntelligence>('/api/network/intelligence');
  },

  async getIpHistory(): Promise<{ ipHistory: any[]; totalCount: number }> {
    return request('/api/network/ip-history');
  },

  async trustIp(ipAddress: string, trust?: boolean): Promise<{ success: boolean; ipAddress: string; isTrusted: boolean }> {
    return request('/api/network/trust-ip', {
      method: 'POST',
      body: JSON.stringify({ ipAddress, trust }),
    });
  },

  // -------------------------------------------------------------
  // 13. CONFIGURABLE SECURITY POLICY
  // -------------------------------------------------------------
  async getSecurityPolicy(): Promise<SecurityPolicyConfig> {
    return request<SecurityPolicyConfig>('/api/policy');
  },

  async updateSecurityPolicy(updates: Partial<SecurityPolicyConfig>): Promise<{ success: boolean; policy: SecurityPolicyConfig }> {
    return request('/api/policy', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // -------------------------------------------------------------
  // 14. TAMPER-EVIDENT CRYPTOGRAPHIC AUDIT VERIFICATION
  // -------------------------------------------------------------
  async verifyAuditIntegrity(): Promise<AuditChainVerificationReport> {
    return request<AuditChainVerificationReport>('/api/audit/verify-integrity', {
      method: 'POST',
    });
  },

  // -------------------------------------------------------------
  // 15. MULTI-DEVICE SYNC CONFLICT RESOLUTION
  // -------------------------------------------------------------
  async resolveConflict(payload: {
    recordId: string;
    resolution: 'keep_server' | 'keep_client' | 'merge';
    clientContent?: string;
    clientTitle?: string;
    clientTags?: string[];
  }): Promise<{ success: boolean; record: PrivateRecord }> {
    return request('/api/sync/resolve-conflict', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        deviceId: getClientDeviceId(),
        deviceLabel: getClientDeviceLabel(),
      }),
    });
  },

  async getIncidents(): Promise<{ incidents: SecurityIncident[], totalCount: number }> {
    return request('/api/incidents');
  },

  async getIncident(id: string): Promise<{ incident: SecurityIncident }> {
    return request(`/api/incidents/${id}`);
  },

  async investigateIncident(id: string): Promise<{
    incident: SecurityIncident;
    timeline: any[];
    device: any;
    session: any;
    ipIntelligence: any;
    emailLogs: any[];
  }> {
    return request(`/api/incidents/${id}/investigate`);
  },

  async getDeviceDetail(id: string): Promise<{ device: any; activeSessionsCount: number; linkedSessions: any[] }> {
    return request(`/api/devices/${id}`);
  },

  async getSessionDetail(id: string): Promise<{ session: any }> {
    return request(`/api/sessions/${id}`);
  },

  async quarantineSession(id: string): Promise<{ success: boolean; message: string; sessionId: string }> {
    return request(`/api/sessions/${id}/quarantine`, { method: 'POST' });
  },

  async revokeAllSessions(): Promise<{ success: boolean; message: string; revokedCount: number }> {
    return request('/api/sessions/revoke-all', { method: 'POST' });
  },

  async getIpDetail(ipId: string): Promise<{
    ip: string;
    ipId: string;
    is_blocked: boolean;
    country: string;
    region: string;
    city: string;
    isp: string;
    asn: string;
    vpn: boolean;
    proxy: boolean;
    tor: boolean;
    threat_score: number;
  }> {
    return request(`/api/security/ip/${ipId}`);
  },

  async updateIncidentStatus(id: string, status: string): Promise<{ success: boolean }> {
    return request(`/api/incidents/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  async getEmailConfig(): Promise<{ configured: boolean; recipient: string; from: string; provider: string }> {
    return request('/api/email/config');
  },

  async sendTestEmail(): Promise<{ success: boolean; logId: string; reason?: string }> {
    return request('/api/email/test', { method: 'POST' });
  },

  async getEmailLogs(): Promise<{ emailDeliveryLogs: any[]; totalCount: number }> {
    return request('/api/email/logs');
  },

  async getNotificationSettings(): Promise<any> {
    return request('/api/email/notifications');
  },

  async updateNotificationSettings(settings: any): Promise<{ success: boolean; settings: any }> {
    return request('/api/email/notifications', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }
};

export interface SecurityIncident {
  incident_id: string;
  severity: string;
  event_type: string;
  status: string;
  detected_at: string;
  resolved_at?: string;
  source_ip: string;
  country: string;
  region: string;
  city: string;
  asn: string;
  isp: string;
  vpn_status: string;
  proxy_status: string;
  evidence: string;
  automated_actions: string[];
  email_status: string;
}
