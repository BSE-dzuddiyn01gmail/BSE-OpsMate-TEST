# Owner Registry Extraction Audit

## Authority
EXPLICIT_FROM_CODE — preserved dirty local `GoogleTasksTest.js`; extracted without adopting its Google Tasks coupling.

## Canonical minimal capability
- `BSE_TEST_OWNER_REGISTRY_HEADERS`
- `bseTestOwnerRegistry_(book)`
- `bseTestOwnerRows_(book)`
- `bseTestOwnerForTelegramUser_(book, telegramUserId)`
- `bseTestOwnerFromRow_(row)`
- `bseTestRegistryBoolean_(value)`

## Direct dependency
- SpreadsheetApp-compatible `book`
- `bseEnsureAdditiveHeaders_`

## Explicit non-dependencies
- Google Tasks API
- ScriptApp triggers
- Telegram send API
- Google Tasks authorization

## Regression proof
The live Apps Script function `runBseOwnerRegistryHarnessTests` passed after the recovery Script HEAD update. The full regression suite also passed 25/25 with `production_write:false`.

## Decision
Owner Registry is now a dedicated canonical module. Compatibility shims remain disabled; `GoogleTasksTest.js` is not an authority module.
