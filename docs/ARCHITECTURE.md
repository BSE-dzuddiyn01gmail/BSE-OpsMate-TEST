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
  -> Gemini unified parser + guard
  -> WAITING_INFO atau NEEDS_HUMAN_REVIEW
  -> Google Tasks TEST review task
  -> Telegram reminder bagi task belum selesai
  -> keputusan human review yang eksplisit
  -> TEST log + TEST review audit sahaja
```

1. `receiveBseTelegramTest()` menerima mesej daripada chat/user TEST yang
   dibenarkan dan menyimpannya dalam `TELEGRAM_TEST_QUEUE`.
2. `processBseTelegramTestQueue()` memproses satu laporan queue pada satu masa.
   Ia menjalankan `bseUnifiedProcess_()` dan `bseUnifiedGuard_()`, kemudian
   menyimpan `candidate_json`.
3. Hasil dengan medan hilang menjadi `WAITING_INFO`; jawapan Telegram yang
   dipautkan diproses semula bersama laporan asal. Hasil lengkap yang memerlukan
   semakan menjadi `NEEDS_HUMAN_REVIEW`.
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
| `MEASUREMENT_APPROVED_TEST` | Calon Measurement telah diluluskan dan ditulis ke TEST sahaja. |
| `MEASUREMENT_REJECTED_TEST` | Calon Measurement ditolak; audit sahaja disimpan. |
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
