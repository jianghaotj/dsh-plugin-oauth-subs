/** Read-only local version and explicit maintained-repository release checks.
 * In-place self-installation is disabled: use the host/package manager to
 * select a reviewed commit SHA without silently breaking a pinned install.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { readDevVersion } from './dev-version.js';
import { errorCode } from './http.js';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { outboundFetch } from './outbound.js';
export function modulePackageJsonPath() {
    return fileURLToPath(new URL('../../package.json', import.meta.url));
}
export const REPO_SLUG = 'jianghaotj/dsh-plugin-oauth-subs';
export const REPO_URL = `https://github.com/${REPO_SLUG}`;
export function manualUpdateResult() {
    return { status: 'manual', reason: 'pinned-install', url: REPO_URL,
        command: 'Use the DSH plugin manager with a reviewed commit SHA; in-place self-installation is disabled.' };
}
export const RELEASES_API = `https://api.github.com/repos/${REPO_SLUG}/releases/latest`;
export const RELEASES_LATEST_HTML = `${REPO_URL}/releases/latest`;
export const PLATFORMS = Object.freeze(['win', 'mac', 'linux']);
export const PLUGIN_NAME = 'dsh-plugin-oauth-subs';
export const DEFAULT_PROFILE = 'web';
export const DSH_BIN = 'dsh';
export const GH_BIN = 'gh';
export const GH_API_TIMEOUT_MS = 5_000;
// Preserve the version of the code loaded by this process. A self-update may
// replace package.json on disk, but the running module remains the old code.
const LOADED_VERSION = readPackageVersion(modulePackageJsonPath());
export function installedVersion({ readFileFn } = {}) {
    return readFileFn ? readPackageVersion(modulePackageJsonPath(), { readFileFn }) : LOADED_VERSION;
}
/** Newer of two semver-ish tags. Empty / unparseable values lose. */
export function fresherVersion(left, right) {
    const a = parseVersion(left);
    const b = parseVersion(right);
    if (a && b)
        return compareVersions(a.raw, b.raw) >= 0 ? a.raw : b.raw;
    if (a)
        return a.raw;
    if (b)
        return b.raw;
    const fallback = [left, right].find((value) => typeof value === 'string' && value.trim());
    return fallback ? String(fallback).trim() : '';
}
export function parseVersion(tag) {
    const match = String(tag ?? '').trim().match(/(?:v|dsh-v)?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
    if (!match)
        return undefined;
    const prerelease = match[4] || '';
    const raw = prerelease ? `${match[1]}.${match[2]}.${match[3]}-${prerelease}` : `${match[1]}.${match[2]}.${match[3]}`;
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease,
        raw,
    };
}
export function compareVersions(left, right) {
    const a = parseVersion(left);
    const b = parseVersion(right);
    if (!a || !b)
        return 0;
    if (a.major !== b.major)
        return a.major - b.major;
    if (a.minor !== b.minor)
        return a.minor - b.minor;
    if (a.patch !== b.patch)
        return a.patch - b.patch;
    // Non-prerelease is greater than prerelease (e.g. 0.1.2 > 0.1.2-rc.1)
    if (!a.prerelease && b.prerelease)
        return 1;
    if (a.prerelease && !b.prerelease)
        return -1;
    if (!a.prerelease && !b.prerelease)
        return 0;
    const aParts = a.prerelease.split('.');
    const bParts = b.prerelease.split('.');
    const len = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < len; i++) {
        const aPart = aParts[i];
        const bPart = bParts[i];
        if (aPart === undefined)
            return -1;
        if (bPart === undefined)
            return 1;
        if (aPart === bPart)
            continue;
        const aNum = Number(aPart);
        const bNum = Number(bPart);
        const aIsNum = !Number.isNaN(aNum) && String(aNum) === aPart;
        const bIsNum = !Number.isNaN(bNum) && String(bNum) === bPart;
        if (aIsNum && bIsNum)
            return aNum - bNum;
        if (aIsNum && !bIsNum)
            return -1;
        if (!aIsNum && bIsNum)
            return 1;
        return aPart.localeCompare(bPart);
    }
    return 0;
}
export function hostPlatform(platform = process.platform) {
    if (platform === 'win32')
        return 'win';
    if (platform === 'darwin')
        return 'mac';
    return 'linux';
}
export function classifyAsset(name) {
    const n = String(name ?? '').toLowerCase();
    if (/(windows|win32|win64|\bwin\b)/.test(n))
        return 'win';
    if (/(darwin|macos|\bmac\b|\bosx\b)/.test(n))
        return 'mac';
    if (/(linux|gnu)/.test(n))
        return 'linux';
    return 'any';
}
export function pickDownloads(assets, host) {
    const named = { win: undefined, mac: undefined, linux: undefined };
    for (const asset of Array.isArray(assets) ? assets : []) {
        const name = asset?.name;
        const url = asset?.browser_download_url || asset?.url;
        if (typeof name !== 'string' || typeof url !== 'string' || !url)
            continue;
        const kind = classifyAsset(name);
        if (kind === 'any' || named[kind])
            continue;
        named[kind] = { name, url, size: Number.isFinite(asset.size) ? asset.size : undefined };
    }
    return PLATFORMS.flatMap((platform) => {
        const hit = named[platform];
        if (!hit)
            return [];
        return [{
                platform,
                current: platform === host,
                name: hit.name,
                url: hit.url,
                size: hit.size,
            }];
    });
}
/**
 * The package dir a `link:` dependency points at, when it lives outside the
 * profiles root. The plugin panel's 「本地插件目录」 entry installs exactly that,
 * so About must mark the working tree instead of reporting its manifest version
 * as a release (it is the repo's official number by design).
 */
