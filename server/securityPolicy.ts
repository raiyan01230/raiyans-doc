import {
  SecurityPolicyConfig,
  IpNetworkIntelligence,
  RecognizedDevice,
  UserProvidedLocation,
} from '../src/types';

// Default strict personal-vault security policy
export const currentSecurityPolicy: SecurityPolicyConfig = {
  locationRequired: true, // Strict personal vault: browser location verification required
  deviceIdentificationRequired: true,
  authenticationRequired: true,
  trustedDeviceRequired: false,
  mfaRequired: true,
  requireExactLocation: true,
  strictDeviceRecognition: false,
  blockDatacenterAsn: true,
  blockVpnAndProxies: false,
  sessionInactivityTimeoutMinutes: 30,
  maxActiveSessions: 3,
  allowedCountries: ['Bangladesh', 'BD', 'Private Network'], // Default owner configuration
  blockedCountries: [],
  countryPolicyAction: 'alert_only', // 'block' | 'require_mfa' | 'read_only' | 'alert_only'
  vpnAllowed: true, // Configurable
  proxyAllowed: false, // Configurable
  maxFailedLoginAttempts: 5,
  rateLimitWindowMinutes: 10,
  sessionHijackAutoAction: 'flag_alert', // 'flag_alert' | 'require_reauth' | 'terminate_session' | 'freeze_account'
  emergencyRecoveryActive: true,
  updatedAt: new Date().toISOString(),
};

// Evaluate request against current security policy
export function evaluateAccessPolicy(params: {
  networkInfo?: IpNetworkIntelligence;
  device?: RecognizedDevice;
  userLocation?: UserProvidedLocation | null;
  isEmergencyRecovery?: boolean;
}): {
  allowed: boolean;
  requiresMfa?: boolean;
  isReadOnly?: boolean;
  denialReason?: string;
  policyViolations: string[];
} {
  const { networkInfo, device, userLocation, isEmergencyRecovery } = params;
  const violations: string[] = [];

  // Emergency recovery bypasses standard checks with separate cryptographic recovery credential
  if (isEmergencyRecovery) {
    return { allowed: true, policyViolations: [] };
  }

  // 1. Mandatory Location Check (if enabled)
  if (currentSecurityPolicy.locationRequired) {
    if (!userLocation || typeof userLocation.latitude !== 'number') {
      violations.push('Location verification required: Precise browser coordinates not provided.');
      return {
        allowed: false,
        denialReason: 'Location verification is required to access this private vault.',
        policyViolations: violations,
      };
    }
  }

  // 2. Mandatory Device Identification
  if (currentSecurityPolicy.deviceIdentificationRequired && !device) {
    violations.push('Device identification required: No recognizable device signals detected.');
    return {
      allowed: false,
      denialReason: 'Device identification failed. Legitimate browser context is required.',
      policyViolations: violations,
    };
  }

  // 3. Trusted Device Check
  if (currentSecurityPolicy.trustedDeviceRequired && device?.trustStatus !== 'trusted') {
    violations.push(`Untrusted device: Device ${device?.deviceLabel || ''} is not marked as trusted.`);
    return {
      allowed: false,
      denialReason: 'Access Denied: Policy requires a pre-authorized trusted device.',
      policyViolations: violations,
    };
  }

  // 4. VPN Detection Check
  if (!currentSecurityPolicy.vpnAllowed && networkInfo?.vpn.detected) {
    violations.push('VPN Detected: Policy prohibits connections via virtual private networks.');
    return {
      allowed: false,
      denialReason: 'Access Denied: Active VPN connection detected.',
      policyViolations: violations,
    };
  }

  // 5. Proxy Detection Check
  if (!currentSecurityPolicy.proxyAllowed && networkInfo?.proxy.detected) {
    violations.push('Proxy Detected: Policy prohibits connections via anonymizing proxies.');
    return {
      allowed: false,
      denialReason: 'Access Denied: Proxy relay detected.',
      policyViolations: violations,
    };
  }

  // 6. Country Restriction Check
  const country = networkInfo?.country || '';
  const countryCode = networkInfo?.countryCode || '';

  const isExplicitlyBlocked = currentSecurityPolicy.blockedCountries.some(
    c => c.toLowerCase() === country.toLowerCase() || c.toLowerCase() === countryCode.toLowerCase()
  );

  const hasAllowedList = currentSecurityPolicy.allowedCountries.length > 0;
  const isAllowed =
    !hasAllowedList ||
    country === 'Private Network' ||
    currentSecurityPolicy.allowedCountries.some(
      c => c.toLowerCase() === country.toLowerCase() || c.toLowerCase() === countryCode.toLowerCase()
    );

  if (isExplicitlyBlocked || (!isAllowed && hasAllowedList)) {
    violations.push(`Geographic Policy: Country "${country}" is restricted.`);
    if (currentSecurityPolicy.countryPolicyAction === 'block') {
      return {
        allowed: false,
        denialReason: `Access Denied: Incoming connection from restricted region (${country}).`,
        policyViolations: violations,
      };
    } else if (currentSecurityPolicy.countryPolicyAction === 'require_mfa') {
      return {
        allowed: true,
        requiresMfa: true,
        policyViolations: violations,
      };
    } else if (currentSecurityPolicy.countryPolicyAction === 'read_only') {
      return {
        allowed: true,
        isReadOnly: true,
        policyViolations: violations,
      };
    }
  }

  return {
    allowed: true,
    policyViolations: violations,
  };
}

// Update security policy
export function updateSecurityPolicy(updates: Partial<SecurityPolicyConfig>): SecurityPolicyConfig {
  Object.assign(currentSecurityPolicy, updates);
  currentSecurityPolicy.updatedAt = new Date().toISOString();
  return { ...currentSecurityPolicy };
}
