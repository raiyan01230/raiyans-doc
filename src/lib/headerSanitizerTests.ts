import {
  isValidHeaderName,
  isValidHeaderValue,
  isValidAuthorizationHeader,
  validateHeader,
  sanitizeHeaders,
} from './headerSanitizer';

export function runHeaderSanitizerTestSuite(): { passed: boolean; testResults: string[] } {
  const results: string[] = [];
  let passed = true;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      results.push(`✅ PASS: ${testName}`);
    } else {
      results.push(`❌ FAIL: ${testName}`);
      passed = false;
    }
  };

  // Test 1: ASCII header
  assert(isValidHeaderName('X-Test') && isValidHeaderValue('hello') && validateHeader('X-Test', 'hello').valid, 'ASCII header name and value should PASS');

  // Test 2: Unicode database value (Curly quote, Em dash)
  const unicodeDevice = 'Raiyan’s PC — Windows';
  assert(!isValidHeaderValue(unicodeDevice) && !validateHeader('X-Device-Name', unicodeDevice).valid, 'Unicode database value (Curly quote, Em dash) should REJECT in header');

  // Test 3: Emoji
  const emojiStr = '🔐 Security Alert';
  assert(!isValidHeaderValue(emojiStr) && !validateHeader('X-Event', emojiStr).valid, 'Emoji value should REJECT in header');

  // Test 4: Bengali
  const bengaliStr = 'নিরাপত্তা';
  assert(!isValidHeaderValue(bengaliStr) && !validateHeader('X-Reason', bengaliStr).valid, 'Bengali / non-Latin characters should REJECT in header');

  // Test 5: Line break
  const lineBreakStr = 'hello\r\nworld';
  assert(!isValidHeaderValue(lineBreakStr) && !validateHeader('X-Custom', lineBreakStr).valid, 'CR / LF / line break should REJECT in header');

  // Test 6: Control characters
  const ctrlStr = 'hello\x07world';
  assert(!isValidHeaderValue(ctrlStr) && !validateHeader('X-Custom', ctrlStr).valid, 'Control characters should REJECT in header');

  // Test 7: Authorization token valid format
  const validAuth = 'Bearer token_01JABC123XYZ';
  assert(isValidAuthorizationHeader(validAuth) && validateHeader('Authorization', validAuth).valid, 'Authorization token should PASS when valid format');

  // Test 8: Authorization token invalid format
  const invalidAuth = 'Bearer token_🔐_বাংলা';
  assert(!isValidAuthorizationHeader(invalidAuth) && !validateHeader('Authorization', invalidAuth).valid, 'Authorization token with invalid characters should REJECT');

  // Test 9: sanitizeHeaders strips invalid headers and preserves valid ones
  const input = {
    'Content-Type': 'application/json',
    'x-device-id': 'dev-123456',
    'x-device-label': 'Raiyan’s PC — Windows',
    'x-emoji': '🔐 Alert',
    Authorization: 'Bearer valid_token_123',
  };
  const sanitized = sanitizeHeaders(input, 'test/suite');
  assert(
    sanitized['Content-Type'] === 'application/json' &&
    sanitized['x-device-id'] === 'dev-123456' &&
    sanitized['Authorization'] === 'Bearer valid_token_123' &&
    sanitized['x-device-label'] === undefined &&
    sanitized['x-emoji'] === undefined,
    'sanitizeHeaders strips invalid headers and preserves valid headers'
  );

  return { passed, testResults: results };
}

// Auto-run test suite in development mode on client load
if (typeof window !== 'undefined' && (process.env.NODE_ENV !== 'production')) {
  const { passed, testResults } = runHeaderSanitizerTestSuite();
  console.log(`[HEADER SANITIZER SUITE] ${passed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  testResults.forEach(r => console.log(`  ${r}`));
}
