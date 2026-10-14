# ACTION PLAN — OpsMate BSE Site B Recovery

## Current true milestone
PILOT_TEST technical implementation is current on canonical `main` at `8c204ff`.
Daily Morning Digest achieved autonomous LIVE PASS on 2026-10-12; Friday Weekly Digest
remains installed/verified but its first autonomous scheduled proof is still pending.
Plant Replacement/Sulam is now Telegram E2E LIVE VERIFIED, including reporter confirmation,
TEST writer, independent Sheet read-back, exact-reference retrieval, and duplicate/idempotency proof.
Image Processing (`/image_to_text`, `/image_analysis`) is LIVE VERIFIED with TEST Drive evidence,
formatted Telegram review/saved summaries, Gemini transient fallback, and no canonical/domain auto-write.
`/ai` AI-01/AI-03 are MERGED and LIVE PASS. AI-02 archive manifests are bound/read back in Drive. AI-04 current SISMARP derived-cache retrieval and AI-06 source-detail rendering achieved LIVE TELEGRAM PASS on 2026-10-14 via TEST-only owner delivery using the same renderer/send path; AI-05 freshness/version manifest is runtime PASS, while scheduled GitHub Actions refresh remains SOURCE READY and awaits merge to default branch plus its first successful workflow run.
Final PILOT_TEST technical closeout audit is PASS. Production readiness and final handover remain NOT ACHIEVED because the Friday Weekly Digest still lacks its first autonomous scheduled LIVE proof and no PILOT_REAL/production promotion has been authorized.

## Locked safety
`production_write:false`; `official_bse_write:false`; `BSE_TELEGRAM_AUTOMATION=OFF`; no Google Tasks; no official BSE write; no Telegram retry unless independently proven safe.

