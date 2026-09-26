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
| Reminder Telegram harian | `cc20f3d` | Siap TEST dan runtime-tested. |
| Pengesahan penghantar & Delete owner | Belum committed | Kad group penghantar, notis PM, dan `/delete` dua-pengesahan (VOIDED_TEST) siap TEST; runtime-tested untuk Inventory. |
| Fasa 2C-2A — Banci Pokok | Belum committed | Implemented locally / pending runtime; regression PASS. |
| Fasa 2C-2B — Rawatan sebenar | Belum committed | Implemented locally / pending runtime; regression PASS. |

Fasa 2C-2A ialah sebahagian kecil 2C-2. Baki 2C-2 dan Fasa 2C-3 belum mula.
Semua checkpoint di atas kekal TEST-only;
ia bukan bukti bahawa production-ready, pilot accepted, atau final handover telah
dicapai.

## Jadual kerja mengikut dependency

| Trek | Urutan kerja bergantung | Status semasa |
|---|---|---|
| A. Domain | 2C-2A -> 2C-2B -> baki 2C-2 -> 2C-3 -> Fasa 3–8 | 2C-2A dan 2C-2B implemented locally / pending runtime; baki 2C-2, 2C-3, dan Fasa 3–8 belum dimulakan. |
| B. Platform | Task List mengikut pemilik -> private retrieval -> text reporting -> File Evidence -> inventori/claim minimum | Planned; setiap langkah hanya bermula selepas kontrak keselamatan, schema, dan acceptance test langkah terdahulu jelas. |

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
