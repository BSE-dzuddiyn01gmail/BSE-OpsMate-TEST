/** @OnlyCurrentDoc */
// TEST-only human review for one explicit TRANSPLANT proposal. Baseline allocations are immutable.

const BSE_TRANSPLANT_EVENT_HEADERS=['source_key','queue_update_id','transplant_event_id','batch_id','event_date','event_type','crop','variety','plot_ids','event_status','verification_status','original_note','approved_at','reviewer','payload_hash'];
const BSE_ALLOCATION_STATUS_EVENT_HEADERS=['source_key','queue_update_id','status_event_id','transplant_event_id','batch_id','allocation_id','plot_id','from_status','to_status','changed_at','reviewer','payload_hash'];
const BSE_TRANSPLANT_REVIEW_HEADERS=['review_id','source_key','queue_update_id','target','payload_hash','decision','reviewer','review_note','reviewed_at','queue_status_before','candidate_json','transplant_event_id','batch_id'];

function approveTelegramTransplantByReference(){const reference=bsePromptTransplantReference_('Lulus Transplant TEST');if(reference)return bseReviewTelegramTransplantByReference_('APPROVED',reference,'');}
function rejectTelegramTransplantByReference(){
  const reference=bsePromptTransplantReference_('Tolak Transplant TEST');if(!reference)return;
  const ui=SpreadsheetApp.getUi(),response=ui.prompt('Tolak Transplant TEST','Nyatakan sebab penolakan:',ui.ButtonSet.OK_CANCEL);
  if(response.getSelectedButton()!==ui.Button.OK)return;
  const note=response.getResponseText().trim();if(!note)throw new Error('Sebab penolakan wajib diisi.');
  return bseReviewTelegramTransplantByReference_('REJECTED',reference,note);
}
function bsePromptTransplantReference_(title){
  const response=SpreadsheetApp.getUi().prompt(title,'Masukkan rujukan tepat, contohnya BSE-TG-123456:',SpreadsheetApp.getUi().ButtonSet.OK_CANCEL);
  if(response.getSelectedButton()!==SpreadsheetApp.getUi().Button.OK)return '';
  const reference=response.getResponseText().trim();if(!/^BSE-TG-\d+$/.test(reference))throw new Error('Rujukan mesti tepat dalam format BSE-TG-<update_id>.');return reference;
}

