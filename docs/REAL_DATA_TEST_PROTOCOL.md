# BSE OpsMate TEST: Protokol Ujian Data Operasi Sebenar

## Tujuan

Protokol ini membolehkan ujian terkawal bagi 10 hingga 20 mesej operasi sebenar
dalam persekitaran **TEST sahaja**. Ia menguji pemadanan kategori, validasi,
keperluan penjelasan, dan keputusan human review tanpa menulis ke production.

## Penyahnamaan wajib

Sebelum mesej dimasukkan ke fixture atau digunakan dalam sesi ujian, buang atau
gantikan semua maklumat berikut:

- nama individu, nama pelanggan, dan nama pekerja;
- nombor telefon, username, chat ID, dan ID peribadi;
- gambar, pautan fail, atau lampiran;
- lokasi sensitif, alamat, koordinat, atau arahan lokasi khusus;
- mana-mana maklumat peribadi, token, API key, credential, atau rahsia operasi.

Gunakan placeholder neutral jika konteks diperlukan, contohnya `[OPERATOR]`,
`[CONTACT]`, atau `[LOCATION]`. Kekalkan hanya fakta operasi yang diperlukan
untuk menilai kategori dan outcome TEST.

## Larangan data mentah

Mesej mentah tidak boleh di-commit atau di-push ke GitHub. Simpan data asal,
jika benar-benar diperlukan untuk semakan setempat, di luar repositori atau dalam
`fixtures/private/`, yang diabaikan oleh Git. Fail CSV operasi sebenar yang
padan dengan `fixtures/*real*.csv` juga diabaikan; hanya template ternyahnama
yang dipersetujui boleh dijejak.

## Kategori sampel

Gunakan sekurang-kurangnya satu sampel bagi setiap kategori berikut, dan agihkan
10 hingga 20 kes merentas kategori itu:

- Measurement
- Observation
- Operation
- Input Usage
- Decision

Sampel boleh dijangka menghasilkan `PASS`, `NEED_INFO`, `REJECTED`, atau
`CONFLICT`. Jangan ubah mesej semata-mata untuk memaksa `PASS`; kes maklumat
tidak lengkap ialah sebahagian daripada ujian.

## Rekod hasil ujian

Gunakan `fixtures/real_data_sanitized_template.csv` untuk merekodkan bagi setiap
kes:

- input yang telah dinyahnamakan;
- target dan outcome yang dijangka;
- output Gemini yang diringkaskan atau dirujuk secara ternyahnama;
- status queue sebenar;
- sama ada outcome ialah `NEED_INFO`;
- keputusan human review dan alasan jika ditolak.

Jangan salin payload mentah yang mengandungi maklumat peribadi ke CSV, log Git,
commit message, atau isu GitHub.

## Langkah ujian TEST

1. Sahkan sistem masih TEST-only dan `production_write` kekal `false`.
2. Masukkan satu mesej ternyahnama pada satu masa melalui aliran TEST yang
   diluluskan.
3. Rekod outcome Gemini, `candidate_json` secara ternyahnama jika perlu, dan
   status queue dalam template.
4. Untuk `NEED_INFO`, rekod soalan dan jawapan ternyahnama yang dipautkan.
5. Untuk `NEEDS_HUMAN_REVIEW`, lakukan approve/reject melalui workflow TEST yang
   tersedia dan rekod keputusan audit.
6. Sahkan hanya helaian `TEST_*` dan audit TEST menerima write.

## Aturan berhenti

Hentikan ujian serta-merta dan jangan cuba semula secara automatik jika:

- ada petunjuk `production_write` bukan `false`;
- kod cuba memanggil atau menulis ke helaian/servis production;
- token, API key, data peribadi, atau mesej mentah muncul dalam log, fixture,
  diff, atau output Git;
- status atau dedup tidak konsisten dan boleh menyebabkan rekod berganda;
- Google Task selesai ditafsir sebagai kelulusan automatik.

Catat hanya ringkasan ternyahnama tentang isu, kemudian buat diagnosis read-only
sebelum sebarang perubahan kod, deployment, atau ulangan ujian.
