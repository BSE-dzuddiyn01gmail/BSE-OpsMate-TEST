/** @OnlyCurrentDoc */
// TEST-only human review for one atomic Crop Batch seed-sowing proposal.

const BSE_CROP_BATCH_HEADERS=['source_key','queue_update_id','batch_id','event_date','crop','variety','batch_action','batch_status','verification_status','original_note','approved_at','reviewer','payload_hash'];
const BSE_PLANTING_EVENT_HEADERS=['source_key','queue_update_id','batch_id','planting_event_id','event_date','event_type','crop','variety','event_status','verification_status','original_note','approved_at','reviewer','payload_hash'];
const BSE_PLOT_ALLOCATION_HEADERS=['source_key','queue_update_id','batch_id','allocation_id','event_date','plot_id','allocation_status','verification_status','original_note','approved_at','reviewer','payload_hash'];
const BSE_CROP_BATCH_REVIEW_HEADERS=['review_id','source_key','queue_update_id','target','payload_hash','decision','reviewer','review_note','reviewed_at','queue_status_before','candidate_json','batch_id'];

function approveTelegramCropBatchByReference(){
  const reference=bsePromptCropBatchReference_('Lulus Crop Batch TEST');
  if(!reference)return;
  return bseReviewTelegramCropBatchByReference_('APPROVED',reference,'');
}

function rejectTelegramCropBatchByReference(){
  const reference=bsePromptCropBatchReference_('Tolak Crop Batch TEST');
  if(!reference)return;
  const ui=SpreadsheetApp.getUi();
  const response=ui.prompt('Tolak Crop Batch TEST','Nyatakan sebab penolakan:',ui.ButtonSet.OK_CANCEL);
  if(response.getSelectedButton()!==ui.Button.OK)return;
  const note=response.getResponseText().trim();
  if(!note)throw new Error('Sebab penolakan wajib diisi.');
  return bseReviewTelegramCropBatchByReference_('REJECTED',reference,note);
}

function bsePromptCropBatchReference_(title){
  const ui=SpreadsheetApp.getUi();
  const response=ui.prompt(title,'Masukkan rujukan tepat, contohnya BSE-TG-123456:',ui.ButtonSet.OK_CANCEL);
  if(response.getSelectedButton()!==ui.Button.OK)return '';
  const reference=response.getResponseText().trim();
  if(!/^BSE-TG-\d+$/.test(reference))throw new Error('Rujukan mesti tepat dalam format BSE-TG-<update_id>.');
  return reference;
}

