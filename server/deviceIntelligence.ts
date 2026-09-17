import crypto from 'crypto';
import {
  RecognizedDevice,
  ClientDeviceTelemetry,
  IpNetworkIntelligence,
} from '../src/types';

// In-memory device store: Map<userId, Map<deviceId, RecognizedDevice>>
export const userDeviceStore = new Map<string, Map<string, RecognizedDevice>>();

// Parse user-agent into accurate structured breakdown
export function parseDetailedUserAgent(userAgent: string = '', telemetry?: Partial<ClientDeviceTelemetry>) {
  let os = 'Unknown OS';
  let osVersion = '';
  let browser = 'Unknown Browser';
  let browserVersion = '';
  let browserEngine = 'Unknown Engine';
  let deviceType: 'desktop' | 'laptop' | 'tablet' | 'mobile' | 'unknown' = 'unknown';

  const ua = userAgent || '';

  // 1. Operating System
  if (/Windows NT 10.0/i.test(ua)) {
    os = 'Windows';
    osVersion = '10/11';
  } else if (/Windows NT 6.3/i.test(ua)) {
    os = 'Windows';
    osVersion = '8.1';
  } else if (/Windows NT 6.1/i.test(ua)) {
    os = 'Windows';
    osVersion = '7';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
    const match = ua.match(/Mac OS X (\d+[._]\d+[._]?\d*)/);
    if (match) osVersion = match[1].replace(/_/g, '.');
  } else if (/Android/i.test(ua)) {
    os = 'Android';
    const match = ua.match(/Android (\d+(\.\d+)*)/);
    if (match) osVersion = match[1];
  } else if (/iPhone/i.test(ua)) {
    os = 'iOS';
    const match = ua.match(/OS (\d+[._]\d+)/);
    if (match) osVersion = match[1].replace(/_/g, '.');
  } else if (/iPad/i.test(ua)) {
    os = 'iPadOS';
    const match = ua.match(/OS (\d+[._]\d+)/);
    if (match) osVersion = match[1].replace(/_/g, '.');
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
    if (/Ubuntu/i.test(ua)) osVersion = 'Ubuntu';
    else if (/Fedora/i.test(ua)) osVersion = 'Fedora';
    else if (/Debian/i.test(ua)) osVersion = 'Debian';
  }

  // 2. Browser & Version
  if (/Edg\/(\d+[\.\d]*)/i.test(ua)) {
    browser = 'Edge';
    browserVersion = ua.match(/Edg\/(\d+[\.\d]*)/i)![1];
    browserEngine = 'Blink';
  } else if (/OPR\/(\d+[\.\d]*)/i.test(ua)) {
    browser = 'Opera';
    browserVersion = ua.match(/OPR\/(\d+[\.\d]*)/i)![1];
    browserEngine = 'Blink';
  } else if (/Chrome\/(\d+[\.\d]*)/i.test(ua)) {
    browser = 'Chrome';
    browserVersion = ua.match(/Chrome\/(\d+[\.\d]*)/i)![1];
    browserEngine = 'Blink';
  } else if (/Firefox\/(\d+[\.\d]*)/i.test(ua)) {
    browser = 'Firefox';
    browserVersion = ua.match(/Firefox\/(\d+[\.\d]*)/i)![1];
    browserEngine = 'Gecko';
  } else if (/Safari\/(\d+[\.\d]*)/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari';
    const match = ua.match(/Version\/(\d+[\.\d]*)/i);
    browserVersion = match ? match[1] : '';
    browserEngine = 'WebKit';
  }

  // 3. Device Type Determination
  if (/iPad/i.test(ua) || (os === 'macOS' && telemetry?.maxTouchPoints && telemetry.maxTouchPoints > 1)) {
    deviceType = 'tablet';
  } else if (/Mobile|iPhone|Android.*Mobile/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/Android(?!.*Mobile)/i.test(ua)) {
    deviceType = 'tablet';
  } else if (os === 'Windows' || os === 'macOS' || os === 'Linux') {
    // If touch capability is true on Windows/Linux or screen size matches typical laptop
    if (telemetry?.touchCapability) {
      deviceType = 'laptop';
    } else {
      deviceType = 'desktop';
    }
  }

  // 4. Human-Readable Automatic Label
  let deviceLabel = '';
  if (os === 'iOS' && /iPhone/i.test(ua)) {
    deviceLabel = `iPhone — ${browser}`;
  } else if (os === 'iPadOS' || deviceType === 'tablet') {
    deviceLabel = `${os} Tablet — ${browser}`;
  } else if (os === 'Android') {
    deviceLabel = `Android Phone — ${browser}`;
  } else if (deviceType === 'laptop') {
    deviceLabel = `${os} Laptop — ${browser}`;
  } else {
    deviceLabel = `${os} Desktop — ${browser}`;
  }

  return {
    os,
    osVersion,
    browser,
    browserVersion,
    browserEngine,
    deviceType,
    deviceLabel,
  };
}

// Compute stable Device ID from available legitimate signals
export function computeDeviceId(
  userId: string,
  clientDeviceId: string,
  parsedUa: ReturnType<typeof parseDetailedUserAgent>,
  telemetry?: Partial<ClientDeviceTelemetry>
): string {
  const seed = [
    userId,
    clientDeviceId || 'unassigned',
    parsedUa.os,
    parsedUa.browser,
    parsedUa.browserEngine,
    telemetry?.platform || 'unknown',
    telemetry?.screenResolution || 'unknown',
  ].join('|');

  const hash = crypto.createHash('sha256').update(seed).digest('hex').substring(0, 16);
  return `dev-${hash}`;
}

