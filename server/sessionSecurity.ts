import crypto from 'crypto';
import {
  ActiveSessionRecord,
  SessionAnomalyDetails,
  UserProvidedLocation,
  IpNetworkIntelligence,
  RecognizedDevice,
} from '../src/types';
import { recordAuditEvent } from './monitoring';

// In-memory active sessions: Map<sessionId, SessionContext>
export interface SessionContext {
  sessionId: string;
  tokenHash: string;
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
  status: 'active' | 'suspicious' | 'terminated';
  trustStatus: 'trusted' | 'untrusted';
  authMethod: string;
  suspiciousReason?: string;
  networkIntelligence?: IpNetworkIntelligence;

  // Established security baseline
  baseline: {
    ip: string;
    asn: string;
    country: string;
    browser: string;
    os: string;
    deviceId: string;
    lat: number | null;
    lon: number | null;
    timestamp: number;
  };

  recentAnomalies: SessionAnomalyDetails[];
}

export const activeSessions = new Map<string, SessionContext>();

// Haversine formula to calculate approximate distance in kilometers between two lat/lon points
function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Create new active session with established security baseline
export function createActiveSession(params: {
  sessionId: string;
  token: string;
  userId: string;
  device: RecognizedDevice;
  ip: string;
  networkInfo?: IpNetworkIntelligence;
  userLocation?: UserProvidedLocation | null;
  authMethod?: string;
}): SessionContext {
  const { sessionId, token, userId, device, ip, networkInfo, userLocation, authMethod } = params;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const approxLocation = networkInfo
    ? `${networkInfo.city}, ${networkInfo.country}`
    : 'Unknown Location';

  const lat = userLocation?.latitude ?? networkInfo?.approxLatitude ?? null;
  const lon = userLocation?.longitude ?? networkInfo?.approxLongitude ?? null;

  const session: SessionContext = {
    sessionId,
    tokenHash,
    userId,
    deviceId: device.deviceId,
    deviceLabel: device.customLabel || device.deviceLabel,
    browser: device.browser,
    os: device.os,
    currentIp: ip,
    approxLocation,
    userProvidedLocation: userLocation,
    createdAt: now,
    lastActiveAt: now,
    expiresAt,
    status: 'active',
    trustStatus: device.trustStatus === 'trusted' ? 'trusted' : 'untrusted',
    authMethod: authMethod || 'security_code',
    networkIntelligence: networkInfo,
    baseline: {
      ip,
      asn: networkInfo?.asn || 'Unknown',
      country: networkInfo?.country || 'Unknown',
      browser: device.browser,
      os: device.os,
      deviceId: device.deviceId,
      lat,
      lon,
      timestamp: Date.now(),
    },
    recentAnomalies: [],
  };

  activeSessions.set(sessionId, session);
  return session;
}

