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
| Reminder Telegram harian (historical Google Tasks path) | `cc20f3d` | Historical TEST evidence sahaja; feature disupersede untuk current MVP/shadow pilot oleh ZASS D-027. |
| Pengesahan penghantar & Delete owner | `f7e97fe`, `87ef697` | Kad group penghantar, notis PM, dan `/delete` dua-pengesahan (`VOIDED_TEST`) siap TEST; runtime-tested bagi Inventory/Claim, termasuk penolakan jelas untuk akaun bukan owner/admin tanpa domain write. |
| File Evidence — registration gate, intake & PM retrieval | Runtime TEST PASS | `/start BSE_TEST` mencipta `REGISTRATION_PENDING`; kad `TERIMA`/`TOLAK` dihantar kepada owner aktif, keputusan pertama menutup kad lain, dan pemohon menerima satu notis. PHOTO/DOCUMENT/VIDEO diuji melalui Telegram: `Benar` menyimpan fail ke Drive TEST sahaja, menutup kad, menghantar resit PM penghantar, ringkasan PM owner/admin, dan makluman group minimum. Ahli aktif boleh menghantar `/retrieve BSE-EV-...` melalui PM; akses visibility disemak dan fail dihantar semula melalui Telegram tanpa pautan Drive. Callback batch, retrieval audit, dan dedup kekal TEST-only (`production_write:false`). |
| PM retrieval — `/status plot M2P1` | Runtime TEST PASS | Owner/admin atau ahli `REGISTERED_ACTIVE` mendapat ringkasan allocation ACTIVE yang diluluskan, banci terakhir, dan rawatan terakhir daripada rekod TEST sahaja. Runtime PM mengesahkan M2P1 dengan Timun, allocation `ACTIVE`, banci 96 pokok, dan rawatan terakhir. Group menerima arahan PM minimum tanpa data plot; setiap permintaan diaudit dan tiada domain/production write. |
| PM retrieval — `/summary plot M2P1,M2P2` | Runtime TEST PASS | Rumusan dua hingga enam plot unik melalui PM, menggunakan sumber TEST dan audit yang sama. Runtime PM mengesahkan M2P1 dipaparkan lengkap serta M2P2 yang tiada allocation ACTIVE dipaparkan secara selamat. Group dan user tidak aktif kekal tanpa data melalui kawalan akses dan regression. |
| PM retrieval — `/retrieve BSE-TG-<update_id>` | Runtime TEST PASS | Retrieval PM default-deny untuk rekod yang sudah `REPORTER_CONFIRMED`, dengan hash integrity, audit berasingan, dan ringkasan field terkawal. Runtime owner/admin membuktikan Claim `BSE-TG-146694289` dipulangkan sebagai `INVENTORY_CLAIM` tanpa domain/production write. Rekod group `FIELD_OPERATION` / `ASSET_EQUIPMENT` tersedia kepada ahli aktif; Claim, private, dan rekod tidak dikelas kekal restricted kepada penghantar asal atau owner/admin. |
| PM history — `/history YYYY-MM-DD` atau `/history YYYY-MM` | TEST runtime PASS (`1490167`) | PM owner/admin sahaja. Membaca rekod canonical `REPORTER_CONFIRMED` yang hash-integritinya sah dan Evidence `CONFIRMED_TEST`; mengecualikan `VOIDED_TEST`, menyembunyikan mesej asal/payload penuh, mengehadkan paparan, dan merekod audit retrieval berasingan. |
| PM report — `/report YYYY-MM-DD` atau `/report YYYY-MM` | TEST runtime PASS | PM owner/admin sahaja. Memulangkan fakta canonical TEST yang terkawal, diikuti komen Gemini yang dilabel bukan fakta dan tidak boleh mengubah rekod. Kegagalan Gemini kekal fail-selamat: fakta dipulangkan, manakala audit menyimpan status tanpa credential. |
| PoC retrieval sejarah / laporan Gemini / EC Leaching | TEST runtime PASS | Owner/admin ditetapkan manual untuk PoC; `/history` dan `/report` kekal PM owner-only. EC Leaching menerima tarikh/sesi/bacaan deterministik, kad penghantar `Benar`/`Betulkan`/`Batal`, batch atomik, audit/hash/idempotence, serta PM `/retrieve BSE-TG-...` dan `/history`. Nota lama rawatan-as-Observation telah disupersede oleh D-043 dan dedicated 2C-2B runtime closure. |
| Fasa 2C-2A — Banci Pokok | `f9da6a2` | Siap TEST, committed, dan runtime-tested. Regression/harness PASS; runtime membuktikan laporan satu plot, `Batal` audit sahaja, `Betulkan` one-shot, pengaktifan allocation melalui Transplant, serta Banci dua plot. `BSE-TG-146694362` diretrieve sebagai `M2P1: 93 pokok`; `BSE-TG-146694372` diretrieve sebagai `M2P1: 92 pokok, M2P2: 88 pokok`. Semua bukti kekal `production_write:false`. |
| Fasa 2C-2B — Rawatan sebenar | Dedicated closure 2026-10-06 | TEST runtime PASS. Treatment-specific closure 13/13 PASS merangkumi D-043 state/date/dose/no-invention, deterministic router, ACTIVE allocation dan review safety. Full I-011 regression 22/22 PASS; independent Sheet read-back mengesahkan `production_write:false`. Temporary TEST_ONLY probe dibuang dan Apps Script TEST HEAD dipulihkan kepada canonical source. |
| I-011 regression | `3a3770c` | TEST runtime PASS: `runBseI011ImplementationOnly` 17/17 PASS dan `runBseI011FullRegression` 22/22 PASS, 0 FAIL, `production_write:false`. Kedua-dua bukti runtime dibuat melalui custom-function TEST_ONLY dalam workbook `Kerani_AI_BSE_SB_TEST`, dibaca semula secara bebas, kemudian sheet probe dan wrapper sementara dibuang. |
| Real-message field test | branch `test/real-message-field` | TEST runtime PASS 13/13 menggunakan pola mesej operasi BSE sebenar: claim petrol, Baja In, Baja Out F/N multi-record, `ambil baja` tanpa item/kuantiti, stock count dripper, leave `20 September`, maintenance paip, plant condition, image-only disease guard, transplant guard, dan treatment list. Full regression selepas perubahan kekal 22/22 PASS; `production_write:false`. Dua gap yang ditemui semasa field test dibetulkan: tarikh cuti nama bulan dan split F+N merentas plot. |

