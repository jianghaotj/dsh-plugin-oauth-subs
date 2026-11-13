# Maintained JavaScript artifact fork

This repository preserves the MIT-licensed published JavaScript artifact of dsh-plugin-oauth-subs. The original TypeScript sources and original test suite were not included in the recovered mirror. Do not claim that this tree reproduces a TypeScript build.

## Rules
- Edit the maintained JavaScript under `lib/` directly, with regression tests under `test/`. Do not fabricate missing `src/` files or regenerate unrelated artifacts.
- Run `npm ci --ignore-scripts`, `npm test`, `npm run test:pack`, and `npm run audit:history` before release review. Tests must use synthetic data and mocked networking, never real OAuth login, stored credentials, or billable requests.
- Keep MIT copyright/attribution and document provenance in `MAINTENANCE.md`.
- Never copy a live profile, authentication files, account identifiers, logs, backups, or private keys into this tree.
- Keep automatic checks and in-place self-installation disabled. Explicit metadata checks may inspect this maintained repository; version changes must go through the host/package manager with an explicitly reviewed commit SHA or immutable release artifact.
- Do not modify installed plugin copies, restart production services, push, change repository visibility, or publish without separate authorization.
- Changes must be reviewed as a Git diff and installed from a committed version. The maintenance tests are not a substitute for a separately authorized host smoke test.

Original upstream contributor guidance remains available in Git history; its TypeScript/graft/build instructions do not apply to this artifact-only maintenance fork.