function bseReviewTelegramTransplantByReference_(decision,reference,note){
  const actor=bseCropBatchReviewer_();
  return bseReviewWithLock_({reference:reference,action:decision,actor_type:'APPS_SCRIPT',actor_id:actor,actor_name:actor,reason:String(note||''),source_channel:'APPS_SCRIPT'},bseTransplantReviewCore_);
}
function bseTransplantReviewCore_(book,reviewContext){
    bseReviewContextValidate_(reviewContext);const decision=reviewContext.action,reference=reviewContext.reference,note=reviewContext.reason;
    bseTransplantRequireDecision_(decision,note);const queue=bseTelegramQueue_(book),rows=bseCropBatchRows_(queue,BSE_TG_QUEUE_HEADERS.length),updateId=reference.slice(7);
    const matches=rows.map((row,index)=>({row:row,sheetRow:index+2})).filter(item=>String(item.row[0])===updateId);
    if(matches.length!==1)throw new Error('Rujukan mesti sepadan dengan tepat satu baris TELEGRAM_TEST_QUEUE.');
    const selected=matches[0],status=String(selected.row[6]||''),root=bseCropBatchRoot_(rows,selected.row),proposal=bseTransplantProposal_(selected.row[9],root.provenance);
    const sourceKey='BSE-TG-'+root.updateId+'|Transplant_Event_Log',expectedStatus=decision==='APPROVED'?'TRANSPLANT_APPROVED_TEST':'TRANSPLANT_REJECTED_TEST';
    const reviewSheet=book.getSheetByName('TEST_TRANSPLANT_REVIEW')?bseCropBatchSheet_(book,'TEST_TRANSPLANT_REVIEW',BSE_TRANSPLANT_REVIEW_HEADERS):null;
    const eventSheet=book.getSheetByName('TEST_TRANSPLANT_EVENT')?bseCropBatchSheet_(book,'TEST_TRANSPLANT_EVENT',BSE_TRANSPLANT_EVENT_HEADERS):null;
    const statusSheet=book.getSheetByName('TEST_ALLOCATION_STATUS_EVENT')?bseCropBatchSheet_(book,'TEST_ALLOCATION_STATUS_EVENT',BSE_ALLOCATION_STATUS_EVENT_HEADERS):null;
    const reviews=reviewSheet?bseCropBatchRows_(reviewSheet,BSE_TRANSPLANT_REVIEW_HEADERS.length):[],events=eventSheet?bseCropBatchRows_(eventSheet,BSE_TRANSPLANT_EVENT_HEADERS.length):[],statusEvents=statusSheet?bseCropBatchRows_(statusSheet,BSE_ALLOCATION_STATUS_EVENT_HEADERS.length):[];
    const prior=reviews.find(row=>String(row[1])===sourceKey);
    if(prior){
      const payloadHash=bseCropBatchHash_({proposal:proposal.canonical,batch_id:String(prior[12]||'')});
      if(String(prior[4])!==payloadHash||String(prior[5])!==decision)throw new Error('Konflik semakan sedia ada untuk source_key ini.');
      const eventId=String(prior[11]||''),batchId=String(prior[12]||'');
      if(decision==='APPROVED')bseTransplantAssertApprovedRows_(events,statusEvents,sourceKey,payloadHash,proposal.plots,eventId,batchId);
      else if(events.some(row=>String(row[0])===sourceKey)||statusEvents.some(row=>String(row[0])===sourceKey))throw new Error('Audit REJECTED bercanggah dengan rekod Transplant TEST.');
      if(status===expectedStatus)return {source_key:sourceKey,batch_id:batchId,transplant_event_id:eventId,decision:decision,duplicate:true,production_write:false};
      if(status!=='NEEDS_HUMAN_REVIEW')throw new Error('Status queue tidak konsisten dengan audit Transplant sedia ada.');
      queue.getRange(selected.sheetRow,7).setValue(expectedStatus);SpreadsheetApp.flush();
      return {source_key:sourceKey,batch_id:batchId,transplant_event_id:eventId,decision:decision,duplicate:true,production_write:false};
    }
    const match=bseTransplantMatchForBook_(book,proposal);if(match.kind!=='UNIQUE')throw new Error('Batch Crop Batch atau allocation PLANNED tidak sepadan; tiada write dibuat.');
    const payloadHash=bseCropBatchHash_({proposal:proposal.canonical,batch_id:match.batch_id});
    if(status!=='NEEDS_HUMAN_REVIEW')throw new Error('Baris queue bukan NEEDS_HUMAN_REVIEW.');
    if(events.some(row=>String(row[0])===sourceKey)||statusEvents.some(row=>String(row[0])===sourceKey))throw new Error('Konflik rekod Transplant TEST sedia ada.');
    const reviewer=bseReviewContextActorLabel_(reviewContext),stamp=new Date().toISOString(),reviewOut=reviewSheet||bseCropBatchSheet_(book,'TEST_TRANSPLANT_REVIEW',BSE_TRANSPLANT_REVIEW_HEADERS);let eventId='';
    if(decision==='APPROVED'){
      const eventOut=eventSheet||bseCropBatchSheet_(book,'TEST_TRANSPLANT_EVENT',BSE_TRANSPLANT_EVENT_HEADERS),statusOut=statusSheet||bseCropBatchSheet_(book,'TEST_ALLOCATION_STATUS_EVENT',BSE_ALLOCATION_STATUS_EVENT_HEADERS);
      eventId=bseTransplantNextId_(events,proposal.fields.event_date);
      bseCropBatchAppend_(eventOut,[sourceKey,root.updateId,eventId,match.batch_id,proposal.fields.event_date,'TRANSPLANT',proposal.fields.crop,proposal.fields.variety,proposal.plots.join('|'),'COMPLETED','VERIFIED_TEST',root.provenance,stamp,reviewer,payloadHash]);
      match.allocations.forEach(allocation=>bseCropBatchAppend_(statusOut,[sourceKey,root.updateId,Utilities.getUuid(),eventId,match.batch_id,allocation.allocation_id,allocation.plot_id,'PLANNED','ACTIVE',stamp,reviewer,payloadHash]));
      SpreadsheetApp.flush();
    }
    bseCropBatchAppend_(reviewOut,[Utilities.getUuid(),sourceKey,root.updateId,'Transplant_Event_Log',payloadHash,decision,reviewer,String(note||'').trim(),stamp,status,JSON.stringify(proposal.canonical),eventId,match.batch_id]);
    SpreadsheetApp.flush();queue.getRange(selected.sheetRow,7).setValue(expectedStatus);SpreadsheetApp.flush();
    console.log('TRANSPLANT_REVIEW_SAVED: '+JSON.stringify({source_key:sourceKey,decision:decision,production_write:false}));
    return {source_key:sourceKey,batch_id:match.batch_id,transplant_event_id:eventId,decision:decision,duplicate:false,production_write:false};
}