## Evidence snapshot
- Canonical `origin/main`: `8c204ff` (PR #51 merged). Working tree was clean before this status update.
- PR #9 merged 12 recovery commits from `recovery/pilot-source-reconcile`.
- Canonical source was pushed to PILOT_TEST Apps Script HEAD; no Apps Script version or deployment was created or updated.
- Latest full PILOT_TEST regression after `/ai`, Image Processing formatting/fallback, and Sulam live proof: 44/44 PASS, failed:0, `production_write:false`.
- Independent pull/byte audit after the canonical push: 42/42 canonical files match.
- Telegram proof: BSE-TG-746192225 and BSE-TG-746192227 each produced exactly one TEST inventory event. The latest manual flow received once, sent ACK `26`, sent approval card `28`, processed the `Benar` callback, and reached `APPROVED_TEST / VERIFIED_TEST` with queue `REPORTER_CONFIRMED`; no production write.
- REC-018 cleanup: `TEST_ONLY_PILOT_E2E_SMOKE.gs` was deleted from the active PILOT_TEST Apps Script editor, independently read back as absent, and removed from the executor mirror. Canonical Git did not track this tombstone.
- REC-021 LIVE Betulkan proof (2026-10-08): BSE-TG-746192233 opened a correction session; BSE-TG-746192235 was received once as the replacement report (`Baja NPK`, `0.75 kg`), then reached `REPORTER_CONFIRMED`. Independent PILOT_TEST_INVENTORY_EVENT read-back confirmed one `APPROVED_TEST / VERIFIED_TEST` record with `production_write:FALSE` and preserved original-plus-correction provenance. Full regression after parser fix: 26/26 PASS.
- REC-022 LIVE Batal proof (2026-10-08): BSE-TG-746192237 (`Baja NPK`, `1.0 kg`) received once, produced one reporter card, and after the reporter selected Batal reached `DISCARDED_BY_REPORTER` in both queue and approval UI. Independent PILOT_TEST_INVENTORY_EVENT read-back confirmed no source key or TEST inventory record for BSE-TG-746192237; no domain or production write occurred.
- REC-023 stale-card closure (2026-10-08): the pre-fix incorrect candidate card BSE-TG-746192232 / Telegram message 37 was explicitly discarded by its original reporter. Queue and approval UI both read back `DISCARDED_BY_REPORTER`; PILOT_TEST_INVENTORY_EVENT contains no BSE-TG-746192232 source key.
- REC-024 final readiness audit (2026-10-08): canonical main and PILOT_TEST Apps Script executor matched. Runtime reported `PILOT_TEST`, workbook/evidence binding present, `BSE_TELEGRAM_AUTOMATION=OFF`, `production_write:false`, and `official_bse_write:false`. Callback diagnostic showed all eight persisted callbacks `PROCESSED` with no error; approval audit found no `OPEN` card. Full regression: 26/26 PASS.

- Daily Morning Digest autonomous LIVE PASS (2026-10-12): Telegram message ID `167` was sent automatically for period 2026-10-11; independent Sheet read-back showed digest audit `SENT`, report audit 8/8, and trigger UID advanced from `2910103434482941952` to `5040989954461663232`. General polling remained OFF and `production_write:false`.
- Plant Replacement/Sulam LIVE E2E proof (2026-10-14): `BSE-TG-746192324` parsed `20/10/2026 Sulam 1 pokok M3P3 / Tanaman: Peria`, matched ACTIVE batch `BSE-SB-CB-20260910-002` and allocation `...-PA-001`, reporter card was confirmed, callback `746192325` reached `PROCESSED`, and exactly one TEST event `BSE-SB-PR-f09986463084` was written as `VERIFIED_TEST` with `production_write:FALSE`. Independent `/retrieve BSE-TG-746192324` audit recorded `SENT | OWNER_ACTIVE`; duplicate replay left exactly one event.
- Image Processing LIVE proof (2026-10-14): `/image_to_text` and `/image_analysis` presentation upgraded to Telegram HTML; structured Gemini summary is labelled `Rumusan`, while `Pembetulan user` appears only for a real correction. Gemini image calls use `gemini-3.1-flash-lite` primary with `gemini-3.5-flash-lite` transient 429/5xx fallback. Confirmed TEST evidence read-back used one Drive file only; latest verified file ID `1D1nAsb3mFJ5pkD831F_xauRdLKYB21zB`, size 74,152 bytes. Image Processing harness 16/16 PASS.
- `/ai` LIVE proof (2026-10-14): isolated NON_CANONICAL Telegram Q&A merged in PR #50, with Gemini File Search agriculture KB (IRAC MoA v11.5 + DOA pesticide portal snapshot), formatted HTML replies, no canonical BSE read/write, and full regression 44/44 PASS.
- Final PILOT_TEST closeout audit (2026-10-14): runtime `PILOT_TEST`, spreadsheet/evidence bound, general automation `OFF`, `production_write:false`, `official_bse_write:false`; schema audit 53/53 `CURRENT`; source-key audit `CURRENT` with 179 entries / 0 issue after auditor was corrected to treat terminal `OCR_DISCARDED` history as non-active lifecycle state; read-only auditor harness 8/8 PASS; approval callbacks latest state all processed and no current approval card OPEN; full regression 44/44 PASS; temporary `clasp pull` comparison confirmed 52/52 executable files byte-identical with Apps Script HEAD.

## /ai milestone truth — 2026-10-14
- AI-01: LIVE PASS — `/ai <question>` -> Gemini -> Telegram, NON_CANONICAL, zero canonical/domain write.
- AI-02: PASS under reconciled contract — Gemini File Search has 2 active documents (IRAC v11.5 + DOA portal snapshot); `08_KB_REFERENCE/IRAC` and `DOA_SISMARP` contain audit/archive manifests with authority, source URL, version, File Search store/import state and freshness policy. Raw PDF/web binary is not claimed to be stored in Drive.
- AI-03: LIVE PASS — agriculture/IRAC questions use grounded File Search and expose source labels.
- AI-04: LIVE TELEGRAM PASS — current SISMARP retriever reads fresh HTTPS derived cache sourced from the public DOA SISMARP wildcard listing; zero-result queries fail safe, positive control `deltamethrin + peria` returned 6 current matches and the same rendered answer was accepted by Telegram as message ID 230. Authority remains SISMARP/DOA; cache is transport state only.
- AI-05: PARTIAL PASS — KB `refreshed_at`/version/freshness manifest and stale detection are live; SISMARP cache has `refreshed_at` + 14-day fail-closed freshness. Weekly GitHub Actions refresh source exists but autonomous scheduled run is NOT VERIFIED until after merge to default branch and one successful run.
- AI-06: LIVE TELEGRAM PASS — Telegram accepted the AI-04 live proof with HTML rendering from the production `/ai` renderer/send path, including `SISMARP CURRENT` freshness/padanan and source URL handling. Existing AI-03 proof already covers KB source labels; no canonical/domain write occurred.

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
- `PILOT_TEST` only. General Telegram receive/worker polling automation kekal OFF dan manual. Daily Morning Digest 08:01 MYT = AUTONOMOUS LIVE PASS; current trigger UID `5040989954461663232`. Friday Weekly Digest 07:59 MYT = installed/verified, autonomous proof PENDING until first Friday run.
- Plant Replacement/Sulam = LIVE VERIFIED end-to-end, including exact-reference retrieval and duplicate/idempotency proof.
- Image Processing `/image_to_text` + `/image_analysis` = LIVE VERIFIED; Drive evidence remains TEST-only and domain records are not auto-written.
- `/ai` = AI-01 LIVE PASS; AI-02 implemented as File Search semantic source + Drive audit/archive manifests (raw PDF/web binary is not claimed stored in Drive); AI-03 LIVE PASS; AI-04 LIVE TELEGRAM PASS using fresh fail-closed SISMARP derived cache (25,498 rows, 14-day freshness) with authority remaining SISMARP/DOA; AI-05 manifest/stale policy PASS and scheduled refresh SOURCE READY / autonomous proof PENDING; AI-06 LIVE TELEGRAM PASS.
- User `913757987` is registered as active TEST owner/admin.
- No Google Tasks, production writer, production deployment, or official BSE integration is enabled.

## Next real pilot gate
- Final PILOT_TEST technical closeout/readiness audit: PASS on 2026-10-14.
- Keep Friday Weekly Digest autonomous proof pending until its first scheduled Friday run at 07:59 MYT; do not mark autonomous weekly reporting verified before that real scheduled proof.
- After the Friday scheduled proof, prepare the final PILOT_TEST handover / PILOT_REAL readiness decision without enabling production write or general Telegram polling unless separately authorized.
- General Telegram receive/worker polling remains OFF unless separately authorized.

## Known limits
- Apps Script cloud logs remain unavailable through clasp because its project configuration lacks a GCP project ID; this is a diagnostic gap only.
- Drive-authorized callbacks may fail through `clasp run` Execution API even when the Apps Script owner runtime is authorized; live Drive callback proofs therefore use the Apps Script owner runtime and are independently read back from Sheet/Drive.
- Friday Weekly Digest has not yet achieved an autonomous scheduled LIVE PASS; installed/verified is not equivalent to scheduled proof.
- General Telegram receive/worker automation remains intentionally OFF. Dedicated reporting schedulers are separately governed; production promotion, Apps Script version/deployment update, or official BSE write still requires explicit owner authorization.