// Evaluate session characteristics against baseline for session hijacking detection
export function evaluateSessionHijacking(params: {
  session: SessionContext;
  currentIp: string;
  currentNetwork?: IpNetworkIntelligence;
  currentDevice: RecognizedDevice;
  currentUserLocation?: UserProvidedLocation | null;
}): {
  isAnomalous: boolean;
  anomaly?: SessionAnomalyDetails;
} {
  const { session, currentIp, currentNetwork, currentDevice, currentUserLocation } = params;
  const baseline = session.baseline;
  const now = Date.now();

  const signals: SessionAnomalyDetails['signals'] = [];
  let flagCount = 0;

  // 1. IP Address Change
  const isIpChanged = currentIp !== baseline.ip;
  signals.push({
    name: 'IP Address',
    previous: baseline.ip,
    current: currentIp,
    flagged: isIpChanged,
  });
  if (isIpChanged) flagCount++;

  // 2. ASN / Network Provider Change
  const currentAsn = currentNetwork?.asn || 'Unknown';
  const isAsnChanged =
    baseline.asn !== 'Unknown' && currentAsn !== 'Unknown' && baseline.asn !== currentAsn;
  signals.push({
    name: 'Network ASN',
    previous: baseline.asn,
    current: currentAsn,
    flagged: isAsnChanged,
  });
  if (isAsnChanged) flagCount += 2; // Network jump is a stronger signal

  // 3. Country Change
  const currentCountry = currentNetwork?.country || 'Unknown';
  const isCountryChanged =
    baseline.country !== 'Unknown' &&
    currentCountry !== 'Unknown' &&
    baseline.country !== currentCountry;
  signals.push({
    name: 'Country',
    previous: baseline.country,
    current: currentCountry,
    flagged: isCountryChanged,
  });
  if (isCountryChanged) flagCount += 3; // Country jump is a high severity signal

  // 4. Operating System or Browser Change
  const isBrowserChanged = currentDevice.browser !== baseline.browser;
  const isOsChanged = currentDevice.os !== baseline.os;
  signals.push({
    name: 'Client Environment',
    previous: `${baseline.os} / ${baseline.browser}`,
    current: `${currentDevice.os} / ${currentDevice.browser}`,
    flagged: isBrowserChanged || isOsChanged,
  });
  if (isBrowserChanged || isOsChanged) flagCount += 3;

  // 5. Device Identifier Change
  const isDeviceChanged = currentDevice.deviceId !== baseline.deviceId;
  signals.push({
    name: 'Device Identity',
    previous: baseline.deviceId,
    current: currentDevice.deviceId,
    flagged: isDeviceChanged,
  });
  if (isDeviceChanged) flagCount += 3;

  // 6. Impossible Travel Speed Detection
  const currentLat = currentUserLocation?.latitude ?? currentNetwork?.approxLatitude ?? null;
  const currentLon = currentUserLocation?.longitude ?? currentNetwork?.approxLongitude ?? null;

  if (
    baseline.lat !== null &&
    baseline.lon !== null &&
    currentLat !== null &&
    currentLon !== null
  ) {
    const distKm = calculateHaversineDistanceKm(
      baseline.lat,
      baseline.lon,
      currentLat,
      currentLon
    );
    const timeDeltaHours = Math.max(0.01, (now - baseline.timestamp) / (1000 * 60 * 60));
    const speedKmH = distKm / timeDeltaHours;

    // Commercial airliner cruising speed ~850-900 km/h; threshold > 800 km/h over > 250km
    const isImpossibleTravel = distKm > 250 && speedKmH > 800;
    signals.push({
      name: 'Travel Speed Velocity',
      previous: `${baseline.lat.toFixed(2)}, ${baseline.lon.toFixed(2)}`,
      current: `${currentLat.toFixed(2)}, ${currentLon.toFixed(2)} (${Math.round(distKm)}km at ${Math.round(speedKmH)}km/h)`,
      flagged: isImpossibleTravel,
    });
    if (isImpossibleTravel) flagCount += 4;
  }

  // Determine anomaly severity based on aggregated signals
  if (flagCount >= 3) {
    let severity: SessionAnomalyDetails['severity'] = 'medium';
    if (flagCount >= 5) severity = 'high';
    if (flagCount >= 7) severity = 'critical';

    const reasonsList = signals.filter(s => s.flagged).map(s => s.name);
    const reason = `Multiple session characteristics abruptly altered: ${reasonsList.join(', ')}. Context mismatch with established session baseline.`;

    const anomaly: SessionAnomalyDetails = {
      anomalyId: `anom-${now}-${crypto.randomBytes(3).toString('hex')}`,
      sessionId: session.sessionId,
      detectedAt: new Date().toISOString(),
      title: 'Potential Session Anomaly Detected',
      reason,
      signals,
      severity,
      possibleActions: [
        'Re-authenticate',
        'Require MFA',
        'Terminate Session',
        'Freeze Account',
        'Mark Device Untrusted',
        'Investigate',
      ],
    };

    session.status = 'suspicious';
    session.suspiciousReason = reason;
    session.recentAnomalies.unshift(anomaly);
    if (session.recentAnomalies.length > 10) session.recentAnomalies.pop();

    return { isAnomalous: true, anomaly };
  }

  return { isAnomalous: false };
}

// Update session heartbeat / activity
export function updateSessionActivity(
  sessionId: string,
  ip: string,
  networkInfo?: IpNetworkIntelligence,
  userLocation?: UserProvidedLocation | null
) {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  session.lastActiveAt = new Date().toISOString();
  session.currentIp = ip;
  if (networkInfo) {
    session.networkIntelligence = networkInfo;
    session.approxLocation = `${networkInfo.city}, ${networkInfo.country}`;
  }
  if (userLocation) {
    session.userProvidedLocation = userLocation;
  }
}

// Terminate a single session
export function terminateSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  if (!session) return false;
  session.status = 'terminated';
  activeSessions.delete(sessionId);
  return true;
}

// Terminate all sessions for a device
export function terminateSessionsForDevice(deviceId: string): number {
  let count = 0;
  for (const [id, session] of activeSessions.entries()) {
    if (session.deviceId === deviceId) {
      session.status = 'terminated';
      activeSessions.delete(id);
      count++;
    }
  }
  return count;
}

// Terminate all sessions except current
export function terminateAllOtherSessions(currentSessionId: string, userId: string): number {
  let count = 0;
  for (const [id, session] of activeSessions.entries()) {
    if (session.userId === userId && id !== currentSessionId) {
      session.status = 'terminated';
      activeSessions.delete(id);
      count++;
    }
  }
  return count;
}

// List active sessions for user formatted for client
export function getActiveSessionsForUser(
  userId: string,
  currentSessionId?: string
): ActiveSessionRecord[] {
  const list: ActiveSessionRecord[] = [];
  const now = Date.now();

  for (const session of activeSessions.values()) {
    if (session.userId === userId) {
      // Check expiration
      if (new Date(session.expiresAt).getTime() < now) {
        session.status = 'terminated';
        continue;
      }

      list.push({
        sessionId: session.sessionId,
        userId: session.userId,
        deviceId: session.deviceId,
        deviceLabel: session.deviceLabel,
        browser: session.browser,
        os: session.os,
        currentIp: session.currentIp,
        approxLocation: session.approxLocation,
        userProvidedLocation: session.userProvidedLocation,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
        expiresAt: session.expiresAt,
        isCurrent: session.sessionId === currentSessionId,
        status: session.status,
        trustStatus: session.trustStatus,
        authMethod: session.authMethod,
        suspiciousReason: session.suspiciousReason,
        networkIntelligence: session.networkIntelligence,
      });
    }
  }

  // Sort by last active descending
  return list.sort(
    (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
  );
}
