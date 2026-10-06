# PILOT_TEST Dependency Review + Comparator Binding Evidence

Date: 2026-10-06

## Scope

This checkpoint closes the next controlled-replay gate after
`PTR-20261006-002`:

1. complete the previously `DEPENDENCY_REQUIRED` Crop / Transplant / Census
   review paths inside isolated `PILOT_TEST`; and
2. resolve every previously `OPEN_CONTROLLED` comparator into either an
   explicitly bound source or an explicit `LEGACY_MISSING` state.

It does **not** start Telegram manual smoke testing, enable automation, authorize
`PILOT_OPERATION`, or change the locked safety boundaries.

- `production_write:false`
- `official_bse_write:false`
- automation OFF
- no official BSE-system write
- no invented legacy comparator

## 1. Dependency-required review paths

Runtime evidence is recorded under `PTR-20261006-003`.

### Crop / Transplant prerequisite chain

The source-derived Crop Batch case for M1P1 remains `WAITING_INFO` because the
legacy source does not contain the variety required by the current Crop Batch
contract. The system did not invent a variety.

For dependency-path verification only, a clearly marked TEST_ONLY prerequisite
was used inside isolated PILOT_TEST so the Transplant review core could be
executed against a valid `PLANNED` allocation.

Observed result:

- source-derived M1P1 Transplant path: PASS with TEST_ONLY prerequisite;
- allocation lineage: `PLANNED -> ACTIVE`;
- original Crop source case remains `WAITING_INFO`; it was not rewritten as a
  complete real record.

### Historical M2P2 Transplant

The exact historical source message for M2P2 completed the Transplant review
path against an isolated approved Crop prerequisite.

Observed result:

- parser/source boundary PASS;
- matching PLANNED allocation found;
- review core PASS;
- status transition recorded as `PLANNED -> ACTIVE`;
- no baseline allocation mutation;
- no production/official BSE write.

### Historical M2P1 + M2P2 Banci Pokok

After both isolated allocations were ACTIVE, the exact historical Banci source
completed the Census review path.

Observed counts were preserved exactly:

- M2P1: 92 pokok
- M2P2: 88 pokok

The review core completed with ACTIVE-allocation linkage and no production or
official BSE write.

### Partial-write reconciliation and cleanup

The first bounded trigger attempt produced a partial TEST_ONLY dependency proof
write because execution stopped at the trigger runtime boundary.

The operator did not retry blindly.

Actual PILOT_TEST state was read back, the already-applied step was reconciled,
and remaining actions were resumed idempotently one step at a time.

After evidence capture:

- TEST_ONLY dependency domain sheets were deleted;
- TEST_ONLY queue/proof sheets were deleted;
- temporary Apps Script stepper/onOpen code was removed;
- fresh PILOT_TEST `clasp pull` matched canonical TEST source with diff count 0;
- the PILOT_TEST workbook returned to control/evidence surfaces only.

Runtime audit records both `DEPENDENCY_REVIEW_PATH_PROOF = PASS` and
`DEPENDENCY_PROOF_CLEANUP = PASS`.

## 2. Comparator binding closure

D-050 explicitly forbids inventing a legacy comparator. Previously open
comparators were therefore resolved into one of:

- `BOUND`
- `BOUND_WITH_GAP`
- `BOUND_SOURCE_RECORD`
- `LEGACY_MISSING`

### Asset

Existing bound registry comparator:

- `BIND-ASSET-001`
- source: `BSE Inventory Master 2026 / TOOL-MASTER`
- supports explicit registered/existing equipment state only.

New supplemental binding:

- `BIND-ASSET-002`
- source: `Laporan Pertanian Mingguan W2 Jan2026 / Modul 1 row 5`
- source wording records use of a **new grass cutter** on 12/01/2026 and a
  carburetor/warranty problem.

This supports asset **existence / newly-in-use by the report date** only.

It does not establish:

- proposal chronology;
- exact purchase date;
- vendor;
- price;
- registration chronology.

