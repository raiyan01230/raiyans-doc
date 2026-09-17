export type RecordCategory =
  | 'Credentials'
  | 'Financial'
  | 'Personal Notes'
  | 'Legal & Identity'
  | 'Servers & API Keys'
  | 'Secure Backup';

export const RECORD_CATEGORIES: RecordCategory[] = [
  'Credentials',
  'Financial',
  'Personal Notes',
  'Legal & Identity',
  'Servers & API Keys',
  'Secure Backup',
];

export interface PrivateRecord {
  id: string;
  user_id: string;
  title: string;
  category: RecordCategory;
  content: string;
  is_pinned?: boolean;
  tags?: string[];
  version?: number;
  sync_version?: number;
  last_modified_device_id?: string;
  last_modified_device_label?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRecordInput {
  title: string;
  category: RecordCategory;
  content: string;
  is_pinned?: boolean;
  tags?: string[];
}

export interface UpdateRecordInput {
  title?: string;
  category?: RecordCategory;
  content?: string;
  is_pinned?: boolean;
  tags?: string[];
}

export interface UserSession {
  id: string;
  email?: string;
  username?: string;
  token: string;
  created_at?: string;
}

export interface ServerConfig {
  isSupabaseConfigured: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  environment: string;
  securityHeadersActive: boolean;
  targetUsername?: string;
}

export interface VaultStats {
  totalRecords: number;
  categoryCounts: Record<string, number>;
  pinnedCount: number;
  lastUpdated: string | null;
}

// -------------------------------------------------------------
// 1. BEHAVIORAL MONITORING & AUDIT LOGS
// -------------------------------------------------------------
export type EventType =
  | 'login'
  | 'logout'
  | 'failed_login'
  | 'new_device_login'
  | 'device_connected'
  | 'device_recognized'
  | 'device_trusted'
  | 'device_untrusted'
  | 'device_revoked'
  | 'device_renamed'
  | 'session_created'
  | 'session_terminated'
  | 'suspicious_session_detected'
  | 'session_hijack_flagged'
  | 'ip_changed'
  | 'country_changed'
  | 'vpn_detected'
  | 'proxy_detected'
  | 'security_policy_changed'
  | 'sync_conflict_detected'
  | 'sync_conflict_resolved'
  | 'audit_integrity_verified'
  | 'location_permission_granted'
  | 'location_permission_denied'
  | 'emergency_recovery_accessed'
  | 'record_created'
  | 'record_updated'
  | 'record_deleted'
  | 'file_uploaded'
  | 'file_downloaded'
  | 'file_previewed'
  | 'file_deleted'
  | 'file_renamed'
  | 'file_moved'
  | 'backup_created'
  | 'backup_restored'
  | 'backup_deleted'
  | 'permission_change'
  | 'security_setting_changed'
  | 'password_changed'
  | 'mfa_changed'
  | 'account_frozen'
  | 'account_unfrozen'
  | 'recovery_mode_activated'
  | 'recovery_mode_deactivated'
  | 'ip_blocked'
  | 'ip_unblocked';

export interface AuditEvent {
  event_id: string;
  user_id: string;
  event_type: EventType;
  timestamp: string;
  ip_address: string;
  user_agent: string;
  device_id?: string;
  device_label?: string;
  device_summary?: string;
  session_id?: string;
  approx_location?: string;
  resource_type?: string;
  resource_id?: string;
  success: boolean;
  prev_hash?: string;
  hash?: string;
  metadata?: Record<string, unknown>;
}

export interface AnomalyAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  anomaly_type:
    | 'multiple_failed_logins'
    | 'new_device_login'
    | 'large_number_of_downloads'
    | 'unusual_file_deletions'
    | 'sudden_bulk_operations'
    | 'repeated_failed_api_requests'
    | 'suspicious_access_pattern';
  detected_at: string;
  triggering_event_count: number;
  details?: Record<string, unknown>;
}

// -------------------------------------------------------------
// 2. RECOVERY MODE & 3. FREEZE ACCOUNT
// -------------------------------------------------------------
export interface AccountSecurityStatus {
  user_id: string;
  is_frozen: boolean;
  freeze_reason: string | null;
  frozen_at: string | null;
  frozen_by: string | null;
  is_recovery_mode: boolean;
  recovery_activated_at: string | null;
  recovery_reason: string | null;
  recovery_verification_required: boolean;
  active_sessions_count: number;
}

export interface SecuritySession {
  id: string;
  ip_address: string;
  user_agent: string;
  device_summary: string;
  is_current: boolean;
  created_at: string;
  last_active_at: string;
}

