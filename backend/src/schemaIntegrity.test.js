const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');

// Every campaign status the application can persist. The database constraint
// must accept all of them or write paths (admin suspension, refunds, etc.)
// fail at runtime with CHECK violations.
const EXPECTED_CAMPAIGN_STATUSES = [
  'active',
  'funded',
  'in_progress',
  'completed',
  'closed',
  'withdrawn',
  'failed',
  'suspended',
  'refunded',
];

test('schema integrity: campaigns_status_check allows every status the app uses', () => {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  assert.ok(
    files.includes('20260602_campaign_refund_mechanism.sql'),
    'refund migration must still exist (regression guard)',
  );

  const sql = files
    .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n');

  // Replay the constraint's evolution exactly as migrate.js would apply it,
  // in chronological order: DROP resets it, the next ADD wins.
  const constraintRe =
    /(DROP CONSTRAINT IF EXISTS campaigns_status_check)|(ADD CONSTRAINT campaigns_status_check\s+CHECK\s*\(\s*status\s+IN\s*\([^)]*\)\s*\))/g;

  const events = [];
  let match;
  while ((match = constraintRe.exec(sql)) !== null) {
    if (match[1]) {
      events.push({ type: 'drop' });
    } else {
      events.push({ type: 'add', definition: match[2] });
    }
  }

  assert.ok(events.length, 'no campaigns_status_check migration found');

  let finalDefinition = null;
  for (const event of events) {
    if (event.type === 'drop') {
      finalDefinition = null;
    } else {
      finalDefinition = event.definition;
    }
  }

  assert.ok(
    finalDefinition,
    'campaigns_status_check must be (re)defined after the last migration',
  );

  const statuses = finalDefinition
    .replace(/^ADD CONSTRAINT campaigns_status_check\s+CHECK\s*\(\s*status\s+IN\s*\(\s*/i, '')
    .replace(/\s*\)\s*\)\s*$/, '')
    .split(',')
    .map((s) => s.trim().replace(/^'/, '').replace(/'$/, ''));

  assert.deepEqual(
    [...statuses].sort(),
    [...EXPECTED_CAMPAIGN_STATUSES].sort(),
    'final campaigns_status_check must allow every status the application writes, including suspended',
  );
});