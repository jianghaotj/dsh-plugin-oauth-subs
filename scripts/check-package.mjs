import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { forbiddenPath, scanContent, assertClean } from './audit-common.mjs';
const root = resolve('.test-tmp'); mkdirSync(root, { recursive: true });
const tmp = mkdtempSync(join(root, 'pack-'));
try {
  const env = { ...process.env, NPM_CONFIG_USERCONFIG: join(tmp, 'user.npmrc'), NPM_CONFIG_GLOBALCONFIG: join(tmp, 'global.npmrc'), NPM_CONFIG_CACHE: resolve('.test-cache') };
  const report = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', tmp], { encoding: 'utf8', env }))[0];
  const names = report.files.map(file => file.path);
  const allowed = /^(?:lib\/|assets\/|package\.json$|cordis\.patch\.yml$|LICENSE$|README(?:\.zh)?\.md$|MAINTENANCE\.md$|CHANGELOG\.md$)/;
  for (const name of names) { assert(allowed.test(name), 'Unexpected packaged path: ' + name); assert(!forbiddenPath.test(name), 'Sensitive/backup path: ' + name); assert(!name.includes('..'), 'Unsafe package path'); }
  for (const required of ['lib/index.js', 'lib/ui/client.js', 'cordis.patch.yml', 'LICENSE', 'MAINTENANCE.md', 'CHANGELOG.md']) assert(names.includes(required), 'Missing: ' + required);
  const archive = join(tmp, report.filename);
  execFileSync('tar', ['-xzf', archive, '-C', tmp]);
  const pkg = join(tmp, 'package');
  const manifest = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
  assert.equal(manifest.version, '0.0.111'); assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.repository.url, 'git+https://github.com/jianghaotj/dsh-plugin-oauth-subs.git');
  assert.equal(manifest.main, 'lib/index.js'); assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
  assert.match(readFileSync(join(pkg, 'LICENSE'), 'utf8'), /Copyright \(c\) 2026 dsh-plugin-oauth-subs contributors/);
  const findings = [];
  for (const path of names) { assert(lstatSync(join(pkg, path)).isFile(), 'Nonregular package entry'); findings.push(...scanContent(readFileSync(join(pkg, path), 'utf8'), path, 'npm-pack')); }
  assertClean(findings);
  console.log(JSON.stringify({ name: report.filename, files: names.length, unpackedSize: report.unpackedSize, sha256: createHash('sha256').update(readFileSync(archive)).digest('hex'), findings: findings.length }));
} finally { assert(tmp.startsWith(root + '/pack-')); rmSync(tmp, { recursive: true, force: true }); }
