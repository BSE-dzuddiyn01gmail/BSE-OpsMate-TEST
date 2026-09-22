# BSE OpsMate TEST Architecture

## Tujuan dan sempadan

BSE OpsMate dalam repositori ini ialah workflow **TEST-only** untuk menerima
laporan Telegram, membentuk calon rekod dengan Gemini, meminta semakan manusia,
dan menyimpan hasil yang diluluskan ke helaian TEST sahaja. Semua hasil Gemini
dan aliran review mesti mengekalkan `production_write: false`. Tiada fungsi
semasa dibenarkan menulis rekod production.

## Aliran kerja

```text
Telegram private chat TEST
  -> TELEGRAM_TEST_QUEUE
  -> Site A jelas: OUT_OF_SCOPE_TEST, acknowledgement, dan berhenti
  -> Kolam <nombor>: ASSET_OBSERVATION_UNSUPPORTED_TEST, acknowledgement, dan berhenti
  -> Gemini unified parser + guard
  -> WAITING_INFO atau NEEDS_HUMAN_REVIEW
  -> Google Tasks TEST review task
  -> Telegram reminder bagi task belum selesai
  -> keputusan human review yang eksplisit
  -> TEST log + TEST review audit sahaja
```

1. `receiveBseTelegramTest()` menerima mesej daripada chat/user TEST yang
   dibenarkan dan menyimpannya dalam `TELEGRAM_TEST_QUEUE`. Mesej yang menyebut
   `Site A` dengan jelas ditandakan `OUT_OF_SCOPE_TEST`, menerima acknowledgement
   luar skop, dan tidak dihantar ke Gemini atau worker. Jika bukan Site A tetapi
   menyebut `Kolam <nombor>` dengan jelas, mesej ditandakan
   `ASSET_OBSERVATION_UNSUPPORTED_TEST`, menerima acknowledgement pemerhatian
   aset belum disokong, dan juga berhenti sebelum Gemini atau worker.
2. `processBseTelegramTestQueue()` memproses satu laporan queue pada satu masa.
   Ia menjalankan `bseUnifiedProcess_()` dan `bseUnifiedGuard_()`, kemudian
   menyimpan `candidate_json`.
3. Final validation `NEED_INFO` sentiasa menjadi `WAITING_INFO` dan tidak layak
   untuk Google Task review. Hanya final `PASS` dengan calon actionable menjadi
   `NEEDS_HUMAN_REVIEW` dan layak untuk Google Task. Hasil dengan medan hilang
   menjadi `WAITING_INFO`; jawapan Telegram yang
   dipautkan diproses semula bersama laporan asal. Jika jawapan menyumbang fakta
   calon, `original_note` audit menyimpan laporan asal dan semua jawapan ikut
   turutan; konflik crop atau variety semaian menjadi `NEEDS_INFO`, bukan PASS.
   Hasil lengkap yang memerlukan semakan menjadi `NEEDS_HUMAN_REVIEW`.
4. `syncBseTelegramTestReviewTasks_()` mencipta atau mendeduplikasi Google Task
   dalam senarai `BSE TEST Review` untuk row `NEEDS_HUMAN_REVIEW` selepas
   cutover TEST.
5. `processBseTelegramTestReminders()` menyemak task yang belum selesai dan
   menghantar maksimum dua peringatan sehari, dengan sela minimum empat jam.
6. Reviewer membuat keputusan melalui menu BSE TEST. Keputusan ini, bukan
   status Google Task, mengawal penulisan ke helaian TEST.

## Google Tasks ialah peringatan sahaja

Google Tasks digunakan untuk menarik perhatian reviewer kepada rujukan
`BSE-TG-<update_id>`. Menanda task sebagai selesai tidak meluluskan calon,
tidak mengemas kini status queue, dan tidak menulis rekod apa-apa. Pada run
reminder seterusnya, task selesai hanya direkodkan sebagai `COMPLETED` dalam
`TELEGRAM_TEST_REMINDER_AUDIT`.

## Status penting

| Status | Maksud |
|---|---|
| `QUEUED` | Laporan diterima dan menunggu worker. |
| `PROCESSING` | Worker sedang memproses laporan. |
| `RETRY_NEEDED` | Panggilan Gemini atau output perlu dicuba semula. |
| `RESULT_REPLY_PENDING` | Hasil telah disimpan tetapi balasan Telegram belum dihantar. |
| `WAITING_INFO` | Medan wajib belum lengkap; bot meminta penjelasan. |
| `NEEDS_HUMAN_REVIEW` | Hasil tersedia untuk semakan manusia dan Google Task. |
| `OUT_OF_SCOPE_TEST` | Mesej jelas Site A; direkod untuk audit tetapi berhenti sebelum Gemini, worker, dan Google Tasks. |
| `ASSET_OBSERVATION_UNSUPPORTED_TEST` | Mesej jelas Kolam <nombor> di luar workflow aset Fasa 1; direkod untuk audit tetapi berhenti sebelum Gemini, worker, dan Google Tasks. |
| `MEASUREMENT_APPROVED_TEST` | Calon Measurement telah diluluskan dan ditulis ke TEST sahaja. |
| `MEASUREMENT_REJECTED_TEST` | Calon Measurement ditolak; audit sahaja disimpan. |
| `CROP_BATCH_APPROVED_TEST` | Proposal batch semaian diluluskan dan hanya rekod TEST ditulis. |
| `CROP_BATCH_REJECTED_TEST` | Proposal batch semaian ditolak; audit TEST sahaja disimpan. |
| `TRANSPLANT_APPROVED_TEST` | Proposal pindah anak pokok diluluskan dan hanya event/status TEST ditulis. |
| `TRANSPLANT_REJECTED_TEST` | Proposal pindah anak pokok ditolak; audit TEST sahaja disimpan. |
| `OBSERVATION_APPROVED` / `OBSERVATION_REJECTED` | Keputusan workflow Observation TEST sedia ada. |
| `NEEDS_ATTENTION` | Had retry worker telah dicapai. |

