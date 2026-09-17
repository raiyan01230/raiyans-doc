import { Request } from 'express';
import { createIncident } from './incidents.js';
import { getClientIp } from './security.js';
import { getIpNetworkIntelligence } from './networkIntelligence.js';

interface RequestLog {
  timestamp: number;
  route: string;
  method: string;
  statusCode: number;
}

const clientRequestLogs = new Map<string, RequestLog[]>();

export async function analyzeRequestForThreats(req: Request, res: any, next: Function) {
  const ip = getClientIp(req);
  const now = Date.now();
  
  if (!clientRequestLogs.has(ip)) {
    clientRequestLogs.set(ip, []);
  }
  const logs = clientRequestLogs.get(ip)!;
  
  // Clean old logs (keep last 60 seconds)
  const recentLogs = logs.filter(log => now - log.timestamp < 60000);
  
  // Record current before analysis, but without status code yet (since it's pre-flight or we analyze after)
  // Actually, it's better to hook into response finish
  res.on('finish', async () => {
    recentLogs.push({
      timestamp: now,
      route: req.path,
      method: req.method,
      statusCode: res.statusCode,
    });
    clientRequestLogs.set(ip, recentLogs);
    
    // Thresholds
    const REQUEST_BURST_THRESHOLD = 100;
    const NOT_FOUND_THRESHOLD = 20;

    const notFoundCount = recentLogs.filter(r => r.statusCode === 404).length;
    const authFailureCount = recentLogs.filter(r => r.route.includes('/auth') && r.statusCode === 401).length;

    let threatDetected = false;
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let eventType = '';
    let evidence = '';

    if (recentLogs.length > REQUEST_BURST_THRESHOLD) {
       threatDetected = true;
       severity = 'HIGH';
       eventType = 'Abnormal Request Burst';
       evidence = `Detected ${recentLogs.length} requests in 60s.`;
    } else if (notFoundCount > NOT_FOUND_THRESHOLD) {
       threatDetected = true;
       severity = 'HIGH';
       eventType = 'Endpoint Enumeration / Probing';
       evidence = `Detected ${notFoundCount} 404 Not Found responses in 60s.`;
    } else if (authFailureCount > 10) {
       threatDetected = true;
       severity = 'CRITICAL';
       eventType = 'Brute-Force Authentication Attempt';
       evidence = `Detected ${authFailureCount} failed auth attempts in 60s.`;
    }

    if (threatDetected) {
      // Don't trigger repeatedly in a short burst
      const lastIncidentKey = `threat-${ip}-${eventType}`;
      if (!lastIncidentTimeCache.has(lastIncidentKey) || now - lastIncidentTimeCache.get(lastIncidentKey)! > 60000 * 5) {
         lastIncidentTimeCache.set(lastIncidentKey, now);
         
         const intel = await getIpNetworkIntelligence(ip);
         
         // Upgrade severity based on VPN/Proxy
         if (intel.vpn.detected || intel.proxy.detected) {
            if (severity === 'HIGH') severity = 'CRITICAL';
         }

         await createIncident({
           severity,
           event_type: eventType,
           source_ip: ip,
           country: intel.country,
           region: intel.region,
           city: intel.city,
           asn: intel.asn,
           isp: intel.isp,
           vpn_status: intel.vpn.status,
           proxy_status: intel.proxy.status,
           evidence: evidence,
         });
      }
    }
  });

  next();
}

const lastIncidentTimeCache = new Map<string, number>();
