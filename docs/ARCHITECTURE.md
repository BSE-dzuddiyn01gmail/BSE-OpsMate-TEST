# OpsMate BSE site B v1.0 Final Handover — Architecture

## Tujuan dan sempadan

BSE OpsMate dalam repositori ini ialah workflow **TEST-only** untuk menerima
laporan Telegram, membentuk calon rekod dengan Gemini, meminta semakan manusia,
dan menyimpan hasil yang diluluskan ke helaian TEST sahaja. Semua hasil Gemini
dan aliran review mesti mengekalkan `production_write: false`. Tiada fungsi
semasa dibenarkan menulis rekod production.

## Scope lock v1.0 dan production gate

Nama rasmi projek ialah **OpsMate BSE site B v1.0 Final Handover**. Implementasi
semasa ialah TEST-only; ia belum production-ready dan belum merupakan final
handover. Sebarang peralihan ke production memerlukan production gate berasingan,
pilot kerja sebenar, dan penerimaan BSE yang didokumenkan. Google Task completion
bukan approval, access control, atau bukti penerimaan pilot.

Keputusan terkunci bagi shadow pilot MVP selepas checkpoint TEST ialah di
[`SHADOW_PILOT_MVP_HANDOVER.md`](SHADOW_PILOT_MVP_HANDOVER.md). Ia menetapkan
tiga environment (`TEST`, `PILOT_TEST`, `PILOT_OPERATION`), questionnaire
penilaian admin/team operasi, dan handover kepada BSE/team IT tanpa penulisan
atau integrasi terus ke sistem rasmi BSE.

Scope lock platform yang diluluskan untuk roadmap ialah:

- Google Tasks dikeluarkan daripada MVP/shadow pilot melalui ZASS D-027.
  Owner registry kekal untuk identity/authorization/notification routing sahaja;
  MVP tidak menjamin automatic pending-review reminder dan tidak boleh menggantinya
  secara senyap dengan subsystem lain;
- retrieval hanya diterima dalam PM bot daripada user berdaftar dan aktif;
  permintaan retrieval dalam group ditolak dengan arahan minimum untuk PM;
- reporting text-only: daily delta, Friday Report A (provisional + approved),
  dan Report B (approved-only). Waktu scheduler belum diputuskan;
- File Evidence: gambar/dokumen/video -> caption -> kategori dicadang ->
  pengesahan manusia -> Google Drive + metadata + retrieval. v1.0 tidak
  merangkumi OCR, Vision, atau transkripsi;
- inventori/claim hanya log rujukan, bukan rekod stok atau kewangan rasmi.
- `TEST_CLAIM_LOG` menggunakan header kanonik yang mengekalkan identiti Telegram
  penuntut tepat selepas `claimant`; migrasi TEST yang dikenali menyusun data
  legacy mengikut nama header sebelum writer Claim digunakan.

## PILOT_TEST environment adapter dan isolation boundary

Pelaksanaan first-pilot menggunakan source TEST yang sama melalui adapter runtime
yang eksplisit, bukan dengan menunjuk source TEST secara terus kepada workbook
pilot. `EnvironmentTest.js` memegang kontrak environment berikut:

- `TEST` kekal default compatibility environment;
- `PILOT_TEST` hanya boleh resolve kepada workbook dan Evidence folder pilot yang
  telah dibind secara eksplisit;
- setiap `boundTestBook_()` mesti memanggil `bseRuntimeAssertWorkbookId_()`
  sebelum writer mendapat akses kepada workbook;
- nama target legacy `TEST_*` dipetakan secara deterministik kepada
  `PILOT_TEST_*`, manakala `TELEGRAM_TEST_QUEUE` dipetakan kepada
  `PILOT_TEST_TELEGRAM_QUEUE`;
- PILOT_TEST Evidence tidak boleh auto-create fallback folder; folder ID mesti
  sepadan dengan binding pilot yang dikunci;
- property Telegram group/chat PILOT_TEST berasingan daripada TEST, dan output
  Telegram PILOT_TEST dilabel `[PILOT TEST]`;
- pemasangan automation trigger ditolak semasa controlled setup/replay;
- semua environment kekal `production_write:false` dan
  `official_bse_write:false`.