function bseReviewTelegramCropBatchByReference_(decision,reference,note){
  bseCropBatchRequireDecision_(decision,note);
  if(!/^BSE-TG-\d+$/.test(reference))throw new Error('Rujukan mesti tepat dalam format BSE-TG-<update_id>.');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw new Error('Barisan sedang dikemas kini. Cuba semula.');
  try{
    const book=boundTestBook_(),queue=bseTelegramQueue_(book),updateId=reference.slice(7);
    const rows=bseCropBatchRows_(queue,BSE_TG_QUEUE_HEADERS.length);
    const matches=rows.map((row,index)=>({row:row,sheetRow:index+2})).filter(item=>String(item.row[0])===updateId);
    if(matches.length!==1)throw new Error('Rujukan mesti sepadan dengan tepat satu baris TELEGRAM_TEST_QUEUE.');
    const selected=matches[0],status=String(selected.row[6]||'');
    const root=bseCropBatchRoot_(rows,selected.row);
    const proposal=bseCropBatchProposal_(selected.row[9],root.original);
    const sourceKey='BSE-TG-'+root.updateId+'|Crop_Batch_Log';
    const payloadHash=bseCropBatchHash_(proposal.canonical);
    const expectedStatus=decision==='APPROVED'?'CROP_BATCH_APPROVED_TEST':'CROP_BATCH_REJECTED_TEST';
    const reviewer=bseCropBatchReviewer_(),stamp=new Date().toISOString();
    const reviewSheet=book.getSheetByName('TEST_CROP_BATCH_REVIEW')?bseCropBatchSheet_(book,'TEST_CROP_BATCH_REVIEW',BSE_CROP_BATCH_REVIEW_HEADERS):null;
    const batchSheet=book.getSheetByName('TEST_CROP_BATCH')?bseCropBatchSheet_(book,'TEST_CROP_BATCH',BSE_CROP_BATCH_HEADERS):null;
    const eventSheet=book.getSheetByName('TEST_PLANTING_EVENT')?bseCropBatchSheet_(book,'TEST_PLANTING_EVENT',BSE_PLANTING_EVENT_HEADERS):null;
    const allocationSheet=book.getSheetByName('TEST_PLOT_ALLOCATION')?bseCropBatchSheet_(book,'TEST_PLOT_ALLOCATION',BSE_PLOT_ALLOCATION_HEADERS):null;
    const reviews=reviewSheet?bseCropBatchRows_(reviewSheet,BSE_CROP_BATCH_REVIEW_HEADERS.length):[];
    const batches=batchSheet?bseCropBatchRows_(batchSheet,BSE_CROP_BATCH_HEADERS.length):[];
    const events=eventSheet?bseCropBatchRows_(eventSheet,BSE_PLANTING_EVENT_HEADERS.length):[];
    const allocations=allocationSheet?bseCropBatchRows_(allocationSheet,BSE_PLOT_ALLOCATION_HEADERS.length):[];
    const prior=reviews.find(row=>String(row[1])===sourceKey);
    const duplicate=bseCropBatchExistingDecision_(prior&&{payload_hash:prior[4],decision:prior[5],batch_id:prior[11]},decision,payloadHash);
    if(duplicate){
      if(decision==='APPROVED')bseCropBatchAssertApprovedRows_(batches,events,allocations,sourceKey,payloadHash,proposal.plots,duplicate.batch_id);
      else if(batches.some(row=>String(row[0])===sourceKey)||events.some(row=>String(row[0])===sourceKey)||allocations.some(row=>String(row[0])===sourceKey))throw new Error('Audit REJECTED bercanggah dengan rekod Crop Batch TEST.');
      if(status===expectedStatus)return {source_key:sourceKey,decision:decision,duplicate:true,production_write:false};
      if(status!=='NEEDS_HUMAN_REVIEW')throw new Error('Status queue tidak konsisten dengan audit Crop Batch sedia ada.');
      queue.getRange(selected.sheetRow,7).setValue(expectedStatus);SpreadsheetApp.flush();
      return {source_key:sourceKey,decision:decision,duplicate:true,production_write:false};
    }
    if(status!=='NEEDS_HUMAN_REVIEW')throw new Error('Baris queue bukan NEEDS_HUMAN_REVIEW.');
    if(batches.some(row=>String(row[0])===sourceKey)||events.some(row=>String(row[0])===sourceKey)||allocations.some(row=>String(row[0])===sourceKey))throw new Error('Konflik rekod Crop Batch TEST sedia ada.');
    // Validate every destination header before the first APPROVED write.
    const reviewOut=reviewSheet||bseCropBatchSheet_(book,'TEST_CROP_BATCH_REVIEW',BSE_CROP_BATCH_REVIEW_HEADERS);
    let batchId='';
    if(decision==='APPROVED'){
      batchId=bseCropBatchNextId_(batches,proposal.batch.fields.event_date);
      const batchOut=batchSheet||bseCropBatchSheet_(book,'TEST_CROP_BATCH',BSE_CROP_BATCH_HEADERS);
      const eventOut=eventSheet||bseCropBatchSheet_(book,'TEST_PLANTING_EVENT',BSE_PLANTING_EVENT_HEADERS);
      const allocationOut=allocationSheet||bseCropBatchSheet_(book,'TEST_PLOT_ALLOCATION',BSE_PLOT_ALLOCATION_HEADERS);
      const batch=proposal.batch.fields,event=proposal.event.fields;
      bseCropBatchAppend_(batchOut,[sourceKey,updateId,batchId,batch.event_date,batch.crop,batch.variety,batch.batch_action,batch.batch_status,batch.verification_status,root.original,stamp,reviewer,payloadHash]);
      bseCropBatchAppend_(eventOut,[sourceKey,updateId,batchId,Utilities.getUuid(),event.event_date,event.event_type,event.crop,event.variety,event.event_status,event.verification_status,root.original,stamp,reviewer,payloadHash]);
      proposal.allocations.forEach((allocation,index)=>{
        const fields=allocation.fields;
        bseCropBatchAppend_(allocationOut,[sourceKey,updateId,batchId,batchId+'-PA-'+String(index+1).padStart(3,'0'),fields.event_date,fields.plot_id,fields.allocation_status,fields.verification_status,root.original,stamp,reviewer,payloadHash]);
      });
      SpreadsheetApp.flush();
    }
    bseCropBatchAppend_(reviewOut,[Utilities.getUuid(),sourceKey,updateId,'Crop_Batch_Log',payloadHash,decision,reviewer,String(note||'').trim(),stamp,status,JSON.stringify(proposal.canonical),batchId]);
    SpreadsheetApp.flush();
    queue.getRange(selected.sheetRow,7).setValue(expectedStatus);SpreadsheetApp.flush();
    console.log('CROP_BATCH_REVIEW_SAVED: '+JSON.stringify({source_key:sourceKey,decision:decision,production_write:false}));
    return {source_key:sourceKey,batch_id:batchId,decision:decision,duplicate:false,production_write:false};
  }finally{lock.releaseLock();}
}

