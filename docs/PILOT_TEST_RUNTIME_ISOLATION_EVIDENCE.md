# PILOT_TEST Runtime Binding and Isolation Evidence

Date: 2026-10-06

## Scope

This checkpoint implements and verifies the environment-safe runtime boundary required before controlled `PILOT_TEST` replay. It does **not** start controlled replay, enable Telegram automation, authorize `PILOT_OPERATION`, or enable any production/official BSE write.

Locked boundaries remain:

- `production_write:false`
- `official_bse_write:false`
- automation OFF
- no Google Tasks reactivation
- no cross-environment Sheet/Drive write

## Source baselines

- TEST canonical baseline before this change: `d4bdac6`
- stable PILOT scope/setup authority at execution time: `a097efa`
- isolated PILOT_TEST workbook: `Kerani_AI_BSE_SB_PILOT_TEST`
- isolated source-evidence folder: configured PILOT_TEST `Evidence_Files`

The original user TEST worktree was not modified. Implementation work used a separate worktree.

## Runtime adapter

`EnvironmentTest.js` centralizes the runtime environment contract.

Key controls:

1. `TEST` remains the default compatibility environment.
2. `PILOT_TEST` resolves only to the locked PILOT_TEST workbook binding.
3. `bseRuntimeAssertWorkbookId_()` rejects a workbook ID from another environment before a writer may proceed.
4. `boundTestBook_()` validates the active workbook and exposes a guarded wrapper.
5. Existing TEST sheet names are deterministically mapped in PILOT_TEST:
   - `TEST_*` -> `PILOT_TEST_*`
   - `TELEGRAM_TEST_QUEUE` -> `PILOT_TEST_TELEGRAM_QUEUE`
   - TEST result sheets -> PILOT_TEST result sheets.
6. PILOT_TEST evidence storage is bound to the dedicated evidence folder. Auto-creation of a fallback evidence folder is forbidden in PILOT_TEST.
7. Telegram runtime properties are environment-specific. PILOT_TEST does not silently reuse the TEST group/chat property names.
8. PILOT_TEST outgoing Telegram text/captions are visibly prefixed `[PILOT TEST]`.
9. Automatic Telegram trigger installation is explicitly blocked while PILOT_TEST remains in controlled setup/replay mode.
10. Google Tasks advanced-service dependency is removed from the Apps Script manifest in line with D-027.

## Static verification

All changed JavaScript files passed `node --check`.

`git diff --check` passed.

A changed-file secret-pattern scan found no obvious committed credential/token/password/private-key value. `.clasp.json` remains local-only and is not staged.

## TEST runtime regression

The environment adapter was pushed to Apps Script TEST HEAD and invoked through a temporary TEST_ONLY custom-function wrapper.

Independent Sheet read-back returned:

```json
{
  "environment": "TEST",
  "total": 23,
  "passed": 23,
  "failed": 0,
  "production_write": false,
  "official_bse_write": false
}
```

TEST binding verification independently returned:

- environment = `TEST`
- active workbook matched the canonical TEST workbook
- `TEST_TREATMENT_EVENT` remained `TEST_TREATMENT_EVENT`
- `TELEGRAM_TEST_QUEUE` remained `TELEGRAM_TEST_QUEUE`
- the PILOT_TEST workbook ID was rejected by the environment guard
- `production_write:false`
- `official_bse_write:false`

The temporary TEST_ONLY formula sheet and wrapper were removed. A fresh `clasp pull` then matched the intended clean source with no temporary wrapper.

## PILOT_TEST runtime regression

The same source was bound to the separate PILOT_TEST Apps Script project/workbook.

Clean bound-runtime custom-function verification returned:

```json
{
  "status": "PASS",
  "environment": "PILOT_TEST",
  "workbook_match": true,
  "domain_sheet": "PILOT_TEST_TREATMENT_EVENT",
  "queue_sheet": "PILOT_TEST_TELEGRAM_QUEUE",
  "evidence_folder_match": true,
  "cross_environment_rejected": true,
  "production_write": false,
  "official_bse_write": false
}
```

Full I-011 regression in the bound PILOT_TEST runtime returned:

```json
{
  "status": "PASS",
  "environment": "PILOT_TEST",
  "total": 23,
  "passed": 23,
  "failed": 0,
  "production_write": false,
  "official_bse_write": false
}
```

## Write -> read-back -> reject proof

A temporary TEST_ONLY simple `onOpen` proof was pushed only long enough to exercise an actual Apps Script write from the bound PILOT_TEST runtime.

Observed sequence:

1. The PILOT_TEST workbook was opened under the bound Apps Script runtime.
2. The runtime validated the active workbook ID.
3. A fake TEST-workbook writer path was presented to the guard.
4. The guard rejected the TEST workbook ID **before** the fake writer could execute.
5. Apps Script created/wrote only the mapped `PILOT_TEST_ENVIRONMENT_ISOLATION_PROBE` sheet.
6. Independent Google Sheets read-back confirmed:
   - environment `PILOT_TEST`
   - workbook = PILOT_TEST workbook
   - mapped target = `PILOT_TEST_ENVIRONMENT_ISOLATION_PROBE`
   - `cross_environment_rejected = TRUE`
   - `fake_test_write_invoked = FALSE`
   - `production_write = FALSE`
7. Independent inspection of the canonical TEST workbook found no isolation-probe or fake-write sheet.
8. The proof row was preserved in `PILOT_TEST_RUNTIME_AUDIT`.
9. The temporary probe sheet and formula sheets were deleted.
10. The temporary `onOpen` proof code was removed and the clean PILOT_TEST Apps Script HEAD was pushed back.
11. A fresh pull verified that no temporary trigger/proof code remained.

## Current state after proof

- TEST Apps Script HEAD: environment adapter present and clean
- PILOT_TEST Apps Script HEAD: environment adapter present and clean
- TEST regression: **23/23 PASS**
- PILOT_TEST regression: **23/23 PASS**
- PILOT_TEST write isolation: **PASS**
- independent read-back: **PASS**
- cross-environment rejection: **PASS**
- temporary proof artifacts: **REMOVED**
- automation: **OFF**
- Telegram PILOT_TEST bot/group binding: **PENDING**
- controlled replay: **NOT STARTED**
- PILOT_OPERATION: **NOT AUTHORIZED**

This checkpoint is therefore **runtime isolation PASS**, not `PILOT_TEST PASS` and not production acceptance.
