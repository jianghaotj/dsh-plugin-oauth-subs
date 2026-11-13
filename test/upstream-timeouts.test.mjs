import test from 'node:test';
import assert from 'node:assert/strict';
import { UPSTREAM_TIMEOUTS, UPSTREAM_TIMEOUT_CEILING_MS, resolveUpstreamTimeouts } from '../lib/oauth/upstream.js';

// The host cuts a silent stream at 300s, so plugin timers must stay below that
// ceiling and every override must be a positive duration.

test('default upstream timers give a slow first byte more room than the old 120s', () => {
  assert.deepEqual(UPSTREAM_TIMEOUTS, { firstByteMs: 240_000, budgetMs: 290_000, idleMs: 290_000 });
  assert.deepEqual(resolveUpstreamTimeouts(), UPSTREAM_TIMEOUTS);
  assert.ok(UPSTREAM_TIMEOUT_CEILING_MS < 300_000);
});

test('explicit timers are honoured', () => {
  assert.deepEqual(
    resolveUpstreamTimeouts({ firstByteMs: 60_000, budgetMs: 120_000, idleMs: 90_000 }),
    { firstByteMs: 60_000, budgetMs: 120_000, idleMs: 90_000 },
  );
  assert.equal(resolveUpstreamTimeouts({ firstByteMs: '30000' }).firstByteMs, 30_000);
});

test('timers are clamped to the host watchdog ceiling', () => {
  const wide = resolveUpstreamTimeouts({ firstByteMs: 900_000, budgetMs: 900_000, idleMs: 900_000 });
  assert.deepEqual(wide, {
    firstByteMs: UPSTREAM_TIMEOUT_CEILING_MS,
    budgetMs: UPSTREAM_TIMEOUT_CEILING_MS,
    idleMs: UPSTREAM_TIMEOUT_CEILING_MS,
  });
});

test('the first-byte window never outlives the budget', () => {
  const merged = resolveUpstreamTimeouts({ firstByteMs: 200_000, budgetMs: 90_000 });
  assert.equal(merged.firstByteMs, 90_000);
  assert.equal(merged.budgetMs, 90_000);
});

test('nonsense values fail closed instead of silently reverting', () => {
  for (const bad of [0, -1, 'abc', Number.NaN, Number.POSITIVE_INFINITY, 4_999]) {
    assert.throws(() => resolveUpstreamTimeouts({ firstByteMs: bad }), /upstream firstByteMs/);
  }
  assert.throws(() => resolveUpstreamTimeouts({ budgetMs: 'soon' }), /upstream budgetMs/);
  assert.throws(() => resolveUpstreamTimeouts({ idleMs: 1 }), /upstream idleMs/);
});
