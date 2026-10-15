# PILOT_OPERATION Execution Path — LOCKED

**Status: LOCKED — 2026-10-15**

## 1. Naming authority

Nama runtime/environment rasmi ialah **`PILOT_OPERATION`**.

Tiada nama alternatif dibenarkan sebagai nama environment, workbook, Drive folder, property, branch, deployment, atau dokumen baharu.

Canonical environment sequence:

```text
TEST
  -> PILOT_TEST
  -> PILOT_OPERATION
  -> separate production gate only if explicitly authorized later
```

`PILOT_OPERATION` ialah shadow pilot operasi sebenar. Ia bukan production rasmi BSE.

## 2. Safety and authority lock

Sepanjang `PILOT_OPERATION`:

- `production_write:false` kekal.
- `official_bse_write:false` kekal.
- Writer dibenarkan menyimpan **data operasi sebenar pilot** ke Spreadsheet/Drive `PILOT_OPERATION` sahaja.
- Tiada direct write/integration ke sistem rasmi BSE.
- Human confirmation, provenance, dedup, audit, access boundary dan fail-closed behavior kekal wajib.
- Google Tasks kekal out of scope per D-027.
- GitHub authority: repository/ecosystem **BSE-dzuddiyn01gmail** / owner path yang sedang digunakan.
- Google authority: **dzuddiyn01@gmail.com**.
- Akaun GitHub atau Google `rdeeen` tidak menjadi authority, owner, credential dependency atau fallback bagi `PILOT_OPERATION`.
- Nama produk/project ialah **BSE OpsMate**. Tiada alias produk lama dibenarkan pada resource atau prompt aktif `PILOT_OPERATION`.

## 3. Locked execution path A–I

Urutan A–I di bawah ialah **LOCKED**. Jangan lompat gate kecuali architecture decision baharu yang eksplisit diluluskan.

### A — Closeout truth reconciliation

Tujuan: pastikan tracking repo menggambarkan state sebenar sebelum promotion.

Wajib:
- canonical `main` terkini direkod;
- PR terakhir/merge state direkod;
- PILOT_TEST Script HEAD = canonical source;
- full regression terkini direkod;
- schema/source-key audit terkini direkod;
- Daily + Friday autonomous reporting proof direkod;
- tracking lama yang stale dibetulkan.

**Gate A:** documentation truth = CURRENT.

### B — Implement PILOT_OPERATION environment adapter

Tujuan: implement keputusan architecture yang sudah LOCKED, bukan reka architecture baharu.

Wajib:
- environment `PILOT_OPERATION`;
- Spreadsheet berasingan;
- Evidence Drive berasingan;
- target sheet `PILOT_*`;
- queue/review/audit/registry berasingan;
- Telegram output label `[PILOT]`;
- cross-environment write guard;
- active prompt/resource naming normalized to **BSE OpsMate** only;
- `production_write:false`;
- `official_bse_write:false`.

**Gate B:** local/regression/isolation PASS sebelum runtime binding.

### C — Authority and identity binding

Wajib verify:
- GitHub authority = dzuddiyn01/BSE path;
- Google owner = `dzuddiyn01@gmail.com`;
- bot/group/user config bound kepada environment pilot;
- no `rdeeen` authority/dependency;
- no credential copied into repo/logs.

**Gate C:** authority CURRENT dan isolated.

### D — Seed minimum real operational baseline

Jangan copy seluruh PILOT_TEST.

Seed hanya prerequisite fakta semasa yang diperlukan oleh operasi sebenar, contohnya:
- current Crop Batch;
- current Plot Allocation / effective lifecycle state;
- relevant Transplant/Reallocation/Allocation Status lineage;
- owner/admin/active user registry;
- approved group/config minimum.

Jangan migrate:
- synthetic TEST rows;
- stale/superseded cards;
- debug probes;
- temporary proof artifacts;
- known wrong-domain rows kecuali diperlukan sebagai audit history dan explicitly classified.

**Gate D:** baseline facts verified independently.

### E — Pre-pilot transport reconciliation

Automation general masih **OFF**.

Wajib inspect/reconcile:
- Telegram offset;
- latest processed update;
- queue;
- pending callbacks;
- open approval cards;
- duplicate pending work;
- webhook state;
- stale prompt/card state.

