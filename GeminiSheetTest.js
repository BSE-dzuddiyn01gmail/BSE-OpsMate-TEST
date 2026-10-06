/** @OnlyCurrentDoc */
// Requires Code.gs and GeminiUnifiedTest.gs. Writes ONLY GEMINI_TEST_RESULTS.
const BSE_API_RESULT_HEADERS=['run_id','tested_at','source_row','test_id','input_text','matched_case','model_test','processor_test','validation','routes','model_json','candidate_json','review_status','production_write','rules_source'];
function showBseApiMenu() {
  boundTestBook_();
  SpreadsheetApp.getUi().createMenu('BSE API TEST').addItem('Uji baris dipilih','runGeminiSelectedRow').addToUi();
}
function runGeminiSelectedRow() {
  const book=boundTestBook_(),selection=book.getActiveRange();
  if(!selection||selection.getSheet().getName()!==bseRuntimeSheetName_('TEST_INPUT')||selection.getRow()<2||selection.getNumRows()!==1)throw new Error('Pilih satu sel pada baris input dalam '+bseRuntimeSheetName_('TEST_INPUT')+'.');
  return bseRunGeminiSheetRow_(selection.getRow());
}
// No active sheet, selection or menu required. Default: TEST_INPUT row 2.
function runGeminiRowByNumber() {
  const setting=(PropertiesService.getScriptProperties().getProperty('BSE_TEST_ROW')||'2').trim();
  if(!/^\d+$/.test(setting))throw new Error('BSE_TEST_ROW mesti nombor baris, sekurang-kurangnya 2.');
  return bseRunGeminiSheetRow_(Number(setting));
}
function bseRunGeminiSheetRow_(row) {
  const book=boundTestBook_();
  if(!Number.isSafeInteger(row)||row<2)throw new Error('Nombor baris mesti sekurang-kurangnya 2.');
  const lock=LockService.getDocumentLock();
  if(!lock.tryLock(10000))throw new Error('Ujian lain sedang berjalan. Cuba kemudian.');
  try {
    const source=book.getSheetByName('TEST_INPUT');
    if(!source||row>source.getLastRow())throw new Error('Baris input tidak ditemui dalam TEST_INPUT.');
    if(source.getRange(1,1,1,2).getDisplayValues()[0].join('|')!=='test_id|input_text')throw new Error('Header TEST_INPUT A1:B1 mesti test_id dan input_text.');
    const pair=source.getRange(row,1,1,2).getDisplayValues()[0];
    if(!pair[1].trim())throw new Error('input_text kosong.');
    if(pair[1].length>12000)throw new Error('Input TEST terlalu panjang; maksimum 12000 aksara.');
    const outputName='GEMINI_TEST_RESULTS';
    let output=book.getSheetByName(outputName);
    if(output&&output.getLastRow()>0&&output.getRange(1,1,1,BSE_API_RESULT_HEADERS.length).getDisplayValues()[0].join('|')!==BSE_API_RESULT_HEADERS.join('|'))throw new Error('Header GEMINI_TEST_RESULTS berbeza; tiada panggilan API atau write dilakukan.');
    const result=bseApiRowResult_(pair[1]);
    const key=(PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')||'').trim();
    const redact=value=>key?String(value).split(key).join('[REDACTED]'):String(value);
    const stamp=Utilities.formatDate(new Date(),'Asia/Kuala_Lumpur','yyyy-MM-dd HH:mm:ss');
    const values=[Utilities.getUuid(),stamp,row,pair[0],pair[1],result.matched_case,result.model_test,result.processor_test,result.validation,result.routes,JSON.stringify(result.raw),JSON.stringify(result.processed),result.review_status,false,'CODE_SNAPSHOT_UNIFIED_TEST_v0.2'];
    const safe=values.map(v=>{if(typeof v!=='string')return v;const text=redact(v);return /^\s*[=+@-]/.test(text)?"'"+text:text;});
    if(safe.some(v=>typeof v==='string'&&v.length>45000))throw new Error('Respons terlalu panjang untuk satu sel; tiada hasil ditulis.');
    if(!output)output=book.insertSheet(outputName);
    if(output.getMaxColumns()<BSE_API_RESULT_HEADERS.length)output.insertColumnsAfter(output.getMaxColumns(),BSE_API_RESULT_HEADERS.length-output.getMaxColumns());
    if(!output.getLastRow()) {
      output.getRange(1,1,1,BSE_API_RESULT_HEADERS.length).setValues([BSE_API_RESULT_HEADERS]).setFontWeight('bold');
      output.setFrozenRows(1);
      output.setColumnWidth(5,350);output.setColumnWidth(11,450);output.setColumnWidth(12,450);
    }
    const next=output.getLastRow()+1;
    if(next>output.getMaxRows())output.insertRowsAfter(output.getMaxRows(),next-output.getMaxRows());
    output.getRange(next,1,1,safe.length).setNumberFormat('@').setValues([safe]).setWrap(true).setVerticalAlignment('top');
    console.log('SAVED_TEST_RESULT: '+JSON.stringify({source_row:row,test_id:pair[0],matched_case:result.matched_case,model_test:result.model_test,processor_test:result.processor_test,review_status:result.review_status,production_write:false}));
    // Execution log is sufficient; no spreadsheet UI is required.
  } finally {lock.releaseLock();}
}
function bseApiRowResult_(input) {
  // Match actual text, never trust a user-entered test_id as proof of test coverage.
  const fixture=BSE_UNIFIED_CASES.find(t=>t.input===input);
  const raw=bseUnifiedProcess_(input),processed=bseUnifiedGuard_(raw);
  const modelFailures=fixture?bseUnifiedValidate_(fixture.id,raw,input):null;
  const failures=fixture?bseUnifiedValidate_(fixture.id,processed,input):null;
  return {raw:raw,processed:processed,matched_case:fixture?fixture.id:'NEW_INPUT',
    model_test:fixture?(modelFailures.length?'FAIL: '+modelFailures.join('; '):'PASS'):'NOT_TESTED',
    processor_test:fixture?(failures.length?'FAIL: '+failures.join('; '):'PASS'):'NOT_TESTED',
    validation:processed&&typeof processed.validation==='string'?processed.validation:'INVALID_OUTPUT',
    routes:processed&&Array.isArray(processed.candidates)?processed.candidates.map(c=>c&&c.target||'INVALID').join('; '):'',
    review_status:fixture?(failures.length?'TEST_FAILED':'REGRESSION_PASS'):'NEEDS_HUMAN_REVIEW'};
}