function linkedInstallPath(diskPath, diskVersion, { env, realpathFn } = {}) {
    if (!diskPath || !diskVersion)
        return undefined;
    const root = canonicalPath(join(dshHome(env), 'profiles'), { realpathFn });
    const actual = canonicalPath(dirname(diskPath), { realpathFn });
    const inside = relative(root, actual);
    if (inside && inside !== '..' && !inside.startsWith(`..${sep}`) && !isAbsolute(inside))
        return undefined;
    return actual;
}
export function localUpdateInfo(platform = process.platform, opts = {}) {
    const runningPath = modulePackageJsonPath();
    const running = installedVersion({ readFileFn: opts.readFileFn });
    const diskPath = profilePluginPackageJson(opts.profile, opts.env);
    const disk = readPackageVersion(diskPath, { readFileFn: opts.readFileFn });
    const resolvedPath = resolveProfilePluginManifest(opts.profile, opts.env, { resolveFn: opts.resolveFn });
    const resolved = resolvedPath ? readPackageVersion(resolvedPath, { readFileFn: opts.readFileFn }) : '';
    const copies = extraPluginManifests(opts.profile, opts.env)
        .map((path) => ({ path, version: readPackageVersion(path, { readFileFn: opts.readFileFn }) }))
        .filter((row) => row.version);
    const staleProcess = Boolean(disk && running && parseVersion(disk) && parseVersion(running) && compareVersions(disk, running) !== 0);
    const staleLoad = Boolean(staleProcess && canonicalPath(runningPath, opts) !== canonicalPath(diskPath, opts));
    const linkedPath = linkedInstallPath(diskPath, disk, opts);
    const linked = Boolean(linkedPath);
    // A linked working tree carries the repo's official number (the manifest must
    // stay a release version); show the derived `-dev[.n]` build instead so About
    // never reads the working tree as the published release. `npm run dev-build`
    // writes the counter next to the repo; without it the plain `-dev` stands.
    const devVersion = linked && running && !parseVersion(running)?.prerelease
        ? readDevVersion(linkedPath, running, { readFileFn: opts.readFileFn }) ?? `${running}-dev`
        : undefined;
    return {
        version: running,
        running,
        devVersion,
        linked,
        linkedPath,
        disk: disk || undefined,
        resolved: resolved || undefined,
        runningPath,
        diskPath,
        resolvedPath,
        copies,
        staleProcess,
        staleLoad,
        platform: hostPlatform(platform),
        repo: REPO_URL,
        repoSlug: REPO_SLUG,
    };
}
export function githubRequestHeaders(userAgent, env = process.env) {
    const headers = {
        accept: 'application/vnd.github+json',
        'user-agent': userAgent,
    };
    const token = String(env?.GITHUB_TOKEN || env?.GH_TOKEN || '').trim();
    if (token)
        headers.authorization = `Bearer ${token}`;
    return headers;
}
/** `/releases/tag/v0.0.84` or `/tags/dsh-v0.1.5-alpha.2` from a github.com URL. */
export function tagFromGithubReleaseUrl(url) {
    const match = String(url ?? '').match(/\/(?:releases\/tag|tags)\/([^/?#]+)/);
    if (!match)
        return undefined;
    try {
        return decodeURIComponent(match[1]);
    }
    catch {
        return match[1];
    }
}
function ghBins(env = process.env, existsSyncFn = existsSync) {
    const pinned = String(env?.GH_BIN || '').trim();
    if (pinned)
        return [pinned];
    const bins = [GH_BIN];
    for (const abs of ['/opt/homebrew/bin/gh', '/usr/local/bin/gh']) {
        if (existsSyncFn(abs) && !bins.includes(abs))
            bins.push(abs);
    }
    return bins;
}
function spawnGhJsonOnce(spawnFn, bin, args, env, timeoutMs) {
    return new Promise((resolve) => {
        let child;
        try {
            child = spawnFn(bin, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
        }
        catch (error) {
            resolve({ enoent: errorCode(error) === 'ENOENT' });
            return;
        }
        let stdout = '';
        let settled = false;
        const finish = (value) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
        };
        const timer = setTimeout(() => {
            try {
                child.kill('SIGTERM');
            }
            catch { /* already gone */ }
            finish({});
        }, timeoutMs);
        child.stdout?.on?.('data', (chunk) => { stdout += chunk; });
        child.stderr?.on?.('data', () => { });
        child.once('error', (error) => {
            finish({ enoent: error?.code === 'ENOENT' });
        });
        child.once('close', (code) => {
            if (code !== 0) {
                finish({});
                return;
            }
            try {
                finish({ json: JSON.parse(stdout) });
            }
            catch {
                finish({});
            }
        });
    });
}
async function runGhApiJson({ spawnFn = spawn, args, env = process.env, timeoutMs = GH_API_TIMEOUT_MS, existsSyncFn = existsSync, } = {}) {
    if (!Array.isArray(args) || args.length === 0)
        return undefined;
    for (const bin of ghBins(env, existsSyncFn)) {
        const result = await spawnGhJsonOnce(spawnFn, bin, args, env, timeoutMs);
        if (result?.json !== undefined)
            return result.json;
        if (!result?.enoent)
            return undefined;
    }
    return undefined;
}
async function fetchGithubLatestHtml(fetchFn, htmlUrl, { userAgent, signal } = {}) {
    const response = await fetchFn(htmlUrl, {
        headers: {
            accept: 'text/html',
            'user-agent': userAgent || 'dsh-plugin-oauth-subs',
        },
        redirect: 'manual',
        signal,
    });
    const location = typeof response.headers?.get === 'function' ? response.headers.get('location') : undefined;
    const tag = tagFromGithubReleaseUrl(location) || tagFromGithubReleaseUrl(response.url);
    if (!tag)
        return undefined;
    const url = location && /^https?:/i.test(location)
        ? location
        : `${String(htmlUrl).replace(/\/releases\/latest$/, '')}/releases/tag/${tag}`;
    return { tag, url };
}
/** GitHub `published_at` as `YYYY-MM-DD HH:mm:ss` in Asia/Shanghai. */
export function formatPublishedAt(iso) {
    if (typeof iso !== 'string' || !iso.trim())
        return undefined;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return iso.trim();
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const pick = (type) => parts.find((part) => part.type === type)?.value || '';
    const hour = pick('hour') === '24' ? '00' : pick('hour');
    return `${pick('year')}-${pick('month')}-${pick('day')} ${hour}:${pick('minute')}:${pick('second')}`;
}
export async function fetchLatest({ fetchFn = outboundFetch, spawnFn = spawn, current, platform = process.platform, timeoutMs = 10_000, profile, env, readFileFn, existsSyncFn, } = {}) {
    const local = localUpdateInfo(platform, { profile, env, readFileFn });
    const installed = parseVersion(current ?? local.version)?.raw ?? local.version;
    const wait = new AbortController();
    const timer = setTimeout(() => wait.abort(), timeoutMs);
    const userAgent = `dsh-plugin-oauth-subs/${installed || 'dev'}`;
    try {
        let payload;
        let apiStatus;
        try {
            const response = await fetchFn(RELEASES_API, {
                headers: githubRequestHeaders(userAgent, env),
                signal: wait.signal,
            });
            if (response.ok)
                payload = await response.json();
            else
                apiStatus = response.status;
        }
        catch (error) {
            if (wait.signal.aborted)
                throw error;
            apiStatus = 0;
        }
        if (!payload) {
            try {
                const gh = await runGhApiJson({
                    spawnFn,
                    args: ['api', `repos/${REPO_SLUG}/releases/latest`],
                    env,
                    existsSyncFn,
                });
                if (gh && (gh.tag_name || gh.name))
                    payload = gh;
            }
            catch {
                // keep apiStatus
            }
        }
        if (!payload) {
            try {
                const html = await fetchGithubLatestHtml(fetchFn, RELEASES_LATEST_HTML, {
                    userAgent,
                    signal: wait.signal,
                });
                if (html)
                    payload = { tag_name: html.tag, html_url: html.url, assets: [] };
            }
            catch {
                // keep apiStatus
            }
        }
        if (!payload)
            throw new Error(apiStatus ? `GitHub releases ${apiStatus}` : 'GitHub releases unavailable');
        const tag = payload?.tag_name || payload?.name;
        const latest = parseVersion(tag);
        const cmp = latest ? compareVersions(latest.raw, installed) : 0;
        const status = !latest ? 'unknown' : cmp > 0 ? 'update' : cmp < 0 ? 'ahead' : 'current';
        const html = typeof payload?.html_url === 'string' ? payload.html_url : `${REPO_URL}/releases/latest`;
        return {
            ...local,
            version: installed,
            status,
            latest: {
                tag: typeof tag === 'string' ? tag : undefined,
                name: typeof payload?.name === 'string' ? payload.name : undefined,
                url: html,
                publishedAt: formatPublishedAt(payload?.published_at),
            },
            assets: pickDownloads(payload?.assets, local.platform),
        };
    }
    finally {
        clearTimeout(timer);
    }
}
/** `$DSH_HOME/profiles/<name>` from Cordis `ctx.baseUrl`, else web. */
export function profileFromBaseUrl(baseUrl) {
    if (typeof baseUrl !== 'string' || !baseUrl.startsWith('file:'))
        return DEFAULT_PROFILE;
    try {
        const path = fileURLToPath(baseUrl).replace(/\\/g, '/');
        const parts = path.split('/').filter(Boolean);
        const i = parts.lastIndexOf('profiles');
        if (i >= 0 && parts[i + 1])
            return parts[i + 1];
    }
    catch {
        // not a file URL we can parse
    }
    return DEFAULT_PROFILE;
}
/**
 * The Electron app owns `desktop` end to end — `dsh plugin --profile desktop`
 * is rejected outright, so updates there always mean "reinstall from the
 * Plugins page"; anything else gets the manual CLI command as a hint.
 */
export function isElectronManagedProfile(profile) {
    return profile === 'desktop';
}
export function pluginUpdateArgs(profile = DEFAULT_PROFILE) {
    return ['plugin', '--profile', String(profile || DEFAULT_PROFILE), 'update', PLUGIN_NAME];
}
export function pluginUpdateCommand(profile = DEFAULT_PROFILE) {
    return [DSH_BIN, ...pluginUpdateArgs(profile)].join(' ');
}
export function pluginAddArgs(profile = DEFAULT_PROFILE, source = REPO_URL) {
    return ['plugin', '--profile', String(profile || DEFAULT_PROFILE), 'add', String(source || REPO_URL)];
}
export function pluginRemoveArgs(profile = DEFAULT_PROFILE) {
    return ['plugin', '--profile', String(profile || DEFAULT_PROFILE), 'remove', PLUGIN_NAME];
}
/** GitHub tag → `dsh plugin add` source. `v0.0.71` and `0.0.71` both pin `#v0.0.71`. */
export function releaseInstallSource(tag) {
    const parsed = parseVersion(tag);
    if (!parsed)
        return REPO_URL;
    return `${REPO_URL}#v${parsed.raw}`;
}
export function workaroundCommand(profile = DEFAULT_PROFILE, source = REPO_URL) {
    return `${[DSH_BIN, ...pluginRemoveArgs(profile)].join(' ')} && ${[DSH_BIN, ...pluginAddArgs(profile, source)].join(' ')}`;
}
export function profilePluginPackageJson(profile = DEFAULT_PROFILE, env = process.env) {
    return join(dshHome(env), 'profiles', String(profile || DEFAULT_PROFILE), 'node_modules', PLUGIN_NAME, 'package.json');
}
export function extraPluginManifests(profile = DEFAULT_PROFILE, env = process.env) {
    const home = dshHome(env);
    const name = String(profile || DEFAULT_PROFILE);
    return [
        join(home, 'profiles', 'node_modules', PLUGIN_NAME, 'package.json'),
        join(home, 'profiles', name, '.dsh-module-fallback', 'node_modules', PLUGIN_NAME, 'package.json'),
    ];
}
export function resolveProfilePluginManifest(profile = DEFAULT_PROFILE, env = process.env, { resolveFn } = {}) {
    const manifest = join(dshHome(env), 'profiles', String(profile || DEFAULT_PROFILE), 'package.json');
    try {
        if (!resolveFn && !existsSync(manifest))
            return undefined;
        const resolve = resolveFn || createRequire(manifest).resolve;
        const found = resolve(`${PLUGIN_NAME}/package.json`);
        if (!found)
            return undefined;
        const profilesRoot = canonicalPath(join(dshHome(env), 'profiles'));
        const actual = canonicalPath(found);
        const path = relative(profilesRoot, actual);
        if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path))
            return undefined;
        if (dirname(actual).split(sep).at(-1) !== PLUGIN_NAME)
            return undefined;
        return found;
    }
    catch {
        return undefined;
    }
}
export function canonicalPath(path, { realpathFn } = {}) {
    if (!path)
        return '';
    try {
        return String((realpathFn || realpathSync)(path));
    }
    catch {
        return String(path);
    }
}
export function readPackageVersion(path, { readFileFn = readFileSync } = {}) {
    try {
        const raw = readFileFn(path, 'utf8');
        const text = typeof raw === 'string' ? raw : String(raw ?? '');
        const parsed = JSON.parse(text);
        return typeof parsed?.version === 'string' ? parsed.version : '';
    }
    catch {
        return '';
    }
}
/** `v0.0.104`/`0.0.104` → the GitHub source tarball URL for that tag. */
export function releaseTarballUrl(tag) {
    const parsed = parseVersion(tag);
    if (!parsed)
        return undefined;
    return `${REPO_URL}/archive/refs/tags/v${parsed.raw}.tar.gz`;
}
/**
 * Package dirs currently holding an install: the profile copy, the
 * cross-profile shared copy, the `.dsh-module-fallback` copy, and whatever
 * `require.resolve` picks from the profile manifest. Deduped by realpath —
 * entries that do not parse as package.json simply do not exist.
 */
export function installedPackageDirs(profile = DEFAULT_PROFILE, env = process.env, { readFileFn, realpathFn, resolveFn } = {}) {
    const manifests = [
        profilePluginPackageJson(profile, env),
        ...extraPluginManifests(profile, env),
        resolveProfilePluginManifest(profile, env, { resolveFn }),
    ].filter(Boolean);
    const dirs = new Map();
    const root = canonicalPath(join(dshHome(env), 'profiles'), { realpathFn });
    for (const manifest of manifests) {
        if (!readPackageVersion(manifest, { readFileFn }))
            continue;
        const dir = dirname(manifest);
        const actual = canonicalPath(dir, { realpathFn });
        const path = relative(root, actual);
        if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path))
            continue;
        if (actual.split(sep).at(-1) !== PLUGIN_NAME)
            continue;
        dirs.set(actual, dir);
    }
    return [...dirs.values()];
}
/** `tar -xf <archive> -C <dest>` — bsdtar on macOS/Windows reads tar.gz and zip alike. */
/** Compatibility API: never download or overwrite a pinned installation. */
export async function installRelease(_options = {}) {
    return manualUpdateResult();
}
function dshHome(env = process.env) {
    const home = env.DSH_HOME;
    if (typeof home === 'string' && home.trim())
        return home.trim();
    return join(homedir(), '.dsh');
}