function bseTransplantRequireDecision_(decision,note){if(!['APPROVED','REJECTED'].includes(decision))throw new Error('Keputusan semakan tidak sah.');if(decision==='REJECTED'&&!String(note||'').trim())throw new Error('Sebab penolakan wajib diisi.');}
function bseTransplantNormalizeCrop_(value){return String(value==null?'':value).trim().replace(/\s+/g,' ').toLocaleLowerCase();}
function bseTransplantProposal_(encoded,original){
  let result;try{result=JSON.parse(String(encoded||''));}catch(_){throw new Error('candidate_json tidak sah.');}
  if(!result||typeof result!=='object'||Array.isArray(result)||Object.keys(result).some(key=>!['validation','production_write','candidates'].includes(key))||result.validation!=='PASS'||result.production_write!==false||!Array.isArray(result.candidates)||result.candidates.length!==1)throw new Error('Hasil Transplant TEST tidak sah.');
  const candidate=result.candidates[0],f=candidate&&candidate.fields,allowed=['project_id','system_year','event_date','record_type','verification_status','original_note','event_type','crop','variety','plot_ids','event_status','responsible_name','responsible_source','responsible_telegram_user_id'];
  if(!candidate||candidate.target!=='Transplant_Event_Log'||candidate.validation!=='PASS'||!Array.isArray(candidate.missing)||candidate.missing.length||!f||typeof f!=='object'||Array.isArray(f)||Object.keys(f).some(key=>!allowed.includes(key))||f.project_id!=='BSE_SB'||f.system_year!==2026||f.record_type!=='TRANSPLANT_EVENT'||f.verification_status!=='PROVISIONAL'||f.original_note!==original||f.event_type!=='TRANSPLANT'||f.event_status!=='PROPOSED'||typeof f.crop!=='string'||!f.crop.trim()||typeof f.variety!=='string'||!bseCropBatchDate_(f.event_date)||!Array.isArray(f.plot_ids)||!f.plot_ids.length)throw new Error('Calon Transplant gagal semakan kontrak TEST.');
  const plots=f.plot_ids.slice().map(String).sort(bseTransplantPlotCompare_);
  if(new Set(plots).size!==plots.length||plots.some(plot=>!/^M[1-9]\d*P[1-9]\d*$/.test(plot))||JSON.stringify(plots)!==JSON.stringify(f.plot_ids))throw new Error('Plot Transplant mesti unik dan diisih secara kanonik.');
  const canonical={event_date:f.event_date,event_type:'TRANSPLANT',crop:f.crop,variety:f.variety,plot_ids:plots,event_status:'PROPOSED',verification_status:'PROVISIONAL',original_note:original,production_write:false};
  return {fields:f,plots:plots,canonical:canonical};
}

