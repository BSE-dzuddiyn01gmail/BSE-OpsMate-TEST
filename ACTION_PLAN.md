# ACTION PLAN — OpsMate BSE Site B Recovery

## Current true milestone
PILOT_TEST technical implementation is current on canonical `main` at `4cfcc40`.
Daily Morning Digest and Friday Weekly Digest schedulers are installed and independently
verified in PILOT_TEST. General Telegram receive/worker polling remains OFF.
Scheduled autonomous-delivery proof is still pending; therefore pilot acceptance,
production readiness, and final handover remain NOT ACHIEVED.

## Locked safety
`production_write:false`; `official_bse_write:false`; `BSE_TELEGRAM_AUTOMATION=OFF`; no Google Tasks; no official BSE write; no Telegram retry unless independently proven safe.

## Evidence snapshot
- Canonical `origin/main`: `4cfcc40` (PR #42 merged). Dirty primary repo remains preserved untouched.
- PR #9 merged 12 recovery commits from `recovery/pilot-source-reconcile`.
- Canonical source was pushed to PILOT_TEST Apps Script HEAD; no Apps Script version or deployment was created or updated.
- Latest full PILOT_TEST regression: 38/38 PASS, failed:0, `production_write:false`.
- Independent pull/byte audit after the canonical push: 42/42 canonical files match.
- Telegram proof: BSE-TG-746192225 and BSE-TG-746192227 each produced exactly one TEST inventory event. The latest manual flow received once, sent ACK `26`, sent approval card `28`, processed the `Benar` callback, and reached `APPROVED_TEST / VERIFIED_TEST` with queue `REPORTER_CONFIRMED`; no production write.
- REC-018 cleanup: `TEST_ONLY_PILOT_E2E_SMOKE.gs` was deleted from the active PILOT_TEST Apps Script editor, independently read back as absent, and removed from the executor mirror. Canonical Git did not track this tombstone.
- REC-021 LIVE Betulkan proof (2026-10-08): BSE-TG-746192233 opened a correction session; BSE-TG-746192235 was received once as the replacement report (`Baja NPK`, `0.75 kg`), then reached `REPORTER_CONFIRMED`. Independent PILOT_TEST_INVENTORY_EVENT read-back confirmed one `APPROVED_TEST / VERIFIED_TEST` record with `production_write:FALSE` and preserved original-plus-correction provenance. Full regression after parser fix: 26/26 PASS.
- REC-022 LIVE Batal proof (2026-10-08): BSE-TG-746192237 (`Baja NPK`, `1.0 kg`) received once, produced one reporter card, and after the reporter selected Batal reached `DISCARDED_BY_REPORTER` in both queue and approval UI. Independent PILOT_TEST_INVENTORY_EVENT read-back confirmed no source key or TEST inventory record for BSE-TG-746192237; no domain or production write occurred.
- REC-023 stale-card closure (2026-10-08): the pre-fix incorrect candidate card BSE-TG-746192232 / Telegram message 37 was explicitly discarded by its original reporter. Queue and approval UI both read back `DISCARDED_BY_REPORTER`; PILOT_TEST_INVENTORY_EVENT contains no BSE-TG-746192232 source key.
- REC-024 final readiness audit (2026-10-08): canonical main and PILOT_TEST Apps Script executor matched. Runtime reported `PILOT_TEST`, workbook/evidence binding present, `BSE_TELEGRAM_AUTOMATION=OFF`, `production_write:false`, and `official_bse_write:false`. Callback diagnostic showed all eight persisted callbacks `PROCESSED` with no error; approval audit found no `OPEN` card. Full regression: 26/26 PASS.

## Recovery tasks
- REC-001 through REC-009: DONE — source/runtime audit, Owner Registry extraction, tests, and reproducible Script HEAD audit.
- REC-010 through REC-015: DONE — Telegram reconciliation, controlled retry, confirmation/idempotency proof, and cleanup.
- REC-016: DONE — evidence captured; PR #9 merged to `main`.
- REC-017: DONE — canonical status record merged to `main` in PR #10; Script HEAD verified and 25/25 live regression evidence retained.
- REC-018: DONE — remote non-executable tombstone deleted from the active PILOT_TEST Apps Script project; executor mirror reconciled; 25/25 regression PASS after cleanup.
- REC-019: DONE — latest manual Telegram pilot LIVE PASS evidence merged to canonical `main` in PR #12; no runtime or production change.
- REC-021: DONE — clean LIVE Betulkan flow repaired, source merged in PR #15, and BSE-TG-746192235 independently verified as the corrected `0.75 kg` TEST record; no production write.
- REC-022: DONE — clean LIVE Batal flow independently verified; BSE-TG-746192237 ended as `DISCARDED_BY_REPORTER` with no TEST domain record and no production write.
- REC-023: DONE — stale incorrect card 37 and its queue were explicitly discarded; independent read-back confirmed no TEST inventory record for BSE-TG-746192232.
- REC-024: DONE — final read-only pilot readiness audit passed: no approval card remains OPEN, all persisted callbacks are processed, runtime remains safely bound to PILOT_TEST, and full regression is 26/26 PASS.
- REC-025: DONE — PILOT_TEST stability cycle (2026-10-08) passed with independent Sheet read-back. Cycle 1 Benar: BSE-TG-746192241 produced exactly one `Baja NPK` `1.25 kg` inventory TEST record after reporter confirmation. Cycle 2 Betulkan: BSE-TG-746192243 (`0.40 kg`) entered correction state; replacement BSE-TG-746192245 (`0.60 kg`) produced exactly one confirmed TEST record with original-plus-correction provenance, while the root created no domain record. Cycle 3 Batal: BSE-TG-746192247 (`2.00 kg`) reached `DISCARDED_BY_REPORTER` with no inventory record. A controlled receive/worker retry with no new Telegram message created no queue, approval card, callback, or inventory duplicate. Final runtime audit retained `PILOT_TEST`, automation `OFF`, `production_write:false`, `official_bse_write:false`; full regression 26/26 PASS.

## Current operational state
- `PILOT_TEST` only. General Telegram receive/worker polling automation kekal OFF dan manual. Dedicated reporting schedulers dipisahkan daripada polling. Daily Morning Digest 08:01 MYT = ON/verified (trigger UID `2910103434482941952`). Friday Weekly Digest 07:59 MYT = ON/verified (trigger UID `4372146794230972416`). Scheduled autonomous-delivery proof masih PENDING.
- User `913757987` is registered as active TEST owner/admin.
- No Google Tasks, production writer, production deployment, or official BSE integration is enabled.

## Next real pilot gate
- Observe and independently verify the first scheduled Daily Morning Digest delivery at 08:01 MYT without any manual trigger.
- Then observe and independently verify the first scheduled Friday Weekly Digest delivery at 07:59 MYT.
- A scheduler installation/configuration PASS is not equivalent to autonomous delivery PASS.

## Known limits
- Apps Script cloud logs remain unavailable through clasp because its project configuration lacks a GCP project ID; this is a diagnostic gap only.
- General Telegram receive/worker automation remains intentionally OFF. Dedicated reporting schedulers are separately governed; production promotion, Apps Script version/deployment update, or official BSE write still requires explicit owner authorization.
