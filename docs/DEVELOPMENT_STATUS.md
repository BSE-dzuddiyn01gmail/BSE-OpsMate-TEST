# OpsMate BSE site B v1.0 Final Handover

## Definisi status

| Status | Definisi |
|---|---|
| Planned | Reka bentuk atau skop telah dicadangkan/diluluskan, tetapi belum dilaksanakan. |
| Implemented | Perubahan sumber telah dilaksanakan secara setempat. |
| TEST regression PASS | Semakan sintaks dan harness/regression berkaitan lulus. |
| TEST runtime PASS | Tingkah laku telah disahkan pada projek Apps Script TEST dengan bukti runtime. |
| Production-ready | Semua kawalan, ujian, dokumentasi, dan keputusan operasi yang diperlukan telah diluluskan untuk production. |
| Pilot accepted | Pilot kerja sebenar telah diterima oleh BSE mengikut skop dan kriteria penerimaan yang dipersetujui. |
| Final handover | Handover rasmi dibuat selepas production gate dan penerimaan pilot dipenuhi. |

## Bukti checkpoint TEST

| Komponen | Bukti commit | Status bukti |
|---|---|---|
| Fasa 2A — proposal Crop Batch | `bbad077` | Siap TEST dan committed. |
| Fasa 2B — human review Crop Batch | `c57dac8` | Siap TEST dan committed. |
| Fasa 2C-1 — Transplant / Pindah Anak Pokok | `4869e60` | Siap TEST, committed, dan runtime-tested. |
| Plot Allocation Change / Reallocation semasa Transplant | PILOT_TEST Telegram E2E LIVE VERIFIED | Baseline `PLOT_ALLOCATION` immutable; append-only Reallocation Event + Transplant Event + Allocation Status ledger. Destination mesti kosong. Live root `BSE-TG-746192336` asked `plot asal`; reply-linked `BSE-TG-746192338` with `M1P1` resolved Timun Lokal (CCB) M1P1→M1P3 and opened card 256. Reporter selected Batal; Telegram confirmed `DISCARDED_BY_REPORTER` at 15/10/2026 06:13 MYT, callback `746192339` processed, and queue/UI both reached `DISCARDED_BY_REPORTER` with no second reason prompt. Independent read-back: Reallocation 0, Transplant 0, Allocation Status 0; M1P1/M1P2 baseline remained PLANNED. Live proof exposed and fixed worker-finalize `source_plot` loss in `e4fbb7d`; targeted harness 8/8, full regression 47/47, schema 57/57 CURRENT, source audit 185/0, production false. |
| Reminder Telegram harian (historical Google Tasks path) | `cc20f3d` | Historical TEST evidence sahaja; feature disupersede untuk current MVP/shadow pilot oleh ZASS D-027. |
| Pengesahan penghantar & Delete owner | `f7e97fe`, `87ef697` | Kad group penghantar, notis PM, dan `/delete` dua-pengesahan (`VOIDED_TEST`) siap TEST; runtime-tested bagi Inventory/Claim, termasuk penolakan jelas untuk akaun bukan owner/admin tanpa domain write. |
| File Evidence — registration gate, intake & PM retrieval | Runtime TEST PASS | `/start BSE_TEST` mencipta `REGISTRATION_PENDING`; kad `TERIMA`/`TOLAK` dihantar kepada owner aktif, keputusan pertama menutup kad lain, dan pemohon menerima satu notis. PHOTO/DOCUMENT/VIDEO diuji melalui Telegram: `Benar` menyimpan fail ke Drive TEST sahaja, menutup kad, menghantar resit PM penghantar, ringkasan PM owner/admin, dan makluman group minimum. Ahli aktif boleh menghantar `/retrieve BSE-EV-...` melalui PM; akses visibility disemak dan fail dihantar semula melalui Telegram tanpa pautan Drive. Callback batch, retrieval audit, dan dedup kekal TEST-only (`production_write:false`). |
| PM retrieval — `/status plot M2P1` | Runtime TEST PASS | Owner/admin atau ahli `REGISTERED_ACTIVE` mendapat ringkasan allocation ACTIVE yang diluluskan, banci terakhir, dan rawatan terakhir daripada rekod TEST sahaja. Runtime PM mengesahkan M2P1 dengan Timun, allocation `ACTIVE`, banci 96 pokok, dan rawatan terakhir. Group menerima arahan PM minimum tanpa data plot; setiap permintaan diaudit dan tiada domain/production write. |
| PM retrieval — `/summary plot M2P1,M2P2` | Runtime TEST PASS | Rumusan dua hingga enam plot unik melalui PM, menggunakan sumber TEST dan audit yang sama. Runtime PM mengesahkan M2P1 dipaparkan lengkap serta M2P2 yang tiada allocation ACTIVE dipaparkan secara selamat. Group dan user tidak aktif kekal tanpa data melalui kawalan akses dan regression. |
| PM retrieval — `/retrieve BSE-TG-<update_id>` | Runtime TEST PASS | Retrieval PM default-deny untuk rekod yang sudah `REPORTER_CONFIRMED`, dengan hash integrity, audit berasingan, dan ringkasan field terkawal. Runtime owner/admin membuktikan Claim `BSE-TG-146694289` dipulangkan sebagai `INVENTORY_CLAIM` tanpa domain/production write. Rekod group `FIELD_OPERATION` / `ASSET_EQUIPMENT` tersedia kepada ahli aktif; Claim, private, dan rekod tidak dikelas kekal restricted kepada penghantar asal atau owner/admin. |
| PM history — `/history YYYY-MM-DD`, `/history YYYY-MM`, `/history week last`, `/history week N YYYY-MM`, `/history week <Friday YYYY-MM-DD>` | PILOT_TEST runtime PASS | Owner/admin atau `REGISTERED_ACTIVE` melalui PM. Weekly history menggunakan window Jumaat-Khamis; `week N YYYY-MM` bermaksud Jumaat ke-N dalam bulan pilihan user hingga Khamis berikutnya. Runtime week 2 Oct (`2026-10-09..2026-10-15`) memulangkan 20 authorized events. Owner/admin mendapat rekod authorized penuh; user biasa hanya rekod sendiri atau `GROUP_STANDARD`; restricted/private kekal default-deny. |
| PM report — `/report YYYY-MM-DD` atau `/report YYYY-MM` | TEST runtime PASS | PM owner/admin sahaja. Memulangkan fakta canonical TEST yang terkawal, diikuti komen Gemini yang dilabel bukan fakta dan tidak boleh mengubah rekod. Kegagalan Gemini kekal fail-selamat: fakta dipulangkan, manakala audit menyimpan status tanpa credential. Daily Morning Digest 08:01 MYT menggunakan renderer ini untuk hari sebelumnya. |
| PoC retrieval sejarah / laporan Gemini / EC Leaching | PILOT_TEST runtime PASS | EC Leaching menerima tarikh/sesi/bacaan deterministik, kad `Benar`/`Betulkan`/`Batal`, batch atomik, audit/hash/idempotence. Dedicated `/ec_history` kini membaca `TEST_EC_LEACHATE` secara langsung bagi hari/bulan/minggu; runtime `/ec_history week 3 2026-09` memulangkan 1 batch / 21 bacaan confirmed pada 2026-09-21 dengan `production_write:false`. General `/history` kekal ringkasan silang-domain. |
| Fasa 2C-2A — Banci Pokok | `f9da6a2` | Siap TEST, committed, dan runtime-tested. Regression/harness PASS; runtime membuktikan laporan satu plot, `Batal` audit sahaja, `Betulkan` one-shot, pengaktifan allocation melalui Transplant, serta Banci dua plot. `BSE-TG-146694362` diretrieve sebagai `M2P1: 93 pokok`; `BSE-TG-146694372` diretrieve sebagai `M2P1: 92 pokok, M2P2: 88 pokok`. Semua bukti kekal `production_write:false`. |
| Fasa 2C-2B — Rawatan sebenar | Dedicated closure 2026-10-06 | TEST runtime PASS. Treatment-specific closure 13/13 PASS merangkumi D-043 state/date/dose/no-invention, deterministic router, ACTIVE allocation dan review safety. Full I-011 regression 22/22 PASS; independent Sheet read-back mengesahkan `production_write:false`. Temporary TEST_ONLY probe dibuang dan Apps Script TEST HEAD dipulihkan kepada canonical source. |
| Plant Replacement / Sulam | PILOT_TEST Telegram E2E LIVE VERIFIED | Dedicated `Plant_Replacement_Event_Log` + review audit implemented. Deterministic parser routes replacement wording before Plant Condition/Gemini, requires explicit positive replacement count and valid plot/date, resolves crop only from a unique ACTIVE allocation as-of event date, and never mutates Plant Census. Live `BSE-TG-746192324` produced exactly one `VERIFIED_TEST` event `BSE-SB-PR-f09986463084`; independent Sheet read-back and exact-reference retrieval passed; duplicate replay remained idempotent. |
| PILOT_TEST runtime binding + isolation | `docs/PILOT_TEST_RUNTIME_ISOLATION_EVIDENCE.md` | Environment adapter implemented. TEST runtime full regression 23/23 PASS dan mengekalkan TEST target names; PILOT_TEST runtime full regression 23/23 PASS, mapped `PILOT_TEST_*` targets, fixed Evidence binding, dan cross-environment guard PASS. Apps Script TEST_ONLY write ke workbook PILOT_TEST dibaca semula secara bebas; TEST workbook salah ditolak sebelum fake writer dipanggil. Temporary formula/probe/onOpen artifacts dibuang. Automation OFF. |
| PILOT_TEST controlled replay | `PTR-20261006-001` -> `PTR-20261006-003` | Run pertama menemui dua mismatch parser; fix TEST merged `482779f`, dan `PTR-20261006-002` mencapai **10/10 boundary-correct PASS**. `PTR-20261006-003` kemudian menutup dependency-required Crop/Transplant/Census review paths: exact historical M2P2 Transplant + Banci lulus terhadap isolated prerequisite/allocation lineage, manakala source-derived M1P1 Crop kekal `WAITING_INFO` kerana variety tiada dan tidak direka. Partial TEST_ONLY proof write direconcile sebelum resume idempotent; semua synthetic proof rows/sheets dan temporary Apps Script stepper dibuang selepas read-back. Tiada Telegram API, automation, production write, atau official BSE write. |
| PILOT_TEST dependency/comparator gate | `docs/PILOT_TEST_DEPENDENCY_COMPARATOR_EVIDENCE.md` | Dependency review proof `PTR-20261006-003` PASS + cleanup PASS. Asset registry/maintenance/measurement-observation/qualitative plant-condition comparators are bound; supplemental asset new-in-use source and File Evidence source-record comparator added. Leave exact comparator, exact numeric Plant Condition comparator, dan pre-acquisition Asset proposal chronology were not found and are explicitly `LEGACY_MISSING` under D-050 no-invention rule. Previously `OPEN_CONTROLLED` comparator set is now fully classified. |
| I-011 regression | `3a3770c` | TEST runtime PASS: `runBseI011ImplementationOnly` 17/17 PASS dan `runBseI011FullRegression` 22/22 PASS, 0 FAIL, `production_write:false`. Kedua-dua bukti runtime dibuat melalui custom-function TEST_ONLY dalam workbook `Kerani_AI_BSE_SB_TEST`, dibaca semula secara bebas, kemudian sheet probe dan wrapper sementara dibuang. |
| Real-message field test | branch `test/real-message-field` | TEST runtime PASS 13/13 menggunakan pola mesej operasi BSE sebenar: claim petrol, Baja In, Baja Out F/N multi-record, `ambil baja` tanpa item/kuantiti, stock count dripper, leave `20 September`, maintenance paip, plant condition, image-only disease guard, transplant guard, dan treatment list. Full regression selepas perubahan kekal 22/22 PASS; `production_write:false`. Dua gap yang ditemui semasa field test dibetulkan: tarikh cuti nama bulan dan split F+N merentas plot. |

