// Add as a NEW .gs file in the existing BSE TEST project. Keep Code.gs.
// Connection check only: does not send farm records or generate model content.
function testGeminiConnection() {
  boundTestBook_();
  const key = (PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '').trim();
  if (!key) throw new Error('GEMINI_API_KEY belum diisi dalam Project Settings > Script Properties.');
  let response;
  try {
    response = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
      method: 'get', headers: {'x-goog-api-key': key},
      muteHttpExceptions: true, followRedirects: false
    });
  } catch (_) {
    throw new Error('Sambungan Gemini gagal. Semak akses internet/UrlFetch dan cuba semula. Key tidak dilog.');
  }
  const status = response.getResponseCode();
  if (status !== 200) {
    const hint = status===400 || status===401 || status===403 ? 'Semak key, projek dan akses Gemini API.' :
      status===429 ? 'Had permintaan dicapai; cuba kemudian.' : 'Cuba semula kemudian; semak status perkhidmatan.';
    throw new Error('Gemini HTTP '+status+'. '+hint);
  }
  let data;
  try { data = JSON.parse(response.getContentText()); }
  catch (_) { throw new Error('Respons Gemini bukan JSON sah.'); }
  if (!Array.isArray(data.models)) throw new Error('Respons tidak mengandungi senarai model.');
  const models = data.models.filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name).filter(n => typeof n === 'string' && /^models\/[a-zA-Z0-9._-]+$/.test(n));
  if (!models.length) throw new Error('Sambungan berjaya tetapi tiada model generateContent ditemui pada halaman ini.');
  console.log('CONNECTION_OK — model listing sahaja; belum mengesahkan quota generation.');
  console.log(models.join('\n'));
  if (data.nextPageToken) console.log('Senarai ini separa; terdapat halaman tambahan.');
  return {status:'CONNECTION_OK', models:models, complete:!data.nextPageToken};
}