Fasa 2C-2A dan 2C-2B ialah sebahagian 2C-2. Baki 2C-2 belum dibekukan untuk PILOT; per stable ZASS D-049, Fasa 2C-3 ialah `DEFERRED` untuk first pilot.
Semua checkpoint di atas kekal TEST-only;
ia bukan bukti bahawa production-ready, pilot accepted, atau final handover telah
dicapai.

## Jadual kerja mengikut dependency

| Trek | Urutan kerja bergantung | Status semasa |
|---|---|---|
| A. Domain / pilot entry | 2C-2A -> 2C-2B -> MVP scope freeze -> PILOT_TEST | 2C-2A TEST PASS dan committed (`f9da6a2`); 2C-2B dedicated TEST runtime PASS pada 2026-10-06; per stable ZASS D-049, 2C-3 `DEFERRED` dan next gate ialah MVP scope freeze bagi baki 2C-2 / Fasa 3–8. |
| B. Platform | File Evidence architecture -> registration gate -> File Evidence TEST -> PM retrieval -> owner/admin registry + Telegram human review -> text reporting | Registration gate, intake/Drive Evidence, dan PM retrieval telah diimplementasi serta runtime-tested dalam TEST. Google Tasks/Task List telah dikeluarkan daripada MVP/shadow pilot oleh D-027; tiada replacement reminder tersirat. |

Tiada waktu scheduler laporan ditetapkan dalam dokumen ini. Ia mesti diputuskan
berasingan semasa reka bentuk/pilot reporting, bersama timezone, penerima, dan
kaedah pemulihan kegagalan.

## Syarat selesai dan production gate

Setiap item hanya boleh ditanda selesai apabila mempunyai commit, ujian relevan,
dan bukti runtime apabila item itu melibatkan runtime atau integrasi Apps Script.
Semua perubahan mesti kekal TEST-only sehingga production gate diluluskan.

Status production ialah **belum layak**. Sebelum sebarang final handover,
OpsMate memerlukan pilot kerja sebenar, bukti penerimaan BSE, dan kelulusan
production gate yang berasingan. Google Task completion tidak pernah menjadi
kelulusan automatik atau bukti penerimaan pilot.
