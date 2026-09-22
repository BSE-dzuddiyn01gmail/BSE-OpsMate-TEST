/** @OnlyCurrentDoc */
// BSE TEST harness v0.1. Core contract v2026.1 + Clerk Rules v2026.1.1.
// Intentionally narrow deterministic parser; NOT Gemini and NOT a production writer.
const BSE_TEST = Object.freeze({
  spreadsheetId: '1O2k9ef5yp7abyVxDBS5E1YuAEu9IwvuRKsr5YpbQ9M8',
  inputTab: 'TEST_INPUT', outputTab: 'SCRIPT_TEST_RESULTS',
  version: 'v2026.1.1', scriptVersion: 'TEST_v0.1', year: 2026
});
const RESULT_HEADERS = ['run_id','tested_at','test_id','input_text','validation',
  'routes','candidate_json','missing_fields','production_write','config_version','script_version'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('BSE TEST')
    .addItem('Uji baris dipilih', 'runSelectedTest')
    .addItem('Uji semua input', 'runAllTests')
    .addSeparator()
    .addItem('Lulus Observation dipilih', 'approveSelectedTelegramObservationTest')
    .addItem('Tolak Observation dipilih', 'rejectSelectedTelegramObservationTest')
    .addItem('Lulus Measurement ikut rujukan', 'approveTelegramMeasurementByReference')
    .addItem('Tolak Measurement ikut rujukan', 'rejectTelegramMeasurementByReference')
    .addItem('Lulus Crop Batch ikut rujukan', 'approveTelegramCropBatchByReference')
    .addItem('Tolak Crop Batch ikut rujukan', 'rejectTelegramCropBatchByReference')
    .addItem('Lulus Transplant ikut rujukan', 'approveTelegramTransplantByReference')
    .addItem('Tolak Transplant ikut rujukan', 'rejectTelegramTransplantByReference')
    .addItem('Lulus Banci Pokok ikut rujukan', 'approveTelegramPlantCensusByReference')
    .addItem('Tolak Banci Pokok ikut rujukan', 'rejectTelegramPlantCensusByReference')
    .addItem('Lulus Rawatan ikut rujukan', 'approveTelegramTreatmentByReference')
    .addItem('Tolak Rawatan ikut rujukan', 'rejectTelegramTreatmentByReference')
    .addSeparator()
    .addItem('Tetapkan Masa Peringatan TEST', 'setBseTestTelegramReminderTimeMyt')
    .addItem('Papar Masa Peringatan TEST', 'showBseTestTelegramReminderTimeMyt')
    .addToUi();
}

function boundTestBook_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book || book.getId() !== BSE_TEST.spreadsheetId) throw new Error('Skrip hanya untuk workbook BSE TEST yang ditetapkan.');
  return book;
}

function runSelectedTest() {
  const book = boundTestBook_();
  const selection = book.getActiveRange();
  if (!selection || selection.getSheet().getName() !== BSE_TEST.inputTab || selection.getRow() < 2 || selection.getNumRows() !== 1) {
    throw new Error('Pilih satu sel pada baris ujian dalam TEST_INPUT.');
  }
  runTestRows_([selection.getRow()]);
}

function runAllTests() {
  const sheet = boundTestBook_().getSheetByName(BSE_TEST.inputTab);
  if (!sheet) throw new Error('TEST_INPUT tidak ditemui.');
  const count = sheet.getLastRow() - 1;
  if (count < 1 || count > 200) throw new Error('Jalankan 1 hingga 200 baris ujian sahaja.');
  runTestRows_(Array.from({length: count}, (_, i) => i + 2));
}