// -------------------------------------------------------------
// 4. IP BLOCKLIST
// -------------------------------------------------------------
export interface BlockedIP {
  id: string;
  ip_address: string;
  is_cidr: boolean;
  reason: string;
  blocked_by: string;
  is_permanent: boolean;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

// -------------------------------------------------------------
// 5. STORAGE HEALTH & FILES
// -------------------------------------------------------------
export interface StorageHealthInfo {
  status: 'healthy' | 'warning' | 'degraded';
  storageUsageBytes: number;
  storageUsageFormatted: string;
  fileCount: number;
  bucketCount: number;
  bucketName: string;
  bucketStatus: string;
  availableQuota: string; // e.g. "Unavailable from provider" or specific number
  largestFiles: {
    id: string;
    filename: string;
    size_bytes: number;
    size_formatted: string;
    mime_type: string;
  }[];
  recentUploadsCount: number;
  recentDeletionsCount: number;
  failedOperationsCount: number;
  recentActivity: {
    action: string;
    filename: string;
    timestamp: string;
  }[];
  historicalTrends: {
    date: string;
    usageBytes: number;
    fileCount: number;
  }[];
}

export interface VaultFile {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  file_path: string;
  folder_path: string;
  size_bytes: number;
  mime_type: string;
  extension: string;
  download_count: number;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileUploadQueueItem {
  id: string;
  file: File;
  relativePath: string;
  folder: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  error?: string;
  xhr?: XMLHttpRequest;
}

// -------------------------------------------------------------
// 6. ERROR MONITORING
// -------------------------------------------------------------
export interface AppErrorLog {
  id: string;
  error_id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  error_type: string;
  message: string;
  endpoint?: string;
  user_id?: string;
  request_id?: string;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
}

export interface ErrorMetrics {
  errorsToday: number;
  errorsThisWeek: number;
  errorRatePercent: number;
  unresolvedCount: number;
  mostCommonErrors: {
    type: string;
    count: number;
  }[];
  recentErrors: AppErrorLog[];
}

// -------------------------------------------------------------
// 7. PERFORMANCE MONITORING
// -------------------------------------------------------------
export interface PerformanceSummary {
  hasEnoughData: boolean;
  sampleCount: number;
  averageResponseTimeMs: number | null;
  medianResponseTimeMs: number | null;
  p95ResponseTimeMs: number | null;
  slowestEndpoints: {
    endpoint: string;
    method: string;
    avgDurationMs: number;
    count: number;
  }[];
  slowestRequests: {
    id: string;
    endpoint: string;
    method: string;
    durationMs: number;
    timestamp: string;
  }[];
  dbTimingSummary: {
    avgQueryMs: number | null;
    measuredQueriesCount: number;
  };
  storageTimingSummary: {
    avgOpMs: number | null;
    measuredOpsCount: number;
  };
}

// -------------------------------------------------------------
// 8. REQUEST MONITORING
// -------------------------------------------------------------
export interface RequestLogEntry {
  request_id: string;
  timestamp: string;
  method: string;
  route: string;
  status_code: number;
  duration_ms: number;
  response_size_bytes: number;
  user_id?: string;
  ip_address: string;
  user_agent: string;
  success: boolean;
  error_message?: string;
}

export interface RequestMetrics {
  totalRequestsRecorded: number;
  requestsPerMinute: number;
  errorRatePercent: number;
  statusDistribution: {
    '2xx': number;
    '3xx': number;
    '4xx': number;
    '5xx': number;
  };
  topRoutes: {
    route: string;
    count: number;
  }[];
}

// -------------------------------------------------------------
// 9. FULL BACKUP
// -------------------------------------------------------------
export type BackupStatus = 'Pending' | 'Running' | 'Verifying' | 'Completed' | 'Failed';

export interface BackupItem {
  id: string;
  filename: string;
  status: BackupStatus;
  size_bytes: number;
  record_count: number;
  file_count: number;
  checksum_sha256?: string;
  is_scheduled: boolean;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

// -------------------------------------------------------------
// 18 & 21. NAVIGATION & DASHBOARD CONSOLE STATE
// -------------------------------------------------------------
export type ConsoleTab =
  | 'dashboard'
  | 'search'
  | 'vault'
  | 'files'
  | 'activity'
  | 'monitoring'
  | 'devices'
  | 'sessions'
  | 'network'
  | 'policy'
  | 'backups'
  | 'security'
  | 'settings';

// Aliases for component convenience
export type StorageHealthMetrics = StorageHealthInfo;
export type FileMetadata = VaultFile;
export type ErrorLogItem = AppErrorLog;
export type ErrorMetricsSummary = ErrorMetrics;
export type PerformanceMetricsSummary = PerformanceSummary;
export type RequestLogItem = RequestLogEntry;
export type RequestMetricsSummary = RequestMetrics;

// -------------------------------------------------------------
// 10. REAL DEVICE INTELLIGENCE & TELEMETRY
// -------------------------------------------------------------
export interface ClientDeviceTelemetry {
  clientDeviceId?: string;
  platform: string;
  language: string;
  languages: string[];
  screenResolution?: string;
  screenWidth?: number;
  screenHeight?: number;
  screenColorDepth?: number;
  screenPixelDepth?: number;
  viewport?: string;
  devicePixelRatio: number;
  touchCapability?: boolean;
  hasTouch?: boolean;
  maxTouchPoints: number;
  colorScheme?: 'dark' | 'light' | 'no-preference';
  hardwareConcurrency?: number;
  deviceMemory?: number;
  webglVendor?: string;
  webglRenderer?: string;
  audioLatency?: number;
  timezone: string;
  timezoneOffset: number;
  referrer?: string;
  capabilities?: {
    webAuthn: boolean;
    serviceWorker: boolean;
    cookiesEnabled: boolean;
    localStorage: boolean;
  };
}

export interface UserProvidedLocation {
  latitude: number;
  longitude: number;
  accuracyRadiusMeters: number;
  timestamp: string;
  source: 'Browser Geolocation';
}

export interface IpNetworkIntelligence {
  ip: string;
  ipFamily: 'IPv4' | 'IPv6';
  country: string;
  countryCode: string;
  region: string;
  city: string;
  postal: string;
  approxLatitude: number | null;
  approxLongitude: number | null;
  timezone: string;
  isp: string;
  asn: string;
  organization: string;
  connectionType: string;
  vpn: {
    detected: boolean | null;
    status: 'Detected' | 'Not Detected' | 'Unknown';
    provider?: string;
    confidence?: string;
  };
  proxy: {
    detected: boolean | null;
    status: 'Detected' | 'Not Detected' | 'Unknown';
    type?: string;
  };
  hostingDatacenter: boolean;
  torRelay: boolean;
  isNewNetwork: boolean;
}

export interface RecognizedDevice {
  deviceId: string;
  userId: string;
  deviceLabel: string;
  customLabel?: string;
  deviceType: 'desktop' | 'laptop' | 'tablet' | 'mobile' | 'unknown';
  browser: string;
  browserVersion: string;
  browserEngine: string;
  os: string;
  osVersion: string;
  firstSeen: string;
  lastSeen: string;
  sessionCount: number;
  ipHistory: string[];
  locationHistory: {
    approxLocation: string;
    timestamp: string;
    ip: string;
  }[];
  asnHistory: string[];
  trustStatus: 'trusted' | 'untrusted' | 'revoked';
  riskStatus: 'normal' | 'suspicious' | 'high_risk';
  recognitionState: 'known' | 'new' | 'previously_seen' | 'reinstalled_browser' | 'suspicious' | 'unrecognized';
  isCurrentDevice?: boolean;
}

export interface ActiveSessionRecord {
  sessionId: string;
  userId: string;
  deviceId: string;
  deviceLabel: string;
  browser: string;
  os: string;
  currentIp: string;
  approxLocation: string;
  userProvidedLocation?: UserProvidedLocation | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isCurrent: boolean;
  status: 'active' | 'suspicious' | 'terminated';
  trustStatus: 'trusted' | 'untrusted';
  authMethod: string;
  suspiciousReason?: string;
  networkIntelligence?: IpNetworkIntelligence;
}

export interface SessionAnomalyDetails {
  anomalyId: string;
  sessionId: string;
  detectedAt: string;
  title: string;
  reason: string;
  signals: {
    name: string;
    previous: string;
    current: string;
    flagged: boolean;
  }[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  possibleActions: string[];
}

export interface AuditChainVerification {
  isValid: boolean;
  totalEvents?: number;
  totalRecords?: number;
  verifiedCount?: number;
  genesisHash: string;
  latestHash?: string;
  currentHeadHash?: string;
  brokenAtIndex: number | null;
  brokenLinks?: { index: number; id: string; reason: string }[];
  verifiedAt: string;
}

export type AuditChainVerificationReport = AuditChainVerification;

export interface SecurityPolicyConfig {
  requireExactLocation?: boolean;
  strictDeviceRecognition?: boolean;
  blockDatacenterAsn?: boolean;
  blockVpnAndProxies?: boolean;
  sessionInactivityTimeoutMinutes?: number;
  maxActiveSessions?: number;
  locationRequired?: boolean;
  deviceIdentificationRequired?: boolean;
  authenticationRequired?: boolean;
  trustedDeviceRequired?: boolean;
  mfaRequired?: boolean;
  allowedCountries?: string[];
  blockedCountries?: string[];
  countryPolicyAction?: 'block' | 'require_mfa' | 'read_only' | 'alert_only';
  vpnAllowed?: boolean;
  proxyAllowed?: boolean;
  maxFailedLoginAttempts?: number;
  rateLimitWindowMinutes?: number;
  sessionHijackAutoAction?: 'flag_alert' | 'require_reauth' | 'terminate_session' | 'freeze_account';
  emergencyRecoveryActive?: boolean;
  updatedAt?: string;
}

export interface SyncConflict {
  recordId: string;
  serverRecord: PrivateRecord & { version: number; last_modified_device_label?: string };
  clientRecord: PrivateRecord & { version: number; last_modified_device_label?: string };
  detectedAt: string;
}

export interface ObservedIpRecord {
  ipAddress: string;
  firstSeen: string;
  lastSeen: string;
  deviceIds: string[];
  deviceLabels: string[];
  country: string;
  region: string;
  city: string;
  asn: string;
  isp: string;
  vpnStatus: 'Detected' | 'Not Detected' | 'Unknown';
  proxyStatus: 'Detected' | 'Not Detected' | 'Unknown';
  isBlocked: boolean;
  isTrusted: boolean;
  requestCount: number;
}


