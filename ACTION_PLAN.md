# ACTION PLAN — OpsMate BSE Site B Recovery

## Current true milestone
RECOVERY SOURCE RECONCILED; LIVE RECONCILIATION PENDING. PILOT_TEST Telegram E2E is not PASS.

## Locked safety
`production_write:false`; `official_bse_write:false`; `BSE_TELEGRAM_AUTOMATION=OFF`; no Google Tasks; no official BSE write; no Telegram retry unless REC-010 proves it safe.

## Evidence snapshot
- Dirty local main: `1723678`; canonical `origin/main`: `13c8b8e`. Dirty work is preserved untouched.
- Recovery branch: `recovery/pilot-source-reconcile`, containing additive-header, callback-context, and independent Owner Registry fixes.
- Targeted Apps Script tests PASS: Owner Registry and additive header harnesses.
- Full Apps Script regression PASS: 25/25, `failed:0`, with `production_write:false`.
- PILOT_TEST Script HEAD was pushed from the recovery source and pulled independently into a disposable audit copy.
- Critical runtime files match recovery byte-for-byte: OwnerRegistryTest.js, RegressionSuiteTest.js, ReviewCoreTest.js, TelegramApprovalUiTest.js.
- The former TEST_ONLY smoke file is now a two-line non-executable tombstone. Clasp cannot delete a remote file that is absent locally; no TEST_ONLY function remains.

## Recovery tasks
- REC-001 Snapshot canonical/worktree/runtime state. DONE.
- REC-002 Exact Apps Script HEAD mismatch manifest. DONE: prior source mismatch isolated; recovery source is the runtime baseline.
- REC-003 Owner Registry lineage audit. DONE: extracted as a standalone module with no Tasks dependency.
- REC-004 Minimal canonical Owner Registry module. DONE.
- REC-005 Combine header and callback repairs. DONE.
- REC-006 Register Owner Registry regression. DONE.
- REC-007 Syntax, targeted, full regression, diff checks. DONE (25/25 live Apps Script harnesses).
- REC-008 Remove executable TEST_ONLY artifact. DONE; remote tombstone remains because clasp does not delete files.
- REC-009 Reproducible Apps Script HEAD and independent pull/compare. DONE, subject to non-executable tombstone noted above.
- REC-010 Reconcile Telegram updates 746192218/220/223/225 with queue, domain, callback and offset state. DONE: 218=DISCARDED_BY_REPORTER; 220=NEEDS_HUMAN_REVIEW; 223=UNLINKED_REPLY; 225 is absent from queue, still present in Telegram, offset=746192224.
- REC-011 Retry only if update 746192225 is proven unprocessed and safe. DONE with owner authorization: one queue row created, status=QUEUED, ACK=SENT (message id 21), offset=746192226, automation remains OFF.
- REC-012 Confirmation/domain-write proof. REQUIRES EXPLICIT OWNER AUTHORIZATION: the worker mutates TEST queue/domain state and sends the provisional Telegram confirmation/card; it does not write production.
- REC-013 Idempotency proof. BLOCKED BY REC-012.
- REC-014 Full final reconciliation. BLOCKED BY REC-012–013.
- REC-015 Clean-up. PENDING.
- REC-016 Evidence/PR and owner merge gate. PENDING.

## Known live facts requiring reconciliation
- Update 746192225 / group message id 19 was previously observed after offset 746192224.
- Prior refs 746192218, 746192220, 746192223 have historical status/callback anomalies.
- Cloud log access through clasp is unavailable because the clasp project configuration has no GCP project ID, despite the Apps Script standard project being linked. This is a diagnostic gap, not a pass or a reason to retry.
