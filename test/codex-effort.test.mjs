import test from 'node:test';
import assert from 'node:assert/strict';
import { CODEX_REASONING_EFFORTS, CODEX_REASONING_EFFORTS_56 } from '../lib/oauth/codex/index.js';
import { normalizeCodexResponsesBody } from '../lib/oauth/codex/request.js';

// chatgpt.com answers 400 unsupported_value for reasoning.effort "none", so the
// Codex family must not advertise an off rung, and the proxy must never forward
// an explicit none/null effort.

test('codex effort ladders expose no off rung', () => {
  assert.equal(Object.hasOwn(CODEX_REASONING_EFFORTS, 'off'), false);
  assert.equal(Object.hasOwn(CODEX_REASONING_EFFORTS_56, 'off'), false);
  assert.deepEqual(Object.keys(CODEX_REASONING_EFFORTS), ['low', 'medium', 'high', 'xhigh']);
  assert.equal(CODEX_REASONING_EFFORTS_56.max, 'max');
});

test('an unset or explicit off effort is omitted from the Codex body', () => {
  const off = normalizeCodexResponsesBody({ model: 'gpt-6-astra', reasoning: { effort: 'none' } });
  assert.deepEqual(off.reasoning, undefined);
  assert.equal(JSON.stringify(off).includes('none'), false);

  const nul = normalizeCodexResponsesBody({ model: 'gpt-6-astra', reasoning: { effort: null } });
  assert.deepEqual(nul.reasoning, undefined);

  const kept = normalizeCodexResponsesBody({ model: 'gpt-6-astra', reasoning: { effort: 'high', summary: 'auto' } });
  assert.deepEqual(kept.reasoning, { effort: 'high', summary: 'auto' });

  const modeOnly = normalizeCodexResponsesBody({ model: 'gpt-6-astra', reasoning: { mode: 'standard', summary: 'auto' } });
  assert.deepEqual(modeOnly.reasoning, { summary: 'auto' });
});
