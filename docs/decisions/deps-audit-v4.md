# Dependency audit decision (v4)

Date: 2026-01-23
Branch: `sec/secrets-and-deps-audit-v4`

## Goal

Resolve `npm audit` findings where reasonably possible (especially high severity),
keep changes compatible with the repo tooling, and leave receipts under
`.reports/<RUN_ID>/sec/`.

## Inputs (receipts)

- `.reports/<RUN_ID>/sec/npm.audit.txt`
- `.reports/<RUN_ID>/sec/npm.audit.json`

## Findings (before)

`npm audit` reported vulnerabilities in transitive dependencies, primarily pulled in via dev tooling:

- `cookie` (via `lighthouse` → `@sentry/node`)
- `tar-fs` and `ws` (via `puppeteer`)
- `lodash`

The advisory output recommended `npm audit fix --force`, which implied major version bumps.

## Decision

We upgraded the devDependencies that were the root of the vulnerable dependency chains:

- `lighthouse` → `13.0.1`
- `puppeteer` → `24.36.0`

Rationale:

- These packages are used for local/CI auditing and automation, and are not shipped to the browser.
- Upgrading removes all reported vulnerabilities (see receipts).
- The environment meets the engine requirement noted upstream for Lighthouse v13
  (Node 22+). In this repo workspace, Node is already >= 22.

## Outcome (after)

- `npm audit` reports `found 0 vulnerabilities` (see updated receipts).

## Follow-ups

- If CI pins an older Node version, align CI Node to 22+ (LTS) or revise the Lighthouse tooling choice.