Mesej pertama `PILOT_OPERATION` mesti:
- tidak replay mesej lama;
- tidak skip mesej baru;
- tidak double-process.

**Gate E:** transport CLEAN.

### F — Controlled PILOT_OPERATION real write + retrieval proof

Automation general masih **OFF**.

Proof pertama: satu laporan operasi sebenar yang sudah matang, utamakan **Rawatan/Treatment**.

Flow:
```text
Telegram real message
 -> receive/queue
 -> parser/validator
 -> human Benar
 -> PILOT_* writer
 -> independent Sheet read-back
 -> retrieval/status/history
 -> same factual record
```

Verify:
- exact crop/plot/product/dose/date;
- source/update identity;
- no duplicate;
- review state closed;
- provenance intact;
- retrieval mengembalikan rekod yang sama;
- restricted data kekal restricted.

**Gate F:** one complete real write-store-retrieve loop PASS.

### G — Evidence / image proof

Satu gambar/evidence sebenar:

```text
Telegram image
 -> image/evidence intake
 -> human confirmation
 -> PILOT Drive
 -> metadata/audit
 -> retrieve/reference evidence
```

Verify:
- Drive file private/authorized;
- metadata lineage tepat;
- no duplicate;
- no automatic domain claim daripada Gemini inference;
- retrieval/reference berfungsi.

**Gate G:** Evidence PILOT_OPERATION PASS.

### H — Enable general Telegram automation

Hanya selepas F dan G PASS.

Enable:
- receive/worker automation;
- dedicated reporting schedulers as approved.

Live proof:
1. fresh Telegram message auto-received exactly once;
2. callback auto-processed exactly once;
3. queue settles;
4. no replay;
5. no skipped update;
6. no duplicate;
7. rollback path = automation OFF.

**Gate H:** TELEGRAM AUTOMATION LIVE PASS.

### I — Final ordinary-user walkthrough and delivery

Tanpa manual `clasp run` atau manual worker.

Walkthrough pengguna biasa:
```text
Telegram
 -> parse
 -> human confirmation
 -> stored PILOT record/evidence
 -> retrieve/history/status
```

Final independent verification:
- canonical repo/source/runtime match;
- schema/source-key audits CURRENT;
- access controls;
- provenance/dedup;
- automation state;
- known limitations;
- rollback SOP;
- handover evidence.

Jika semua acceptance PASS:

```text
PILOT_OPERATION VERIFIED
 -> PILOT_OPERATION DELIVERED
```

Ini **bukan** `production`, **bukan** `official_bse_write:true`, dan bukan kelulusan integrasi sistem rasmi BSE.

## 4. Current execution state

As of 2026-10-15:

- PILOT_TEST technical closeout: PASS.
- Canonical `main`: `0abf016300231a63126726ef30b1dc513c044fb6` after PR #58 merge.
- PILOT_TEST Script HEAD reconciled to canonical source.
- Full regression: 47/47 PASS.
- Schema audit: 57/57 CURRENT.
- Source-key audit: CURRENT / 0 issue.
- Daily Morning Digest: AUTONOMOUS LIVE PASS.
- Friday Weekly Digest: AUTONOMOUS LIVE PASS on accelerated owner-runtime one-shot proof; schedule restored to Friday 07:59 MYT.
- General Telegram receive/worker automation: OFF.
- `production_write:false`.
- `official_bse_write:false`.
- `PILOT_OPERATION` runtime adapter: NOT IMPLEMENTED.
- Reserved Google resources exist but are not bound/used by runtime:
  - workbook `BSE_OpsMate_SB_PILOT_OPERATION`;
  - Evidence folder `BSE_OpsMate_SB_PILOT_OPERATION_Evidence`;
  - owner `dzuddiyn01@gmail.com`, `shared:false`.
- `PILOT_OPERATION` runtime: NOT STARTED.

Current gate: **A — documentation truth reconciliation**.

## 5. Change-control rule

Selepas lock ini:

- gunakan `PILOT_OPERATION` sahaja sebagai nama technical resource;
- jangan redesign scope ketika promotion;
- code hanya untuk gap `PILOT_OPERATION` yang diperlukan oleh A–I atau defect sebenar yang dibuktikan;
- setiap failure mesti diklasifikasi dan diperbaiki dengan smallest safe fix;
- production gate kekal keputusan berasingan selepas `PILOT_OPERATION` delivery.
