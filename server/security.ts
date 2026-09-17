import { Request, Response, NextFunction } from 'express';
import { store, DEMO_USER_ID, StoredBlockedIP } from './store';
import { recordAuditEvent } from './monitoring';

// Helper to convert IPv4 string to integer for CIDR checking
function ipToInt(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

// Check if an IP matches a CIDR range (e.g. 192.168.1.0/24)
export function isIpInCidr(ip: string, cidr: string): boolean {
  try {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    if (isNaN(bits) || bits < 0 || bits > 32) return false;

    // IPv4 simple verification
    if (!ip.includes('.') || !range.includes('.')) return false;

    const mask = ~(2 ** (32 - bits) - 1);
    return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
  } catch {
    return false;
  }
}

// Get the client IP reliably from headers or socket
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// Extract human-friendly device summary from User-Agent
export function parseDeviceSummary(userAgent: string): string {
  if (!userAgent) return 'Unknown Device';
  let os = 'Unknown OS';
  if (/Macintosh|Mac OS X/i.test(userAgent)) os = 'macOS';
  else if (/Windows/i.test(userAgent)) os = 'Windows';
  else if (/Linux/i.test(userAgent)) os = 'Linux';
  else if (/Android/i.test(userAgent)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(userAgent)) os = 'iOS';

  let browser = 'Browser';
  if (/Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) browser = 'Chrome';
  else if (/Firefox/i.test(userAgent)) browser = 'Firefox';
  else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) browser = 'Safari';
  else if (/Edg/i.test(userAgent)) browser = 'Edge';

  return `${browser} on ${os}`;
}

// -------------------------------------------------------------
// IP BLOCKLIST MIDDLEWARE
// Enforced on all incoming requests
// -------------------------------------------------------------
export function checkIpBlocklist(req: Request, res: Response, next: NextFunction) {
  const clientIp = getClientIp(req);
  const now = new Date().toISOString();

  // Find active block
  const block = store.blockedIPs.find(b => {
    if (!b.is_active) return false;
    if (b.expires_at && b.expires_at < now) {
      b.is_active = false; // Mark expired block
      return false;
    }
    if (b.is_cidr) {
      return isIpInCidr(clientIp, b.ip_address);
    }
    return b.ip_address === clientIp;
  });

  if (block) {
    // Record audit event for blocked access attempt
    recordAuditEvent({
      userId: DEMO_USER_ID,
      eventType: 'ip_blocked',
      ipAddress: clientIp,
      userAgent: req.headers['user-agent'] as string,
      resourceType: 'ip_blocklist',
      resourceId: block.id,
      success: false,
      metadata: {
        reason: block.reason,
        attemptedRoute: req.originalUrl,
      },
    });

    return res.status(403).json({
      error: 'IPBlocked',
      message: 'Access Denied: Your IP address is blocked by the security system.',
      reason: block.reason,
      blocked_at: block.created_at,
      expires_at: block.expires_at,
    });
  }

  next();
}

// -------------------------------------------------------------
// ACCOUNT FROZEN MIDDLEWARE
// Enforced on modifying operations (POST, PUT, DELETE)
// -------------------------------------------------------------
export function checkAccountFrozen(req: any, res: Response, next: NextFunction) {
  const userId = req.user?.id || DEMO_USER_ID;
  const security = store.accountSecurity.get(userId);

  if (security && security.is_frozen) {
    // Allow unfreezing and read-only operations
    const isUnfreezePath = req.path === '/api/security/unfreeze';
    const isReadOnly = req.method === 'GET';

    if (!isReadOnly && !isUnfreezePath) {
      recordAuditEvent({
        userId,
        eventType: 'account_frozen',
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] as string,
        resourceType: 'account',
        resourceId: userId,
        success: false,
        metadata: {
          action: 'blocked_frozen_operation',
          method: req.method,
          path: req.path,
        },
      });

      return res.status(403).json({
        error: 'AccountFrozen',
        message: `Account is frozen: ${security.freeze_reason || 'Administrative hold active'}`,
        frozen_at: security.frozen_at,
        frozen_by: security.frozen_by,
        is_frozen: true,
      });
    }
  }

  next();
}