// Resolve or register connecting device
export function registerOrRecognizeDevice(params: {
  userId: string;
  clientDeviceId: string;
  userAgent: string;
  ip: string;
  networkInfo?: IpNetworkIntelligence;
  telemetry?: Partial<ClientDeviceTelemetry>;
}): {
  device: RecognizedDevice;
  recognitionState: RecognizedDevice['recognitionState'];
  isNewDevice: boolean;
} {
  const { userId, clientDeviceId, userAgent, ip, networkInfo, telemetry } = params;
  const parsed = parseDetailedUserAgent(userAgent, telemetry);
  const deviceId = computeDeviceId(userId, clientDeviceId, parsed, telemetry);
  const now = new Date().toISOString();

  let userDevices = userDeviceStore.get(userId);
  if (!userDevices) {
    userDevices = new Map<string, RecognizedDevice>();
    userDeviceStore.set(userId, userDevices);
  }

  const approxLocation = networkInfo
    ? `${networkInfo.city}, ${networkInfo.country}`
    : 'Unknown Location';

  const existingDevice = userDevices.get(deviceId);

  if (existingDevice) {
    // Existing known device
    existingDevice.lastSeen = now;
    existingDevice.sessionCount += 1;

    // Record IP if not already present
    if (!existingDevice.ipHistory.includes(ip)) {
      existingDevice.ipHistory.unshift(ip);
      if (existingDevice.ipHistory.length > 20) existingDevice.ipHistory.pop();
    }

    // Record location history
    const lastLoc = existingDevice.locationHistory[0]?.approxLocation;
    if (lastLoc !== approxLocation) {
      existingDevice.locationHistory.unshift({
        approxLocation,
        timestamp: now,
        ip,
      });
      if (existingDevice.locationHistory.length > 20) existingDevice.locationHistory.pop();
    }

    // Record ASN history
    if (networkInfo?.asn && !existingDevice.asnHistory.includes(networkInfo.asn)) {
      existingDevice.asnHistory.unshift(networkInfo.asn);
    }

    let recognitionState: RecognizedDevice['recognitionState'] = 'known';
    if (existingDevice.trustStatus === 'revoked') {
      recognitionState = 'unrecognized';
    } else if (existingDevice.riskStatus === 'high_risk') {
      recognitionState = 'suspicious';
    } else {
      recognitionState = 'previously_seen';
    }
    existingDevice.recognitionState = recognitionState;

    return {
      device: existingDevice,
      recognitionState,
      isNewDevice: false,
    };
  }

  // Check if this is a reinstalled browser or similar browser profile on same OS
  let isReinstalled = false;
  for (const [, dev] of userDevices.entries()) {
    if (dev.os === parsed.os && dev.browser === parsed.browser && dev.browserEngine === parsed.browserEngine) {
      isReinstalled = true;
      break;
    }
  }

  // Auto-trust first device for owner, subsequent devices start as untrusted/new
  const isFirstDeviceForUser = userDevices.size === 0;
  const trustStatus: RecognizedDevice['trustStatus'] = isFirstDeviceForUser ? 'trusted' : 'untrusted';
  const recognitionState: RecognizedDevice['recognitionState'] = isFirstDeviceForUser
    ? 'known'
    : isReinstalled
    ? 'reinstalled_browser'
    : 'new';

  const newDevice: RecognizedDevice = {
    deviceId,
    userId,
    deviceLabel: parsed.deviceLabel,
    customLabel: isFirstDeviceForUser ? 'My Main PC' : undefined,
    deviceType: parsed.deviceType,
    browser: `${parsed.browser} ${parsed.browserVersion}`.trim(),
    browserVersion: parsed.browserVersion,
    browserEngine: parsed.browserEngine,
    os: `${parsed.os} ${parsed.osVersion}`.trim(),
    osVersion: parsed.osVersion,
    firstSeen: now,
    lastSeen: now,
    sessionCount: 1,
    ipHistory: [ip],
    locationHistory: [
      {
        approxLocation,
        timestamp: now,
        ip,
      },
    ],
    asnHistory: networkInfo?.asn ? [networkInfo.asn] : [],
    trustStatus,
    riskStatus: 'normal',
    recognitionState,
  };

  userDevices.set(deviceId, newDevice);

  return {
    device: newDevice,
    recognitionState,
    isNewDevice: !isFirstDeviceForUser,
  };
}

// Get all devices for user
export function getUserDevices(userId: string): RecognizedDevice[] {
  const devices = userDeviceStore.get(userId);
  if (!devices) return [];
  return Array.from(devices.values()).sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  );
}

// Update device trust status
export function updateDeviceTrustStatus(
  userId: string,
  deviceId: string,
  trustStatus: RecognizedDevice['trustStatus']
): RecognizedDevice | null {
  const userDevices = userDeviceStore.get(userId);
  if (!userDevices) return null;
  const dev = userDevices.get(deviceId);
  if (!dev) return null;
  dev.trustStatus = trustStatus;
  dev.lastSeen = new Date().toISOString();
  return dev;
}

// Update device custom label (owner manual rename)
export function updateDeviceCustomLabel(
  userId: string,
  deviceId: string,
  customLabel: string
): RecognizedDevice | null {
  const userDevices = userDeviceStore.get(userId);
  if (!userDevices) return null;
  const dev = userDevices.get(deviceId);
  if (!dev) return null;
  dev.customLabel = customLabel.trim() || undefined;
  dev.lastSeen = new Date().toISOString();
  return dev;
}