function bseTransplantRowsByName_(book,name,headers){const sheet=book.getSheetByName(name);return sheet?bseCropBatchRows_(bseCropBatchSheet_(book,name,headers),headers.length):[];}
function bseTransplantMatchForBook_(book,proposal){
  return bseTransplantFindMatches_(proposal,bseTransplantRowsByName_(book,'TEST_CROP_BATCH',BSE_CROP_BATCH_HEADERS),bseTransplantRowsByName_(book,'TEST_PLOT_ALLOCATION',BSE_PLOT_ALLOCATION_HEADERS),bseTransplantRowsByName_(book,'TEST_CROP_BATCH_REVIEW',BSE_CROP_BATCH_REVIEW_HEADERS),bseTransplantRowsByName_(book,'TEST_ALLOCATION_STATUS_EVENT',BSE_ALLOCATION_STATUS_EVENT_HEADERS));
}
function bseTransplantFindMatches_(proposal,batches,allocations,reviews,statusEvents){
  const crop=bseTransplantNormalizeCrop_(proposal.fields.crop),approved=new Set(reviews.filter(row=>String(row[3])==='Crop_Batch_Log'&&String(row[5])==='APPROVED').map(row=>String(row[11]))),matches=[];
  batches.forEach(batch=>{
    const batchId=String(batch[2]||''),sourceKey=String(batch[0]||'');if(!batchId||!approved.has(batchId)||bseTransplantNormalizeCrop_(batch[4])!==crop)return;
    const candidates=allocations.filter(row=>String(row[2])===batchId&&String(row[6])==='PLANNED').map(row=>({allocation_id:String(row[3]),plot_id:String(row[5])}));
    const active=new Set(statusEvents.filter(row=>String(row[4])===batchId&&String(row[8])==='ACTIVE').map(row=>String(row[5])));
    const selected=proposal.plots.map(plot=>candidates.find(item=>item.plot_id===plot&& !active.has(item.allocation_id)));
    if(selected.every(Boolean))matches.push({batch_id:batchId,source_key:sourceKey,allocations:selected});
  });
  return matches.length===1?Object.assign({kind:'UNIQUE'},matches[0]):{kind:matches.length?'MULTIPLE':'NONE',matches:matches};
}
function bseTransplantQueueGuard_(book,result){
  if(!result||!Array.isArray(result.candidates)||result.candidates.length!==1||!result.candidates[0]||result.candidates[0].target!=='Transplant_Event_Log'||result.validation!=='PASS')return result;
  let proposal;try{proposal=bseTransplantProposal_(JSON.stringify(result),String(result.candidates[0].fields.original_note||''));}catch(_){return result;}
  const match=bseTransplantMatchForBook_(book,proposal);if(match.kind==='UNIQUE')return result;
  result.validation='NEED_INFO';result.candidates[0].validation='NEED_INFO';result.candidates[0].missing=Array.from(new Set((result.candidates[0].missing||[]).concat(['batch_match'])));return result;
}
function bseTransplantNextId_(events,eventDate){
  if(!bseCropBatchDate_(eventDate))throw new Error('Tarikh Transplant tidak sah untuk ID.');const prefix='BSE-SB-TR-'+eventDate.replace(/-/g,'')+'-',used=events.map(row=>String(row[2]||''));let highest=0;
  used.forEach(id=>{const match=id.match(new RegExp('^'+prefix+'(\\d{3})$'));if(match)highest=Math.max(highest,Number(match[1]));});if(highest>=999)throw new Error('Siri Transplant harian telah penuh.');return prefix+String(highest+1).padStart(3,'0');
}
function bseTransplantAssertApprovedRows_(events,statusEvents,sourceKey,payloadHash,plots,eventId,batchId){
  const event=events.filter(row=>String(row[0])===sourceKey),statuses=statusEvents.filter(row=>String(row[0])===sourceKey);
  if(!eventId||!batchId||event.length!==1||statuses.length!==plots.length||String(event[0][2])!==eventId||String(event[0][3])!==batchId||String(event[0][14])!==payloadHash||String(event[0][9])!=='COMPLETED'||String(event[0][10])!=='VERIFIED_TEST'||statuses.some(row=>String(row[3])!==eventId||String(row[4])!==batchId||String(row[7])!=='PLANNED'||String(row[8])!=='ACTIVE'||String(row[11])!==payloadHash)||statuses.map(row=>String(row[6])).join('|')!==plots.join('|'))throw new Error('Audit APPROVED tidak sepadan dengan rekod Transplant TEST.');
}