## Fasa 1: Measurement human review

Menu berikut meminta rujukan tepat `BSE-TG-<update_id>`:

- `Lulus Measurement ikut rujukan`
- `Tolak Measurement ikut rujukan`

Fasa 1 hanya menerima satu calon tunggal `Measurement_Log` yang mempunyai
`validation: PASS`, `missing` kosong, `record_type: MEASUREMENT`,
`verification_status: PROVISIONAL`, dan `production_write: false`. Medan
`event_date`, `plot_id`, `measurement_type`, serta `value` mesti sah.

Identity dedup ialah:

```text
update_id|candidate_index|Measurement_Log
```

Hash stabil payload digunakan untuk mengesan perubahan. Tindakan sama adalah
idempotent; keputusan berlainan atau hash berlainan bagi identity sama ialah
konflik yang ditolak.

`APPROVED` menulis tepat satu rekod ke `TEST_MEASUREMENT_LOG`, menulis audit ke
`TEST_MEASUREMENT_REVIEW`, kemudian menetapkan queue kepada
`MEASUREMENT_APPROVED_TEST`. `REJECTED` memerlukan alasan, hanya menulis audit,
dan kemudian menetapkan `MEASUREMENT_REJECTED_TEST`. Kedua-dua laluan menggunakan
`ScriptLock`; queue tidak dikemas kini sebelum write TEST/audit selesai.

## Helaian TEST dan audit

Helaian operasi TEST utama ialah:

- `TELEGRAM_TEST_QUEUE` - input, status, rantaian clarification, dan
  `candidate_json`.
- `GOOGLE_TASKS_TEST_AUDIT` - task review yang dicipta/dideduplikasi.
- `TELEGRAM_TEST_REMINDER_AUDIT` - penghantaran reminder dan state `COMPLETED`.
- `TEST_MEASUREMENT_LOG` - rekod Measurement yang diluluskan dalam TEST.
- `TEST_MEASUREMENT_REVIEW` - keputusan reviewer Measurement, alasan, hash, dan
  payload audit.
- `TEST_OBSERVATION_LOG` dan `TEST_OBSERVATION_REVIEW` - workflow Observation
  TEST sedia ada.
- `TEST_CROP_BATCH`, `TEST_PLANTING_EVENT`, `TEST_PLOT_ALLOCATION`, dan
  `TEST_CROP_BATCH_REVIEW` - rekod dan audit human review Crop Batch Fasa 2B.
- `TEST_TRANSPLANT_EVENT`, `TEST_ALLOCATION_STATUS_EVENT`, dan
  `TEST_TRANSPLANT_REVIEW` - event, ledger perubahan allocation, dan audit
  human review Transplant Fasa 2C-1.

## Workflow Git dan clasp

Urutan wajib bagi perubahan Apps Script ialah:

```text
ubah kod -> uji sintaks/semakan berkaitan -> clasp push ke TEST
-> git add fail yang tepat -> git commit -> git push
```

Jangan stage `.clasp.json`, token, API key, atau konfigurasi tempatan. Gunakan
`git status --short` sebelum dan selepas commit untuk memastikan skop tepat.
`clasp push` menolak sumber Apps Script ke projek TEST; `git push` menolak
sejarah sumber ke GitHub. Kedua-duanya ialah tindakan berasingan.

## Sempadan semasa dan Fasa 2

Fasa 1 hanya meliputi `Measurement_Log`. Google Task selesai masih bukan
keputusan review, dan rujukan yang mempunyai lebih daripada satu calon tidak
boleh diluluskan melalui vertical slice ini.

Fasa 2 perlu menggeneralisasikan semakan mengikut calon bagi:

- `Observation_Log`
- `Operation_Log`
- `Input_Usage_Log`
- `Decision_Approval_Log`

Setiap target memerlukan validator kontrak sendiri, TEST log sendiri, audit
keputusan yang idempotent, dan status queue yang tidak menyiratkan kelulusan
target lain. Tiada generalisasi boleh menambah production writer tanpa reka
bentuk, ujian, dan kelulusan eksplisit yang berasingan.