Apps Script manifest tidak lagi mengaktifkan Google Tasks advanced service,
selaras dengan D-027. Runtime isolation checkpoint 2026-10-06 membuktikan full
regression 23/23 PASS dalam TEST dan 23/23 PASS dalam PILOT_TEST. Apps Script
PILOT_TEST juga membuat write TEST_ONLY sebenar ke target pilot yang dipetakan,
diikuti independent Sheet read-back; workbook TEST salah ditolak sebelum fake
writer boleh dipanggil. Tiada probe sheet ditinggalkan selepas cleanup. Bukti
terperinci direkodkan dalam `docs/PILOT_TEST_RUNTIME_ISOLATION_EVIDENCE.md`.
Controlled replay telah bermula dalam PILOT_TEST. Run `PTR-20261006-001` menemui dua mismatch parser; selepas fix TEST merged `482779f`, rerun `PTR-20261006-002` mencapai 10/10 boundary-correct PASS. Dependency-required Crop/Transplant/Census review paths kemudian diselesaikan dalam `PTR-20261006-003`, termasuk PLANNED→ACTIVE lineage dan Banci terhadap ACTIVE allocation. Semua TEST_ONLY prerequisite/proof rows dibersihkan selepas independent read-back. Comparator yang sebelum ini `OPEN_CONTROLLED` kini sama ada dibind kepada sumber sebenar dengan had eksplisit atau diklasifikasikan `LEGACY_MISSING`; tiada comparator direka. Bukti direkodkan dalam `docs/PILOT_TEST_DEPENDENCY_COMPARATOR_EVIDENCE.md`. Telegram pilot/smoke sebenar telah LIVE PASS: dua mesej standard diterima tepat sekali; flow terkini menghantar ACK dan kad pengesahan, kemudian mencapai `APPROVED_TEST / VERIFIED_TEST` selepas pelapor memilih `Benar`, tanpa production write. Bukti canonical direkodkan dalam `ACTION_PLAN.md`.

## Keputusan terkunci: pengesahan penghantar dan pembatalan owner

- Laporan lengkap kekal dalam group. Kad `Benar` / `Betulkan` / `Batal` dihantar
  sebagai reply dalam group dan hanya boleh ditindak oleh penghantar asal.
- `Benar` penghantar ialah syarat sebelum rekod TEST diwujudkan. Owner/admin
  tidak menerima kad kelulusan rutin; setiap owner aktif menerima PM ringkasan
  bagi rekod yang telah diwujudkan, termasuk arahan `/delete` tepat untuk
  rujukan tersebut. Makluman menyatakan nama paparan Telegram penghantar;
  jika tiada, ia menggunakan `@username` atau ID Telegram sebagai fallback.
- Resit dan perubahan status dihantar melalui PM kepada penghantar hanya jika
  penghantar telah menjalankan `/start`; ketiadaan opt-in tidak menghalang
  rekod group yang telah disahkan daripada diproses.
- `Batal` penghantar menghasilkan audit `DISCARDED_BY_REPORTER` sahaja, tanpa
  rekod domain atau makluman owner.
- Owner/admin aktif boleh memulakan pembatalan melalui PM dengan
  `/delete BSE-TG-<update_id> <alasan>`. Bot mesti meminta pengesahan kedua
  `Sahkan Delete` / `Batal`. Tindakan disimpan sebagai `VOIDED_TEST`, bukan
  pemadaman fizikal; alasan, pelaku, masa dan rujukan asal wajib diaudit.
  Selepas keputusan `Sahkan Delete` atau `Batal`, kad PM ditutup dan teksnya
  menjadi status terminal. Selepas `VOIDED_TEST`, makluman dihantar kepada
  semua owner/admin aktif serta penghantar yang telah opt-in PM.
  Laluan awal ini hanya membolehkan writer yang telah mempunyai status TEST
  yang boleh dibatalkan dengan selamat (Inventory, Claim, dan proposal Aset).
  Target yang mempunyai ledger atau kesan rentas-rekod ditolak dengan jelas
  sehingga void writer khususnya direka; ia tidak boleh dipadam secara senyap.

## Keputusan terkunci: pendaftaran, PM retrieval, dan File Evidence

Keputusan ini dikunci oleh Project Owner pada 2026-09-29 untuk implementasi
TEST seterusnya. ZASS autoritatif kekal di stable repository; bahagian ini
merekodkan kontrak implementasi TEST dan bukan sumber ZASS yang kedua.

