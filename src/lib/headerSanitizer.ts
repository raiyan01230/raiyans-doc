/**
 * Utility for HTTP header validation and sanitization.
 * Enforces RFC 7230 / ISO-8859-1 compliance for HTTP headers.
 */

// Headers containing sensitive data that should never be logged in debug mode
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'bearer',
  'token',
]);

/**
 * Validates if a header name is a valid HTTP token according to RFC 7230.
 */
export function isValidHeaderName(name: string): boolean {
  if (typeof name !== 'string' || !name.length) return false;
  return /^[a-zA-Z0-9!#$%&'*+-.^_`|~]+$/.test(name);
}

/**
 * Validates if a header value contains only valid ISO-8859-1 printable characters
 * (code points <= 255) and no control characters (CR, LF, NULL, etc.).
 */
export function isValidHeaderValue(value: string): boolean {
  if (typeof value !== 'string') return false;

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    // Reject CR (\r=13), LF (\n=10), control characters (< 32 except TAB \t=9), DEL (127), and non-ISO-8859-1 (> 255)
    if (code === 13 || code === 10 || (code < 32 && code !== 9) || code === 127 || code > 255) {
      return false;
    }
  }
  return true;
}

/**
 * Validates Authorization header format (e.g. "Bearer <ascii_token>").
 */
export function isValidAuthorizationHeader(value: string): boolean {
  if (!isValidHeaderValue(value)) return false;
  return /^Bearer\s+[A-Za-z0-9._~+/-]+=*$/.test(value) || /^[A-Za-z0-9._~+/-]+=*$/.test(value);
}

export interface HeaderValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateHeader(name: string, value: string): HeaderValidationResult {
  if (!isValidHeaderName(name)) {
    return { valid: false, reason: 'Invalid header name format' };
  }

  if (name.toLowerCase() === 'authorization') {
    if (!isValidAuthorizationHeader(value)) {
      return { valid: false, reason: 'Authorization header contains invalid characters or format' };
    }
  } else if (!isValidHeaderValue(value)) {
    return { valid: false, reason: 'Contains non ISO-8859-1 code point or invalid control characters' };
  }

  return { valid: true };
}

/**
 * Validates and sanitizes a headers object before passing to fetch() / Request().
 * In development / debug mode, prints safe diagnostics without leaking secrets.
 */
export function sanitizeHeaders(
  headers: Record<string, string | undefined>,
  sourcePath: string = 'api/fetch'
): Record<string, string> {
  const safeHeaders: Record<string, string> = {};
  const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;

  for (const [name, val] of Object.entries(headers)) {
    if (val === undefined || val === null) continue;

    const validation = validateHeader(name, val);

    if (isDev) {
      const isSensitive = SENSITIVE_HEADERS.has(name.toLowerCase());
      const displayVal = isSensitive ? '[REDACTED_SECRET]' : val.length > 50 ? `${val.substring(0, 50)}...` : val;

      console.log(`[REQUEST DEBUG]`);
      console.log(`Header Name:   ${name}`);
      console.log(`Header Source: ${sourcePath}`);
      console.log(`Validation:    ${validation.valid ? 'PASS' : 'FAIL'}`);
      if (!validation.valid) {
        console.warn(`Reason:        ${validation.reason} (Value sample: "${displayVal}")`);
      }
    }

    if (validation.valid) {
      safeHeaders[name] = val;
    } else {
      console.error(
        `[HEADER SANITIZER] Stripped header "${name}" from request due to validation failure: ${validation.reason}`
      );
    }
  }

  return safeHeaders;
}
