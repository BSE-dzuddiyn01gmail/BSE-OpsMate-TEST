/** @OnlyCurrentDoc */
// TEST-only human review and storage for Observation_Log candidates.
// Never writes production records, calls Gemini, or sends Telegram messages.
const BSE_OBSERVATION_REVIEW_HEADERS=['review_id','source_key','queue_update_id','candidate_index','target','payload_hash','decision','reviewer','review_note','reviewed_at','queue_status_before','candidate_json'];
const BSE_OBSERVATION_LOG_HEADERS=['source_key','queue_update_id','candidate_index','event_date','plot_id','observation_facts','suspected_cause','verification_status','original_note','approved_at','reviewer','payload_hash'];

function approveSelectedTelegramObservationTest() {
  return bseReviewSelectedTelegramObservation_('APPROVED','');
}
function rejectSelectedTelegramObservationTest() {
  const ui=SpreadsheetApp.getUi();
  const response=ui.prompt('Tolak Observation TEST','Nyatakan sebab penolakan:',ui.ButtonSet.OK_CANCEL);
  if(response.getSelectedButton()!==ui.Button.OK)return;
  const note=response.getResponseText().trim();
  if(!note)throw new Error('Sebab penolakan wajib diisi.');
  return bseReviewSelectedTelegramObservation_('REJECTED',note);
}
function bseReviewSelectedTelegramObservation_(decision,note) {
  if(!['APPROVED','REJECTED'].includes(decision))throw new Error('Keputusan semakan tidak sah.');
  const book=boundTestBook_(),lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw new Error('Barisan sedang dikemas kini. Cuba semula.');
  try {
    const selected=bseSelectedTelegramQueueRow_(book),queue=bseTelegramQueue_(book);
    const row=queue.getRange(selected.row,1,1,BSE_TG_QUEUE_HEADERS.length).getValues()[0];
    const status=String(row[6]),updateId=String(row[0]),original=bseObservationRootOriginal_(queue,row),encoded=String(row[9]||'');
    if(!encoded)throw new Error('Tiada candidate_json untuk disemak.');
    let result;
    try{result=JSON.parse(encoded);}catch(_){throw new Error('candidate_json tidak sah.');}
    const picked=bseObservationCandidate_(result,original);
    const sourceKey=updateId+'|'+picked.index+'|Observation_Log';
    const payloadHash=bseObservationHash_(JSON.stringify(picked.candidate));
    const reviewer=bseObservationReviewer_(),stamp=new Date().toISOString();
    const reviewSheet=bseObservationSheet_(book,'TEST_OBSERVATION_REVIEW',BSE_OBSERVATION_REVIEW_HEADERS);
    const logSheet=bseObservationSheet_(book,'TEST_OBSERVATION_LOG',BSE_OBSERVATION_LOG_HEADERS);
    const reviews=bseObservationRows_(reviewSheet,BSE_OBSERVATION_REVIEW_HEADERS.length);
    const logs=bseObservationRows_(logSheet,BSE_OBSERVATION_LOG_HEADERS.length);
    const priorReview=reviews.find(r=>String(r[1])===sourceKey);
    const priorLog=logs.find(r=>String(r[0])===sourceKey);
    if(priorReview&&(String(priorReview[5])!==payloadHash||String(priorReview[6])!==decision))throw new Error('Konflik semakan sedia ada; tiada write dibuat.');
    if(priorLog&&String(priorLog[11])!==payloadHash)throw new Error('Konflik rekod observation sedia ada; tiada write dibuat.');
    if(!priorReview&&status!=='NEEDS_HUMAN_REVIEW')throw new Error('Baris queue bukan NEEDS_HUMAN_REVIEW.');
    if(decision==='REJECTED'&&priorLog)throw new Error('Observation sudah diluluskan; penolakan tidak dibenarkan.');
    if(decision==='APPROVED'&&!priorLog) {
      const f=picked.candidate.fields;
      bseObservationAppend_(logSheet,[sourceKey,updateId,picked.index,f.event_date,f.plot_id,f.observation_facts,f.suspected_cause,f.verification_status,original,stamp,reviewer,payloadHash]);
      SpreadsheetApp.flush();
    }
    if(!priorReview) {
      bseObservationAppend_(reviewSheet,[Utilities.getUuid(),sourceKey,updateId,picked.index,'Observation_Log',payloadHash,decision,reviewer,note,stamp,status,encoded]);
      SpreadsheetApp.flush();
    }
    const queueStatus=decision==='APPROVED'?'OBSERVATION_APPROVED':'OBSERVATION_REJECTED';
    if(status!==queueStatus)queue.getRange(selected.row,7).setValue(queueStatus);
    SpreadsheetApp.flush();
    console.log('OBSERVATION_REVIEW_SAVED: '+JSON.stringify({source_key:sourceKey,decision:decision,duplicate:Boolean(priorReview),production_write:false}));
    return {source_key:sourceKey,decision:decision,duplicate:Boolean(priorReview),production_write:false};
  } finally {lock.releaseLock();}
}
function bseObservationReviewCore_(book,context) {
  bseReviewContextValidate_(context);
  if(context.action!=='APPROVED')throw new Error('Observation hanya direkod selepas Benar penghantar.');
  const queue=bseTelegramQueue_(book),rows=queue.getLastRow()>1?queue.getRange(2,1,queue.getLastRow()-1,BSE_TG_QUEUE_HEADERS.length).getValues():[];
  const qIndex=rows.findIndex(r=>'BSE-TG-'+String(r[0])===String(context.reference));
  if(qIndex<0)throw new Error('Queue Observation tidak ditemui.');
  const queueRow=rows[qIndex],status=String(queueRow[6]||''),root=bseTelegramReportContext_(rows,queueRow);
  let result=context.proposalResult;
  if(!result){try{result=JSON.parse(String(queueRow[9]||''));}catch(_){throw new Error('candidate_json Observation tidak sah.');}}
  const picked=bseObservationCandidate_(result,root.provenance),sourceKey=String(context.reference)+'|Observation_Log',payloadHash=bseObservationHash_(JSON.stringify(picked.candidate)),reviewer=String(context.actor_name||context.actor_id||'TEST_OPERATOR'),stamp=new Date().toISOString();
  const reviewSheet=bseObservationSheet_(book,'TEST_OBSERVATION_REVIEW',BSE_OBSERVATION_REVIEW_HEADERS),logSheet=bseObservationSheet_(book,'TEST_OBSERVATION_LOG',BSE_OBSERVATION_LOG_HEADERS),reviews=bseObservationRows_(reviewSheet,BSE_OBSERVATION_REVIEW_HEADERS.length),logs=bseObservationRows_(logSheet,BSE_OBSERVATION_LOG_HEADERS.length),priorReview=reviews.find(r=>String(r[1])===sourceKey),priorLog=logs.find(r=>String(r[0])===sourceKey);
  if(priorReview){
    if(String(priorReview[5])!==payloadHash||String(priorReview[6])!=='APPROVED')throw new Error('Konflik audit Observation sedia ada; tiada write tambahan dibuat.');
    if(!priorLog||String(priorLog[11])!==payloadHash)throw new Error('Audit Observation APPROVED tidak sepadan dengan log.');
    if(status!=='OBSERVATION_CONFIRMED_TEST')queue.getRange(qIndex+2,7).setValue('OBSERVATION_CONFIRMED_TEST');
    SpreadsheetApp.flush();
    return {source_key:sourceKey,duplicate:true,production_write:false};
  }
  if(status!=='NEEDS_HUMAN_REVIEW')throw new Error('Baris queue Observation bukan NEEDS_HUMAN_REVIEW.');
  if(priorLog)throw new Error('Log Observation tanpa audit ditemui; tiada write tambahan dibuat.');
  const f=picked.candidate.fields;
  bseObservationAppend_(logSheet,[sourceKey,String(queueRow[0]),picked.index,f.event_date,f.plot_id,f.observation_facts,f.suspected_cause,f.verification_status,root.provenance,stamp,reviewer,payloadHash]);
  SpreadsheetApp.flush();
  bseObservationAppend_(reviewSheet,[Utilities.getUuid(),sourceKey,String(queueRow[0]),picked.index,'Observation_Log',payloadHash,'APPROVED',reviewer,'',stamp,status,JSON.stringify(picked.candidate)]);
  queue.getRange(qIndex+2,7).setValue('OBSERVATION_CONFIRMED_TEST');SpreadsheetApp.flush();
  return {source_key:sourceKey,duplicate:false,production_write:false};
}
function bseObservationConfirmedSummaryFromRows_(reference,rows) {
  const matches=(rows||[]).filter(row=>String(row[0]||'')&&(String(row[0])===String(reference)+'|Observation_Log'||String(row[0])===String(reference)));
  if(!matches.length)return '';
  const row=matches[matches.length-1],cause=String(row[6]||'').trim(),lines=['PEMERHATIAN LADANG','Rujukan : '+String(reference||''),'Tarikh : '+bseApprovalDisplayDate_(String(row[3]||'')),'Plot : '+String(row[4]||''),'Fakta pemerhatian : '+String(row[5]||''),'Punca disyaki : '+(cause||'tidak dinyatakan'),'Status : REPORTER_CONFIRMED','Mod TEST — tiada rekod production ditulis.'];
  return lines.join('\n');
}
function bseObservationConfirmedSummary_(book,reference,outcome) {
  const sourceKey=String(outcome&&outcome.source_key||String(reference||'')+'|Observation_Log'),rows=bseObservationRows_(bseObservationSheet_(book,'TEST_OBSERVATION_LOG',BSE_OBSERVATION_LOG_HEADERS),BSE_OBSERVATION_LOG_HEADERS.length).filter(row=>String(row[0])===sourceKey);
  return bseObservationConfirmedSummaryFromRows_(reference,rows);
}
function runBseObservationTelegramApprovalHarnessTests() {
  const note='16/9/2026 M1P2 daun timun banyak kuning dan ada pokok layu.',result={validation:'PASS',production_write:false,candidates:[{target:'Observation_Log',validation:'PASS',missing:[],fields:{project_id:'BSE_SB',system_year:2026,event_date:'2026-09-16',record_type:'OBSERVATION',verification_status:'PROVISIONAL',original_note:note,plot_id:'M1P2',observation_facts:'Daun timun banyak kuning dan ada pokok layu.',suspected_cause:''}}]},picked=bseObservationCandidate_(result,note),row=['BSE-TG-1|Observation_Log','1',0,'2026-09-16','M1P2','Daun timun banyak kuning dan ada pokok layu.','','PROVISIONAL',note,'','','hash'],summary=bseObservationConfirmedSummaryFromRows_('BSE-TG-1',[row]),core=bseObservationReviewCore_.toString(),tests=[
    {id:'Observation contract preserves facts and empty suspected cause',pass:picked.candidate.fields.observation_facts.indexOf('kuning')>=0&&picked.candidate.fields.suspected_cause===''},
    {id:'Observation approval core is TEST-only and idempotent',pass:/TEST_OBSERVATION_LOG/.test(core)&&/TEST_OBSERVATION_REVIEW/.test(core)&&/OBSERVATION_CONFIRMED_TEST/.test(core)&&/production_write:false/.test(core)&&!/production_write\s*:\s*true|bseUnifiedProcess_/.test(core)},
    {id:'Observation canonical summary exposes facts without invented diagnosis',pass:/Fakta pemerhatian : .*kuning/.test(summary)&&/Punca disyaki : tidak dinyatakan/.test(summary)&&!/penyakit/.test(summary)},
    {id:'Observation approval domain is wired',pass:bseApprovalDomain_(result).core===bseObservationReviewCore_},
    {id:'Observation approval card exposes facts before Benar',pass:/Fakta pemerhatian: .*kuning/.test(bseApprovalSummary_('BSE-TG-1',result))&&/Punca disyaki: tidak dinyatakan/.test(bseApprovalSummary_('BSE-TG-1',result))}
  ];
  const failures=tests.filter(t=>!t.pass);if(failures.length)throw new Error('Observation Telegram harness gagal: '+failures.map(t=>t.id).join(', '));return tests;
}