- `/start BSE_TEST` dalam PM mencipta `REGISTRATION_PENDING`, bukan akses.
  Semua owner/admin aktif menerima kad `TERIMA` / `TOLAK`; keputusan sah
  pertama adalah idempotent, menutup kad lain, dan menghantar tepat satu
  makluman kepada pemohon. Identiti access control ialah Telegram numeric user
  ID; username dan nama paparan hanyalah label.
- `TERIMA` menghasilkan `REGISTERED_ACTIVE` dan memautkan user kepada
  `DEFAULT_OPERATIONAL_GROUP_CHAT_ID` tunggal. Bot tidak menambah ahli ke
  group Telegram; PM penerimaan hanya mengarahkan ahli baharu untuk join group
  melalui owner/admin. `TOLAK` atau `REGISTRATION_PENDING` tidak boleh
  retrieval atau menghantar data/evidence PM; respons minimum ialah meminta
  mereka menghubungi admin.
- Retrieval hanya melalui PM dan hanya untuk `REGISTERED_ACTIVE`. Permintaan
  group tidak mengembalikan data, summary, bukti, atau pautan Drive. Owner/admin
  sahaja boleh menerima, menolak, menyahaktifkan, atau menukar peranan user.
- `\/status plot M<n>P<n>` ialah retrieval PM ringkas untuk owner/admin atau
  `REGISTERED_ACTIVE`. Ia membaca allocation ACTIVE yang telah diluluskan,
  banci terakhir, dan rawatan terakhir daripada helaian TEST sahaja, lalu
  merekod audit. Permintaan sama dalam group hanya menerima arahan minimum
  untuk menggunakan PM; tiada data plot dipulangkan. Ia bukan query bebas ke
  Sheet, Drive, atau rekod production.
- `\/summary plot M<n>P<n>,M<n>P<n>` menerima dua hingga enam plot unik melalui
  PM yang sama dan memberi rumusan padat setiap plot. Ia menggunakan bacaan
  dan audit TEST yang sama; status tiada atau ambigu dipaparkan sebagai keadaan
  selamat, bukan diteka.
- Rekod daripada group yang berkategori standard (`FIELD_OPERATION`,
  `CROP_CONDITION`, `ASSET_EQUIPMENT`) boleh diretrieve melalui PM oleh semua
  user aktif. Rekod PM ialah `PRIVATE_SUBMISSION`; ia hanya boleh diretrieve
  oleh penghantar asal dan owner/admin. `INVENTORY_CLAIM`, `ADMIN_DOCUMENT`,
  dan `UNCLASSIFIED_TEST` ialah restricted bagi retrieval walaupun asalnya
  group. Sistem tidak boleh menyembunyikan mesej asal yang pengguna sendiri
  telah hantar ke group.
- `\/retrieve BSE-TG-<update_id>` ialah retrieval PM tepat bagi rekod Telegram
  yang telah `REPORTER_CONFIRMED`. Ia membaca barisan queue dan kad pengesahan
  TEST sahaja, mengesahkan hash payload, dan menolak rujukan kabur, belum
  disahkan, atau payload yang tidak utuh. `FIELD_OPERATION` dan
  `ASSET_EQUIPMENT` daripada group boleh dibaca oleh semua ahli aktif;
  `INVENTORY_CLAIM`, `PRIVATE_SUBMISSION`, dan `UNCLASSIFIED_TEST` hanya untuk
  penghantar asal atau owner/admin. Ringkasan menggunakan field calon yang
  dibenarkan sahaja—bukan mesej asal—dan setiap cubaan diaudit tanpa domain
  write atau production write.
- File Evidence menerima hanya PHOTO, DOCUMENT, atau VIDEO bersama caption/teks.
  Kategori dicadang daripada caption/teks sahaja dan penghantar mengesahkan
  `Benar` / `Betulkan` / `Batal` dalam chat asal. Hanya selepas `Benar`, fail
  asal disimpan ke Drive TEST bersama metadata/audit; `Batal` tidak menghasilkan
  Drive write atau makluman group.
- PM submission hanya dibenarkan untuk `REGISTERED_ACTIVE`; ia menggunakan kad
  pengesahan PM. Selepas `Benar`, owner/admin menerima butiran PM dan group
  lalai menerima makluman minimum dengan nama penghantar sahaja—tanpa caption,
  kategori, rujukan, nama fail, pautan Drive, atau kandungan. Fail dan butiran
  private kekal diketahui oleh penghantar serta owner/admin sahaja.
