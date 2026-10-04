# OpsMate BSE — Architecture Findings

Purpose: temporary engineering findings discovered during TEST/debug work.

This file is **not** the decision authority and does not replace:
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT_STATUS.md`
- the authoritative ZASS file in the stable/handover repository

Authoritative ZASS:
`BSE-dzuddiyn01gmail/BSE-OpsMate-AI-PPM-Site-B/ZASS_OpsMate_BSE.md`

## Rules

- Normal implementation bugs may be fixed without adding an entry here when they do not alter a LOCKED decision or architecture rule.
- If debugging reveals a possible architecture/rule change, record it here first.
- Do not silently modify architecture because of a finding.
- If a proposed fix conflicts with a LOCKED ZASS decision, stop that implementation path and report the conflict.
- Relevant findings are reviewed through ZASS after the current Inventory/Claim checkpoint reaches TEST PASS and is committed.

## Entry format

### AF-xxx — [short title]

**Status:** OPEN
**Source:** [debug/test area]  
**Date:** YYYY-MM-DD

**Observed:**
-

**Evidence:**
-

**Affected area:**
-

**Potential consequence:**
-

**Possible options:**
-

**ZASS impact:** `NONE` / `REVIEW REQUIRED`

---

### AF-001 — Google Tasks disabled in local Platform P1 conflicts with locked D-006

**Status:** OPEN
**Source:** Current local working tree audit
**Date:** 2026-10-04

**Observed:**
- The uncommitted local `GoogleTasksTest.js` replaces the existing Google Tasks review/reminder implementation with a transitional state where Google Tasks is deliberately disabled and only the TEST owner registry remains.

**Evidence:**
- Local diff from canonical `main` removes task-list/task/reminder logic and introduces the comment `Platform P1 transitional state: Google Tasks is deliberately disabled.`
- Authoritative ZASS `D-006` remains LOCKED and requires one Google Task List per worker/person with private reminder semantics; task completion controls reminder completion only.

**Affected area:**
- Platform reminder architecture, owner registry, review follow-up, pilot scope, and regression expectations.

**Potential consequence:**
- Committing or deploying the current local P1 state would silently supersede a LOCKED architectural decision and could remove a previously tested reminder capability.

**Possible options:**
1. Keep D-006: restore/retain Google Tasks and adapt the P1 refactor around the locked per-person Task List semantics.
2. Supersede D-006 through ZASS: intentionally remove Google Tasks from the MVP/pilot and define the replacement reminder/follow-up mechanism.
3. Defer the P1 Google Tasks removal and continue only work that does not depend on this decision.

**ZASS impact:** `REVIEW REQUIRED`

---

