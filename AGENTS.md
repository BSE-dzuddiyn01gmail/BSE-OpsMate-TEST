# BSE OpsMate TEST Guardrails

## Mula dengan seni bina

Sebelum menganalisis, mendiagnosis, atau mengubah kod, baca
`docs/ARCHITECTURE.md`. Gunakan dokumen itu sebagai sumber kebenaran bagi
aliran semasa, status, schema TEST, dan sempadan Fasa 1/Fasa 2.

## Sempadan keselamatan

- Kekalkan semua aliran sebagai **TEST-only**.
- Jangan tambah atau panggil production writer. Semua hasil dan tindakan review
  mesti mengekalkan `production_write: false`.
- Google Tasks telah dikeluarkan daripada MVP/shadow pilot melalui ZASS D-027.
  Jangan aktifkan Tasks API, task sync, task-completion polling, atau reminder
  berasaskan Google Tasks tanpa keputusan ZASS baharu. Human review kekal eksplisit,
  diaudit, dan tidak boleh dipintas.
- Guna semakan manusia yang eksplisit, audit, dedup, dan `ScriptLock` bagi
  sebarang workflow review baharu.

## Cara membuat perubahan

- Gunakan perubahan kecil dengan skop fail yang jelas.
- Jalankan `node --check` bagi setiap fail JavaScript yang diubah, serta
  semakan berkaitan seperti `git diff --check`.
- Bagi perubahan Apps Script, ikut urutan:

  ```text
  ubah dan uji -> clasp push ke TEST -> git add fail tepat -> git commit -> git push
  ```

- Jangan stage `.clasp.json`, token, API key, credential, `.env`, atau
  konfigurasi tempatan/peribadi.
- Sahkan staging dan working tree dengan `git status --short` sebelum dan
  selepas commit.

## Dokumentasi dan diagnosis

- Kemas kini `docs/ARCHITECTURE.md` apabila perubahan mengubah aliran, schema,
  sempadan keselamatan, dedup, status, atau keputusan seni bina.
- Jika punca isu belum pasti, buat diagnosis read-only dahulu. Jangan mengubah
  kod, data, trigger, Git, atau deployment sebelum punca disahkan atau arah
  seterusnya jelas.