- Metadata minimum Evidence ialah evidence ID, rujukan sumber, identiti/chat/
  message asal, masa, caption asal, jenis/mime/nama/saiz, kategori, visibility,
  ID Drive, status pengesahan, dan audit. Retrieval menghantar semula bukti
  melalui PM; tiada pautan Drive awam. v1.0 tidak melaksanakan OCR, Vision,
  pembacaan kandungan dokumen, atau transkripsi video.

### Lock PoC 2026-09-29: owner manual, sejarah, laporan Gemini, dan EC

- Bagi PoC ini, Project Owner akan menetapkan setiap user yang perlu akses penuh
  sebagai owner/admin secara manual dalam registry TEST. Tiada bypass role atau
  capability `POC_VIEW_ALL` ditambah. Owner/admin manual menerima semua kuasa
  owner sedia ada, termasuk retrieval rekod restricted, pendaftaran/role, dan
  `/delete`; user tidak aktif kekal tiada akses.
- Telegram command registry TEST memaparkan hanya command yang telah
  diimplementasi: `/start`, `/status`, `/summary`, `/retrieve`, dan `/delete`.
  `/history` serta `/report` ditambah ke menu serentak dengan implementasinya.
  Semua command tetap menguatkuasakan autorisasi pada runtime; menu bukan bukti
  kuasa akses.
- `\/history YYYY-MM-DD` dan `\/history YYYY-MM` ialah retrieval PM owner/admin
  bagi rekod TEST canonical dalam sela masa tepat. Secara default ia mengecualikan
  `VOIDED_TEST`, mengehadkan respons, menyembunyikan mesej asal/payload penuh,
  dan mengaudit setiap permintaan. Rekod restricted termasuk Claim tersedia
  kepada owner/admin manual sepanjang PoC ini.
- `\/report YYYY-MM-DD` dan `\/report YYYY-MM` ialah laporan ad-hoc PM sahaja.
  Ia menghantar fakta canonical TEST dalam sela masa tersebut bersama komen
  Gemini yang dilabel jelas; Gemini tidak boleh mencipta fakta, approval, atau
  domain write. Kegagalan Gemini tidak menghalang fakta canonical daripada
  dipulangkan, dan alasan kegagalan diaudit tanpa credential. Ia bukan scheduler.
- Banci Pokok khusus (2C-2A) dan Rawatan sebenar khusus (2C-2B) telah mencapai
  dedicated regression dan Apps Script TEST runtime PASS. Rawatan 2C-2B mengikuti
  kontrak ZASS D-043: bagi workflow treatment-list BSE yang telah ditetapkan,
  wording sejarah seperti `CADANGAN MERACUN` tidak menentukan state; rekod ialah
  treatment yang sudah dibuat di plot, tertakluk kepada pengesahan penghantar,
  audit, validation ACTIVE allocation, dan `production_write:false`.
- EC Leaching ialah target TEST baharu yang berasingan, `EC_Leachate_Log`.
  Tarikh `DD/MM/YYYY` dan sesi `PAGI` atau `PETANG` adalah wajib. `x : x`
  disimpan sebagai `NOT_MEASURED`; `AK` bermaksud `EC_IN_NEXT=0` dengan status
  `AK_ZERO`; nombor EC ialah perpuluhan bukan-negatif. `M7 - x : x` direkod
  sebagai scope modul `M7`, bukan diteka sebagai plot. Setiap laporan EC ialah
  batch atomik yang memerlukan pengesahan penghantar, hash/dedup, audit, dan
  `ScriptLock`; ia tidak menulis production. Jika penghantar memilih
  `Betulkan`, mesej biasa seterusnya mesti merupakan laporan EC penuh yang
  menggantikan laporan asal. Hanya laporan pembetulan terbaru diparse; laporan
  asal dan pembetulan tidak pernah digabungkan sebagai set bacaan yang sama.
  EC yang dihantar dari group ialah `FIELD_OPERATION` standard untuk retrieval
  ahli aktif yang dibenarkan; penghantaran PM kekal `PRIVATE_SUBMISSION` dan
  tertakluk kepada polisi asal penghantar/owner.

Butiran pelaksanaan, dependency, dan status roadmap direkodkan dalam
`docs/DEVELOPMENT_STATUS.md`.

## Aliran kerja

