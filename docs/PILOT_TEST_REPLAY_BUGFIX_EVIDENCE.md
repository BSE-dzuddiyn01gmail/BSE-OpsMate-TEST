# PILOT_TEST Controlled Replay Bugfix Evidence

Date: 2026-10-06

## Scope

This checkpoint fixes the two mismatches found by controlled replay run
`PTR-20261006-001` without enabling Telegram smoke testing, automation,
production writes, or official BSE writes.

Affected replay cases:

1. `RP-INV-001` — Inventory OUT
2. `RP-TG-TREAT-001` — D-043 Rawatan

Locked boundaries remain:

- `production_write:false`
- `official_bse_write:false`
- automation OFF
- no Telegram PILOT_TEST smoke test in this checkpoint
- no PILOT_OPERATION

## Bug 1 — Inventory OUT item parsing

Replay input:

`02/01/2026 Baja Out 3 Set Baja AB`

Observed before fix:

- record type: `INVENTORY_OUT`
- quantity: `3`
- unit: `set`
- event date: `2026-01-02`
- incorrect `item_name`: `02/01/2026 Baja Out`

Root cause:

`bseInventoryItemText_()` selected the whole inventory line and stripped the
quantity suffix. Because the date preceded `Baja Out`, the existing
leading-action cleanup did not remove the date/movement prefix.

Fix:

When an explicit inventory movement phrase is followed by quantity + unit +
trailing text, the trailing text is treated as the item candidate. Existing
canonical item mapping still applies afterwards.

Regression assertion:

- `item_name = Baja AB`
- `quantity = 3`
- `unit = set`
- `event_date = 2026-01-02`
- `record_type = INVENTORY_OUT`

## Bug 2 — D-043 labelled Rawatan description

Replay input:

```text
RAWATAN DIBUAT
Jenis Tanaman: Timun
M2P1
Rawatan: Semburan racun kulat
```

Observed before fix:

- `event_status = COMPLETED`
- date fallback correct
- plot correct
- `treatment_description` empty
- result fell to `NEED_INFO`

Root cause:

The deterministic treatment-list parser only built
`treatment_description` from dosage-list lines such as
`Acerio - 30`. It did not accept the explicit
`Rawatan: <description>` field used by the real historical Telegram source.

Fix:

`bseTreatmentListParseMessage_()` now prefers an explicit
`Rawatan: <description>` line when present, while preserving the existing
dose-list representation as fallback. D-043 semantics remain unchanged:
the event is `COMPLETED`, no unit is invented, and sent-date fallback is used
when no explicit treatment date exists.

Regression assertion:

- validation `PASS`
- `event_status = COMPLETED`
- `treatment_description = Semburan racun kulat`
- `event_date = 2026-09-22`
- `plot_ids = [M2P1]`

## Local targeted verification

Local deterministic harnesses passed:

- D-038 Inventory acceptance: **7/7 assertions PASS**
- D-043 Treatment acceptance: **7/7 assertions PASS**
- changed JavaScript `node --check`: PASS
- `git diff --check`: PASS

## Apps Script TEST runtime proof

The fix was pushed to the isolated TEST Apps Script HEAD together with a
temporary TEST_ONLY verification wrapper.

Independent Sheet read-back returned:

```json
{
  "inventory_harness": {"passed": 7, "failed": 0},
  "treatment_harness": {"total": 7, "passed": 7},
  "inventory_replay": {
    "validation": "PASS",
    "record_type": "INVENTORY_OUT",
    "item_name": "Baja AB",
    "quantity": 3,
    "unit": "set",
    "event_date": "2026-01-02"
  },
  "treatment_replay": {
    "validation": "PASS",
    "event_status": "COMPLETED",
    "treatment_description": "Semburan racun kulat",
    "event_date": "2026-09-22",
    "plot_ids": ["M2P1"]
  },
  "full_regression": {"total": 23, "passed": 23, "failed": 0},
  "production_write": false,
  "official_bse_write": false
}
```

The temporary TEST_ONLY formula sheet and wrapper were removed. A fresh
`clasp pull` then verified:

- temporary wrapper absent;
- Apps Script TEST HEAD source diff count = 0 against the intended fix source.

## Next gate

Merge the TEST fix, update the PILOT_TEST Apps Script runtime from merged TEST
main, then rerun the controlled replay corpus and reconcile the two previously
failing cases. This document does not claim the rerun has passed yet.
