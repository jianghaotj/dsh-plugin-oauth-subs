/** Explicit maintained-repository metadata checks. Self-installation is disabled. */
export declare function modulePackageJsonPath(): string;
export declare const REPO_SLUG = "jianghaotj/dsh-plugin-oauth-subs";
export declare const REPO_URL = "https://github.com/jianghaotj/dsh-plugin-oauth-subs";
export declare const RELEASES_API = "https://api.github.com/repos/jianghaotj/dsh-plugin-oauth-subs/releases/latest";
export declare const RELEASES_LATEST_HTML = "https://github.com/jianghaotj/dsh-plugin-oauth-subs/releases/latest";
export declare const PLATFORMS: readonly string[];
export declare const PLUGIN_NAME = "dsh-plugin-oauth-subs";
export declare const DEFAULT_PROFILE = "web";
export declare const DSH_BIN = "dsh";
export declare const GH_BIN = "gh";
export declare const GH_API_TIMEOUT_MS = 5000;
export declare function installedVersion({ readFileFn }?: any): any;
/** Newer of two semver-ish tags. Empty / unparseable values lose. */
export declare function fresherVersion(left: any, right: any): string;
export declare function parseVersion(tag: any): {
    major: number;
    minor: number;
    patch: number;
    prerelease: string;
    raw: string;
} | undefined;
export declare function compareVersions(left: any, right: any): number;
export declare function hostPlatform(platform?: NodeJS.Platform): "linux" | "win" | "mac";
export declare function classifyAsset(name: any): "linux" | "win" | "mac" | "any";
export declare function pickDownloads(assets: any, host: any): {
    platform: string;
    current: boolean;
    name: any;
    url: any;
    size: any;
}[];
export declare function localUpdateInfo(platform?: NodeJS.Platform, opts?: any): {
    version: any;
    running: any;
    devVersion: string | undefined;
    linked: boolean;
    linkedPath: string | undefined;
    disk: any;
    resolved: any;
    runningPath: string;
    diskPath: string;
    resolvedPath: any;
    copies: {
        path: string;
        version: any;
    }[];
    staleProcess: boolean;
    staleLoad: boolean;
    platform: string;
    repo: string;
    repoSlug: string;
};
export declare function githubRequestHeaders(userAgent: any, env?: NodeJS.ProcessEnv): any;
/** `/releases/tag/v0.0.84` or `/tags/dsh-v0.1.5-alpha.2` from a github.com URL. */
export declare function tagFromGithubReleaseUrl(url: any): string | undefined;
/** GitHub `published_at` as `YYYY-MM-DD HH:mm:ss` in Asia/Shanghai. */
export declare function formatPublishedAt(iso: any): string | undefined;
export declare function fetchLatest({ fetchFn, spawnFn, current, platform, timeoutMs, profile, env, readFileFn, existsSyncFn, }?: any): Promise<{
    version: any;
    status: string;
    latest: {
        tag: string | undefined;
        name: any;
        url: any;
        publishedAt: string | undefined;
    };
    assets: {
        platform: string;
        current: boolean;
        name: any;
        url: any;
        size: any;
    }[];
    running: any;
    devVersion: string | undefined;
    linked: boolean;
    linkedPath: string | undefined;
    disk: any;
    resolved: any;
    runningPath: string;
    diskPath: string;
    resolvedPath: any;
    copies: {
        path: string;
        version: any;
    }[];
    staleProcess: boolean;
    staleLoad: boolean;
    platform: string;
    repo: string;
    repoSlug: string;
}>;
/** `$DSH_HOME/profiles/<name>` from Cordis `ctx.baseUrl`, else web. */
export declare function profileFromBaseUrl(baseUrl: any): string;
/**
 * The Electron app owns `desktop` end to end — `dsh plugin --profile desktop`
 * is rejected outright, so updates there always mean "reinstall from the
 * Plugins page"; anything else gets the manual CLI command as a hint.
 */
export declare function isElectronManagedProfile(profile: any): boolean;
export declare function pluginUpdateArgs(profile?: string): string[];
export declare function pluginUpdateCommand(profile?: string): string;
export declare function pluginAddArgs(profile?: string, source?: string): string[];
export declare function pluginRemoveArgs(profile?: string): string[];
/** GitHub tag → `dsh plugin add` source. `v0.0.71` and `0.0.71` both pin `#v0.0.71`. */
export declare function releaseInstallSource(tag: any): string;
export declare function workaroundCommand(profile?: string, source?: string): string;
export declare function profilePluginPackageJson(profile?: string, env?: NodeJS.ProcessEnv): string;
export declare function extraPluginManifests(profile?: string, env?: NodeJS.ProcessEnv): string[];
export declare function resolveProfilePluginManifest(profile?: string, env?: NodeJS.ProcessEnv, { resolveFn }?: any): any;
export declare function canonicalPath(path: any, { realpathFn }?: any): string;
export declare function readPackageVersion(path: any, { readFileFn }?: any): any;
/** `v0.0.104`/`0.0.104` → the GitHub source tarball URL for that tag. */
export declare function releaseTarballUrl(tag: any): string | undefined;
/**
 * Package dirs currently holding an install: the profile copy, the
 * cross-profile shared copy, the `.dsh-module-fallback` copy, and whatever
 * `require.resolve` picks from the profile manifest. Deduped by realpath —
 * entries that do not parse as package.json simply do not exist.
 */
export declare function installedPackageDirs(profile?: string, env?: NodeJS.ProcessEnv, { readFileFn, realpathFn, resolveFn }?: any): any[];
export interface ManualUpdateResult {
    status: "manual";
    reason: "pinned-install";
    url: string;
    command: string;
}
export declare function manualUpdateResult(): ManualUpdateResult;
/** Compatibility API; performs no network requests or installation writes. */
export declare function installRelease(options?: any): Promise<ManualUpdateResult>;
