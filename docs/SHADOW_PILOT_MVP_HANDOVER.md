# Shadow Pilot MVP PoC dan Penyerahan BSE

**Status: LOCKED — 2026-10-01**

## 1. Tujuan dan sempadan

Dokumen ini mengawal peralihan selepas Fasa 2C-2B Rawatan sebenar mencapai
`TEST PASS`. Ia menyediakan MVP PoC untuk BSE melalui **shadow pilot**, bukan
integrasi atau penulisan terus ke sistem rasmi BSE.

```text
Mesej operasi Telegram
  -> rekod OpsMate PILOT
  -> rekod cara lama admin BSE
  -> reconciliation dan keputusan verifikasi admin
  -> admin memasukkan rekod yang disahkan ke sistem rasmi BSE
```

OpsMate tidak menulis, mengubah, atau mengintegrasi terus dengan sistem rasmi
BSE. `production_write:false` kekal bermaksud tiada penulisan ke sistem rasmi
BSE; ia tidak menghalang writer daripada menulis ke Sheet atau Drive milik
OpsMate.

## 2. Prasyarat mula

Shadow pilot hanya bermula selepas semua perkara berikut lengkap:

1. Fasa 2C-2B Rawatan sebenar mencapai regression dan runtime `TEST PASS`.
2. Project Owner memutuskan bagi baki 2C-2, 2C-3, dan Fasa 3–8 sama ada:
   - dibina hingga `TEST PASS`; atau
   - ditangguhkan.
3. Setiap penangguhan direkod dalam architecture bersama sebab, risiko,
   dependency, dan syarat pengaktifan semula.
4. Flow yang dipilih untuk MVP telah committed, pushed, dan mempunyai bukti
   regression serta runtime.

## 3. Tiga persekitaran berasingan

| Environment | Tujuan | Pengguna | Writer dibenarkan |
|---|---|---|---|
| `TEST` | Pembangunan, debug, data sintetik | Pembangun/admin | `TEST_*` sahaja |
| `PILOT_TEST` | Replay data sebenar secara terkawal | Pembangun/admin | `PILOT_TEST_*` dan Drive `PILOT_TEST` |
| `PILOT_OPERATION` | Shadow pilot bersama team operasi sebenar | Team operasi/admin BSE | `PILOT_*` dan Drive `PILOT` |

Setiap environment mempunyai Spreadsheet, folder Drive, chat/configuration,
registry role, queue, audit, dan writer sendiri. Credential/configuration tidak
boleh bercampur. Setiap mesej bot mesti dilabel `TEST`, `PILOT TEST`, atau
`PILOT`.

Semua environment kekal:

```text
official_bse_write: false
production_write: false
```

## 4. Freeze skop MVP

Sediakan senarai rasmi setiap flow dan kategori dengan status:

- `IN_SCOPE_PILOT` — dibenarkan dalam pilot;
- `DEFERRED` — ditangguh dengan alasan dan syarat pengaktifan;
- `OUT_OF_SCOPE_PILOT` — ditolak dengan jelas oleh sistem.

Bagi setiap `IN_SCOPE_PILOT`, tentukan format mesej Telegram, kad pengesahan,
writer Sheet/Drive, role yang boleh bertindak, rekod cara lama yang dibandingkan,
dan kaedah reconciliation. Sistem tidak boleh mencuba memproses flow di luar
skop secara senyap.

## 5. Extract data dan operasi sebenar

Kumpulkan crop cycle, batch, plot/allocation, banci, rawatan, EC Leaching,
inventori/claim dalam skop, evidence, SOP admin, dan contoh mesej Telegram
sebenar.

Bina matriks berikut sebelum `PILOT_TEST`:

```text
Dokumen atau mesej sebenar
-> format Telegram OpsMate
-> parser/kategori
-> Benar / Betulkan / Batal
-> writer PILOT
-> rekod cara lama
-> kaedah reconciliation
```

Fakta yang tidak jelas tidak boleh diteka: ia menjadi `WAITING_INFO`,
`DEFERRED`, atau `OUT_OF_SCOPE_PILOT`.

## 6. Struktur Drive dan metadata PILOT

Sediakan Drive berasingan untuk `PILOT_TEST` dan `PILOT_OPERATION`:

```text
OpsMate_BSE_PILOT/
  00_Governance/
  01_Source_Evidence/
  02_Operational_Records/
  03_Reconciliation/
  04_Runtime_Audit/
  05_Regression_Evidence/
  06_Handover/
  07_Backlog_IT/
```

Metadata minimum bagi rekod/evidence: rujukan sumber, masa diterima,
chat/penghantar, kategori, visibility, status pengesahan, ID Drive,
hash/dedup identity, environment writer, dan audit tindakan. Percubaan writer
masuk ke environment salah ialah kegagalan kritikal.