```text
Telegram private chat TEST
  -> TELEGRAM_TEST_QUEUE
  -> Site A jelas: OUT_OF_SCOPE_TEST, acknowledgement, dan berhenti
  -> Kolam <nombor>: ASSET_OBSERVATION_UNSUPPORTED_TEST, acknowledgement, dan berhenti
  -> Gemini unified parser + guard
  -> WAITING_INFO atau NEEDS_HUMAN_REVIEW
  -> keputusan human review yang eksplisit melalui workflow Telegram/TEST
  -> TEST log + TEST review audit sahaja
```

1. `receiveBseTelegramTest()` menerima mesej daripada chat/user TEST yang
   dibenarkan dan menyimpannya dalam `TELEGRAM_TEST_QUEUE`. Mesej yang menyebut
   `Site A` dengan jelas ditandakan `OUT_OF_SCOPE_TEST`, menerima acknowledgement
   luar skop, dan tidak dihantar ke Gemini atau worker. Jika bukan Site A tetapi
   menyebut `Kolam <nombor>` dengan jelas, mesej ditandakan
   `ASSET_OBSERVATION_UNSUPPORTED_TEST`, menerima acknowledgement pemerhatian
   aset belum disokong, dan juga berhenti sebelum Gemini atau worker. Hanya
   mesej yang mempunyai lampiran PHOTO, DOCUMENT, atau VIDEO boleh dituntut oleh
   laluan File Evidence; mesej teks biasa yang bukan command atau sesi pembetulan
   sentiasa diteruskan ke queue laporan.
2. `processBseTelegramTestQueue()` memproses satu laporan queue pada satu masa.
   Ia menggunakan deterministic-first routing sebelum fallback Gemini, kemudian
   `bseUnifiedGuard_()` dan menyimpan `candidate_json`. `KERJA SEMAIAN BENIH`
   canonical diparse deterministic-first dan tidak memerlukan Gemini/API key:
   jenis tanaman/varieti, satu baris Modul kanonik, serta Tarikh Semai membentuk
   tepat satu Crop Batch, satu SEED_SOWING event, dan allocation PLANNED bagi
   setiap plot eksplisit. Ia kekal satu Crop Batch atomik bagi setiap mesej. Jika
   satu mesej mengandungi lebih daripada satu blok tanaman/Modul/Tarikh Semai,
   worker fail-closed dan meminta pelapor memecahkannya kepada mesej berasingan;
   mesej itu tidak boleh jatuh ke laluan Rawatan/Treatment atau Gemini fallback.
3. Final validation `NEED_INFO` sentiasa menjadi `WAITING_INFO` dan tidak layak
   untuk Google Task review. Hanya final `PASS` dengan calon actionable menjadi
   `NEEDS_HUMAN_REVIEW` dan layak untuk Google Task. Hasil dengan medan hilang
   menjadi `WAITING_INFO`; jawapan Telegram yang
   dipautkan diproses semula bersama laporan asal. Jika jawapan menyumbang fakta
    calon, `original_note` audit menyimpan laporan asal dan semua jawapan ikut
    turutan; konflik crop atau variety semaian menjadi `NEEDS_INFO`, bukan PASS.
    Hasil lengkap yang memerlukan semakan menjadi `NEEDS_HUMAN_REVIEW`.
   Untuk kad kelulusan `✏️ Betulkan`, callback owner mencipta sesi pembetulan
   tahan lama pada `TEST_TELEGRAM_APPROVAL_UI`, kemudian prompt dihantar sebagai
   reply kepada mesej laporan asal. Mesej biasa seterusnya diterima hanya jika
   tepat satu sesi `CORRECTION_WAITING_INFO` sepadan dengan `reference`,
   `source_group_chat_id`, dan `reporter_telegram_user_id`. Sesi ditutup secara
   one-shot selepas queue child disimpan; chat, pelapor, atau sesi yang tidak
   sepadan tidak boleh mengambil alih dan sesi ambigu menjadi `UNLINKED_REPLY`.
4. Reviewer membuat keputusan melalui workflow Telegram/TEST yang dibenarkan.
   Keputusan human review yang diaudit mengawal penulisan ke helaian TEST. Crop Batch menggunakan shared review core yang sama bagi wrapper Apps Script dan callback Telegram; lock dipegang oleh transaction boundary, bukan domain core. D-048 multi-record splitting tidak memecahkan dependency group Crop Batch: Crop_Batch_Log + Planting_Event_Log + semua Plot_Allocation_Log bagi satu batch kekal satu approval envelope dan satu keputusan Benar/Betulkan/Batal.

