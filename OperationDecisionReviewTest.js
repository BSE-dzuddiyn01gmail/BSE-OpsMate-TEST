/** @OnlyCurrentDoc */
// TEST-only human review and storage for Operation_Log and Decision_Approval_Log.
// Reporter confirmation acknowledges the record only. It NEVER turns a PENDING/PROPOSED
// Decision_Approval candidate into a Manager-approved decision.

const BSE_OPERATION_REVIEW_HEADERS=['review_id','source_key','queue_update_id','candidate_index','target','payload_hash','decision','reviewer','review_note','reviewed_at','queue_status_before','candidate_json'];
const BSE_OPERATION_LOG_HEADERS=['source_key','queue_update_id','candidate_index','event_date','event_time','plot_id','operation_type','remarks','verification_status','original_note','approved_at','reviewer','payload_hash'];
const BSE_DECISION_APPROVAL_REVIEW_HEADERS=['review_id','source_key','queue_update_id','candidate_index','target','payload_hash','decision','reviewer','review_note','reviewed_at','queue_status_before','candidate_json'];
const BSE_DECISION_APPROVAL_LOG_HEADERS=['source_key','queue_update_id','candidate_index','event_date','decision_subject','proposal_text','approval_status','proposed_by','approved_by','approval_date','verification_status','original_note','confirmed_at','reviewer','payload_hash'];

function bseOperationDecisionSheet_(book,name,headers){
  let sheet=book.getSheetByName(name);
  if(!sheet)sheet=book.insertSheet(name);
  if(!sheet.getLastRow()){
    if(sheet.getMaxColumns()<headers.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),headers.length-sheet.getMaxColumns());
    sheet.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');sheet.setFrozenRows(1);
  }
  const actual=sheet.getRange(1,1,1,headers.length).getValues()[0].map(String);
  if(actual.join('|')!==headers.join('|'))throw new Error('Header '+name+' tidak sepadan.');
  return sheet;
}
function bseOperationDecisionRows_(sheet,width){return sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues():[];}
function bseOperationDecisionCell_(value){return typeof value==='string'&&/^\s*[=+@-]/.test(value)?"'"+value:value;}
function bseOperationDecisionAppend_(sheet,values){
  const row=sheet.getLastRow()+1;if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),row-sheet.getMaxRows());
  sheet.getRange(row,1,1,values.length).setNumberFormat('@').setValues([values.map(bseOperationDecisionCell_)]).setWrap(true);
}
function bseOperationDecisionHash_(value){return bseApprovalHash_(value);}
function bseOperationDecisionCandidate_(result,target){
  if(!result||result.production_write!==false||result.validation!=='PASS'||!Array.isArray(result.candidates))throw new Error('Hasil bukan calon TEST PASS yang selamat.');
  const found=result.candidates.map((candidate,index)=>({candidate,index})).filter(x=>x.candidate&&x.candidate.target===target);
  if(found.length!==1)throw new Error('Mesti ada tepat satu '+target+' untuk tindakan ini.');
  const picked=found[0],c=picked.candidate,f=c.fields||{};
  if(c.validation!=='PASS'||!Array.isArray(c.missing)||c.missing.length||f.verification_status!=='PROVISIONAL')throw new Error('Calon '+target+' gagal semakan kontrak.');
  if(target==='Operation_Log'){
    if(f.record_type!=='OPERATION')throw new Error('record_type Operation tidak sah.');
    ['event_date','plot_id'].forEach(k=>{if(!String(f[k]||'').trim())throw new Error('Medan wajib Operation tidak lengkap: '+k);});
    if(!String(f.operation_type||'').trim())throw new Error('operation_type Operation tidak lengkap.');
    if(typeof f.event_time!=='string'||typeof f.remarks!=='string')throw new Error('Field Operation mesti string.');
  }else{
    if(f.record_type!=='DECISION_APPROVAL')throw new Error('record_type Decision Approval tidak sah.');
    ['event_date','decision_subject','approval_status'].forEach(k=>{if(!String(f[k]||'').trim())throw new Error('Medan wajib Decision Approval tidak lengkap: '+k);});
    if(!['PROPOSED','PENDING','APPROVED','REJECTED'].includes(String(f.approval_status)))throw new Error('approval_status Decision Approval tidak sah.');
    ['proposal_text','proposed_by','approved_by','approval_date'].forEach(k=>{if(typeof f[k]!=='string')throw new Error(k+' Decision Approval mesti string.');});
    if(['PROPOSED','PENDING'].includes(String(f.approval_status))&&(String(f.approved_by||'').trim()||String(f.approval_date||'').trim()))throw new Error('Decision belum diluluskan tidak boleh mempunyai approver/date rekaan.');
  }
  return picked;
}
function bseOperationDecisionSourceKey_(reference,target,payloadHash){return String(reference)+'|'+target+'|'+String(payloadHash).slice(0,12);}

