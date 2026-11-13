import { createHash } from 'node:crypto';
export const forbiddenPath = /(?:^|\/)(?:node_modules|\.git|\.ssh|\.test-[^/]*|data|sessions)(?:\/|$)|(?:^|\/)(?:\.env(?:\..*)?|auth\.json|credentials\.json|proxy-key|id_rsa|id_ed25519)$|(?:\.bak[^/]*|\.log|\.pem|\.key|\.tgz)$/i;
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ['github-token', /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/g],
  ['aws-access-key', /(?:AKIA|ASIA)[A-Z0-9]{16}/g],
  ['slack-token', /xox[baprs]-[A-Za-z0-9-]{24,}/g],
  ['jwt', /eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/g],
  ['literal-secret', /(?:accessToken|refreshToken|apiKey|clientSecret|password)\s*[:=]\s*['"]([^'"\n]{24,})['"]/g],
];
export function scanContent(text, path, object = 'working-tree') {
  const findings = [];
  for (const [rule, regex] of rules) {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex)) findings.push({ path, object, rule, line: text.slice(0, match.index).split('\n').length, fingerprint: createHash('sha256').update(match[0]).digest('hex') });
  }
  return findings;
}
export function assertClean(findings) {
  if (findings.length) { console.error(JSON.stringify({ findings }, null, 2)); process.exitCode = 1; }
}
