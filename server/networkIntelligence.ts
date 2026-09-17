import { Request } from 'express';
import crypto from 'crypto';
import { IpNetworkIntelligence, ObservedIpRecord } from '../src/types';
import { getClientIp } from './security';

// In-memory cache for IP lookups to keep latency near 0ms
const ipIntelligenceCache = new Map<string, IpNetworkIntelligence>();

// Observed IP history
export const observedIps = new Map<string, ObservedIpRecord>();

// Trusted IP list
export const trustedIps = new Set<string>(['127.0.0.1', '::1']);

// Known datacenter / hosting ASNs
const KNOWN_DATACENTER_ASNS = new Set([
  'AS16509', // Amazon AWS
  'AS15169', // Google Cloud
  'AS396982', // Google Cloud
  'AS13335', // Cloudflare
  'AS14061', // DigitalOcean
  'AS16276', // OVH
  'AS63949', // Linode / Akamai
  'AS24940', // Hetzner
  'AS8075',  // Microsoft Azure
  'AS20473', // Vultr
  'AS60068', // CDN77 / Datacamp
  'AS9009',  // M247
  'AS46562', // Total Server Solutions
  'AS51852', // Private Layer
  'AS62240', // Clouvider
]);

// Helper to check if an IP is a private / loopback IP
export function isPrivateOrLoopbackIp(ip: string): boolean {
  if (!ip) return true;
  const clean = ip.replace(/^::ffff:/, '');
  if (
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean === 'localhost' ||
    clean.startsWith('10.') ||
    clean.startsWith('192.168.') ||
    clean.startsWith('172.16.') ||
    clean.startsWith('172.17.') ||
    clean.startsWith('172.18.') ||
    clean.startsWith('172.19.') ||
    clean.startsWith('172.2') ||
    clean.startsWith('172.30.') ||
    clean.startsWith('172.31.') ||
    clean.startsWith('fc00:') ||
    clean.startsWith('fe80:')
  ) {
    return true;
  }
  return false;
}

