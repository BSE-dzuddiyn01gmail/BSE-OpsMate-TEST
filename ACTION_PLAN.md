# ACTION PLAN — OpsMate BSE Site B Recovery

## Current true milestone
RECOVERY SOURCE MERGED AND VERIFIED. PR #9 is merged to canonical `main`; PILOT_TEST Apps Script HEAD matches canonical source. Telegram E2E proof is TEST-only and remains non-production.

## Locked safety
`production_write:false`; `official_bse_write:false`; `BSE_TELEGRAM_AUTOMATION=OFF`; no Google Tasks; no official BSE write; no Telegram retry unless independently proven safe.

## Evidence snapshot
- Canonical `origin/main`: `54133fd` (merge of PR #9). Dirty local main at `1723678` is preserved untouched.
- PR #9 merged 12 recovery commits from `recovery/pilot-source-reconcile`.
- Canonical source was pushed to PILOT_TEST Apps Script HEAD; no Apps Script version or deployment was created or updated.
- Live Apps Script full regression: 25/25 PASS, `failed:0`, `production_write:false`.
- Independent pull/byte audit after the canonical push: 42/42 canonical files match.
- Telegram proof: BSE-TG-746192225 has exactly one TEST_INVENTORY_EVENT, status `APPROVED_TEST / VERIFIED_TEST`; queue is `REPORTER_CONFIRMED`; no production write.
- Former TEST_ONLY smoke artefact is a non-executable tombstone; no TEST_ONLY function remains.

## Recovery tasks
- REC-001 through REC-009: DONE — source/runtime audit, Owner Registry extraction, tests, and reproducible Script HEAD audit.
- REC-010 through REC-015: DONE — Telegram reconciliation, controlled retry, confirmation/idempotency proof, and cleanup.
- REC-016: DONE — evidence captured; PR #9 merged to `main`.
- REC-017: IN REVIEW — this canonical status record records merged `main`, verified Script HEAD, and 25/25 live regression evidence.

## Current operational state
- `PILOT_TEST` only; automation OFF; manual receive/worker execution only.
- User `913757987` is registered as active TEST owner/admin.
- No Google Tasks, production writer, production deployment, or official BSE integration is enabled.

## Known limits
- Apps Script cloud logs remain unavailable through clasp because its project configuration lacks a GCP project ID; this is a diagnostic gap only.
- Removing the remote tombstone file requires an explicit Apps Script file deletion action; it is non-executable and does not affect runtime behavior.
