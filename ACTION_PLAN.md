# ACTION PLAN — OpsMate BSE Site B Recovery

## Current true milestone
RECOVERY SOURCE MERGED AND VERIFIED. PR #9 is merged to canonical `main`; PILOT_TEST Apps Script HEAD matches canonical source. Telegram E2E proof is TEST-only and remains non-production.

## Locked safety
`production_write:false`; `official_bse_write:false`; `BSE_TELEGRAM_AUTOMATION=OFF`; no Google Tasks; no official BSE write; no Telegram retry unless independently proven safe.

## Evidence snapshot
- Canonical `origin/main`: `5ce1dda` (PR #9, #10 and #11 merged). Dirty local main at `1723678` is preserved untouched.
- PR #9 merged 12 recovery commits from `recovery/pilot-source-reconcile`.
- Canonical source was pushed to PILOT_TEST Apps Script HEAD; no Apps Script version or deployment was created or updated.
- Live Apps Script full regression after cleanup: 25/25 PASS, `failed:0`, `production_write:false`.
- Independent pull/byte audit after the canonical push: 42/42 canonical files match.
- Telegram proof: BSE-TG-746192225 and BSE-TG-746192227 each produced exactly one TEST inventory event. The latest manual flow received once, sent ACK `26`, sent approval card `28`, processed the `Benar` callback, and reached `APPROVED_TEST / VERIFIED_TEST` with queue `REPORTER_CONFIRMED`; no production write.
- REC-018 cleanup: `TEST_ONLY_PILOT_E2E_SMOKE.gs` was deleted from the active PILOT_TEST Apps Script editor, independently read back as absent, and removed from the executor mirror. Canonical Git did not track this tombstone.

## Recovery tasks
- REC-001 through REC-009: DONE — source/runtime audit, Owner Registry extraction, tests, and reproducible Script HEAD audit.
- REC-010 through REC-015: DONE — Telegram reconciliation, controlled retry, confirmation/idempotency proof, and cleanup.
- REC-016: DONE — evidence captured; PR #9 merged to `main`.
- REC-017: DONE — canonical status record merged to `main` in PR #10; Script HEAD verified and 25/25 live regression evidence retained.
- REC-018: DONE — remote non-executable tombstone deleted from the active PILOT_TEST Apps Script project; executor mirror reconciled; 25/25 regression PASS after cleanup.
- REC-019: IN REVIEW — latest manual Telegram pilot LIVE PASS evidence recorded in this documentation-only PR; no runtime or production change.

## Current operational state
- `PILOT_TEST` only; automation OFF; manual receive/worker execution only.
- User `913757987` is registered as active TEST owner/admin.
- No Google Tasks, production writer, production deployment, or official BSE integration is enabled.

## Known limits
- Apps Script cloud logs remain unavailable through clasp because its project configuration lacks a GCP project ID; this is a diagnostic gap only.
- Automation remains intentionally OFF. Any automation enablement, Apps Script version/deployment update, or production promotion requires explicit owner authorization.
