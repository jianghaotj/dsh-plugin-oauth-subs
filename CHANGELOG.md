# Changelog

## 0.0.114 — Codex rejects `none`

- The ChatGPT Codex family no longer advertises an `off` reasoning rung. `chatgpt.com/backend-api/codex` answers 400 `unsupported_value` for `reasoning.effort: "none"`, so leaving the effort unset produced a hard failure on every GPT-6 Astra / Sol / Luna request.
- `normalizeCodexResponsesBody` now drops an explicit `none`/`null`/empty effort (and an empty reasoning object) instead of forwarding it, so any host that still sends off degrades to the model default.
- Add regressions for the effort ladder and the body guard.

## 0.0.113 — Kiro IdC region selection

- Kiro IdC login now accepts an AWS region from the UI and the login payload. The host is `https://oidc.<region>.amazonaws.com`, so an IAM Identity Center instance outside the historical `us-west-2` default can sign in.
- Invalid region strings are rejected before any network call instead of silently falling back to the default; blank input keeps `us-west-2` for existing callers.
- IdC sessions no longer store the sign-in region as the usage host. Kiro's data plane stays on `us-east-1`, with European regions mapped to `eu-central-1`, matching `KIRO_USAGE_REGIONS`.
- Add synthetic regressions for region normalisation, the registration endpoint and the stored session regions. No live OAuth or billable request is exercised.
- Upstream timers are configurable (`upstreamFirstByteMs` / `upstreamBudgetMs` / `upstreamIdleMs`) and default to 240s / 290s / 290s instead of 120s / 270s / 270s. A 130k-token Copilot turn that needed 120s+ to its first token no longer burns the whole budget on three doomed attempts. Values are clamped to the host's 295s watchdog ceiling and rejected when invalid.
- Add synthetic regressions for timer defaults, overrides, clamping and fail-closed validation.

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