Fasa 2C-2A dan 2C-2B ialah sebahagian 2C-2. Per stable ZASS D-050 dan owner lock 2026-10-11, baki 2C-2 yang tidak pasti serta seluruh Fasa 2C-3 kekal `DEFERRED_BY_LOCKED_SCOPE` dan tidak akan dibina tanpa keperluan operasi baharu yang jelas. Plant Replacement/Sulam diluluskan secara eksplisit sebagai next feature berasingan; OCR minimum PoC turut diluluskan sebagai capability kecil selepas scheduler proof.
Semua checkpoint di atas kekal TEST-only;
ia bukan bukti bahawa production-ready, pilot accepted, atau final handover telah
dicapai.

## Jadual kerja mengikut dependency

| Trek | Urutan kerja bergantung | Status semasa |
|---|---|---|
| A. Domain / pilot entry | 2C-2A -> 2C-2B -> MVP scope freeze -> PILOT_TEST | Domain/review runtime paths, File Evidence, Claim, Observation, Operation, Decision, Input Usage, PM retrieval/history/report, Daily Morning Digest, dan Friday Weekly Digest telah mencapai TEST/PILOT_TEST technical PASS yang berkaitan. Daily 08:01 MYT dan Friday 07:59 MYT schedulers ialah ON/verified. General Telegram receive/worker polling kekal OFF. Next real pilot gate ialah scheduled autonomous-delivery proof, kemudian documented BSE pilot acceptance; production gate kekal berasingan. |
| B. Platform | File Evidence architecture -> registration gate -> File Evidence TEST -> PM retrieval -> owner/admin registry + Telegram human review -> text reporting | Registration gate, intake/Drive Evidence, dan PM retrieval telah diimplementasi serta runtime-tested dalam TEST. Google Tasks/Task List telah dikeluarkan daripada MVP/shadow pilot oleh D-027; tiada replacement reminder tersirat. |

Scheduler reporting telah dikunci dan dipasang dalam PILOT_TEST:
- Daily Morning Digest: 08:01 MYT setiap hari, laporan hari sebelumnya, PM owner/admin.
- Friday Weekly Digest: 07:59 MYT setiap Jumaat, window 7 hari lengkap Jumaat-Khamis,
  PM kepada owner/admin/REGISTERED_ACTIVE user mengikut visibility filtering.
Daily Morning Digest achieved autonomous LIVE PASS on 2026-10-12 with independent audit
read-back (8/8 records, Telegram message ID 167, trigger rescheduled). Friday Weekly Digest
remains installation/configuration PASS only until its first autonomous Friday delivery.

## Syarat selesai dan production gate

Setiap item hanya boleh ditanda selesai apabila mempunyai commit, ujian relevan,
dan bukti runtime apabila item itu melibatkan runtime atau integrasi Apps Script.
Semua perubahan mesti kekal TEST-only sehingga production gate diluluskan.

Status production ialah **belum layak**. Sebelum sebarang final handover,
OpsMate memerlukan pilot kerja sebenar, bukti penerimaan BSE, dan kelulusan
production gate yang berasingan. Google Task completion tidak pernah menjadi
kelulusan automatik atau bukti penerimaan pilot.