## 7. Gate `PILOT_TEST`

Replay dataset fakta sebenar secara terkawal. Writer aktif mesti menulis ke
Spreadsheet, Drive, dan audit `PILOT_TEST` sahaja.

Uji bagi setiap flow dalam skop:

- mesej sah dan mesej tidak lengkap;
- `Benar`, `Betulkan`, dan `Batal`;
- duplicate/retry;
- akses user/chat salah;
- retrieval dan `/delete` bagi kategori yang menyokongnya;
- evidence Drive;
- kegagalan Telegram/Gemini;
- reconciliation dengan rekod cara lama.

`PILOT_TEST PASS` hanya diberi apabila writer Sheet/Drive berada sepenuhnya di
`PILOT_TEST`, tiada cross-environment write, controls manusia berfungsi,
reconciliation boleh dibuat, dan isu kritikal telah ditutup atau flow ditangguh
secara rasmi. Gate ini diulang hingga sesuai untuk manusia menjalankan
`PILOT_OPERATION`.

## 8. Persediaan `PILOT_OPERATION`

Sebelum pilot operasi sebenar, tetapkan satu group pilot terhad, user aktif,
owner/admin, tempoh pilot, kategori dibenarkan, jadual reconciliation,
contact point isu operasi, dan SOP stop/rollback. Semua data kekal data PILOT;
admin BSE kekal membuat rekod lama dan menentukan apa yang dimasukkan ke sistem
rasmi BSE.

## 9. Pelaksanaan dan reconciliation harian

Team operasi menghantar mesej kerja sebenar mengikut flow yang diluluskan.
OpsMate menerima, meminta pengesahan penghantar, menulis ke `PILOT_*`, dan
merekod audit. Admin BSE menyimpan rekod cara lama secara selari.

Setiap hari admin membandingkan:

```text
Mesej operasi -> rekod PILOT -> rekod cara lama -> keputusan verifikasi
```

Nilai keputusan minimum ialah `MATCHED`, `MATCHED_WITH_NOTE`, `PILOT_MISSING`,
`PILOT_DUPLICATE`, `LEGACY_MISSING`, `DATA_DIFFERENCE`, `OUT_OF_SCOPE`, atau
`VOIDED_TEST`.

## 10. Questionnaire penilaian `PILOT_OPERATION`

Apabila Project Owner tidak lagi terlibat dalam penilaian harian, **admin BSE
dan team operasi wajib mengisi questionnaire ini**. Borang yang lengkap menjadi
input kanonik untuk team IT BSE dan menggantikan keperluan Project Owner membuat
penilaian operasi selepas keluar.

Borang diisi bagi setiap insiden atau semakan harian/mingguan. Lampirkan
rujukan Telegram, screenshot, rekod PILOT, rekod cara lama, dan log relevan
jika ada.

### A. Maklumat asas

| Medan | Isian |
|---|---|
| Tarikh / masa | |
| Diisi oleh | |
| Peranan | Admin BSE / Team Operasi |
| Environment | `PILOT_OPERATION` |
| Rujukan Telegram / rekod PILOT | |
| Kategori / flow | |
| Plot/batch jika relevan | |

### B. Soalan untuk admin BSE

| Soalan | Ya | Tidak | N/A | Catatan / bukti |
|---|:---:|:---:|:---:|---|
| Rekod PILOT sepadan dengan mesej operasi asal? | [ ] | [ ] | [ ] | |
| Rekod PILOT sepadan dengan rekod cara lama? | [ ] | [ ] | [ ] | |
| Rujukan, masa, penghantar dan kategori jelas? | [ ] | [ ] | [ ] | |
| Tiada duplicate atau missing record? | [ ] | [ ] | [ ] | |
| Akses user dan chat adalah betul? | [ ] | [ ] | [ ] | |
| Admin boleh reconciliation tanpa andaian? | [ ] | [ ] | [ ] | |
| Admin mahu menggunakan rekod ini sebagai rujukan sebelum memasukkan data rasmi BSE? | [ ] | [ ] | [ ] | |

### C. Soalan untuk team operasi

| Soalan | Ya | Tidak | N/A | Catatan / bukti |
|---|:---:|:---:|:---:|---|
| Format mesej mudah difahami? | [ ] | [ ] | [ ] | |
| Kad `Benar`, `Betulkan`, `Batal` mudah digunakan? | [ ] | [ ] | [ ] | |
| Pembetulan boleh dibuat tanpa mengelirukan? | [ ] | [ ] | [ ] | |
| Bot memberi makluman yang cukup dan tepat? | [ ] | [ ] | [ ] | |
| Aliran ini menambah kerja yang tidak munasabah? | [ ] | [ ] | [ ] | |
| Anda akan gunakan flow ini dalam kerja harian jika diteruskan? | [ ] | [ ] | [ ] | |

