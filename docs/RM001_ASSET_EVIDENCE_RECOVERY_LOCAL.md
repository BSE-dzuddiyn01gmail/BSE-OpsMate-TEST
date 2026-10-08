# RM-001 Asset–Evidence recovery — local validation (2026-10-08)

Worktree: clean feature branch fix/rm001-asset-evidence-recovery from canonical main 4410bf6.
Scope: TEST writer only; no Sheets/Drive/Telegram/Apps Script HEAD write.

Defects:
1. On failed Evidence link, Asset Event had already been appended; absent review row caused unsafe append on retry.
2. Prior Review idempotency reader compared object properties against Sheets getValues() array rows, missing persisted duplicates.

Change:
- bseInventoryAssetRecoveryDecision_ scans Asset Event source key, confirms unique expected event ID, domain, hash, approval state, production_write false, and skips repeated append; mismatches/duplicates fail closed.
- bseInventoryDecisionFromPrior_ handles both object test fixtures and actual array-shaped sheet rows, conflicts on mismatched hash/decision or duplicate review rows.
- Subsequent retry re-enters Evidence link, then finalizes Review + Queue after successful link.

Tests (local, no external network or domain writes):
- rm001_recovery_fault_test.cjs: 7 checks PASS; one injected Evidence-link failure after asset row, then retry; final asset=1, review=1, link=1, third run duplicate; hash/row conflicts refused.
- rm001_local_regression.cjs: exact corpus 21/21, Asset acceptance 7/7, full regression 26/26.
- node --check and git diff --check PASS.

Limit: fault injection uses local in-memory Sheet simulation; independently live-verified write durability and queue/callback recovery are not yet shown. D007 remains BLOCKED pending final C022 and authorized TEST Script HEAD + scoped LIVE verification. No TEST PASS FINAL.
