import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import vm from 'node:vm';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { kiroSession, kiroUsageHeaders, KIRO_DEFAULT_REGION } from '../lib/oauth/kiro/index.js';
import { fetchKiroLiveModels } from '../lib/oauth/kiro/catalog.js';
import { parseCopilotUsage } from '../lib/oauth/quota.js';
import { AuthController } from '../lib/oauth/controller.js';
import { getSession } from '../lib/oauth/store.js';
import { installRelease, fetchLatest, REPO_SLUG, REPO_URL, RELEASES_API } from '../lib/utils/update.js';
import { updatePrefsPath } from '../lib/utils/update-prefs.js';
import { forbiddenPath, scanContent } from '../scripts/audit-common.mjs';

const agent = new MockAgent(); agent.disableNetConnect(); setGlobalDispatcher(agent);
const oldFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Real network is forbidden in maintenance tests'); };
const root = resolve('.test-tmp'); mkdirSync(root, { recursive: true });
const tmp = mkdtempSync(join(root, 'regression-'));
after(async () => { globalThis.fetch = oldFetch; await agent.close(); assert(tmp.startsWith(root + '/regression-')); rmSync(tmp, { recursive: true, force: true }); });
const deny = () => { throw new Error('Unexpected external operation'); };
const synthetic = (extra = {}) => kiroSession({ authMethod: 'idc', accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh', expiresAt: Date.now() + 3600000, ...extra });

test('Kiro keeps auth-region separate from the regional API plane', () => {
  assert.equal(KIRO_DEFAULT_REGION, 'us-west-2');
  const us = synthetic(); assert.equal(us.authRegion, 'us-west-2'); assert.equal(us.apiRegion, 'us-east-1');
  assert.equal(synthetic({ region: 'eu-west-1' }).apiRegion, 'eu-central-1');
  assert.equal(synthetic({ apiRegion: 'ap-southeast-1' }).apiRegion, 'ap-southeast-1');
  assert.equal(synthetic({ authMethod: 'social', region: 'eu-central-1' }).apiRegion, 'eu-central-1');
});
test('Kiro usage headers use the maintained CLI/KAS compatibility values', () => {
  const headers = kiroUsageHeaders(synthetic());
  assert.match(headers['user-agent'], /KiroCLI\/2\.37\.1 KAS\/0\.66\.70/);
  assert.equal(headers['x-amz-user-agent'], headers['user-agent']);
  assert.doesNotMatch(headers['user-agent'], /KiroIDE-1\.0\.0/);
});
test('Kiro discovers and retains enterprise profile ARN using mocked management responses', async () => {
  const session = synthetic(); const calls = [];
  const models = await fetchKiroLiveModels(session, { regions: ['us-east-1'], fetchFn: async (url, init) => {
    calls.push({ url, method: init.method });
    if (init.method === 'POST') return new Response(JSON.stringify({ profiles: [{ arn: 'synthetic-enterprise-profile' }] }));
    const discovered = new URL(url).searchParams.get('profileArn') === 'synthetic-enterprise-profile';
    return new Response(JSON.stringify({ models: discovered ? [{ modelId: 'synthetic-model' }] : [] }));
  } });
  assert.equal(session.profileArn, 'synthetic-enterprise-profile');
  assert.equal(models[0].modelId, 'synthetic-model');
  assert(calls.some(call => call.method === 'POST'));
});
test('Kiro discovery preserves the existing profile after failed/empty responses', async () => {
  const session = synthetic({ profileArn: 'synthetic-existing-profile' });
  const result = await fetchKiroLiveModels(session, { fetchFn: async () => new Response('{}', { status: 403 }) });
  assert.deepEqual(result, []); assert.equal(session.profileArn, 'synthetic-existing-profile');
});
test('controller persists discovered enterprise profile only in an isolated synthetic store', async () => {
  const path = join(tmp, 'synthetic-sessions.json');
  const session = synthetic();
  const controller = new AuthController({ authPath: path, modelsPath: join(tmp, 'models.json'), fetchFn: deny, commandCodeAutoImport: false, kiroDiscover: async (current) => { current.profileArn = 'synthetic-enterprise-profile'; return []; } });
  controller.tokens = { kiro: { session: async () => session } };
  await controller.warmCatalogs();
  const saved = await getSession('kiro', path);
  assert.equal(saved.profileArn, 'synthetic-enterprise-profile');
});
function premium(snap) { return parseCopilotUsage({ quota_snapshots: { premium_interactions: snap } }).rows[0]; }
test('Copilot preserves absolute credit totals, usage and remaining, including zero', () => {
  const row = premium({ percent_remaining: 25, entitlement: 100, credits_used: 75, remaining: 25 });
  assert.equal(row.total, 100); assert.equal(row.used, 75); assert.equal(row.remaining, 25);
  assert.equal(row.remainingPercent, 25); assert.equal(row.usedPercent, 75);
  assert.equal(premium({ percent_remaining: 0, entitlement: 100, credits_used: 100, remaining: 0 }).remaining, 0);
  assert.equal(premium({ percent_remaining: 25, entitlement: '100', quota_remaining: '25' }).remaining, 25);
});
test('Copilot rejects invalid percentages and avoids fabricated quota totals', () => {
  assert.equal(premium({ percent_remaining: NaN, entitlement: 100 }), undefined);
  assert.equal(premium({ entitlement: 100 }), undefined);
  assert.equal(premium({ percent_remaining: 20, entitlement: 0, remaining: 2 }).total, undefined);
  assert.equal(premium({ percent_remaining: 200 }).remainingPercent, 100);
  assert.equal(premium({ unlimited: true }).unlimited, true);
});
const ui = readFileSync(new URL('../lib/ui/client.js', import.meta.url), 'utf8');
const begin = ui.indexOf('function QuotaRow('); const end = ui.indexOf('function resetCreditRows(', begin);
assert(begin >= 0 && end > begin);
const QuotaRow = vm.runInNewContext('(' + ui.slice(begin, end).trim() + ')', {
  h: (type, props, ...children) => ({ type, props, children }), QuotaMeter: 'QuotaMeter',
  remainingPercentOf: row => row.remainingPercent, formatAmount: String, formatTokenAmount: String, formatUsd: String,
  formatReset: () => '', rowLabel: () => 'synthetic-label',
});
test('the actual UI QuotaRow renders remaining/total for Kiro and Copilot, including zero', () => {
  for (const family of ['kiro', 'copilot']) {
    const rendered = QuotaRow({ t: {}, row: { used: 75, total: 100, remaining: 25 }, family });
    assert.equal(rendered.children[0].props.amount, '25 / 100');
    assert.equal(QuotaRow({ t: {}, row: { used: 100, total: 100, remaining: 0 }, family }).children[0].props.amount, '0 / 100');
  }
  assert.equal(QuotaRow({ t: {}, row: { used: 75, total: 100, remaining: 25 }, family: 'grok' }).children[0].props.amount, '75 / 100');
});
test('UI removes automatic-update switches and install callbacks from the About panel', () => {
  const panel = ui.slice(ui.indexOf('function AboutPanel('), ui.indexOf('function ', ui.indexOf('function AboutPanel(') + 25));
  assert.doesNotMatch(ui, /h\(AutoUpdateRow,/);
  assert.doesNotMatch(ui, /onClick: onApply/);
  assert.match(ui, /manualPinnedUpdateNote/);
  assert.match(ui, /jianghaotj\/dsh-plugin-oauth-subs/);
});
test('legacy autoUpdate=true preferences cannot enable timers or install requests', async () => {
  const path = join(tmp, 'legacy.json'); const prefs = updatePrefsPath(tmp);
  writeFileSync(prefs, JSON.stringify({ autoUpdate: true }));
  const controller = new AuthController({ authPath: path, modelsPath: join(tmp, 'models.json'), fetchFn: deny, commandCodeAutoImport: false, installReleaseFn: deny });
  await controller.prefsReady; assert.equal(controller.autoUpdate, false);
  assert.deepEqual(await controller.setAutoUpdate({ autoUpdate: true }), { autoUpdate: false, reason: 'pinned-install' });
  controller.startAutoUpdateWatch(); assert.equal(controller.autoUpdateTimer, undefined);
  assert.deepEqual(await controller.runAutoUpdate(), { skipped: true, reason: 'pinned-install' });
  assert.equal(JSON.parse(readFileSync(prefs, 'utf8')).autoUpdate, true, 'legacy preference file is not silently rewritten');
});
test('both old install RPC and direct install API are no-op manual instructions', async () => {
  const controllerResult = await AuthController.prototype.checkUpdate.call({ fetchFn: deny, installReleaseFn: deny }, { apply: true });
  assert.equal(controllerResult.apply.status, 'manual');
  const result = await installRelease({ fetchFn: deny, spawnFn: deny, dirs: [join(tmp, 'must-not-exist')] });
  assert.equal(result.status, 'manual'); assert.equal(result.reason, 'pinned-install');
  assert.equal(existsSync(join(tmp, 'must-not-exist')), false);
});
test('manual release metadata uses only maintained repository, with synthetic responses', async () => {
  assert.equal(REPO_SLUG, 'jianghaotj/dsh-plugin-oauth-subs');
  assert.equal(REPO_URL, 'https://github.com/' + REPO_SLUG);
  let requests = 0;
  const result = await fetchLatest({ current: '0.0.111', env: {}, existsSyncFn: () => false, readFileFn: () => { throw new Error('fixture: no disk install'); }, spawnFn: deny, fetchFn: async url => {
    assert.equal(url, RELEASES_API); requests++;
    return new Response(JSON.stringify({ tag_name: 'v0.0.112', html_url: REPO_URL + '/releases/tag/v0.0.112', assets: [] }));
  } });
  assert.equal(requests, 1); assert.equal(result.status, 'update');
});
test('scanner finds synthetic secrets and backups without exposing matched values', () => {
  const sample = 'ghp_' + 'A'.repeat(36);
  const findings = scanContent(sample, 'synthetic.txt'); assert.equal(findings[0].rule, 'github-token');
  assert(!JSON.stringify(findings).includes(sample));
  assert.equal(scanContent('-----BEGIN ' + 'PRIVATE KEY-----', 'synthetic.txt')[0].rule, 'private-key');
  assert(forbiddenPath.test('lib/foo.js.bak-old')); assert(forbiddenPath.test('data/auth.json'));
  assert(!forbiddenPath.test('lib/oauth/store.js'));
});
test('maintenance metadata preserves MIT and declares an artifact-only pinned fork', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.version, '0.0.112'); assert.equal(pkg.license, 'MIT');
  assert.match(pkg.repository.url, /jianghaotj/); assert.equal(pkg.scripts.build, undefined);
  assert.match(readFileSync(new URL('../MAINTENANCE.md', import.meta.url), 'utf8'), /original.*test suite are absent/i);
});