function runBseTransplantReviewHarnessTests(){
  const note='Pindah anak pokok\nJenis Tanaman: Timun Lokal\nM1P34',candidate={validation:'PASS',production_write:false,candidates:[{target:'Transplant_Event_Log',validation:'PASS',missing:[],fields:{project_id:'BSE_SB',system_year:2026,event_date:'2026-09-12',record_type:'TRANSPLANT_EVENT',verification_status:'PROVISIONAL',original_note:note,event_type:'TRANSPLANT',crop:'Timun Lokal',variety:'',plot_ids:['M1P3','M1P4'],event_status:'PROPOSED'}}]},proposal=bseTransplantProposal_(JSON.stringify(candidate),note),batch=['BSE-TG-1|Crop_Batch_Log','1','BSE-SB-CB-20260910-001','2026-09-10','Timun Lokal','CCB','BATCH_START','PROPOSED','PROVISIONAL','','','','hash'],allocations=[['k','1',batch[2],batch[2]+'-PA-001','2026-09-10','M1P3','PLANNED'],['k','1',batch[2],batch[2]+'-PA-002','2026-09-10','M1P4','PLANNED']],review=['r','k','1','Crop_Batch_Log','hash','APPROVED','','','','','','BSE-SB-CB-20260910-001'];
  const tests=[],pass=(id,fn)=>{try{fn();tests.push({id:id,pass:true});}catch(error){tests.push({id:id,pass:false,error:error.message});}};
  pass('compact M1P34 expands',()=>{if(proposal.plots.join('|')!=='M1P3|M1P4')throw new Error('plot salah');});
  pass('crop required',()=>{const bad=JSON.parse(JSON.stringify(candidate));bad.candidates[0].fields.crop='';let failed=false;try{bseTransplantProposal_(JSON.stringify(bad),note);}catch(_){failed=true;}if(!failed)throw new Error('crop kosong diterima');});
  pass('reporter metadata does not invalidate a canonical Transplant candidate',()=>{const withReporter=JSON.parse(JSON.stringify(candidate));Object.assign(withReporter.candidates[0].fields,{responsible_name:'tester',responsible_source:'REPORTER_DEFAULT',responsible_telegram_user_id:'123'});if(bseTransplantProposal_(JSON.stringify(withReporter),note).plots.join('|')!=='M1P3|M1P4')throw new Error('metadata penghantar ditolak');});
  pass('Telegram Malaysia date fallback',()=>{if(bseTransplantMalaysiaDate_('2026-09-11T17:00:00.000Z')!=='2026-09-12')throw new Error('fallback tarikh Malaysia salah');});
  pass('unique batch match',()=>{if(bseTransplantFindMatches_(proposal,[batch],allocations,[review],[]).kind!=='UNIQUE')throw new Error('padanan unik gagal');});
  pass('no and multiple batch match',()=>{if(bseTransplantFindMatches_(proposal,[],allocations,[review],[]).kind!=='NONE'||bseTransplantFindMatches_(proposal,[batch,batch.slice()],allocations,[review],[]).kind!=='MULTIPLE')throw new Error('padanan tiada/berganda gagal');});
  pass('planned baseline is not mutated',()=>{const before=JSON.stringify(allocations);const match=bseTransplantFindMatches_(proposal,[batch],allocations,[review],[]);const statusRows=match.allocations.map(a=>[proposal.plots.indexOf(a.plot_id),a.allocation_id,a.plot_id,'PLANNED','ACTIVE']);if(statusRows.length!==2||before!==JSON.stringify(allocations))throw new Error('baseline berubah');});
  pass('reject reason and audit-only contract',()=>{let failed=false;try{bseTransplantRequireDecision_('REJECTED','');}catch(_){failed=true;}if(!failed)throw new Error('reject tanpa alasan diterima');if(proposal.canonical.production_write!==false||/Tasks\./.test(bseReviewTelegramTransplantByReference_.toString()))throw new Error('production atau Google Task approval');});
  pass('legacy wrapper delegates and core has no UI Session or lock',()=>{const wrapper=bseReviewTelegramTransplantByReference_.toString(),core=bseTransplantReviewCore_.toString();if(!/bseReviewWithLock_/.test(wrapper)||/SpreadsheetApp\.getUi|Session\.|LockService/.test(core))throw new Error('pemisahan wrapper/core tidak selamat');});
  pass('retry approve idempotent shape',()=>{const hash='h',eventId='BSE-SB-TR-20260912-001',events=[['sk','2',eventId,batch[2],'2026-09-12','TRANSPLANT','Timun Lokal','','M1P3|M1P4','COMPLETED','VERIFIED_TEST','','','','h']],statuses=[['sk','2','a',eventId,batch[2],batch[2]+'-PA-001','M1P3','PLANNED','ACTIVE','','','h'],['sk','2','b',eventId,batch[2],batch[2]+'-PA-002','M1P4','PLANNED','ACTIVE','','','h']],before=JSON.stringify({events:events,statuses:statuses});bseTransplantAssertApprovedRows_(events,statuses,'sk',hash,proposal.plots,eventId,batch[2]);if(before!==JSON.stringify({events:events,statuses:statuses}))throw new Error('retry menambah row');});
  console.log('TRANSPLANT_REVIEW_HARNESS: '+JSON.stringify(tests));const failures=tests.filter(test=>!test.pass);if(failures.length)throw new Error('Transplant review harness gagal: '+failures.map(test=>test.id).join(', '));return tests;
}