## Google Tasks dikeluarkan daripada MVP / shadow pilot

ZASS D-027 (LOCKED 2026-10-04) mensupersede D-006. Google Tasks, Tasks API,
task-list mapping, task-completion polling, dan reminder berasaskan Google Tasks
bukan lagi capability aktif bagi MVP/shadow pilot. Fungsi compatibility shim
boleh kekal sementara untuk mengelakkan caller lama gagal, tetapi ia mesti tiada
side effect Tasks/Telegram/domain write dan mengekalkan `production_write:false`.

Bukti TEST lama berkaitan Google Tasks/reminder kekal sebagai evidence sejarah
sahaja. Ia bukan bukti feature semasa. MVP juga tidak menjamin automatic
pending-review reminder. Sebarang replacement reminder/task integration
memerlukan keputusan ZASS, architecture, regression dan runtime proof baharu.

## Status penting

| Status | Maksud |
|---|---|
| `QUEUED` | Laporan diterima dan menunggu worker. |
| `PROCESSING` | Worker sedang memproses laporan. |
| `RETRY_NEEDED` | Panggilan Gemini atau output perlu dicuba semula. |
| `RESULT_REPLY_PENDING` | Hasil telah disimpan tetapi balasan Telegram belum dihantar. |
| `WAITING_INFO` | Medan wajib belum lengkap; bot meminta penjelasan. |
| `CORRECTION_PROMPT_PENDING` | Callback Betulkan telah dirizabkan tetapi prompt belum disahkan. |
| `CORRECTION_WAITING_INFO` | Sesi pembetulan owner terbuka; hanya satu mesej biasa daripada pelapor/chat asal boleh dipadankan. |
| `CORRECTION_ANSWER_RECEIVED` | Sesi pembetulan telah dituntut dan ditutup selepas jawapan disimpan. |
| `NEEDS_HUMAN_REVIEW` | Hasil tersedia untuk semakan manusia melalui workflow TEST; tiada dependency Google Tasks. |
| `OUT_OF_SCOPE_TEST` | Mesej jelas Site A; direkod untuk audit tetapi berhenti sebelum Gemini, worker, dan human-review workflow. |
| `ASSET_OBSERVATION_UNSUPPORTED_TEST` | Mesej jelas Kolam <nombor> di luar workflow aset Fasa 1; direkod untuk audit tetapi berhenti sebelum Gemini, worker, dan human-review workflow. |
| `MEASUREMENT_APPROVED_TEST` | Calon Measurement telah diluluskan dan ditulis ke TEST sahaja. |
| `MEASUREMENT_REJECTED_TEST` | Calon Measurement ditolak; audit sahaja disimpan. |
| `CROP_BATCH_APPROVED_TEST` | Proposal batch semaian diluluskan dan hanya rekod TEST ditulis. |
| `CROP_BATCH_REJECTED_TEST` | Proposal batch semaian ditolak; audit TEST sahaja disimpan. |
| `TRANSPLANT_APPROVED_TEST` | Proposal pindah anak pokok diluluskan dan hanya event/status TEST ditulis. |
| `TRANSPLANT_REJECTED_TEST` | Proposal pindah anak pokok ditolak; audit TEST sahaja disimpan. |
| `PLANT_CENSUS_APPROVED_TEST` | Banci pokok bagi allocation efektif ACTIVE diluluskan dan ditulis ke TEST sahaja. |
| `PLANT_CENSUS_REJECTED_TEST` | Banci pokok ditolak; audit TEST sahaja disimpan. |
| `TREATMENT_APPROVED_TEST` | Rawatan sebenar bagi allocation efektif ACTIVE diluluskan dan ditulis ke TEST sahaja. |
| `TREATMENT_REJECTED_TEST` | Rawatan sebenar ditolak; audit TEST sahaja disimpan. |
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
- `TEST_TELEGRAM_APPROVAL_UI` - kad owner dan sesi pembetulan tahan lama,
  termasuk ID prompt, ID update jawapan, serta masa penutupan sesi.