function bseCropBatchRequireDecision_(decision,note){
  if(!['APPROVED','REJECTED'].includes(decision))throw new Error('Keputusan semakan tidak sah.');
  if(decision==='REJECTED'&&!String(note||'').trim())throw new Error('Sebab penolakan wajib diisi.');
}

function bseCropBatchRoot_(rows,current){
  let cursor=current;const seen=new Set();
  while(cursor[14]){
    const id=String(cursor[0]);if(seen.has(id))throw new Error('Rantaian penjelasan Crop Batch tidak sah.');seen.add(id);
    const parent=rows.find(row=>String(row[0])===String(cursor[14])&&String(row[1])===String(current[1])&&String(row[2])===String(current[2]));
    if(!parent)throw new Error('Laporan asal Crop Batch tidak ditemui.');cursor=parent;
  }
  return {updateId:String(cursor[0]),original:String(cursor[4]||'')};
}

function bseCropBatchProposal_(encoded,original){
  let result;try{result=JSON.parse(String(encoded||''));}catch(_){throw new Error('candidate_json tidak sah.');}
  if(!result||typeof result!=='object'||Array.isArray(result)||Object.keys(result).some(key=>!['validation','production_write','candidates'].includes(key))||result.production_write!==false||result.validation!=='PASS'||!Array.isArray(result.candidates))throw new Error('Hasil Crop Batch TEST tidak sah.');
  const allowed=new Set(['Crop_Batch_Log','Planting_Event_Log','Plot_Allocation_Log']);
  if(!result.candidates.length||result.candidates.some(c=>!c||!allowed.has(c.target)))throw new Error('Hasil mengandungi target Crop Batch yang tidak dibenarkan.');
  const batches=result.candidates.filter(c=>c.target==='Crop_Batch_Log');
  const events=result.candidates.filter(c=>c.target==='Planting_Event_Log');
  const allocations=result.candidates.filter(c=>c.target==='Plot_Allocation_Log');
  if(batches.length!==1||events.length!==1||!allocations.length)throw new Error('Proposal mesti mempunyai satu batch-start, satu planting event, dan allocation.');
  const common=(candidate,recordType,required)=>{
    const f=candidate.fields;
    const allowedFields=['project_id','system_year','record_type','verification_status','original_note'].concat(required);
    if(Object.keys(candidate).some(key=>!['target','validation','missing','fields'].includes(key))||candidate.validation!=='PASS'||!Array.isArray(candidate.missing)||candidate.missing.length||!f||typeof f!=='object'||Array.isArray(f)||Object.keys(f).some(key=>!allowedFields.includes(key))||f.record_type!==recordType||f.project_id!=='BSE_SB'||f.system_year!==2026||f.verification_status!=='PROVISIONAL'||f.original_note!==original)throw new Error('Calon Crop Batch gagal semakan kontrak TEST.');
    required.forEach(key=>{if(typeof f[key]!=='string'||!f[key].trim())throw new Error('Medan wajib Crop Batch tidak lengkap: '+key);});
    if(!bseCropBatchDate_(f.event_date))throw new Error('Tarikh Crop Batch tidak sah.');
    return f;
  };
  const batch=batches[0],event=events[0];
  const batchFields=common(batch,'CROP_BATCH',['event_date','batch_action','crop','variety','batch_status']);
  const eventFields=common(event,'PLANTING_EVENT',['event_date','event_type','crop','variety','event_status']);
  if(batchFields.batch_action!=='BATCH_START'||batchFields.batch_status!=='PROPOSED'||eventFields.event_type!=='SEED_SOWING'||eventFields.event_status!=='PROPOSED'||batchFields.event_date!==eventFields.event_date||batchFields.crop!==eventFields.crop||batchFields.variety!==eventFields.variety)throw new Error('Batch-start dan planting event tidak sepadan.');
  const normalized=allocations.map(allocation=>{
    const f=common(allocation,'PLOT_ALLOCATION',['event_date','plot_id','allocation_status']);
    if(f.event_date!==batchFields.event_date||f.allocation_status!=='PLANNED'||!/^M[1-9]\d*P[1-9]\d*$/.test(f.plot_id))throw new Error('Allocation Crop Batch tidak kanonik atau bukan PLANNED.');
    return allocation;
  }).sort((a,b)=>bseCropBatchPlotCompare_(a.fields.plot_id,b.fields.plot_id));
  const plots=normalized.map(c=>c.fields.plot_id);
  if(new Set(plots).size!==plots.length||plots.some((plot,index)=>index&&bseCropBatchPlotCompare_(plots[index-1],plot)>=0))throw new Error('Plot allocation mesti unik dan diisih secara kanonik.');
  const canonical={batch:bseCropBatchCanonicalFields_(batchFields),event:bseCropBatchCanonicalFields_(eventFields),allocations:normalized.map(c=>bseCropBatchCanonicalFields_(c.fields))};
  return {batch:batch,event:event,allocations:normalized,plots:plots,canonical:canonical};
}

