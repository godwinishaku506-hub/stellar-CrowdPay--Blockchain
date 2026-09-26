const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { hmacSignature, assertSafeWebhookUrl, assertNotPrivateIp } = require('./webhookDispatcher');

// ---------------------------------------------------------------------------
// Existing HMAC signature test
// ---------------------------------------------------------------------------
test('HMAC-SHA256 signature matches Node crypto verify pattern', () => {
  const secret = 'whsec_testsecret';
  const body = JSON.stringify({ hello: 'world' });
  const sig = hmacSignature(secret, body);
  const expected = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  assert.equal(sig, expected);
});

// ---------------------------------------------------------------------------
// assertNotPrivateIp — synchronous IP range checks
// ---------------------------------------------------------------------------
test('assertNotPrivateIp blocks IPv4 loopback 127.0.0.1', () => {
  assert.throws(() => assertNotPrivateIp('127.0.0.1'), /loopback/i);
});

test('assertNotPrivateIp blocks IPv4 loopback 127.255.255.255', () => {
  assert.throws(() => assertNotPrivateIp('127.255.255.255'), /loopback/i);
});

test('assertNotPrivateIp blocks RFC-1918 10.x.x.x', () => {
  assert.throws(() => assertNotPrivateIp('10.0.0.1'), /private/i);
});

test('assertNotPrivateIp blocks RFC-1918 172.16.0.1', () => {
  assert.throws(() => assertNotPrivateIp('172.16.0.1'), /private/i);
});

test('assertNotPrivateIp blocks RFC-1918 172.31.255.255', () => {
  assert.throws(() => assertNotPrivateIp('172.31.255.255'), /private/i);
});

test('assertNotPrivateIp blocks RFC-1918 192.168.1.1', () => {
  assert.throws(() => assertNotPrivateIp('192.168.1.1'), /private/i);
});

test('assertNotPrivateIp blocks link-local 169.254.169.254 (AWS metadata)', () => {
  assert.throws(() => assertNotPrivateIp('169.254.169.254'), /link-local/i);
});

test('assertNotPrivateIp blocks IPv6 loopback ::1', () => {
  assert.throws(() => assertNotPrivateIp('::1'), /loopback/i);
});

test('assertNotPrivateIp blocks IPv6 ULA fc00::', () => {
  assert.throws(() => assertNotPrivateIp('fc00::1'), /private.*ULA/i);
});

test('assertNotPrivateIp blocks IPv6 ULA fd prefix', () => {
  assert.throws(() => assertNotPrivateIp('fd12:3456:789a:1::1'), /private.*ULA/i);
});

test('assertNotPrivateIp allows a public IPv4 address', () => {
  // Should not throw
  assert.doesNotThrow(() => assertNotPrivateIp('8.8.8.8'));
});

test('assertNotPrivateIp allows another public IPv4 address', () => {
  assert.doesNotThrow(() => assertNotPrivateIp('52.94.5.2'));
});

// ---------------------------------------------------------------------------
// assertSafeWebhookUrl — async URL-level validation
// ---------------------------------------------------------------------------
test('assertSafeWebhookUrl rejects http:// scheme', async () => {
  await assert.rejects(
    () => assertSafeWebhookUrl('http://example.com/hook'),
    /HTTPS/i
  );
});

test('assertSafeWebhookUrl rejects ftp:// scheme', async () => {
  await assert.rejects(
    () => assertSafeWebhookUrl('ftp://example.com/hook'),
    /HTTPS/i
  );
});

test('assertSafeWebhookUrl rejects file:// scheme', async () => {
  await assert.rejects(
    () => assertSafeWebhookUrl('file:///etc/passwd'),
    /HTTPS/i
  );
});

test('assertSafeWebhookUrl rejects invalid URL string', async () => {
  await assert.rejects(
    () => assertSafeWebhookUrl('not-a-url'),
    /Invalid webhook URL/i
  );
});

test('assertSafeWebhookUrl rejects https://localhost', async () => {
  await assert.rejects(
    () => assertSafeWebhookUrl('https://localhost/hook'),
    /forbidden host/i
  );
});

test('assertSafeWebhookUrl rejects https://localhost. subdomain', async () => {
  await assert.rejects(
    () => assertSafeWebhookUrl('https://internal.localhost/hook'),
    /forbidden host/i
  );
});

test('assertSafeWebhookUrl rejects https://127.0.0.1/', async () => {
  await assert.rejects(
    () => assertSafeWebhookUrl('https://127.0.0.1/hook'),
    /loopback/i
  );
});

test('assertSafeWebhookUrl rejects https://10.0.0.1/', async () => {
  await assert.rejects(
    () => assertSafeWebhookUrl('https://10.0.0.1/hook'),
    /private/i
  );
});

test('assertSafeWebhookUrl rejects https://192.168.1.1/', async () => {
  await assert.rejects(
    () => assertSafeWebhookUrl('https://192.168.1.1/hook'),
    /private/i
  );
});

test('assertSafeWebhookUrl rejects https://169.254.169.254/ (AWS metadata)', async () => {
  await assert.rejects(
    () => assertSafeWebhookUrl('https://169.254.169.254/latest/meta-data/'),
    /link-local/i
  );
});

test('assertSafeWebhookUrl rejects https://[::1]/', async () => {
  await assert.rejects(
    () => assertSafeWebhookUrl('https://[::1]/hook'),
    /loopback/i
  );
});