- `GOOGLE_TASKS_TEST_AUDIT` - task review yang dicipta/dideduplikasi.
- `TELEGRAM_TEST_REMINDER_AUDIT` - ringkasan penghantaran reminder dan state
  `COMPLETED`; completion tidak mengubah queue atau rekod domain.
- `TELEGRAM_TEST_REMINDER_DEDUP_AUDIT` - marker/audit tahan lama satu cubaan
  per rujukan bagi satu tarikh MYT.
- `TEST_TELEGRAM_EVIDENCE` - metadata Evidence TEST selepas pengesahan
  penghantar; ID fail Telegram kekal sebagai sumber untuk penghantaran semula.
- `TEST_TELEGRAM_RETRIEVAL_AUDIT` - audit PM retrieval bagi Evidence TEST,
  termasuk user/chat peminta, rujukan, outcome, dan sebab penolakan. Ia tidak
  menyimpan atau mendedahkan pautan Drive.
- `TEST_TELEGRAM_RECORD_RETRIEVAL_AUDIT` - audit PM bagi
  `\/retrieve BSE-TG-<update_id>`, termasuk outcome dan sebab akses; ia tidak
  menyimpan mesej asal atau payload penuh.
- `TEST_EC_LEACHATE` - satu row bagi setiap bacaan dalam batch EC yang telah
  disahkan penghantar; setiap row membawa source key, batch ID, hash, status
  pengesahan TEST, dan `production_write=false`.
- `TEST_EC_LEACHATE_REVIEW` - satu audit idempotent bagi setiap batch EC,
  termasuk hash kanonik, keputusan, bilangan row, dan state write.
- `TEST_TELEGRAM_PLOT_STATUS_AUDIT` - audit `/status plot` TEST, termasuk
  identiti/chat peminta, plot, outcome, dan sebab. Ia bukan rekod domain.
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
- `TEST_PLANT_CENSUS` dan `TEST_PLANT_CENSUS_REVIEW` - rekod dan audit human
  review Banci Pokok Fasa 2C-2A; ini tidak mengubah baseline allocation atau
  ledger transplant.
- `TEST_TREATMENT_EVENT`, `TEST_TREATMENT_ALLOCATION_LINK`, dan
  `TEST_TREATMENT_REVIEW` - event rawatan, pautan allocation, dan audit Fasa
  2C-2B; baseline allocation serta ledger transplant kekal tidak berubah.

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

Fasa 1 hanya meliputi `Measurement_Log`. Google Tasks tidak lagi berada
dalam architecture semasa; keputusan human review kekal authority. Rujukan yang
mempunyai lebih daripada satu calon tidak boleh diluluskan melalui vertical slice ini.

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
atau human-review batch pada checkpoint asal; ia tidak menambah sebarang
penulisan production. Rujukan Google Tasks dalam checkpoint lama telah
disupersede oleh D-027.

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

Fasa ini kekal TEST-only: tiada production writer. Reviewer/writer tidak
bergantung pada Google Tasks; capability itu telah dikeluarkan oleh D-027.

### Fasa 2C-1: Transplant / Pindah Anak Pokok TEST

Frasa jelas `pindah anak pokok` menghasilkan satu proposal
`Transplant_Event_Log` sahaja: `TRANSPLANT`, `PROPOSED`, dan
`PROVISIONAL`. Parser deterministic-first menerima token compact `M1P34`
sebagai dua plot `M1P3` dan `M1P4`; format tiga atau lebih digit selepas
`P` ditolak sebagai samar. Untuk shorthand Telegram, crop dan variety hanya
boleh diperoleh daripada tepat satu Crop Batch APPROVED yang memiliki semua
allocation PLANNED tersebut; padanan tiada atau berganda menjadi `WAITING_INFO`.
`Tarikh Pindah` ialah fakta operasi wajib: ia mesti hadir secara eksplisit dalam
laporan atau jawapan penjelasan dan tidak boleh diandaikan daripada `received_at`
Telegram. Shorthand tanpa tarikh berhenti sebagai `WAITING_INFO` sebelum
Gemini/API fallback dan tiada write dibuat.

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

### Fasa 2C-2A: Banci Pokok TEST — regression dan runtime PASS