function bseOperationReviewCore_(book,reviewContext){
  const context=bseReviewContextValidate_(reviewContext);
  if(context.action!=='APPROVED')throw new Error('Operation hanya direkod selepas Benar penghantar.');
  const picked=bseOperationDecisionCandidate_(context.proposalResult,'Operation_Log'),candidate=picked.candidate,f=candidate.fields;
  const payloadHash=bseOperationDecisionHash_(candidate),sourceKey=bseOperationDecisionSourceKey_(context.reference,'Operation_Log',payloadHash),stamp=new Date().toISOString(),reviewer=String(context.actor_name||context.actor_id||'TEST_OPERATOR');
  const log=bseOperationDecisionSheet_(book,'TEST_OPERATION_LOG',BSE_OPERATION_LOG_HEADERS),review=bseOperationDecisionSheet_(book,'TEST_OPERATION_REVIEW',BSE_OPERATION_REVIEW_HEADERS);
  const logs=bseOperationDecisionRows_(log,BSE_OPERATION_LOG_HEADERS.length),reviews=bseOperationDecisionRows_(review,BSE_OPERATION_REVIEW_HEADERS.length),priorLog=logs.find(r=>String(r[0])===sourceKey),priorReview=reviews.find(r=>String(r[1])===sourceKey);
  if(priorReview){
    if(String(priorReview[5])!==payloadHash||String(priorReview[6])!=='APPROVED')throw new Error('Konflik audit Operation sedia ada.');
    if(!priorLog||String(priorLog[12])!==payloadHash)throw new Error('Audit Operation tidak sepadan dengan log.');
    return {source_key:sourceKey,duplicate:true,production_write:false};
  }
  if(priorLog)throw new Error('Log Operation tanpa audit ditemui; tiada write tambahan dibuat.');
  bseOperationDecisionAppend_(log,[sourceKey,String(context.reference).replace(/^BSE-TG-/,''),picked.index,f.event_date,f.event_time,f.plot_id,f.operation_type,f.remarks,f.verification_status,f.original_note,stamp,reviewer,payloadHash]);
  SpreadsheetApp.flush();
  bseOperationDecisionAppend_(review,[Utilities.getUuid(),sourceKey,String(context.reference).replace(/^BSE-TG-/,''),picked.index,'Operation_Log',payloadHash,'APPROVED',reviewer,'',stamp,'NEEDS_HUMAN_REVIEW',JSON.stringify(candidate)]);
  SpreadsheetApp.flush();
  return {source_key:sourceKey,duplicate:false,production_write:false};
}