function bseCropBatchCanonicalFields_(fields){
  return {project_id:fields.project_id,system_year:fields.system_year,event_date:fields.event_date,record_type:fields.record_type,verification_status:fields.verification_status,original_note:fields.original_note,batch_action:fields.batch_action||'',crop:fields.crop||'',variety:fields.variety||'',batch_status:fields.batch_status||'',event_type:fields.event_type||'',event_status:fields.event_status||'',plot_id:fields.plot_id||'',allocation_status:fields.allocation_status||''};
}

function bseCropBatchPlotCompare_(left,right){
  const a=String(left).match(/^M(\d+)P(\d+)$/),b=String(right).match(/^M(\d+)P(\d+)$/);
  if(!a||!b)throw new Error('plot_id Crop Batch tidak kanonik.');
  return Number(a[1])-Number(b[1])||Number(a[2])-Number(b[2]);
}

function bseCropBatchDate_(value){
  if(!/^2026-\d{2}-\d{2}$/.test(String(value||'')))return false;
  const parts=value.split('-').map(Number),date=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));
  return date.getUTCFullYear()===parts[0]&&date.getUTCMonth()===parts[1]-1&&date.getUTCDate()===parts[2];
}

function bseCropBatchStableJson_(value){
  if(Array.isArray(value))return '['+value.map(bseCropBatchStableJson_).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+bseCropBatchStableJson_(value[key])).join(',')+'}';
  return JSON.stringify(value);
}

function bseCropBatchHash_(canonical){
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bseCropBatchStableJson_(canonical),Utilities.Charset.UTF_8).map(byte=>('0'+((byte+256)%256).toString(16)).slice(-2)).join('');
}

