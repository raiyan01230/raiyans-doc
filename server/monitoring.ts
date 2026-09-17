import crypto from 'crypto';
import { Request, Response } from 'express';
import { store, StoredAuditEvent, StoredErrorLog, StoredRequestLog, DEMO_USER_ID } from './store';

// Performance samples ring buffer
interface PerfSample {
  timestamp: number;
  durationMs: number;
  endpoint: string;
  method: string;
  type: 'http' | 'db' | 'storage';
}

const perfSamples: PerfSample[] = [];
const MAX_PERF_SAMPLES = 2000;
const MAX_REQUEST_LOGS = 1000;
const MAX_ERROR_LOGS = 500;
const MAX_AUDIT_LOGS = 2000;

export function recordRequestLog(
  req: Request,
  res: Response,
  durationMs: number,
  responseSizeBytes: number,
  userId?: string,
  errorMessage?: string
): StoredRequestLog {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  const entry: StoredRequestLog = {
    request_id: (req as any).requestId || `req-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    method: req.method,
    route: req.originalUrl.split('?')[0],
    status_code: res.statusCode,
    duration_ms: Math.round(durationMs * 100) / 100,
    response_size_bytes: responseSizeBytes,
    user_id: userId,
    ip_address: ip,
    user_agent: (req.headers['user-agent'] as string) || 'Unknown Client',
    success: res.statusCode >= 200 && res.statusCode < 400,
    error_message: errorMessage,
  };

  store.requestLogs.unshift(entry);
  if (store.requestLogs.length > MAX_REQUEST_LOGS) {
    store.requestLogs.length = MAX_REQUEST_LOGS;
  }

  // Also record performance sample
  recordPerformanceSample({
    timestamp: Date.now(),
    durationMs,
    endpoint: entry.route,
    method: entry.method,
    type: 'http',
  });

  return entry;
}

export function recordPerformanceSample(sample: PerfSample) {
  perfSamples.unshift(sample);
  if (perfSamples.length > MAX_PERF_SAMPLES) {
    perfSamples.length = MAX_PERF_SAMPLES;
  }
}

export function recordErrorLog(params: {
  severity: 'info' | 'warning' | 'error' | 'critical';
  errorType: string;
  message: string;
  endpoint?: string;
  userId?: string;
  requestId?: string;
  error?: unknown;
}): StoredErrorLog {
  const entry: StoredErrorLog = {
    id: `err-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    error_id: `ERR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    timestamp: new Date().toISOString(),
    severity: params.severity,
    error_type: params.errorType,
    message: params.message,
    endpoint: params.endpoint,
    user_id: params.userId,
    request_id: params.requestId,
    resolved: false,
  };

  store.errorLogs.unshift(entry);
  if (store.errorLogs.length > MAX_ERROR_LOGS) {
    store.errorLogs.length = MAX_ERROR_LOGS;
  }

  // Never expose sensitive internals to client; log error to server console
  if (params.error && process.env.NODE_ENV !== 'production') {
    console.error(`[Error Monitoring - ${entry.error_id}]`, params.message, params.error);
  }

  return entry;
}

export function resolveErrorLog(errorId: string, resolvedBy: string): boolean {
  const item = store.errorLogs.find(e => e.id === errorId || e.error_id === errorId);
  if (item) {
    item.resolved = true;
    item.resolved_at = new Date().toISOString();
    item.resolved_by = resolvedBy;
    return true;
  }
  return false;
}

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function computeEventHash(params: {
  prevHash: string;
  eventId: string;
  timestamp: string;
  eventType: string;
  ipAddress: string;
  userId: string;
  success: boolean;
  resourceId?: string;
}): string {
  const content = [
    params.prevHash,
    params.eventId,
    params.timestamp,
    params.eventType,
    params.ipAddress,
    params.userId,
    String(params.success),
    params.resourceId || '',
  ].join('|');
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function recordAuditEvent(params: {
  userId: string;
  eventType: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  deviceLabel?: string;
  deviceSummary?: string;
  sessionId?: string;
  approxLocation?: string;
  resourceType?: string;
  resourceId?: string;
  success?: boolean;
  metadata?: Record<string, unknown>;
}): StoredAuditEvent {
  const eventId = `evt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const timestamp = new Date().toISOString();
  const ipAddress = params.ipAddress || '127.0.0.1';
  const success = params.success !== undefined ? params.success : true;

  // Link to previous audit event hash (store.auditLogs[0] is the most recently created event)
  const prevHash = store.auditLogs[0]?.hash || GENESIS_HASH;
  const hash = computeEventHash({
    prevHash,
    eventId,
    timestamp,
    eventType: params.eventType,
    ipAddress,
    userId: params.userId,
    success,
    resourceId: params.resourceId,
  });

  const entry: StoredAuditEvent = {
    event_id: eventId,
    user_id: params.userId,
    event_type: params.eventType,
    timestamp,
    ip_address: ipAddress,
    user_agent: params.userAgent || 'Unknown Client',
    device_id: params.deviceId,
    device_label: params.deviceLabel,
    device_summary: params.deviceSummary,
    session_id: params.sessionId,
    approx_location: params.approxLocation,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    success,
    prev_hash: prevHash,
    hash,
    metadata: params.metadata || {},
  };

  store.auditLogs.unshift(entry);
  if (store.auditLogs.length > MAX_AUDIT_LOGS) {
    store.auditLogs.length = MAX_AUDIT_LOGS;
  }

  return entry;
}

// Recalculates and verifies the entire cryptographic audit chain from genesis to latest
export function verifyAuditChainIntegrity(): {
  isValid: boolean;
  totalEvents: number;
  verifiedCount: number;
  genesisHash: string;
  latestHash: string;
  brokenAtIndex: number | null;
  brokenLinks: { index: number; id: string; reason: string }[];
  verifiedAt: string;
} {
  const totalEvents = store.auditLogs.length;
  if (totalEvents === 0) {
    return {
      isValid: true,
      totalEvents: 0,
      verifiedCount: 0,
      genesisHash: GENESIS_HASH,
      latestHash: GENESIS_HASH,
      brokenAtIndex: null,
      brokenLinks: [],
      verifiedAt: new Date().toISOString(),
    };
  }

  // Iterate chronologically from oldest (at end of store.auditLogs) to newest (at index 0)
  const chronological = [...store.auditLogs].reverse();
  let expectedPrevHash = GENESIS_HASH;
  let verifiedCount = 0;
  const brokenLinks: { index: number; id: string; reason: string }[] = [];

  for (let i = 0; i < chronological.length; i++) {
    const evt = chronological[i];
    let isBroken = false;

    // Check if initial event links back to expected genesis or previous link
    if (i === 0) {
      if (evt.prev_hash && evt.prev_hash !== GENESIS_HASH) {
        brokenLinks.push({ index: i, id: evt.event_id, reason: 'Invalid genesis hash linkage' });
        isBroken = true;
      }
    } else {
      if (evt.prev_hash !== expectedPrevHash) {
        brokenLinks.push({ index: i, id: evt.event_id, reason: 'Broken chain link: prev_hash mismatch' });
        isBroken = true;
      }
    }

    // Recompute event hash and compare
    const recomputedHash = computeEventHash({
      prevHash: evt.prev_hash || GENESIS_HASH,
      eventId: evt.event_id,
      timestamp: evt.timestamp,
      eventType: evt.event_type,
      ipAddress: evt.ip_address,
      userId: evt.user_id,
      success: evt.success,
      resourceId: evt.resource_id,
    });

    if (evt.hash && evt.hash !== recomputedHash) {
      brokenLinks.push({ index: i, id: evt.event_id, reason: 'Tampering detected: hash mismatch' });
      isBroken = true;
    }

    if (isBroken) {
      return {
        isValid: false,
        totalEvents,
        verifiedCount,
        genesisHash: GENESIS_HASH,
        latestHash: store.auditLogs[0]?.hash || '',
        brokenAtIndex: i,
        brokenLinks,
        verifiedAt: new Date().toISOString(),
      };
    }

    expectedPrevHash = evt.hash || recomputedHash;
    verifiedCount++;
  }

  return {
    isValid: true,
    totalEvents,
    verifiedCount,
    genesisHash: GENESIS_HASH,
    latestHash: store.auditLogs[0]?.hash || '',
    brokenAtIndex: null,
    brokenLinks,
    verifiedAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// REAL ANOMALY DETECTION ENGINE
// Evaluates real behavioral audit logs & failed request records
// -------------------------------------------------------------
export function detectAnomalies(userId: string = DEMO_USER_ID) {
  const now = Date.now();
  const alerts: Array<{
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
  }> = [];

  // Filter logs for this user or global auth events
  const userAudit = store.auditLogs.filter(e => e.user_id === userId || !e.user_id);
  const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();
  const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();
  const oneMinuteAgo = new Date(now - 1 * 60 * 1000).toISOString();

  // 1. Multiple failed logins in short period (>= 3 in 10 mins)
  const failedLogins = userAudit.filter(
    e => e.event_type === 'failed_login' && e.timestamp >= tenMinutesAgo
  );
  if (failedLogins.length >= 3) {
    alerts.push({
      id: 'anomaly-failed-logins',
      severity: failedLogins.length >= 5 ? 'critical' : 'high',
      title: 'Multiple Failed Login Attempts',
      description: `Detected ${failedLogins.length} failed login attempts within the last 10 minutes. Potential brute-force or credential guessing.`,
      anomaly_type: 'multiple_failed_logins',
      detected_at: failedLogins[0].timestamp,
      triggering_event_count: failedLogins.length,
      details: {
        ips: Array.from(new Set(failedLogins.map(l => l.ip_address))),
      },
    });
  }

  // 2. Large number of file downloads (>= 10 in 5 mins)
  const recentDownloads = userAudit.filter(
    e => e.event_type === 'file_downloaded' && e.timestamp >= fiveMinutesAgo
  );
  if (recentDownloads.length >= 10) {
    alerts.push({
      id: 'anomaly-high-downloads',
      severity: 'high',
      title: 'Elevated File Download Velocity',
      description: `Detected ${recentDownloads.length} private file downloads in the past 5 minutes. Verify that bulk export is authorized.`,
      anomaly_type: 'large_number_of_downloads',
      detected_at: recentDownloads[0].timestamp,
      triggering_event_count: recentDownloads.length,
    });
  }

  // 3. Unusual number of file deletions (>= 5 in 5 mins)
  const recentDeletions = userAudit.filter(
    e => e.event_type === 'file_deleted' && e.timestamp >= fiveMinutesAgo
  );
  if (recentDeletions.length >= 5) {
    alerts.push({
      id: 'anomaly-file-deletions',
      severity: 'critical',
      title: 'Rapid File Deletion Spike',
      description: `Detected ${recentDeletions.length} files deleted in under 5 minutes. Check if account is compromised or under data destruction attempt.`,
      anomaly_type: 'unusual_file_deletions',
      detected_at: recentDeletions[0].timestamp,
      triggering_event_count: recentDeletions.length,
    });
  }

  // 4. Sudden bulk operations (>= 10 record or file ops in 1 minute)
  const bulkOps = userAudit.filter(
    e =>
      [
        'record_created',
        'record_updated',
        'record_deleted',
        'file_uploaded',
        'file_deleted',
      ].includes(e.event_type) && e.timestamp >= oneMinuteAgo
  );
  if (bulkOps.length >= 10) {
    alerts.push({
      id: 'anomaly-bulk-ops',
      severity: 'medium',
      title: 'Sudden High-Frequency Operations',
      description: `Detected ${bulkOps.length} create/update/delete operations in 60 seconds.`,
      anomaly_type: 'sudden_bulk_operations',
      detected_at: bulkOps[0].timestamp,
      triggering_event_count: bulkOps.length,
    });
  }

  // 5. Repeated failed API requests (>= 5 4xx/5xx in 5 minutes)
  const failedRequests = store.requestLogs.filter(
    r =>
      r.status_code >= 400 &&
      r.timestamp >= fiveMinutesAgo &&
      (r.user_id === userId || !r.user_id)
  );
  if (failedRequests.length >= 5) {
    alerts.push({
      id: 'anomaly-failed-api',
      severity: 'medium',
      title: 'Repeated Erroneous API Requests',
      description: `Detected ${failedRequests.length} rejected or failing API requests within 5 minutes.`,
      anomaly_type: 'repeated_failed_api_requests',
      detected_at: failedRequests[0].timestamp,
      triggering_event_count: failedRequests.length,
      details: {
        statusCodes: Array.from(new Set(failedRequests.map(r => r.status_code))),
      },
    });
  }

  // 6. New device login check
  const logins = userAudit.filter(e => e.event_type === 'login');
  if (logins.length >= 2) {
    const latestLogin = logins[0];
    const previousAgents = new Set(
      logins.slice(1, 10).map(l => l.user_agent.trim().toLowerCase())
    );
    if (!previousAgents.has(latestLogin.user_agent.trim().toLowerCase())) {
      alerts.push({
        id: `anomaly-new-device-${latestLogin.timestamp}`,
        severity: 'low',
        title: 'New Device / Browser Signature',
        description: `New client signature detected for @${userId === DEMO_USER_ID ? 'raiyan' : 'user'}.`,
        anomaly_type: 'new_device_login',
        detected_at: latestLogin.timestamp,
        triggering_event_count: 1,
        details: {
          userAgent: latestLogin.user_agent,
          ip: latestLogin.ip_address,
        },
      });
    }
  }

  return alerts;
}

// -------------------------------------------------------------
// PERFORMANCE METRICS CALCULATOR
// -------------------------------------------------------------
export function getPerformanceMetrics() {
  const httpSamples = perfSamples.filter(s => s.type === 'http');

  if (httpSamples.length < 3) {
    return {
      hasEnoughData: false,
      sampleCount: httpSamples.length,
      averageResponseTimeMs: null,
      medianResponseTimeMs: null,
      p95ResponseTimeMs: null,
      slowestEndpoints: [],
      slowestRequests: [],
      dbTimingSummary: { avgQueryMs: null, measuredQueriesCount: 0 },
      storageTimingSummary: { avgOpMs: null, measuredOpsCount: 0 },
    };
  }

  const durations = httpSamples.map(s => s.durationMs).sort((a, b) => a - b);
  const sum = durations.reduce((acc, v) => acc + v, 0);
  const avg = Math.round((sum / durations.length) * 100) / 100;
  const median = durations[Math.floor(durations.length / 2)];
  const p95 = durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1];

  // Slowest endpoints aggregation
  const endpointMap = new Map<string, { sum: number; count: number; method: string }>();
  for (const s of httpSamples) {
    const key = `${s.method} ${s.endpoint}`;
    const curr = endpointMap.get(key) || { sum: 0, count: 0, method: s.method };
    curr.sum += s.durationMs;
    curr.count += 1;
    endpointMap.set(key, curr);
  }

  const slowestEndpoints = Array.from(endpointMap.entries())
    .map(([key, val]) => {
      const endpoint = key.split(' ')[1];
      return {
        endpoint,
        method: val.method,
        avgDurationMs: Math.round((val.sum / val.count) * 100) / 100,
        count: val.count,
      };
    })
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs)
    .slice(0, 5);

  const slowestRequests = [...store.requestLogs]
    .sort((a, b) => b.duration_ms - a.duration_ms)
    .slice(0, 5)
    .map(r => ({
      id: r.request_id,
      endpoint: r.route,
      method: r.method,
      durationMs: r.duration_ms,
      timestamp: r.timestamp,
    }));

  const dbSamples = perfSamples.filter(s => s.type === 'db');
  const dbAvg = dbSamples.length
    ? Math.round(
        (dbSamples.reduce((acc, s) => acc + s.durationMs, 0) / dbSamples.length) * 100
      ) / 100
    : null;

  const storageSamples = perfSamples.filter(s => s.type === 'storage');
  const storageAvg = storageSamples.length
    ? Math.round(
        (storageSamples.reduce((acc, s) => acc + s.durationMs, 0) / storageSamples.length) *
          100
      ) / 100
    : null;

  return {
    hasEnoughData: true,
    sampleCount: httpSamples.length,
    averageResponseTimeMs: avg,
    medianResponseTimeMs: Math.round(median * 100) / 100,
    p95ResponseTimeMs: Math.round(p95 * 100) / 100,
    slowestEndpoints,
    slowestRequests,
    dbTimingSummary: {
      avgQueryMs: dbAvg,
      measuredQueriesCount: dbSamples.length,
    },
    storageTimingSummary: {
      avgOpMs: storageAvg,
      measuredOpsCount: storageSamples.length,
    },
  };
}

// -------------------------------------------------------------
// REQUEST MONITORING METRICS CALCULATOR
// -------------------------------------------------------------
export function getRequestMetrics() {
  const logs = store.requestLogs;
  const now = Date.now();
  const oneMinuteAgo = new Date(now - 60 * 1000).toISOString();
  const reqsLastMinute = logs.filter(l => l.timestamp >= oneMinuteAgo).length;

  const total = logs.length;
  const errorCount = logs.filter(l => l.status_code >= 400).length;
  const errorRatePercent = total > 0 ? Math.round((errorCount / total) * 1000) / 10 : 0;

  const distribution = {
    '2xx': logs.filter(l => l.status_code >= 200 && l.status_code < 300).length,
    '3xx': logs.filter(l => l.status_code >= 300 && l.status_code < 400).length,
    '4xx': logs.filter(l => l.status_code >= 400 && l.status_code < 500).length,
    '5xx': logs.filter(l => l.status_code >= 500).length,
  };

  const routeCounts = new Map<string, number>();
  logs.forEach(l => {
    routeCounts.set(l.route, (routeCounts.get(l.route) || 0) + 1);
  });

  const topRoutes = Array.from(routeCounts.entries())
    .map(([route, count]) => ({ route, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    totalRequestsRecorded: total,
    requestsPerMinute: reqsLastMinute,
    errorRatePercent,
    statusDistribution: distribution,
    topRoutes,
  };
}

// -------------------------------------------------------------
// ERROR METRICS CALCULATOR
// -------------------------------------------------------------
export function getErrorMetrics() {
  const errors = store.errorLogs;
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();

  const weekStart = new Date(now - 7 * 86400 * 1000).toISOString();

  const errorsToday = errors.filter(e => e.timestamp >= todayStr).length;
  const errorsThisWeek = errors.filter(e => e.timestamp >= weekStart).length;
  const unresolved = errors.filter(e => !e.resolved);

  const typeCounts = new Map<string, number>();
  errors.forEach(e => {
    typeCounts.set(e.error_type, (typeCounts.get(e.error_type) || 0) + 1);
  });

  const mostCommonErrors = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalReqs = store.requestLogs.length || 1;
  const errorRatePercent = Math.round((errors.length / totalReqs) * 1000) / 10;

  return {
    errorsToday,
    errorsThisWeek,
    errorRatePercent,
    unresolvedCount: unresolved.length,
    mostCommonErrors,
    recentErrors: errors.slice(0, 30),
  };
}