Laporan hanya diterima apabila mempunyai baris jelas `BANCI POKOK`, satu
`Jenis Tanaman: <crop>`, dan satu atau lebih baris tepat
`M<module>P<plot>: <integer> pokok`. Setiap plot mesti mempunyai kiraan sendiri;
`0 pokok` ialah fakta sah dan tetap melalui human review. Tarikh banci diambil
daripada `received_at` Telegram dalam zon `Asia/Kuala_Lumpur`, kerana format
laporan 2C-2A tidak mewajibkan tarikh eksplisit.

Guard dan matcher membaca sahaja `TEST_CROP_BATCH`, `TEST_PLOT_ALLOCATION`,
`TEST_CROP_BATCH_REVIEW`, dan `TEST_ALLOCATION_STATUS_EVENT`. Crop dipadankan
secara trim, collapse whitespace, dan case-insensitive. Semua plot mesti berada
dalam satu batch TEST yang diluluskan dan setiap allocation mesti efektif
`ACTIVE` menurut ledger transplant; batch tiada/berganda, crop tidak sepadan,
allocation `PLANNED`, atau format samar menjadi `WAITING_INFO` dengan
`batch_match`, tanpa write.

Menu `Lulus Banci Pokok ikut rujukan` dan `Tolak Banci Pokok ikut rujukan`
memerlukan `BSE-TG-<update_id>`. APPROVED menggunakan `ScriptLock`, hash payload
stabil, dan dedup source key rujukan akar + `Plant_Census_Log`, lalu menulis
`TEST_PLANT_CENSUS` serta `TEST_PLANT_CENSUS_REVIEW`. REJECTED memerlukan alasan
dan menulis audit sahaja. Retry keputusan sama adalah idempotent. Baseline
`TEST_PLOT_ALLOCATION` dan ledger transplant tidak pernah diubah; tiada Google
Tasks atau production writer digunakan oleh workflow ini.

### Fasa 2C-2B: Rawatan sebenar TEST — dedicated runtime PASS

Kontrak semasa ialah ZASS D-043. Bagi workflow treatment-list BSE yang telah
ditetapkan, mesej rawatan yang dihantar ialah rekod treatment yang telah
manager-approved dan sudah dibuat di plot. Wording sejarah/copy seperti
`CADANGAN MERACUN` tidak menentukan state dan tidak boleh menukar rekod itu
menjadi proposal. Rule ini khusus kepada workflow BSE tersebut dan tidak boleh
digeneralisasi kepada mesej rawatan lain tanpa signal workflow yang sah.

Tarikh eksplisit yang sah digunakan apabila ada; jika tiada, `event_date`
datang daripada tarikh mesej Telegram. Dos/nilai produk disimpan tepat seperti
dihantar. Unit dos tidak wajib dan OpsMate tidak boleh mereka `ml`, `g`, `L`,
concentration, rate, diagnosis, tujuan rawatan, manager name, atau fakta rawatan
lain yang tidak dinyatakan. Fakta wajib lain yang benar-benar hilang menjadi
`WAITING_INFO` / minimum clarification, bukan inference.

Matcher ACTIVE umum yang dikongsi dengan Census membaca batch approved, crop
normalisasi sempit, baseline `TEST_PLOT_ALLOCATION`, dan status efektif ledger
transplant. Semua plot mesti berada dalam satu batch unik serta efektif `ACTIVE`;
PLANNED, batch tiada/berganda, crop tidak sepadan, atau plot tidak kanonik
menjadi `WAITING_INFO` dengan `batch_match`, tanpa write.

Human confirmation kekal boundary rekod TEST. Menu `Lulus Rawatan ikut rujukan`
dan `Tolak Rawatan ikut rujukan` menggunakan `ScriptLock`, hash stabil, dan
dedup source key rujukan akar + `Treatment_Event_Log`. APPROVED menulis satu
`TEST_TREATMENT_EVENT` dan satu `TEST_TREATMENT_ALLOCATION_LINK` bagi setiap
allocation; REJECTED memerlukan alasan dan audit sahaja. Tiada inventori, claim,
Google Tasks, production writer, perubahan baseline allocation, atau ledger
transplant.

Dedicated closure pada 2026-10-06 membuktikan 13/13 treatment assertions PASS
(D-043 parser/state/date/dose/no-invention, deterministic router, ACTIVE
allocation/review safety) dan full I-011 regression 22/22 PASS pada Apps Script
TEST runtime. Independent Sheet read-back mengesahkan
`production_write:false`; temporary TEST_ONLY probe kemudian dibuang dan Apps
Script TEST HEAD dipulihkan kepada source canonical.