function bseCropBatchNextId_(batchRows,eventDate){
  if(!bseCropBatchDate_(eventDate))throw new Error('Tarikh batch tidak sah untuk ID.');
  const dateKey=eventDate.replace(/-/g,''),prefix='BSE-SB-CB-'+dateKey+'-';let highest=0;
  batchRows.forEach(row=>{const match=String(row[2]||'').match(new RegExp('^'+prefix+'(\\d{3})$'));if(match)highest=Math.max(highest,Number(match[1]));});
  if(highest>=999)throw new Error('Siri batch harian telah penuh.');
  return prefix+String(highest+1).padStart(3,'0');
}

function bseCropBatchExistingDecision_(prior,decision,payloadHash){
  if(!prior)return null;
  if(String(prior.payload_hash)!==payloadHash||String(prior.decision)!==decision)throw new Error('Konflik semakan sedia ada untuk source_key ini.');
  return {duplicate:true,batch_id:String(prior.batch_id||'')};
}

function bseCropBatchAssertApprovedRows_(batches,events,allocations,sourceKey,payloadHash,plots,batchId){
  const batch=batches.filter(row=>String(row[0])===sourceKey),event=events.filter(row=>String(row[0])===sourceKey),allocation=allocations.filter(row=>String(row[0])===sourceKey);
  if(!batchId||batch.length!==1||event.length!==1||allocation.length!==plots.length||String(batch[0][2])!==batchId||String(event[0][2])!==batchId||allocation.some(row=>String(row[2])!==batchId)||String(batch[0][12])!==payloadHash||String(event[0][13])!==payloadHash||allocation.some(row=>String(row[11])!==payloadHash)||allocation.map(row=>String(row[5])).join('|')!==plots.join('|'))throw new Error('Audit APPROVED tidak sepadan dengan rekod Crop Batch TEST.');
}

function bseCropBatchSheet_(book,name,headers){
  let sheet=book.getSheetByName(name);if(!sheet)sheet=book.insertSheet(name);
  if(!sheet.getLastRow()){
    if(sheet.getMaxColumns()<headers.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),headers.length-sheet.getMaxColumns());
    sheet.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');sheet.setFrozenRows(1);
  }
  if(sheet.getRange(1,1,1,headers.length).getValues()[0].join('|')!==headers.join('|'))throw new Error('Header '+name+' tidak sepadan.');
  return sheet;
}

function bseCropBatchRows_(sheet,width){return sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues():[];}
function bseCropBatchAppend_(sheet,values){
  const row=sheet.getLastRow()+1;if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),row-sheet.getMaxRows());
  sheet.getRange(row,1,1,values.length).setNumberFormat('@').setValues([values.map(bseCropBatchCell_)]).setWrap(true);
}
function bseCropBatchCell_(value){return typeof value==='string'&&/^\s*[=+@-]/.test(value)?"'"+value:value;}
function bseCropBatchReviewer_(){try{return Session.getActiveUser().getEmail()||'TEST_OPERATOR';}catch(_){return 'TEST_OPERATOR';}}