Pemerhatian aset seperti Kolam 1 bukan `plot_id` dan bukan sebahagian daripada
workflow Fasa 1. Ia menerima status unsupported sebelum Gemini. Fasa 2
memerlukan target, schema, registry site/aset, validator, audit, dan TEST log
yang berasingan.

### Fasa 2A: proposal Crop Batch sahaja

Fasa 2A menambah kontrak Gemini dan guard TEST-only bagi laporan jelas
`KERJA SEMAIAN BENIH`. Ia menghasilkan satu proposal atomik yang mengandungi
tepat satu calon `Crop_Batch_Log` (`BATCH_START`), satu
`Planting_Event_Log` (`SEED_SOWING`), dan satu atau lebih
`Plot_Allocation_Log`. Baris `Modul:` yang kanonik ialah satu-satunya sumber
plot: `Modul: M1 P1 P2` menjadi `M1P1` dan `M1P2`; Gemini tidak boleh mencipta
atau menggabungkan plot di luar set itu.

Allocation daripada semaian sentiasa `PLANNED`, bukan `ACTIVE`. `ACTIVE` hanya
boleh dipertimbangkan bagi event pindah/penanaman sebenar dalam Fasa 2C. Jika
format Modul, crop, variety, tarikh semai, atau set calon atomik tidak sah,
guard mengeluarkan `NEED_INFO`. Fasa 2A belum mempunyai TEST writer, dedup,
Google Task khusus, atau human-review batch; ia tidak menambah sebarang
penulisan production dan tidak mengubah maksud Google Task sebagai peringatan
sahaja.

### Fasa 2B: human review Crop Batch TEST

Menu `Lulus Crop Batch ikut rujukan` dan `Tolak Crop Batch ikut rujukan`
menerima hanya `BSE-TG-<update_id>` yang berstatus `NEEDS_HUMAN_REVIEW`.
Review memerlukan proposal atomik yang sah: tepat satu `Crop_Batch_Log`
`BATCH_START`, satu `Planting_Event_Log` `SEED_SOWING`, dan allocation
`PLANNED` yang unik serta diisih secara kanonik. Target lain, plot tidak
kanonik, atau output Gemini yang tidak lengkap ditolak.

Identity dedup menggunakan rujukan Telegram asal dan target
`Crop_Batch_Log`; hash stabil dibina daripada batch, event, dan allocation yang
telah dikanonkan. Di bawah `ScriptLock`, APPROVED mencipta satu batch ID
`BSE-SB-CB-YYYYMMDD-###`, satu row `TEST_CROP_BATCH`, satu
`TEST_PLANTING_EVENT`, dan semua row `TEST_PLOT_ALLOCATION`, kemudian audit
`TEST_CROP_BATCH_REVIEW`, sebelum status queue menjadi
`CROP_BATCH_APPROVED_TEST`. REJECTED memerlukan alasan, hanya menulis audit,
kemudian menjadi `CROP_BATCH_REJECTED_TEST`.

Fasa ini kekal TEST-only: tiada production writer atau panggilan Google Tasks
daripada reviewer/writer. Google Task, jika wujud daripada aliran queue,
kekal peringatan dan bukan kelulusan automatik.

### Fasa 2C-1: Transplant / Pindah Anak Pokok TEST

Frasa jelas `pindah anak pokok` menghasilkan satu proposal
`Transplant_Event_Log` sahaja: `TRANSPLANT`, `PROPOSED`, dan
`PROVISIONAL`. Crop wajib, variety opsyenal. Parser deterministik menerima
token compact `M1P34` sebagai dua plot `M1P3` dan `M1P4`; format tiga atau
lebih digit selepas `P` ditolak sebagai samar. Jika tiada `Tarikh Pindah:`
yang sah, `event_date` datang daripada `received_at` Telegram dalam zon
`Asia/Kuala_Lumpur`.

Sebelum menjadi `NEEDS_HUMAN_REVIEW`, worker membandingkan crop dengan trim,
collapse whitespace, dan case-insensitive sahaja. Tepat satu batch TEST yang
diluluskan mesti mengandungi semua plot dilaporkan sebagai allocation
`PLANNED`. Crop tiada, padanan tiada/berganda, atau allocation bukan `PLANNED`
menjadi `WAITING_INFO`; tiada write dibuat.

Menu `Lulus Transplant ikut rujukan` dan `Tolak Transplant ikut rujukan`
memerlukan rujukan tepat `BSE-TG-<update_id>`. APPROVED, di bawah `ScriptLock`,
menulis satu `TEST_TRANSPLANT_EVENT` dengan `COMPLETED` dan `VERIFIED_TEST`,
serta satu event ledger `PLANNED -> ACTIVE` untuk setiap plot yang diluluskan.
`TEST_PLOT_ALLOCATION` asal tidak pernah diubah, jadi aktivasi sebahagian batch
mengekalkan sejarah dan allocation PLANNED lain. REJECTED memerlukan alasan dan
hanya menulis audit. Identity dedup ialah rujukan Telegram asal +
`Transplant_Event_Log`; hash payload kanonik bersama batch ID menolak konflik
dan menjadikan retry idempotent. Tiada reviewer/writer Fasa 2C-1 memanggil
Google Tasks atau menulis production.