function bseDecisionApprovalReviewCore_(book,reviewContext){
  const context=bseReviewContextValidate_(reviewContext);
  if(context.action!=='APPROVED')throw new Error('Decision Approval hanya direkod selepas Benar penghantar.');
  const picked=bseOperationDecisionCandidate_(context.proposalResult,'Decision_Approval_Log'),candidate=picked.candidate,f=candidate.fields;
  const payloadHash=bseOperationDecisionHash_(candidate),sourceKey=bseOperationDecisionSourceKey_(context.reference,'Decision_Approval_Log',payloadHash),stamp=new Date().toISOString(),reviewer=String(context.actor_name||context.actor_id||'TEST_OPERATOR');
  const log=bseOperationDecisionSheet_(book,'TEST_DECISION_APPROVAL_LOG',BSE_DECISION_APPROVAL_LOG_HEADERS),review=bseOperationDecisionSheet_(book,'TEST_DECISION_APPROVAL_REVIEW',BSE_DECISION_APPROVAL_REVIEW_HEADERS);
  const logs=bseOperationDecisionRows_(log,BSE_DECISION_APPROVAL_LOG_HEADERS.length),reviews=bseOperationDecisionRows_(review,BSE_DECISION_APPROVAL_REVIEW_HEADERS.length),priorLog=logs.find(r=>String(r[0])===sourceKey),priorReview=reviews.find(r=>String(r[1])===sourceKey);
  if(priorReview){
    if(String(priorReview[5])!==payloadHash||String(priorReview[6])!=='APPROVED')throw new Error('Konflik audit Decision Approval sedia ada.');
    if(!priorLog||String(priorLog[14])!==payloadHash)throw new Error('Audit Decision Approval tidak sepadan dengan log.');
    return {source_key:sourceKey,duplicate:true,production_write:false,approval_status:String(priorLog[6]||'')};
  }
  if(priorLog)throw new Error('Log Decision Approval tanpa audit ditemui; tiada write tambahan dibuat.');
  bseOperationDecisionAppend_(log,[sourceKey,String(context.reference).replace(/^BSE-TG-/,''),picked.index,f.event_date,f.decision_subject,f.proposal_text,f.approval_status,f.proposed_by,f.approved_by,f.approval_date,f.verification_status,f.original_note,stamp,reviewer,payloadHash]);
  SpreadsheetApp.flush();
  bseOperationDecisionAppend_(review,[Utilities.getUuid(),sourceKey,String(context.reference).replace(/^BSE-TG-/,''),picked.index,'Decision_Approval_Log',payloadHash,'APPROVED',reviewer,'',stamp,'NEEDS_HUMAN_REVIEW',JSON.stringify(candidate)]);
  SpreadsheetApp.flush();
  return {source_key:sourceKey,duplicate:false,production_write:false,approval_status:f.approval_status};
}

function bseOperationConfirmedSummaryFromRows_(reference,rows){
  const row=(rows||[])[(rows||[]).length-1];if(!row)return '';
  const lines=['REKOD OPERASI','Rujukan : '+String(reference||''),'Tarikh : '+bseApprovalDisplayDate_(String(row[3]||'')),'Plot : '+String(row[5]||''),'Jenis operasi : '+String(row[6]||'')];
  if(String(row[4]||'').trim())lines.push('Masa : '+String(row[4]));
  if(String(row[7]||'').trim())lines.push('Catatan : '+String(row[7]));
  lines.push('Status : REPORTER_CONFIRMED','Mod TEST - tiada rekod production ditulis.');return lines.join('\n');
}
function bseOperationConfirmedSummary_(book,reference,outcome){
  const key=String(outcome&&outcome.source_key||'');if(!key)return '';
  const rows=bseOperationDecisionRows_(bseOperationDecisionSheet_(book,'TEST_OPERATION_LOG',BSE_OPERATION_LOG_HEADERS),BSE_OPERATION_LOG_HEADERS.length).filter(r=>String(r[0])===key);
  return bseOperationConfirmedSummaryFromRows_(reference,rows);
}
function bseDecisionApprovalConfirmedSummaryFromRows_(reference,rows){
  const row=(rows||[])[(rows||[]).length-1];if(!row)return '';
  const status=String(row[6]||''),lines=['REKOD SEMAKAN KEPUTUSAN','Rujukan : '+String(reference||''),'Tarikh : '+bseApprovalDisplayDate_(String(row[3]||'')),'Perkara : '+String(row[4]||''),'Cadangan / konteks : '+String(row[5]||''),'Status keputusan : '+status];
  if(String(row[7]||'').trim())lines.push('Dicadang oleh : '+String(row[7]));
  if(String(row[8]||'').trim())lines.push('Diluluskan oleh : '+String(row[8]));
  if(String(row[9]||'').trim())lines.push('Tarikh kelulusan : '+bseApprovalDisplayDate_(String(row[9])));
  if(['PROPOSED','PENDING'].includes(status))lines.push('Nota : pengesahan penghantar bukan kelulusan Manager.');
  lines.push('Status rekod : REPORTER_CONFIRMED','Mod TEST - tiada rekod production ditulis.');return lines.join('\n');
}
function bseDecisionApprovalConfirmedSummary_(book,reference,outcome){
  const key=String(outcome&&outcome.source_key||'');if(!key)return '';
  const rows=bseOperationDecisionRows_(bseOperationDecisionSheet_(book,'TEST_DECISION_APPROVAL_LOG',BSE_DECISION_APPROVAL_LOG_HEADERS),BSE_DECISION_APPROVAL_LOG_HEADERS.length).filter(r=>String(r[0])===key);
  return bseDecisionApprovalConfirmedSummaryFromRows_(reference,rows);
}



