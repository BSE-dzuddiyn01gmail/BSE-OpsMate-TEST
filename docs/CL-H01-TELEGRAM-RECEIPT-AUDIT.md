# CL-H01 — Telegram Crop Lifecycle Receipt Audit

Status: READ-ONLY AUDIT COMPLETE; implementation pending scoped regression evidence.
Roadmap: v2.0 LOCKED by owner on 2026-10-23.
Base: origin/main 480981787d00d4d5ef346fb0531b2e3ec161743e.
Scope: transplant confirmation and mula tuai confirmation only.
Excluded: MxP123/MxP1234 parser, SISMARP, transaction engine, architecture changes.

## Code evidence
- TelegramApprovalUiTest.js current reporter confirmation core first saves canonical domain record.
- It then invokes bseTelegramApprovalCloseCard_ (editMessageText).
- It subsequently invokes bseTelegramReporterReceipt_ (sendMessage) and bseTelegramOwnerNotice_ (sendMessage to active owners).
- For a reporter who is also an owner, a single approval can therefore produce card edit + reporter PM + owner PM within the same destination.
- Transplant_Event_Log is not among the domain-specific recordSummary branches in the final reporter confirmation core, so its receipt falls back to generic text.
- Operation_Log has a canonical summary branch; whether "Mula Tuai" maps to that domain must be verified against representative queue payload, not assumed.
- Approval card state guards retries after REPORTER_CONFIRMED; notification state has no independently durable per-recipient SENT acknowledgement at this point.

## Correction design, pending code
1. Scope routing to confirmed transplant and verified mula-tuai target only.
2. Produce one human-readable confirmation by editing the existing review card, using canonical read-back data.
3. Do not send a second reporter receipt when the same confirmation was successfully delivered by card edit.
4. Suppress owner notices to the same chat id as confirmation; distinct owner recipients retain their normal notice.
5. Preserve failed/uncertain Telegram delivery state without claiming SENT. Do not blindly retry non-idempotent sendMessage.
6. Keep multiple independently approved records independent.
7. Add isolated regression coverage for single chat, reporter=owner, separate owner chat, multi-plot single approval, retries, send failure and unrelated domains.

## Guardrails and current gates
- Original local main has 17 modified files and is 180 commits behind origin/main; untouched.
- Clean isolated worktree: BSE-OpsMate-CL-H01 branch fix/cl-h01-telegram-lifecycle-receipts from latest remote main.
- Repository AGENTS.md instructs Apps Script changes to go through TEST clasp push before git commit/push. Owner explicitly forbids Apps Script HEAD sync in this authorization.
- Thus no runtime sync or deployment. Do not mark MERGED or LIVE PASS; do not bypass the repo gate without a reconciled decision.

## CL-H04 local evidence (2026-10-23 MYT)
- Isolated JS VM loaded all 53 tracked JavaScript files with no parse/load errors.
- I-011 consolidated regression: 47/47 PASS using deterministic Apps Script mocks (not native).
- Targeted lifecycle receipt checks: 7 PASS; routing checks: 5 PASS; reporter=owner across group and PM: PASS.
- Syntax and diff checks PASS.
- Reporter identity path resolves registered owner_name by original reporter telegram id, falls back to callback actor name when unavailable.
- 'Mula Tuai' fixture uses Operation_Log fields.operation_type='Mula Tuai'; live payload mapping remains UNVERIFIED.
- Snapshot of pre-sync Apps Script HEAD was pulled into a dedicated local audit folder (54 files). Seven runtime source files differ from current main/branch: ExactRealMessageCorpusTest.js, GeminiUnifiedTest.js, TelegramApprovalUiTest.js, TelegramQueueTest.js, TelegramWorkerTest.js, TransplantReviewTest.js, TreatmentReviewTest.js. GitHub main is canonical; these differences require read-back after authorized HEAD sync.
- These tests are SYNTHETIC; native Apps Script and Telegram live acceptance remain outstanding.

## Native Apps Script regression proof (2026-10-23 MYT)
- User authorized HEAD synchronization after synthetic 47/47 PASS.
- Apps Script HEAD push at approximately 20:29 MYT: 54 source files, using scoped TEST project binding from existing local .clasp.json; no clasp run.
- Independent fresh clasp pull to separate HEAD-VERIFY folder: 54 files; SHA-256 mismatches versus worktree = 0.
- UI Automation: Windows Edge browser identified by exact locally verified Apps Script scriptId; opened RegressionSuiteTest.gs; selected runBseI011FullRegression by accessibility control and checked selected function before invoking Run exactly once.
- UI execution log at 20:43:14 MYT: BSE_I011_FULL_REGRESSION total=47, passed=47, failed=0, production_write=false; followed by Eksekusi selesai. No native failed harnesses.
- Targeted reporter / receipt / owner duplicate tests run in isolated local Node VM: 7 base assertions PASS, 5 routing assertions PASS, reporter=owner across separate group/PM PASS.
- Native suite validates existing regressions; targeted new notification behavior is not yet Telegram live proof. CL-H06 remains PENDING.
- No Apps Script deployment version was created or updated in this stage.
