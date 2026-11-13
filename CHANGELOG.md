# Changelog

## 0.0.112 — UI regression fix

- Restore the original pure VersionBand presentation component. The 0.0.111 automatic-update cleanup accidentally removed it while AboutPanel still referenced it; retained hidden panels caused the entire subscription page to fail rendering.
- Keep background updates and in-place installation disabled; this fix restores no updater behavior.
- Add complete shipped-client factory/slot/root rendering regressions across English/Chinese, all three views, retained hidden panels and cached release metadata. The new tests reproduce the VersionBand ReferenceError on 0.0.111 before the fix.
- This synchronous component-render harness does not replace a real browser/host smoke test, which is required before rollout.

## 0.0.111 — maintenance candidate

Not a claim of publication.

- Preserve the reviewed 1b432c9 Kiro enterprise profile persistence, IdC API-region mapping, CLI/KAS user agent and Copilot absolute-credit/remaining-display fixes.
- Identify the maintained artifact fork and preserve MIT attribution; document absent TypeScript source/tests.
- Point metadata/manual release checks to jianghaotj/dsh-plugin-oauth-subs. Disable background update checks and in-place self-installation, including legacy preferences and direct installation calls.
- Add dependency lockfile, offline/synthetic regression tests, syntax checks, package-content checks and reachable-history scanning.
- Keep live plugin installations and account stores outside the maintenance workflow.
