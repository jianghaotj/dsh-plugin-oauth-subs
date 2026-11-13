import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { donateQr } from '../lib/utils/donate.js';
test('maintained fork does not expose inherited payment codes', async () => {
  assert.deepEqual(await donateQr(), {});
  const client = readFileSync(new URL('../lib/ui/client.js', import.meta.url), 'utf8');
  assert(!client.includes("h(PageTab, { id: 'donate'"));
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert(!pkg.files.includes('assets'));
});
