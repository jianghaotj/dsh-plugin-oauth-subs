import test from 'node:test';
import assert from 'node:assert/strict';
import { KIRO_DEFAULT_REGION, normalizeKiroRegion, oidcEndpoint } from '../lib/oauth/kiro/index.js';
import { kiroIdcSession, registerKiroOidcClient } from '../lib/oauth/kiro/idc-flow.js';

// Synthetic IdC regression: the OIDC host is regional, so a non-default region
// must reach the wire and survive into the stored session.

test('normalizeKiroRegion keeps a valid region and falls back on blank input', () => {
  assert.equal(normalizeKiroRegion('ap-southeast-1'), 'ap-southeast-1');
  assert.equal(normalizeKiroRegion('  EU-Central-1 '), 'eu-central-1');
  assert.equal(normalizeKiroRegion(''), KIRO_DEFAULT_REGION);
  assert.equal(normalizeKiroRegion(undefined), KIRO_DEFAULT_REGION);
  assert.equal(normalizeKiroRegion(null, 'us-east-1'), 'us-east-1');
});

test('normalizeKiroRegion rejects values that are not AWS region ids', () => {
  for (const bad of ['useast1', 'us east 1', 'us-east', 'http://oidc.us-east-1.amazonaws.com', 42]) {
    assert.throws(() => normalizeKiroRegion(bad), /region/i, String(bad));
  }
});

test('registerKiroOidcClient registers against the requested region', async () => {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ clientId: 'cid', clientSecret: 'csecret' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const startUrl = 'https://example.awsapps.com/start';
  const registered = await registerKiroOidcClient({ region: 'ap-southeast-1', startUrl, fetchFn });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, oidcEndpoint('ap-southeast-1') + '/client/register');
  assert.equal(calls[0].url, 'https://oidc.ap-southeast-1.amazonaws.com/client/register');
  assert.equal(calls[0].body.issuerUrl, startUrl);
  assert.equal(registered.region, 'ap-southeast-1');
  assert.equal(registered.startUrl, startUrl);
});

test('an IdC session keeps the sign-in region but uses the Kiro data-plane region', () => {
  const registered = { clientId: 'cid', clientSecret: 'csecret', startUrl: 'https://example.awsapps.com/start', region: 'ap-southeast-1' };
  const session = kiroIdcSession({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 3600 }, registered, { kind: 'enterprise' });
  assert.equal(session.authMethod, 'idc');
  assert.equal(session.authRegion, 'ap-southeast-1');
  assert.equal(session.apiRegion, 'us-east-1');
  const eu = kiroIdcSession({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 3600 }, { ...registered, region: 'eu-west-1' }, { kind: 'enterprise' });
  assert.equal(eu.authRegion, 'eu-west-1');
  assert.equal(eu.apiRegion, 'eu-central-1');
});
