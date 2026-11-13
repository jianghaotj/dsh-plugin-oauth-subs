# Maintenance and release policy

## Provenance and scope

This is a maintained JavaScript artifact fork, not the original complete TypeScript project. The MIT license and original author/contributor attribution are retained unchanged. The artifact was recovered by the lingdong0128-sys mirror from dsh-plugin-oauth-subs 0.0.110.

- Artifact baseline: `7c6d13b4f1b7801c36e6ce8d154ce7b90ae923b4`.
- Reviewed local fixes: `1b432c9ad639083f40c31ab6db620b4c51d6e80a` (5 files, Kiro enterprise/IdC, client UA and Copilot credit display).
- Proposed maintenance version: **0.0.111**. A version in this manifest does not imply a published GitHub release or an npm package.
- The original `src/`, TypeScript configs and original test suite are absent. No claim of reproducible TypeScript compilation is made; maintenance changes apply directly to `lib/` and add focused regression tests. Legacy analysis/dev scripts remain in Git history/tree but are not part of the distributed package or the release build contract.

## Pinned installation and update behavior

Use the host plugin manager to install a reviewed **full commit SHA** from this repository. Keep the package-manager lockfile. Record the installed SHA, version, package hash and previous known-good SHA; a version string alone cannot identify local modifications.

The plugin may check release metadata from `jianghaotj/dsh-plugin-oauth-subs` only when explicitly requested. Background update timers and in-place self-installation are disabled. Legacy saved `autoUpdate: true` cannot re-enable them, and the old install RPC returns manual instructions without fetching or writing. This prevents a release tarball from silently replacing a fixed SHA. Update through the host/package manager after reviewing the target commit, and restart only with user approval.

For rollback, explicitly reinstall the recorded previous SHA/artifact through the host manager and restart. Keep credential data in the host's private data directory; never copy it into this repository or a release archive. Do not assume a plugin directory overwrite is equivalent to a lockfile-consistent update.

## Checks (Node 22.14+ / npm)

```sh
npm ci --ignore-scripts
npm test
npm run test:pack
npm run audit:history
```

- Syntax checks parse maintained JavaScript without executing it.
- Regression tests use synthetic sessions, temporary directories, a mock outbound dispatcher and injected responses. No real OAuth login, stored account reads or paid model requests are permitted.
- Package checks run `npm pack --ignore-scripts` into a fresh temporary directory, inspect its allowlist, metadata, license, and every unpacked file for suspicious paths/secrets. They do not publish or install the artifact.
- History checks enumerate every reachable commit, scan all unique Git blobs plus commit/tag messages, and scan tracked/unignored working-tree files. Reports show only paths, object ids, line numbers and rule ids, never matching values. Scope is the repository and generated package, not user profiles or external stores. Pattern-based detection is not a proof of absence; manual review is still required for unknown token formats, encrypted/encoded data, images and third-party client constants.

## Release gate

1. Review final diff, MIT attribution, source provenance and all scanner findings. Keep a release record of test output and package SHA-256.
2. Confirm the package contains no auth/session/user data, secrets, private keys, backup files, logs or machine-specific configuration. Do not copy a live installation/profile wholesale.
3. Test installation/startup in an isolated host with no real login first. Production smoke/restarts require explicit approval; automated tests do not prove live provider compatibility.
4. Commit the reviewed tree. Pin consumers to that commit. Tags/releases and repository visibility changes are separate maintainer actions; this work does not authorize an npm publication.
5. Before public release, check provider terms and branding. OAuth client identifiers and vendor constants inherited from upstream are not user credentials, but neither their presence nor an MIT license grants permission to use a third-party service.

## Known limitations

- Kiro CLI/KAS UA versions are inherited fixed compatibility values and can become stale. Login/auth region and API-region behavior needs separately authorized enterprise/regional validation.
- Profile persistence is covered with synthetic sessions, not live enterprise accounts.
- UI regression coverage includes remaining-amount rendering logic; no real DSH browser/restart smoke has been performed by these tests.
- Full upstream test coverage and TypeScript type checking cannot be recovered from the artifact alone.
- Inherited payment QR assets and the payment tab are removed from this maintenance release to avoid misattributing the original payee to this maintainer. The compatibility donation RPC returns an empty object. Original upstream files remain in historical commits for provenance; MIT attribution is retained.