function runTestRows_(rowNumbers) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) throw new Error('Ujian lain sedang berjalan. Cuba semula.');
  try {
    const book = boundTestBook_();
    const source = book.getSheetByName(BSE_TEST.inputTab);
    if (!source) throw new Error('TEST_INPUT tidak ditemui.');
    const headers = source.getRange(1, 1, 1, 2).getDisplayValues()[0];
    if (headers.join('|') !== 'test_id|input_text') throw new Error('Header A1:B1 mesti test_id dan input_text.');
    const runId = Utilities.getUuid();
    const stamp = Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy-MM-dd HH:mm:ss');
    const output = [];
    rowNumbers.forEach(row => {
      const pair = source.getRange(row, 1, 1, 2).getDisplayValues()[0];
      if (!pair[0] && !pair[1]) return;
      const result = parseBseTestInput(pair[1]);
      output.push([runId, stamp, pair[0], pair[1], result.validation,
        result.candidates.map(c => c.target).join('; '), JSON.stringify(result),
        result.missing.join('; '), 'DISABLED_TEST_ONLY', BSE_TEST.version, BSE_TEST.scriptVersion]);
    });
    if (!output.length) throw new Error('Tiada input untuk diuji.');
    let target = book.getSheetByName(BSE_TEST.outputTab);
    if (!target) target = book.insertSheet(BSE_TEST.outputTab);
    if (target.getLastRow() === 0) {
      target.getRange(1, 1, 1, RESULT_HEADERS.length).setValues([RESULT_HEADERS]);
      target.getRange(1, 1, 1, RESULT_HEADERS.length).setFontWeight('bold').setBackground('#eeeeee');
      target.setFrozenRows(1);
      target.setColumnWidth(4, 360);
      target.setColumnWidth(7, 480);
    }
    if (target.getRange(1, 1, 1, RESULT_HEADERS.length).getDisplayValues()[0].join('|') !== RESULT_HEADERS.join('|')) {
      throw new Error('Header SCRIPT_TEST_RESULTS berbeza. Tiada data ditulis.');
    }
    const firstRow = target.getLastRow() + 1;
    const endRow = firstRow + output.length - 1;
    if (endRow > target.getMaxRows()) target.insertRowsAfter(target.getMaxRows(), endRow - target.getMaxRows());
    // Escape formula-leading text; raw input also remains inside candidate_json.
    const safe = output.map(row => row.map(value => /^[=+@-]/.test(String(value)) ? "'" + value : value));
    target.getRange(firstRow, 1, safe.length, RESULT_HEADERS.length).setNumberFormat('@').setValues(safe).setWrap(true).setVerticalAlignment('top');
    book.toast(output.length + ' hasil disimpan dalam SCRIPT_TEST_RESULTS. Tiada write production.', 'BSE TEST');
  } finally { lock.releaseLock(); }
}