### D. Trigger henti / nyahaktif kategori

Tandakan jika berlaku. Mana-mana jawapan `Ya` memerlukan tiket backlog dan
keputusan admin sama ada menghentikan seluruh pilot atau kategori terlibat.

| Keadaan | Ya | Tidak | Rujukan / tindakan segera |
|---|:---:|:---:|---|
| Writer masuk ke environment salah | [ ] | [ ] | |
| Duplicate atau missing record | [ ] | [ ] | |
| Akses user/chat salah | [ ] | [ ] | |
| Mesej tidak dapat dipadankan dengan selamat | [ ] | [ ] | |
| UX menyebabkan kesilapan berulang | [ ] | [ ] | |
| Reconciliation tidak jelas | [ ] | [ ] | |
| Audit/hash/dedup tidak utuh | [ ] | [ ] | |
| Evidence/visibility salah | [ ] | [ ] | |

### E. Kesimpulan penilai

```text
Keputusan: TERUSKAN / TERUSKAN_DENGAN_CATATAN / NYAHAKTIF_KATEGORI / HENTIKAN_PILOT
Severity: Critical / High / Medium / Low
Ringkasan isu dan cadangan:
Pemilik tindakan: Admin BSE / Team IT BSE / Team Operasi
Tarikh sasaran tindakan:
```

## 11. Stop, rollback, dan exception

Questionnaire Seksyen 10 ialah rekod utama untuk keputusan stop/rollback.
Rollback tidak memadam rekod PILOT. Ia hanya mematikan writer/trigger bagi
kategori terlibat, mengehadkan input kepada acknowledgement/read-only, dan
mengekalkan semua audit untuk team IT BSE. Setiap exception mesti dihubungkan
kepada backlog dengan severity, bukti, tindakan sementara, dan pemilik.

## 12. Handover pack kepada BSE dan team IT

Sediakan dokumen berikut di `06_Handover` dan `07_Backlog_IT`:

1. Architecture untuk HQ dan team IT: tiga environment, flow Telegram,
   schema Sheet/Drive, access control, audit/dedup, kategori pilot/ditangguh,
   dan sempadan tiada integrasi rasmi BSE.
2. Manual penggunaan untuk team operasi, admin BSE, dan team IT.
3. Data dictionary dan mapping mesej Telegram ke rekod PILOT.
4. Template reconciliation harian.
5. SOP exception, recovery, `/delete`, dan stop/rollback.
6. Register akses dan ownership, termasuk proses tambah/tukar/nyahaktif user.
7. Release evidence pack: commit, deployment, konfigurasi tanpa credential,
   regression/runtime evidence, known limitations, dan tarikh deploy.
8. Questionnaire dan matriks penilaian `PILOT_OPERATION` yang telah diisi.
9. Backlog team IT dengan klasifikasi `Critical bug`, `Data integrity`,
   `Security/access`, `Operational UX`, `Feature kemudian`, dan `Out of scope`.
10. Disclaimer/polisi data: MVP PoC/shadow pilot, bukan sistem rasmi BSE, dan
    admin kekal pihak verifikasi.
11. Slide presentation MVP PoC OpsMate dan cadangan tindakan team IT.

## 13. Acceptance checklist dan sign-off

- [ ] Rawatan dan semua flow dipilih mencapai `TEST PASS`.
- [ ] Keputusan `IN_SCOPE_PILOT` / `DEFERRED` direkod dalam architecture.
- [ ] `TEST`, `PILOT_TEST`, dan `PILOT_OPERATION` berasingan.
- [ ] Tiada penulisan atau integrasi terus ke sistem rasmi BSE.
- [ ] `PILOT_TEST PASS` dengan writer Sheet/Drive aktif.
- [ ] Team operasi dan admin menerima manual/SOP.
- [ ] Questionnaire dan reconciliation `PILOT_OPERATION` lengkap.
- [ ] Stop/rollback dan exception diurus melalui questionnaire/backlog.
- [ ] Isu kritikal ditutup atau kategori ditangguh.
- [ ] Semua dokumen handover, release evidence, disclaimer, backlog dan slide
  diserahkan.
- [ ] BSE memahami MVP PoC bukan sistem rasmi atau kelulusan automatik.

```text
Nama / peranan penyerah OpsMate:
Tarikh:
Tandatangan:

Nama / peranan penerima BSE:
Tarikh:
Tandatangan:

Skop diterima:
Penangguhan diterima:
Rujukan dokumen handover:
```

Penyerahan dianggap lengkap apabila checklist ditandatangani oleh penyerah
OpsMate dan wakil BSE. Tandatangan ini menerima MVP PoC/shadow pilot dan
backlog untuk team IT; ia bukan kelulusan integrasi ke sistem rasmi BSE.