function bseOperationDecisionDeterministicResult_(input){
  const parsed=parseBseTestInput(String(input||''));
  if(!parsed||parsed.production_write!==false||!Array.isArray(parsed.candidates))return null;
  const targets=parsed.candidates.map(c=>c&&c.target).filter(Boolean);
  if(!targets.some(t=>t==='Operation_Log'||t==='Decision_Approval_Log'))return null;
  const candidates=parsed.candidates.map(c=>{
    const out=JSON.parse(JSON.stringify(c)),f=out.fields||(out.fields={});
    if(out.target==='Operation_Log')f.record_type='OPERATION';
    else if(out.target==='Input_Usage_Log'){
      f.record_type='INPUT_USAGE';
      if(out.missing&&out.missing.includes('quantity'))f.quantity=null;
    }else if(out.target==='Decision_Approval_Log'){
      f.record_type='DECISION_APPROVAL';
      if(typeof f.proposed_by!=='string')f.proposed_by='';
      if(f.approval_status==='PENDING'&&typeof f.proposal_text==='string'&&!/kelulusan\s+(?:Manager|Pengurus)\s+belum\s+disahkan/i.test(f.proposal_text))f.proposal_text=(f.proposal_text.trim()?f.proposal_text.trim()+' ':'')+'Kelulusan Manager belum disahkan.';
    }
    f.original_note=String(input||'');
    f.verification_status='PROVISIONAL';
    return out;
  });
  const validation=candidates.some(c=>c.validation==='REJECTED')?'REJECTED':candidates.some(c=>c.validation==='NEED_INFO')?'NEED_INFO':candidates.every(c=>c.validation==='PASS')?'PASS':'NEED_INFO';
  return {validation:validation,production_write:false,candidates:candidates};
}
function runBseOperationDecisionTelegramApprovalHarnessTests(){
  const opNote='16/9/2026 M2P3 petang tadi spray Abamectin 20ml satu tong.',op={validation:'PASS',production_write:false,candidates:[{target:'Operation_Log',validation:'PASS',missing:[],fields:{project_id:'BSE_SB',system_year:2026,event_date:'2026-09-16',record_type:'OPERATION',verification_status:'PROVISIONAL',original_note:opNote,event_time:'',plot_id:'M2P3',operation_type:'CHEMICAL_APPLICATION',remarks:'Dose 20 ml satu tong dilaporkan.'}}]},dec={validation:'PASS',production_write:false,candidates:[{target:'Decision_Approval_Log',validation:'PASS',missing:[],fields:{project_id:'BSE_SB',system_year:2026,event_date:'2026-09-16',record_type:'DECISION_APPROVAL',verification_status:'PROVISIONAL',original_note:opNote,decision_subject:'Semakan formula/tindakan Abamectin M2P3',proposal_text:'Abamectin 20 ml satu tong',approval_status:'PENDING',proposed_by:'',approved_by:'',approval_date:''}}]};
  const opPicked=bseOperationDecisionCandidate_(op,'Operation_Log'),decPicked=bseOperationDecisionCandidate_(dec,'Decision_Approval_Log');
  const opRow=['key','1',0,'2026-09-16','','M2P3','CHEMICAL_APPLICATION','Dose 20 ml satu tong dilaporkan.','PROVISIONAL',opNote,'','','hash'];
  const decRow=['key','1',0,'2026-09-16','Semakan formula/tindakan Abamectin M2P3','Abamectin 20 ml satu tong','PENDING','','','','PROVISIONAL',opNote,'','','hash'];
  const opSummary=bseOperationConfirmedSummaryFromRows_('BSE-TG-1',[opRow]),decSummary=bseDecisionApprovalConfirmedSummaryFromRows_('BSE-TG-1',[decRow]);
  const operationCore=bseOperationReviewCore_.toString(),decisionCore=bseDecisionApprovalReviewCore_.toString(),worker=processBseTelegramTestQueue.toString();
  const t03=bseOperationDecisionDeterministicResult_('16/9/2026 M2P3 petang tadi spray Abamectin 20ml satu tong.'),t04=bseOperationDecisionDeterministicResult_('17/9/2026 M2P3 pagi tadi selesai spray Abamectin. Jumlah sebenar Abamectin digunakan 100 ml. Kelulusan Manager belum disahkan.'),t06=bseOperationDecisionDeterministicResult_('18/9/2026 cadangan untuk M2P3: spray Abamectin 20 ml satu tong petang nanti. Belum dilaksanakan dan belum mendapat kelulusan Manager.');
  const tests=[
    {id:'T03 deterministic contract returns Operation + incomplete usage + pending decision',pass:t03&&t03.validation==='NEED_INFO'&&t03.candidates.length===3&&t03.candidates[0].target==='Operation_Log'&&t03.candidates[1].target==='Input_Usage_Log'&&t03.candidates[1].missing.includes('quantity')&&t03.candidates[2].fields.approval_status==='PENDING'},
    {id:'T04 deterministic contract preserves actual total usage',pass:t04&&t04.validation==='PASS'&&t04.candidates.length===3&&t04.candidates[1].fields.quantity===100&&t04.candidates[1].fields.unit==='ml'},
    {id:'T06 proposal creates decision only and no operation write',pass:t06&&t06.validation==='PASS'&&t06.candidates.length===1&&t06.candidates[0].target==='Decision_Approval_Log'&&t06.candidates[0].fields.approval_status==='PROPOSED'},
    {id:'worker evaluates Operation/Decision deterministic route before Gemini',pass:worker.indexOf('bseOperationDecisionDeterministicResult_(job.input)')>=0&&worker.indexOf('bseOperationDecisionDeterministicResult_(job.input)')<worker.indexOf('bseUnifiedProcess_(job.input,job.receivedAt)')},
    {id:'Operation contract is source-preserving and TEST-only',pass:opPicked.candidate.fields.plot_id==='M2P3'&&opPicked.candidate.fields.operation_type==='CHEMICAL_APPLICATION'&&op.production_write===false},
    {id:'Decision PENDING remains pending after reporter confirmation',pass:decPicked.candidate.fields.approval_status==='PENDING'&&decPicked.candidate.fields.approved_by===''&&/bukan kelulusan Manager/.test(decSummary)},
    {id:'Operation writer is idempotent TEST-only',pass:/TEST_OPERATION_LOG/.test(operationCore)&&/TEST_OPERATION_REVIEW/.test(operationCore)&&/priorReview/.test(operationCore)&&/production_write:false/.test(operationCore)},
    {id:'Decision writer is idempotent TEST-only',pass:/TEST_DECISION_APPROVAL_LOG/.test(decisionCore)&&/TEST_DECISION_APPROVAL_REVIEW/.test(decisionCore)&&/priorReview/.test(decisionCore)&&/production_write:false/.test(decisionCore)},
    {id:'approval domains are wired',pass:bseApprovalDomain_(op).core===bseOperationReviewCore_&&bseApprovalDomain_(dec).core===bseDecisionApprovalReviewCore_},
    {id:'Operation canonical summary exposes execution facts',pass:/REKOD OPERASI/.test(opSummary)&&/M2P3/.test(opSummary)&&/CHEMICAL_APPLICATION/.test(opSummary)&&/20 ml/.test(opSummary)},
    {id:'Decision canonical summary does not invent approval',pass:/Status keputusan : PENDING/.test(decSummary)&&!/Status keputusan : APPROVED/.test(decSummary)}
  ];
  const failures=tests.filter(t=>!t.pass);if(failures.length)throw new Error('Operation/Decision Telegram harness gagal: '+failures.map(t=>t.id).join(', '));return tests;
}
