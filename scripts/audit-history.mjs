import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import { forbiddenPath, scanContent, assertClean } from './audit-common.mjs';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
const commits = git('rev-list', '--all').trim().split('\n').filter(Boolean);
const blobs = new Map();
const findings = [];
for (const commit of commits) {
  for (const record of git('ls-tree', '-rz', commit).split('\0').filter(Boolean)) {
    const [meta, path] = record.split('\t');
    const [mode, type, oid] = meta.split(' ');
    if (forbiddenPath.test(path)) findings.push({ path, object: commit, rule: 'forbidden-history-path' });
    if (type === 'blob') { if (!blobs.has(oid)) blobs.set(oid, new Set()); blobs.get(oid).add(path); }
    else if (type === 'commit') findings.push({ path, object: commit, rule: 'unscanned-submodule' });
    if (mode === '120000') findings.push({ path, object: commit, rule: 'symlink' });
  }
  findings.push(...scanContent(git('show', '-s', '--format=%B', commit), '(commit message)', commit));
}
for (const [oid, paths] of blobs) findings.push(...scanContent(git('cat-file', 'blob', oid), [...paths].join(' | '), oid));
const tags = git('for-each-ref', '--format=%(objectname)', 'refs/tags').trim().split('\n').filter(Boolean);
for (const oid of tags) if (git('cat-file', '-t', oid).trim() === 'tag') findings.push(...scanContent(git('cat-file', 'tag', oid), '(annotated tag)', oid));
const files = git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean);
let workFiles = 0;
for (const path of new Set(files)) {
  if (forbiddenPath.test(path)) findings.push({ path, rule: 'forbidden-working-path' });
  let stat; try { stat = lstatSync(path); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  if (!stat.isFile()) { findings.push({ path, rule: 'nonregular-working-file' }); continue; }
  findings.push(...scanContent(readFileSync(path, 'utf8'), path)); workFiles++;
}
assertClean(findings);
console.log(JSON.stringify({ reachableCommits: commits.length, uniqueBlobs: blobs.size, workingFiles: workFiles, findings: findings.length, note: 'Pattern scan only; no credential stores read. Unknown formats/binary content require manual review.' }));
