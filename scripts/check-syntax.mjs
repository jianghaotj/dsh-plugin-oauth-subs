import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const files = [];
function walk(dir) { for (const entry of readdirSync(dir, { withFileTypes: true })) { const path = join(dir, entry.name); if (entry.isDirectory()) walk(path); else if (entry.name.endsWith('.js')) files.push(path); } }
walk('lib');
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
console.log('Syntax OK: ' + files.length + ' JavaScript files');