// Perform real IP intelligence lookup
export async function getIpNetworkIntelligence(ip: string): Promise<IpNetworkIntelligence> {
  const cleanIp = (ip || '127.0.0.1').replace(/^::ffff:/, '').trim();

  // Check cache first
  if (ipIntelligenceCache.has(cleanIp)) {
    return ipIntelligenceCache.get(cleanIp)!;
  }

  const isIPv6 = cleanIp.includes(':');
  const ipFamily = isIPv6 ? 'IPv6' : 'IPv4';

  // Handle local / private IPs
  if (isPrivateOrLoopbackIp(cleanIp)) {
    const localInfo: IpNetworkIntelligence = {
      ip: cleanIp,
      ipFamily,
      country: 'Private Network',
      countryCode: 'PRIVATE',
      region: 'Local Loopback',
      city: 'Local Host',
      postal: 'N/A',
      approxLatitude: null,
      approxLongitude: null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      isp: 'Internal Loopback Interface',
      asn: 'PRIVATE-NET',
      organization: 'Local Vault Server',
      connectionType: 'Loopback / Private LAN',
      vpn: {
        detected: false,
        status: 'Not Detected',
      },
      proxy: {
        detected: false,
        status: 'Not Detected',
      },
      hostingDatacenter: false,
      torRelay: false,
      isNewNetwork: !observedIps.has(cleanIp),
    };
    ipIntelligenceCache.set(cleanIp, localInfo);
    return localInfo;
  }

  // Attempt real query to IP intelligence service (ip-api.com with 2.5s timeout)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(
      `http://ip-api.com/json/${cleanIp}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting,query`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success') {
        const asnString = data.as ? data.as.split(' ')[0] : 'Unknown';
        const isDatacenter = Boolean(data.hosting || KNOWN_DATACENTER_ASNS.has(asnString));
        const orgLower = (data.org || data.isp || '').toLowerCase();

        // Check VPN / Proxy signals
        const hasVpnKeywords =
          orgLower.includes('vpn') ||
          orgLower.includes('mullvad') ||
          orgLower.includes('nord') ||
          orgLower.includes('expressvpn') ||
          orgLower.includes('surfshark') ||
          orgLower.includes('cyberghost') ||
          orgLower.includes('private internet access') ||
          orgLower.includes('proton') ||
          orgLower.includes('wireguard') ||
          orgLower.includes('exit-node');

        const vpnDetected = Boolean(data.proxy || hasVpnKeywords);
        const proxyDetected = Boolean(data.proxy);

        const vpnStatus = vpnDetected ? 'Detected' : 'Not Detected';
        const proxyStatus = proxyDetected ? 'Detected' : 'Not Detected';

        const result: IpNetworkIntelligence = {
          ip: cleanIp,
          ipFamily,
          country: data.country || 'Unknown',
          countryCode: data.countryCode || 'UN',
          region: data.regionName || data.region || 'Unknown',
          city: data.city || 'Unknown',
          postal: data.zip || 'Unknown',
          approxLatitude: typeof data.lat === 'number' ? data.lat : null,
          approxLongitude: typeof data.lon === 'number' ? data.lon : null,
          timezone: data.timezone || 'UTC',
          isp: data.isp || 'Unknown ISP',
          asn: asnString,
          organization: data.org || data.isp || 'Unknown Organization',
          connectionType: data.mobile ? 'Cellular / Mobile' : isDatacenter ? 'Datacenter / Hosting' : 'Broadband / Fixed',
          vpn: {
            detected: vpnDetected,
            status: vpnStatus,
            provider: vpnDetected ? (hasVpnKeywords ? data.org || data.isp : 'Datacenter Proxy Relay') : undefined,
            confidence: vpnDetected ? 'High (Network Intelligence)' : undefined,
          },
          proxy: {
            detected: proxyDetected,
            status: proxyStatus,
            type: proxyDetected ? (isDatacenter ? 'Datacenter Proxy' : 'Forward Proxy') : undefined,
          },
          hostingDatacenter: isDatacenter,
          torRelay: orgLower.includes('tor') || orgLower.includes('exit-node'),
          isNewNetwork: !observedIps.has(cleanIp),
        };

        ipIntelligenceCache.set(cleanIp, result);
        return result;
      }
    }
  } catch {
    // Network query failed or timed out — return accurate Unknown status rather than inventing
  }

  // Graceful fallback with Unknown fields (Strict compliance: NEVER invent data)
  const unknownFallback: IpNetworkIntelligence = {
    ip: cleanIp,
    ipFamily,
    country: 'Unknown',
    countryCode: 'UN',
    region: 'Unknown',
    city: 'Unknown',
    postal: 'Unknown',
    approxLatitude: null,
    approxLongitude: null,
    timezone: 'UTC',
    isp: 'Unknown ISP',
    asn: 'Unknown ASN',
    organization: 'Unknown Organization',
    connectionType: 'Unknown',
    vpn: {
      detected: null,
      status: 'Unknown',
    },
    proxy: {
      detected: null,
      status: 'Unknown',
    },
    hostingDatacenter: false,
    torRelay: false,
    isNewNetwork: !observedIps.has(cleanIp),
  };

  ipIntelligenceCache.set(cleanIp, unknownFallback);
  return unknownFallback;
}

// Track and update IP observation history
export function recordIpObservation(
  ip: string,
  deviceId?: string,
  deviceLabel?: string,
  networkInfo?: IpNetworkIntelligence
) {
  const cleanIp = (ip || '127.0.0.1').replace(/^::ffff:/, '').trim();
  const now = new Date().toISOString();

  let existing = observedIps.get(cleanIp);
  if (!existing) {
    existing = {
      ipAddress: cleanIp,
      firstSeen: now,
      lastSeen: now,
      deviceIds: deviceId ? [deviceId] : [],
      deviceLabels: deviceLabel ? [deviceLabel] : [],
      country: networkInfo?.country || 'Unknown',
      region: networkInfo?.region || 'Unknown',
      city: networkInfo?.city || 'Unknown',
      asn: networkInfo?.asn || 'Unknown',
      isp: networkInfo?.isp || 'Unknown',
      vpnStatus: networkInfo?.vpn.status || 'Unknown',
      proxyStatus: networkInfo?.proxy.status || 'Unknown',
      isBlocked: false,
      isTrusted: trustedIps.has(cleanIp),
      requestCount: 1,
    };
    observedIps.set(cleanIp, existing);
  } else {
    existing.lastSeen = now;
    existing.requestCount += 1;
    if (deviceId && !existing.deviceIds.includes(deviceId)) {
      existing.deviceIds.push(deviceId);
    }
    if (deviceLabel && !existing.deviceLabels.includes(deviceLabel)) {
      existing.deviceLabels.push(deviceLabel);
    }
    if (networkInfo && existing.country === 'Unknown' && networkInfo.country !== 'Unknown') {
      existing.country = networkInfo.country;
      existing.region = networkInfo.region;
      existing.city = networkInfo.city;
      existing.asn = networkInfo.asn;
      existing.isp = networkInfo.isp;
      existing.vpnStatus = networkInfo.vpn.status;
      existing.proxyStatus = networkInfo.proxy.status;
    }
  }
}