function bseSelectedTelegramQueueRow_(book) {
  const selection=book.getActiveRange();
  if(!selection||selection.getSheet().getName()!=='TELEGRAM_TEST_QUEUE'||selection.getRow()<2||selection.getNumRows()!==1)throw new Error('Pilih satu sel pada baris TELEGRAM_TEST_QUEUE yang hendak disemak.');
  return {row:selection.getRow()};
}
function bseObservationRootOriginal_(queue,row) {
  const rows=queue.getLastRow()>1?queue.getRange(2,1,queue.getLastRow()-1,BSE_TG_QUEUE_HEADERS.length).getValues():[];
  let cursor=row;const seen=new Set();
  while(cursor[14]) {
    const id=String(cursor[0]);
    if(seen.has(id))throw new Error('Rantaian penjelasan observation tidak sah.');
    seen.add(id);
    const parent=rows.find(r=>String(r[0])===String(cursor[14])&&String(r[1])===String(row[1])&&String(r[2])===String(row[2]));
    if(!parent)throw new Error('Laporan asal observation tidak ditemui.');
    cursor=parent;
  }
  return String(cursor[4]);
}
function bseObservationCandidate_(result,original) {
  if(!result||result.production_write!==false||result.validation!=='PASS'||!Array.isArray(result.candidates))throw new Error('Hasil bukan calon TEST PASS yang selamat untuk diluluskan.');
  const found=result.candidates.map((candidate,index)=>({candidate,index})).filter(x=>x.candidate&&x.candidate.target==='Observation_Log');
  if(found.length!==1)throw new Error('Mesti ada tepat satu Observation_Log untuk tindakan ini.');
  const picked=found[0],c=picked.candidate,f=c.fields;
  if(c.validation!=='PASS'||!Array.isArray(c.missing)||c.missing.length||!f||f.record_type!=='OBSERVATION'||f.verification_status!=='PROVISIONAL'||f.original_note!==original)throw new Error('Calon observation gagal semakan kontrak.');
  ['event_date','plot_id','observation_facts'].forEach(k=>{if(f[k]===undefined||f[k]===null||(typeof f[k]==='string'&&!f[k].trim()))throw new Error('Medan wajib observation tidak lengkap: '+k);});
  if(typeof f.suspected_cause!=='string')throw new Error('suspected_cause mesti string.');
  return picked;
}
function bseObservationSheet_(book,name,headers) {
  let sheet=book.getSheetByName(name);
  if(!sheet)sheet=book.insertSheet(name);
  if(!sheet.getLastRow()) {
    if(sheet.getMaxColumns()<headers.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),headers.length-sheet.getMaxColumns());
    sheet.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');sheet.setFrozenRows(1);
  }
  if(sheet.getRange(1,1,1,headers.length).getValues()[0].join('|')!==headers.join('|'))throw new Error('Header '+name+' tidak sepadan.');
  return sheet;
}
function bseObservationRows_(sheet,width) {
  return sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues():[];
}
function bseObservationAppend_(sheet,values) {
  const row=sheet.getLastRow()+1;
  if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),row-sheet.getMaxRows());
  sheet.getRange(row,1,1,values.length).setNumberFormat('@').setValues([values.map(bseObservationCell_)]).setWrap(true);
}
function bseObservationCell_(value) {
  return typeof value==='string'&&/^\s*[=+@-]/.test(value)?"'"+value:value;
}
function bseObservationHash_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function bseObservationReviewer_() {
  try{return Session.getActiveUser().getEmail()||'TEST_OPERATOR';}catch(_){return 'TEST_OPERATOR';}
}