No explicit pre-acquisition proposal record was located. That gap is recorded
as `BIND-ASSET-GAP-001 = LEGACY_MISSING`. PROPOSAL / ACQUISITION / REGISTERED
remain separate; later evidence is not back-filled into a proposal.

### Maintenance

Already bound and independently verified:

- `BIND-MAINT-001` — `BSE Inventory Master 2026 / TOOL-DAMAGE`;
- `BIND-MAINT-002` — weekly operational narrative.

The weekly source includes explicit states such as:

- pump supply testing completed with flow rate 16 L/s;
- pump electrical short/burned and contractor controller/test action.

Completion is only recognized when explicit wording supports it.

### Measurement / Observation

Already bound:

- `BIND-MEASOBS-001`
- source: `Laporan Pertanian Mingguan W4 Jun 2026 / Modul 1`.

Explicit examples independently read back include:

- flow rate = 16 L/s;
- pH kolam baru = 6.55;
- pH kolam rezab = 6.58;
- accompanying operational observations are preserved as narrative, not turned
  into invented measurements.

### Plant Condition

Existing qualitative comparator:

- `BIND-PCOND-001`
- source: `Laporan Pertanian Mingguan W4 Dec2025 / Modul 1`
- explicit wording: `Serai kebanyakan (+-90%) telah mati.`

This is useful qualitative condition evidence but is **not** an exact D-045
dead-count comparator.

No connected manual source with exact dead/sick counts was located. The exact
numeric comparator gap is therefore recorded as:

- `BIND-PCOND-002 = LEGACY_MISSING`.

The system must not convert `+-90%` into an exact `dead_count`, and historical
TEST output is not promoted into legacy authority.

### File Evidence

A source-record comparator is now bound:

- `BIND-EVIDENCE-001`
- source: `Kerani_AI_BSE_SB_TEST / TEST_FILE_EVIDENCE`.

Confirmed source rows were independently read back and preserve:

- source message ID;
- caption;
- attachment type;
- Telegram file identity;
- MIME type;
- filename;
- file size;
- category;
- visibility;
- confirmed state;
- Drive file ID.

Confirmed examples include `BSE-EV-501-AQADahFr` and
`BSE-EV-512-AQADahFr`.

This is a source comparator for replay lineage, not an official BSE record.

### Leave / attendance

No exact employee leave/attendance comparator was located in the connected BSE
Drive sources searched.

Searches covered leave/cuti/offday/attendance terms and employee references.
Two tempting substitutes were explicitly rejected:

- a weekly note about a produce buyer taking CNY leave;
- inventory rows naming a staff member as stock personnel.

Neither is an employee leave/attendance authority.

The gap is therefore recorded as:

- `BIND-LEAVE-001 = LEGACY_MISSING`.

A future Leave replay may validate parser/review safety from a source message,
but reconciliation must remain `LEGACY_MISSING` unless the owner supplies an
actual leave/attendance record.

## 3. Operational source-binding state

The PILOT_TEST workbook now records that every previously OPEN_CONTROLLED
comparator is either:

- bound to a real source with stated limits; or
- explicitly classified `LEGACY_MISSING`.

No comparator remains silently unresolved and no missing source was invented.

Runtime audit:

- `PTR-20261006-003 DEPENDENCY_REVIEW_PATH_PROOF = PASS`;
- `DEPENDENCY_PROOF_CLEANUP = PASS`;
- `COMPARATOR_BINDING_CLOSURE = PASS_WITH_GAPS_CLASSIFIED`.

## 4. Current gate result

This gate is **PASS WITH EXPLICIT LEGACY GAPS**.

Completed:

- Crop/Transplant/Census dependency review paths;
- dependency proof cleanup;
- comparator binding/classification closure;
- independent source read-back;
- no-invention enforcement.

Still not completed:

- Telegram PILOT_TEST bot/group binding;
- Telegram end-to-end smoke testing;
- final cross-flow PILOT_TEST acceptance/reconciliation;
- readiness/handover pack update;
- PILOT_OPERATION.

This checkpoint does not claim `PILOT_TEST PASS` yet.