function runBseCropBatchReviewHarnessTests(){
  const note='KERJA SEMAIAN BENIH\nJenis Tanaman: Timun Lokal (CCB)\nModul: M1 P1 P2\nTarikh Semai: 10/09/2026';
  const candidate=(target,recordType,fields)=>({target:target,validation:'PASS',missing:[],fields:Object.assign({project_id:'BSE_SB',system_year:2026,event_date:'2026-09-10',record_type:recordType,verification_status:'PROVISIONAL',original_note:note},fields)});
  const valid={validation:'PASS',production_write:false,candidates:[candidate('Crop_Batch_Log','CROP_BATCH',{batch_action:'BATCH_START',crop:'Timun Lokal',variety:'CCB',batch_status:'PROPOSED'}),candidate('Planting_Event_Log','PLANTING_EVENT',{event_type:'SEED_SOWING',crop:'Timun Lokal',variety:'CCB',event_status:'PROPOSED'}),candidate('Plot_Allocation_Log','PLOT_ALLOCATION',{plot_id:'M1P1',allocation_status:'PLANNED'}),candidate('Plot_Allocation_Log','PLOT_ALLOCATION',{plot_id:'M1P2',allocation_status:'PLANNED'})]};
  const proposal=bseCropBatchProposal_(JSON.stringify(valid),note);
  const reversed=JSON.parse(JSON.stringify(valid));reversed.candidates.splice(2,2,reversed.candidates[3],reversed.candidates[2]);
  const reversedProposal=bseCropBatchProposal_(JSON.stringify(reversed),note);
  const tests=[];
  const pass=(id,fn)=>{try{fn();tests.push({id:id,pass:true});}catch(error){tests.push({id:id,pass:false,error:error.message});}};
  pass('valid proposal',()=>{if(proposal.plots.join('|')!=='M1P1|M1P2')throw new Error('plot validasi');});
  pass('reject reason required',()=>{let failed=false;try{bseCropBatchRequireDecision_('REJECTED','');}catch(_){failed=true;}if(!failed)throw new Error('reject kosong diterima');});
  pass('duplicate plot rejected',()=>{const bad=JSON.parse(JSON.stringify(valid));bad.candidates[3].fields.plot_id='M1P1';let failed=false;try{bseCropBatchProposal_(JSON.stringify(bad),note);}catch(_){failed=true;}if(!failed)throw new Error('plot duplikat diterima');});
  pass('noncanonical plot rejected',()=>{const bad=JSON.parse(JSON.stringify(valid));bad.candidates[3].fields.plot_id='M1 P1 P2';let failed=false;try{bseCropBatchProposal_(JSON.stringify(bad),note);}catch(_){failed=true;}if(!failed)throw new Error('plot tidak kanonik diterima');});
  pass('canonical hash allocation order',()=>{if(bseCropBatchHash_(proposal.canonical)!==bseCropBatchHash_(reversedProposal.canonical))throw new Error('hash berubah');});
  pass('batch ID date and serial',()=>{const id=bseCropBatchNextId_([['','', 'BSE-SB-CB-20260910-002']], '2026-09-10');if(id!=='BSE-SB-CB-20260910-003')throw new Error('ID tidak betul');});
  pass('idempotency and conflicts',()=>{if(!bseCropBatchExistingDecision_({payload_hash:'h',decision:'APPROVED',batch_id:'B'},'APPROVED','h').duplicate)throw new Error('bukan duplicate');let decisionConflict=false,hashConflict=false;try{bseCropBatchExistingDecision_({payload_hash:'h',decision:'APPROVED'},'REJECTED','h');}catch(_){decisionConflict=true;}try{bseCropBatchExistingDecision_({payload_hash:'h',decision:'APPROVED'},'APPROVED','other');}catch(_){hashConflict=true;}if(!decisionConflict||!hashConflict)throw new Error('konflik diterima');});
  pass('repeat approve returns existing batch without new rows',()=>{const sourceKey='BSE-TG-146694145|Crop_Batch_Log',batchId='BSE-SB-CB-20260910-001',hash=bseCropBatchHash_(proposal.canonical);const batches=[[sourceKey,'146694145',batchId,'2026-09-10','Timun Lokal','CCB','BATCH_START','PROPOSED','PROVISIONAL',note,'','',hash]],events=[[sourceKey,'146694145',batchId,'event-1','2026-09-10','SEED_SOWING','Timun Lokal','CCB','PROPOSED','PROVISIONAL',note,'','',hash]],allocations=proposal.plots.map((plot,index)=>[sourceKey,'146694145',batchId,'allocation-'+index,'2026-09-10',plot,'PLANNED','PROVISIONAL',note,'','',hash]);const before=JSON.stringify({batches:batches,events:events,allocations:allocations});const duplicate=bseCropBatchExistingDecision_({payload_hash:hash,decision:'APPROVED',batch_id:batchId},'APPROVED',hash);bseCropBatchAssertApprovedRows_(batches,events,allocations,sourceKey,hash,proposal.plots,duplicate.batch_id);if(!duplicate.duplicate||duplicate.batch_id!==batchId||before!==JSON.stringify({batches:batches,events:events,allocations:allocations}))throw new Error('approve ulangan mengubah atau menggandakan row');});
  console.log('CROP_BATCH_REVIEW_HARNESS: '+JSON.stringify(tests));
  const failures=tests.filter(test=>!test.pass);if(failures.length)throw new Error('Crop Batch review harness gagal: '+failures.map(test=>test.id).join(', '));
  return tests;
}