function parseBseTestInput(raw) {
  const original = String(raw == null ? '' : raw);
  const result = {validation:'NEED_INFO', missing:[], candidates:[], reason:'', production_write:false};
  const common = {project_id:'BSE_SB', system_year:2026, event_date:'', verification_status:'PROVISIONAL', original_note:original};
  const text = original.trim();
  if (!text || text.length > 4000) { result.reason='Input kosong atau terlalu panjang untuk harness TEST.'; return result; }
  let rest = text;
  const dateMatch = rest.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+/);
  if (dateMatch) {
    const day=+dateMatch[1], month=+dateMatch[2], year=+dateMatch[3];
    const date=new Date(Date.UTC(year,month-1,day));
    if (date.getUTCFullYear()!==year || date.getUTCMonth()!==month-1 || date.getUTCDate()!==day) {
      result.validation='REJECTED'; result.reason='Tarikh kalendar tidak sah.'; return result;
    }
    common.event_date=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    if (year!==BSE_TEST.year) { result.validation='REJECTED'; result.reason='REJECT_WRITE: event_year != 2026. Grace period hanya finalisation/correction 2026.'; return result; }
    rest=rest.slice(dateMatch[0].length);
  }
  const add=(target, fields, missing=[]) => {
    result.candidates.push({target, validation:missing.length?'NEED_INFO':'PASS', fields:Object.assign({},common,fields), missing});
    missing.forEach(field => result.missing.push(target+'.'+field));
  };
  const missingDate=common.event_date?[]:['event_date'];
  // Entire string must match. No inference from arbitrary prose, negation or other plots.
  const ec=rest.match(/^(M\d+P\d+)\s+(EC-IN|EC_IN|EC)\s+(?:(pagi|petang|malam)\s+)?(\d+(?:\.\d+)?)(?:\s+(mS\/cm|uS\/cm))?(?:\s+jam\s+(\d{1,2})[.:](\d{2})(?:\s+(pagi|petang|malam))?)?\.?$/i);
  if (ec) {
    let hour=ec[6]?+ec[6]:null, time='';
    const minute=ec[7]?+ec[7]:0, part=(ec[8]||'').toLowerCase();
    if (hour!==null) {
      if (minute>59 || hour>23 || (part && (hour<1 || hour>12))) {
        result.validation='REJECTED'; result.reason='Masa tidak sah.'; return result;
      }
      if (part==='pagi') hour=hour===12?0:hour;
      if (part==='petang'||part==='malam') hour=hour===12?12:hour+12;
      time=String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
    }
    const missing=missingDate.slice();
    if (ec[2].toUpperCase()==='EC') missing.push('measurement_type');
    add('Measurement_Log',{plot_id:ec[1].toUpperCase(),measurement_type:ec[2].toUpperCase()==='EC'?'':'EC_IN',value:+ec[4],unit_or_scale:ec[5]||'',event_time:time},missing);
  } else {
    const dose=rest.match(/^(M\d+P\d+)\s+(pagi|petang|malam) tadi spray Abamectin (\d+(?:\.\d+)?)\s*ml satu tong\.?$/i);
    const actual=rest.match(/^(M\d+P\d+)\s+(pagi|petang|malam) tadi selesai spray Abamectin\. Jumlah sebenar Abamectin digunakan (\d+(?:\.\d+)?)\s*ml\. Kelulusan Manager belum disahkan\.?$/i);
    const proposal=rest.match(/^cadangan untuk (M\d+P\d+): spray Abamectin (\d+(?:\.\d+)?)\s*ml satu tong (pagi|petang|malam) nanti\. Belum dilaksanakan dan belum mendapat kelulusan Manager\.?$/i);
    if (dose || actual || proposal) {
      const plot=(dose||actual||proposal)[1].toUpperCase();
      if (!proposal) {
        add('Operation_Log',{plot_id:plot,event_time:'',operation_type:'CHEMICAL_APPLICATION',remarks:actual?'Kelulusan Manager belum disahkan.':'Dose '+dose[3]+' ml per tong dilaporkan. Total penggunaan tidak diketahui. Bukti kelulusan tidak disertakan dalam laporan ini; status kelulusan perlu disemak.'},missingDate);
        add('Input_Usage_Log',{plot_id:plot,item_name:'Abamectin',quantity:actual?+actual[3]:'',unit:actual?'ml':''},missingDate.concat(actual?[]:['quantity','unit']));
      }
      const description=proposal?'Cadangan spray Abamectin '+proposal[2]+' ml satu tong '+proposal[3]+'; belum dilaksanakan dan belum mendapat kelulusan Manager.':actual?'Semak semburan Abamectin dengan jumlah penggunaan sebenar '+actual[3]+' ml di '+plot+'; kelulusan Manager belum disahkan.':'Semak laporan dose '+dose[3]+' ml per tong dan tindakan yang telah berlaku; status kelulusan perlu disemak.';
      add('Decision_Approval_Log',{decision_subject:(proposal?'Cadangan':'Semakan formula/tindakan')+' Abamectin '+plot,proposal_text:description,approval_status:proposal?'PROPOSED':'PENDING',approved_by:'',approval_date:''},missingDate);
    } else {
      result.reason='POLA_BELUM_DISOKONG: semak manual. Harness ini hanya menyokong pola EC-IN dan laporan/cadangan Abamectin yang dinyatakan dalam panduan; bukan parser bahasa umum.';
      return result;
    }
  }
  result.validation=result.missing.length?'NEED_INFO':'PASS';
  result.reason=result.missing.length?'Lengkapkan medan wajib bagi candidate berkaitan.':'Validasi asas lengkap; bukan Manager approval atau pengesahan registry.';
  return result;
}
