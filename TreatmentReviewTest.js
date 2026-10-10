/** @OnlyCurrentDoc */
// TEST-only review for explicit completed treatment. No inventory, claims, production writes, or allocation mutation.
const BSE_TREATMENT_EVENT_HEADERS=['source_key','queue_update_id','treatment_event_id','batch_id','event_date','crop','treatment_description','plot_ids_json','event_status','verification_status','original_note','approved_at','reviewer','payload_hash'];
const BSE_TREATMENT_ALLOCATION_LINK_HEADERS=['source_key','queue_update_id','treatment_event_id','batch_id','allocation_id','plot_id','event_date','payload_hash'];
const BSE_TREATMENT_REVIEW_HEADERS=['review_id','source_key','queue_update_id','target','payload_hash','decision','reviewer','review_note','reviewed_at','queue_status_before','candidate_json','treatment_event_id','batch_id'];

function approveTelegramTreatmentByReference(){const reference=bsePromptTreatmentReference_('Lulus Rawatan TEST');if(reference)return bseReviewTelegramTreatmentByReference_('APPROVED',reference,'');}
function rejectTelegramTreatmentByReference(){const reference=bsePromptTreatmentReference_('Tolak Rawatan TEST');if(!reference)return;const ui=SpreadsheetApp.getUi(),response=ui.prompt('Tolak Rawatan TEST','Nyatakan sebab penolakan:',ui.ButtonSet.OK_CANCEL);if(response.getSelectedButton()!==ui.Button.OK)return;const note=response.getResponseText().trim();if(!note)throw new Error('Sebab penolakan wajib diisi.');return bseReviewTelegramTreatmentByReference_('REJECTED',reference,note);}
function bsePromptTreatmentReference_(title){const ui=SpreadsheetApp.getUi(),response=ui.prompt(title,'Masukkan rujukan tepat, contohnya BSE-TG-123456:',ui.ButtonSet.OK_CANCEL);if(response.getSelectedButton()!==ui.Button.OK)return '';const reference=response.getResponseText().trim();if(!/^BSE-TG-\d+$/.test(reference))throw new Error('Rujukan mesti tepat dalam format BSE-TG-<update_id>.');return reference;}

function bseReviewTelegramTreatmentByReference_(decision,reference,note){
  const actor=bseCropBatchReviewer_();
  return bseReviewWithLock_({reference:reference,action:decision,actor_type:'APPS_SCRIPT',actor_id:actor,actor_name:actor,reason:String(note||''),source_channel:'APPS_SCRIPT'},bseTreatmentReviewCore_);
}
function bseTreatmentReviewCore_(book,reviewContext){
    bseReviewContextValidate_(reviewContext);const decision=reviewContext.action,reference=reviewContext.reference,note=reviewContext.reason;
    bseTreatmentRequireDecision_(decision,note);const queue=bseTelegramQueue_(book),rows=bseCropBatchRows_(queue,BSE_TG_QUEUE_HEADERS.length),updateId=reference.slice(7),matches=rows.map((row,index)=>({row:row,sheetRow:index+2})).filter(item=>String(item.row[0])===updateId);
    if(matches.length!==1)throw new Error('Rujukan mesti sepadan dengan tepat satu baris TELEGRAM_TEST_QUEUE.');const selected=matches[0],status=String(selected.row[6]||''),root=bseCropBatchRoot_(rows,selected.row),proposal=bseTreatmentProposal_(selected.row[9],root.provenance),sourceKey='BSE-TG-'+root.updateId+'|Treatment_Event_Log',payloadHash=bseCropBatchHash_(proposal.canonical),expectedStatus=decision==='APPROVED'?'TREATMENT_APPROVED_TEST':'TREATMENT_REJECTED_TEST';
    const reviewSheet=book.getSheetByName('TEST_TREATMENT_REVIEW')?bseCropBatchSheet_(book,'TEST_TREATMENT_REVIEW',BSE_TREATMENT_REVIEW_HEADERS):null,eventSheet=book.getSheetByName('TEST_TREATMENT_EVENT')?bseCropBatchSheet_(book,'TEST_TREATMENT_EVENT',BSE_TREATMENT_EVENT_HEADERS):null,linkSheet=book.getSheetByName('TEST_TREATMENT_ALLOCATION_LINK')?bseCropBatchSheet_(book,'TEST_TREATMENT_ALLOCATION_LINK',BSE_TREATMENT_ALLOCATION_LINK_HEADERS):null,reviews=reviewSheet?bseCropBatchRows_(reviewSheet,BSE_TREATMENT_REVIEW_HEADERS.length):[],events=eventSheet?bseCropBatchRows_(eventSheet,BSE_TREATMENT_EVENT_HEADERS.length):[],links=linkSheet?bseCropBatchRows_(linkSheet,BSE_TREATMENT_ALLOCATION_LINK_HEADERS.length):[];
    const prior=reviews.find(row=>String(row[1])===sourceKey);
    if(prior){if(String(prior[4])!==payloadHash||String(prior[5])!==decision)throw new Error('Konflik semakan sedia ada untuk source_key ini.');const eventId=String(prior[11]||''),batchId=String(prior[12]||'');if(decision==='APPROVED')bseTreatmentAssertApprovedRows_(events,links,sourceKey,payloadHash,proposal.plots,eventId,batchId);else if(events.some(row=>String(row[0])===sourceKey)||links.some(row=>String(row[0])===sourceKey))throw new Error('Audit REJECTED bercanggah dengan rekod Rawatan TEST.');if(status===expectedStatus)return {source_key:sourceKey,decision:decision,duplicate:true,production_write:false};if(status!=='NEEDS_HUMAN_REVIEW')throw new Error('Status queue tidak konsisten dengan audit Rawatan sedia ada.');queue.getRange(selected.sheetRow,7).setValue(expectedStatus);SpreadsheetApp.flush();return {source_key:sourceKey,decision:decision,duplicate:true,production_write:false};}
    if(status!=='NEEDS_HUMAN_REVIEW')throw new Error('Baris queue bukan NEEDS_HUMAN_REVIEW.');if(events.some(row=>String(row[0])===sourceKey)||links.some(row=>String(row[0])===sourceKey))throw new Error('Konflik rekod Rawatan TEST sedia ada.');const match=bseTreatmentMatchForBook_(book,proposal);if(decision==='APPROVED'&&match.kind!=='UNIQUE')throw new Error('Batch Crop Batch atau allocation ACTIVE tidak sepadan; tiada write dibuat.');
    const reviewer=bseReviewContextActorLabel_(reviewContext),stamp=new Date().toISOString(),reviewOut=reviewSheet||bseCropBatchSheet_(book,'TEST_TREATMENT_REVIEW',BSE_TREATMENT_REVIEW_HEADERS);let eventId='',batchId='';
    if(decision==='APPROVED'){const eventOut=eventSheet||bseCropBatchSheet_(book,'TEST_TREATMENT_EVENT',BSE_TREATMENT_EVENT_HEADERS),linkOut=linkSheet||bseCropBatchSheet_(book,'TEST_TREATMENT_ALLOCATION_LINK',BSE_TREATMENT_ALLOCATION_LINK_HEADERS);eventId=bseTreatmentNextId_(events,proposal.fields.event_date);batchId=match.batch_id;bseCropBatchAppend_(eventOut,[sourceKey,root.updateId,eventId,batchId,proposal.fields.event_date,proposal.fields.crop,proposal.fields.treatment_description,JSON.stringify(proposal.plots),'COMPLETED','VERIFIED_TEST',root.provenance,stamp,reviewer,payloadHash]);match.allocations.forEach(allocation=>bseCropBatchAppend_(linkOut,[sourceKey,root.updateId,eventId,batchId,allocation.allocation_id,allocation.plot_id,proposal.fields.event_date,payloadHash]));SpreadsheetApp.flush();}
    bseCropBatchAppend_(reviewOut,[Utilities.getUuid(),sourceKey,root.updateId,'Treatment_Event_Log',payloadHash,decision,reviewer,String(note||'').trim(),stamp,status,JSON.stringify(proposal.canonical),eventId,batchId]);SpreadsheetApp.flush();queue.getRange(selected.sheetRow,7).setValue(expectedStatus);SpreadsheetApp.flush();return {source_key:sourceKey,decision:decision,duplicate:false,production_write:false};
}
function bseTreatmentRequireDecision_(decision,note){if(!['APPROVED','REJECTED'].includes(decision))throw new Error('Keputusan semakan tidak sah.');if(decision==='REJECTED'&&!String(note||'').trim())throw new Error('Sebab penolakan wajib diisi.');}
function bseTreatmentProposal_(encoded,original){
  let result;try{result=JSON.parse(String(encoded||''));}catch(_){throw new Error('candidate_json tidak sah.');}
  if(!result||typeof result!=='object'||Array.isArray(result)||Object.keys(result).some(key=>!['validation','production_write','candidates'].includes(key))||result.validation!=='PASS'||result.production_write!==false||!Array.isArray(result.candidates)||result.candidates.length!==1)throw new Error('Hasil Rawatan TEST tidak sah.');
  const candidate=result.candidates[0],f=candidate&&candidate.fields;
  const allowed=['project_id','system_year','event_date','record_type','verification_status','original_note','crop','treatment_description','plot_ids','event_status','router_confidence'];
  if(!candidate||candidate.target!=='Treatment_Event_Log'||candidate.validation!=='PASS'||!Array.isArray(candidate.missing)||candidate.missing.length||!f||typeof f!=='object'||Array.isArray(f)||Object.keys(f).some(key=>!allowed.includes(key))||f.project_id!=='BSE_SB'||f.system_year!==2026||f.record_type!=='TREATMENT_EVENT'||f.verification_status!=='PROVISIONAL'||f.original_note!==original||typeof f.crop!=='string'||!f.crop.trim()||typeof f.treatment_description!=='string'||!f.treatment_description.trim()||!['PROPOSED','COMPLETED'].includes(f.event_status)||!bseCropBatchDate_(f.event_date)||!Array.isArray(f.plot_ids)||!f.plot_ids.length)throw new Error('Calon Rawatan gagal semakan kontrak TEST.');
  const plots=f.plot_ids.slice().map(String).sort(bseCropBatchPlotCompare_);
  if(new Set(plots).size!==plots.length||plots.some(plot=>!/^M[1-9]\d*P[1-9]\d*$/.test(plot))||JSON.stringify(plots)!==JSON.stringify(f.plot_ids))throw new Error('Plot Rawatan mesti unik dan diisih secara kanonik.');
  const canonical={event_date:f.event_date,crop:f.crop,treatment_description:f.treatment_description,plot_ids:plots,event_status:f.event_status,verification_status:'PROVISIONAL',original_note:original,production_write:false};
  return {fields:f,plots:plots,canonical:canonical};
}
function bseTreatmentMatchForBook_(book,proposal){return bseActiveAllocationFindMatches_(proposal.fields.crop,proposal.plots,bseTransplantRowsByName_(book,'TEST_CROP_BATCH',BSE_CROP_BATCH_HEADERS),bseTransplantRowsByName_(book,'TEST_PLOT_ALLOCATION',BSE_PLOT_ALLOCATION_HEADERS),bseTransplantRowsByName_(book,'TEST_CROP_BATCH_REVIEW',BSE_CROP_BATCH_REVIEW_HEADERS),bseTransplantRowsByName_(book,'TEST_ALLOCATION_STATUS_EVENT',BSE_ALLOCATION_STATUS_EVENT_HEADERS));}
function bseTreatmentReconcileCandidates_(book,result){
  if(!result||result.production_write!==false||!Array.isArray(result.candidates)||!result.candidates.length||!result.candidates.every(c=>c&&c.target==='Treatment_Event_Log'))return result;
  const batches=bseTransplantRowsByName_(book,'TEST_CROP_BATCH',BSE_CROP_BATCH_HEADERS),allocations=bseTransplantRowsByName_(book,'TEST_PLOT_ALLOCATION',BSE_PLOT_ALLOCATION_HEADERS),reviews=bseTransplantRowsByName_(book,'TEST_CROP_BATCH_REVIEW',BSE_CROP_BATCH_REVIEW_HEADERS),statuses=bseTransplantRowsByName_(book,'TEST_ALLOCATION_STATUS_EVENT',BSE_ALLOCATION_STATUS_EVENT_HEADERS);
  result.candidates.forEach(candidate=>{
    const f=candidate.fields||{};
    if(!String(f.crop||'').trim()&&Array.isArray(f.plot_ids)&&f.plot_ids.length){const inferred=bseActiveAllocationFindMatchesByPlots_(f.plot_ids,batches,allocations,reviews,statuses);if(inferred.kind==='UNIQUE'&&String(inferred.crop||'').trim()){f.crop=String(inferred.crop).trim();candidate.missing=(candidate.missing||[]).filter(k=>k!=='crop');}}
    const missing=(candidate.missing||[]).filter(k=>k!=='active_allocation_unverified'&&k!=='batch_match');
    let ok=false;
    if(!missing.length){
      const single={validation:'PASS',production_write:false,candidates:[Object.assign({},candidate,{validation:'PASS',missing:[]})]};
      try{const proposal=bseTreatmentProposal_(JSON.stringify(single),String(f.original_note||''));ok=bseTreatmentMatchForBook_(book,proposal).kind==='UNIQUE';}catch(_){ok=false;}
    }
    candidate.validation=ok?'PASS':'NEED_INFO';
    candidate.missing=ok?[]:Array.from(new Set(missing.concat('batch_match')));
  });
  result.validation=result.candidates.every(c=>c.validation==='PASS')?'PASS':'NEED_INFO';
  return result;
}
function bseTreatmentQueueGuard_(book,result){return bseTreatmentReconcileCandidates_(book,result);}
function bseTreatmentMarkNeedInfo_(result){result.validation='NEED_INFO';result.candidates.forEach(candidate=>{if(!candidate)return;candidate.validation='NEED_INFO';candidate.missing=Array.from(new Set((Array.isArray(candidate.missing)?candidate.missing:[]).concat(['batch_match'])));});return result;}
function bseTreatmentNextId_(rows,date){if(!bseCropBatchDate_(date))throw new Error('Tarikh Rawatan tidak sah untuk ID.');const prefix='BSE-SB-TX-'+date.replace(/-/g,'')+'-',used=rows.map(row=>String(row[2]||''));let highest=0;used.forEach(id=>{const match=id.match(new RegExp('^'+prefix+'(\\d{3})$'));if(match)highest=Math.max(highest,Number(match[1]));});if(highest>=999)throw new Error('Siri Rawatan harian telah penuh.');return prefix+String(highest+1).padStart(3,'0');}
function bseTreatmentAssertApprovedRows_(events,links,sourceKey,payloadHash,plots,eventId,batchId){const event=events.filter(row=>String(row[0])===sourceKey),rows=links.filter(row=>String(row[0])===sourceKey);if(!eventId||!batchId||event.length!==1||rows.length!==plots.length||String(event[0][2])!==eventId||String(event[0][3])!==batchId||String(event[0][8])!=='COMPLETED'||String(event[0][9])!=='VERIFIED_TEST'||String(event[0][13])!==payloadHash||rows.some(row=>String(row[2])!==eventId||String(row[3])!==batchId||String(row[7])!==payloadHash)||rows.map(row=>String(row[5])).join('|')!==plots.join('|'))throw new Error('Audit APPROVED tidak sepadan dengan rekod Rawatan TEST.');}
function runBseTreatmentReviewHarnessTests(){
  const note='RAWATAN DIBUAT\nJenis Tanaman: Timun\nM2P1\nRawatan: Semburan foliar';
  const candidate={validation:'PASS',production_write:false,candidates:[{target:'Treatment_Event_Log',validation:'PASS',missing:[],fields:{project_id:'BSE_SB',system_year:2026,event_date:'2026-09-22',record_type:'TREATMENT_EVENT',verification_status:'PROVISIONAL',original_note:note,crop:'Timun',treatment_description:'Semburan foliar',plot_ids:['M2P1'],event_status:'PROPOSED'}}]};
  const proposal=bseTreatmentProposal_(JSON.stringify(bseUnifiedGuard_(candidate,{received_at:'2026-09-22T00:00:00.000Z'})),note),batch=['k','1','BSE-SB-CB-20260922-001','2026-09-22','Timun'],allocations=[['k','1',batch[2],batch[2]+'-PA-001','','M2P1','PLANNED']],reviews=[['r','k','1','Crop_Batch_Log','h','APPROVED','','','','','','BSE-SB-CB-20260922-001']],active=[['','','','',batch[2],allocations[0][3],'M2P1','PLANNED','ACTIVE','2026-09-22T01:00:00.000Z']],tests=[];
  const pass=(id,fn)=>{try{fn();tests.push({id:id,pass:true});}catch(error){tests.push({id:id,pass:false,error:error.message});}};
  pass('ACTIVE single and multi plot PASS',()=>{const plots=['M2P1','M2P2'],alloc2=allocations.concat([['k','1',batch[2],batch[2]+'-PA-002','','M2P2','PLANNED']]),active2=active.concat([['','','','',batch[2],batch[2]+'-PA-002','M2P2','PLANNED','ACTIVE','2026-09-22T01:00:00.000Z']]);if(bseActiveAllocationFindMatches_(proposal.fields.crop,proposal.plots,[batch],allocations,reviews,active).kind!=='UNIQUE'||bseActiveAllocationFindMatches_(proposal.fields.crop,plots,[batch],alloc2,reviews,active2).kind!=='UNIQUE')throw new Error('ACTIVE match gagal');});
  pass('PLANNED none multiple crop mismatch need info',()=>{const planned=bseActiveAllocationFindMatches_(proposal.fields.crop,proposal.plots,[batch],allocations,reviews,[]).kind,none=bseActiveAllocationFindMatches_(proposal.fields.crop,proposal.plots,[],allocations,reviews,active).kind,multiple=bseActiveAllocationFindMatches_(proposal.fields.crop,proposal.plots,[batch,batch.slice()],allocations,reviews,active).kind,crop=bseActiveAllocationFindMatches_('Peria',proposal.plots,[batch],allocations,reviews,active).kind,need=bseTreatmentMarkNeedInfo_(JSON.parse(JSON.stringify(candidate)));if(planned!=='NONE'||none!=='NONE'||multiple!=='MULTIPLE'||crop!=='NONE'||need.validation!=='NEED_INFO')throw new Error('guard tidak ketat');});
  pass('CADANGAN RAWATAN does not create treatment event',()=>{const suggestion={validation:'PASS',production_write:false,candidates:[{target:'Decision_Approval_Log',validation:'PASS',missing:[],fields:{project_id:'BSE_SB',system_year:2026,event_date:'2026-09-22',record_type:'DECISION_APPROVAL',verification_status:'PROVISIONAL',original_note:'CADANGAN RAWATAN\nJenis Tanaman: Timun\nM2P1\nRawatan: Semburan foliar',decision_subject:'Cadangan rawatan',proposal_text:'Cadangan sahaja',approval_status:'PROPOSED',proposed_by:'',approved_by:'',approval_date:''}}]};const guarded=bseUnifiedGuard_(suggestion,{received_at:'2026-09-22T00:00:00.000Z'});if(guarded.candidates.some(item=>item.target==='Treatment_Event_Log'))throw new Error('proposal mencipta rawatan');});
  pass('manual wrapper delegates and Treatment core has no nested lock or UI',()=>{const wrapper=bseReviewTelegramTreatmentByReference_.toString(),core=bseTreatmentReviewCore_.toString();if(!/bseReviewWithLock_/.test(wrapper)||/LockService|SpreadsheetApp\.getUi|Session\./.test(core))throw new Error('wrapper/core boundary tidak selamat');});
  pass('reject audit only and retry baseline unchanged',()=>{let failed=false;try{bseTreatmentRequireDecision_('REJECTED','');}catch(_){failed=true;}const eventId='BSE-SB-TX-20260922-001',events=[['sk','2',eventId,batch[2],'2026-09-22','Timun','Semburan','[\"M2P1\"]','COMPLETED','VERIFIED_TEST','','','','h']],links=[['sk','2',eventId,batch[2],allocations[0][3],'M2P1','2026-09-22','h']],before=JSON.stringify({events:events,links:links,allocations:allocations});bseTreatmentAssertApprovedRows_(events,links,'sk','h',['M2P1'],eventId,batch[2]);if(!failed||before!==JSON.stringify({events:events,links:links,allocations:allocations})||/Tasks\./.test(bseReviewTelegramTreatmentByReference_.toString()))throw new Error('audit/retry tidak selamat');});
  console.log('TREATMENT_REVIEW_HARNESS: '+JSON.stringify(tests));const failures=tests.filter(test=>!test.pass);if(failures.length)throw new Error('Treatment review harness gagal: '+failures.map(test=>test.id).join(', '));return tests;
}



function bseTreatmentListPlots_(text){
  const source=String(text||'').toUpperCase(),plots=[];
  const compact=source.match(/M\s*([1-9]\d*)\s*[- ]?\s*P\s*([1-9]\d*)/g)||[];
  compact.forEach(token=>{const m=token.match(/M\s*([1-9]\d*)\s*[- ]?\s*P\s*([1-9]\d*)/);if(!m)return;const module=m[1],digits=m[2];if(digits.length===1)plots.push('M'+module+'P'+digits);else if(digits.length===2&&digits[0]!=='0'&&digits[1]!=='0')digits.split('').forEach(plot=>plots.push('M'+module+'P'+plot));});
  const module=source.match(/\bM\s*([1-9]\d*)\b/);
  if(module){const re=/\bP\s*([1-9])\b/g;let m;while((m=re.exec(source)))plots.push('M'+module[1]+'P'+m[1]);}
  return Array.from(new Set(plots)).sort(bseCropBatchPlotCompare_);
}

function bseTreatmentListCrop_(text){
  const source=String(text||''),m=source.match(/(?:Jenis\s+Tanaman|Tanaman|Crop)\s*[:=-]?\s*([^\n]+)/i);
  return m?String(m[1]||'').trim():'';
}

function bseTreatmentListDate_(text,receivedAt){
  const source=String(text||''),m=source.match(/(?:Tarikh\s+Rawatan|Tarikh|Date)\s*[:=-]?\s*(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})/i)||source.match(/^\s*\*?(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})\*?\s*$/im);
  if(m){
    const day=Number(m[1]),month=Number(m[2]),year=Number(m[3].length===2?'20'+m[3]:m[3]),d=new Date(Date.UTC(year,month-1,day));
    if(year===2026&&d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day)return year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    return '';
  }
  if(!receivedAt)return '';
  const d=new Date(receivedAt);if(isNaN(d.getTime()))return '';
  return Utilities.formatDate(d,'Asia/Kuala_Lumpur','yyyy-MM-dd');
}

function bseTreatmentListItems_(text){
  const lines=String(text||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean),items=[];
  lines.forEach(line=>{
    if(/^(?:RACUN|CADANGAN\s+MERACUN|RAWATAN\s+DIBUAT)$/i.test(line))return;
    if(/^\*?\d{1,2}[\/-]\d{1,2}[\/-](?:\d{2}|\d{4})\*?$/i.test(line))return;
    if(/^(?:ISNIN|SELASA|RABU|KHAMIS|JUMAAT|SABTU|AHAD|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)$/i.test(line.replace(/\*/g,'')))return;
    if(/^\*?\d+\.\s*M\s*\d+\s*[- ]?\s*P\s*\d+(?:\s+[^*]+)?\*?$/i.test(line))return;
    if(/^(?:Jenis\s+Tanaman|Tanaman|Crop|Tarikh|Date|Plot|Modul)\s*[:=-]?/i.test(line))return;
    if(/^M\s*\d+/i.test(line))return;
    const m=line.match(/^(.+?)\s*(?:-|:|=)\s*(\d+(?:[.,]\d+)?)\s*$/);
    if(m)items.push({product:String(m[1]||'').trim(),dosage:Number(String(m[2]).replace(',','.'))});
  });
  return items;
}

function bseTreatmentListParseMessage_(text,receivedAt){
  const source=String(text||'').trim();
  if(!source)return null;
  // Numbered treatment sections are independent records. Never pool doses across crops/plots.
  const headings=[...source.matchAll(/^\s*\*?\d+\.\s*(M\s*\d+)(?:\s*[- ]\s*(P\s*\d+))?\s+([^\n*]+)\*?\s*$/gim)];
  if(headings.length>1){
    const eventDate=bseTreatmentListDate_(source,receivedAt),candidates=[];
    headings.forEach((heading,i)=>{
      const segment=source.slice(heading.index+heading[0].length,i+1<headings.length?headings[i+1].index:source.length);
      const items=bseTreatmentListItems_(segment),module=heading[1].replace(/\s+/g,'').toUpperCase();
      const plots=heading[2]?bseTreatmentListPlots_(module+' '+heading[2]):[];
      const crop=String(heading[3]||'').trim().replace(/^[-\s]+/,'').replace(/\*+$/,'').trim();
      const description=items.map(item=>item.product+' - '+item.dosage).join('\n');
      const missing=[];if(!crop)missing.push('crop');if(!plots.length)missing.push('plot_ids');
      if(!description)missing.push('treatment_description');if(!eventDate)missing.push('event_date');
      candidates.push({target:'Treatment_Event_Log',validation:'NEED_INFO',missing:Array.from(new Set(missing.concat('active_allocation_unverified'))),fields:{project_id:'BSE_SB',system_year:2026,event_date:eventDate,record_type:'TREATMENT_EVENT',verification_status:'PROVISIONAL',original_note:source,crop:crop,treatment_description:description,plot_ids:plots,event_status:'COMPLETED',router_confidence:'LOW'}});
    });
    return {validation:'NEED_INFO',production_write:false,candidates:candidates};
  }
  const items=bseTreatmentListItems_(source),plots=bseTreatmentListPlots_(source),crop=bseTreatmentListCrop_(source);
  const labelledDescription=(source.match(/^\s*Rawatan\s*:\s*(.+?)\s*$/im)||[,''])[1].trim();
  const description=labelledDescription||items.map(item=>item.product+' - '+item.dosage).join('\n');
  const workflowSignal=/^\s*(?:CADANGAN\s+MERACUN|RAWATAN\s+DIBUAT)\s*$/im.test(source)||items.length>0&&plots.length>0;
  if(!workflowSignal)return null;
  const eventDate=bseTreatmentListDate_(source,receivedAt);
  const missing=[];
  if(!crop)missing.push('crop');
  if(!plots.length)missing.push('plot_ids');
  if(!description)missing.push('treatment_description');
  if(!eventDate)missing.push('event_date');
  const fields={
    project_id:'BSE_SB',system_year:2026,event_date:eventDate,record_type:'TREATMENT_EVENT',
    verification_status:'PROVISIONAL',original_note:source,crop:crop,
    treatment_description:description,plot_ids:plots,event_status:'COMPLETED',
    router_confidence:missing.length?'LOW':'HIGH'
  };
  return {validation:missing.length?'NEED_INFO':'PASS',production_write:false,candidates:[{
    target:'Treatment_Event_Log',validation:missing.length?'NEED_INFO':'PASS',missing:missing,fields:fields
  }]};
}

function bseTreatmentFinalizeResult_(book,rawResult,job){
  if(!rawResult||rawResult.production_write!==false||!Array.isArray(rawResult.candidates)||!rawResult.candidates.length)return rawResult;
  if(!rawResult.candidates.every(c=>c&&c.target==='Treatment_Event_Log'))return rawResult;
  return bseTreatmentReconcileCandidates_(book,rawResult);
}

function runBseTreatmentD043AcceptanceHarnessTests(){
  const msg='CADANGAN MERACUN\nJenis Tanaman: Timun\nM3 P1 P2\nAcerio - 30\nAbamectin - 20';
  const result=bseTreatmentListParseMessage_(msg,'2026-10-04T07:00:00.000Z');
  const f=result.candidates[0].fields;
  const replayMsg='RAWATAN DIBUAT\nJenis Tanaman: Timun\nM2P1\nRawatan: Semburan racun kulat';
  const replay=bseTreatmentListParseMessage_(replayMsg,'2026-09-22T06:56:47.042Z');
  const rf=replay&&replay.candidates&&replay.candidates[0]&&replay.candidates[0].fields||{};
  const liveMsg='Racun\n22/10/2026\nKHAMIS\n\n1. M3 - P34\nAmirstartop-200\nCalcium - 300\nKhoros -80\nCyperup-100\nGam';
  const live=bseTreatmentListParseMessage_(liveMsg,'2026-10-10T13:00:00.000Z'),lf=live&&live.candidates&&live.candidates[0]&&live.candidates[0].fields||{};
  const liveBatch=['k','1','BSE-SB-CB-20260910-002','2026-09-10','Peria','Hup Nong'],liveAlloc=[['k','1',liveBatch[2],liveBatch[2]+'-PA-001','','M3P3','PLANNED'],['k','1',liveBatch[2],liveBatch[2]+'-PA-002','','M3P4','PLANNED']],liveReview=[['r','k','1','Crop_Batch_Log','h','APPROVED','','','','','','BSE-SB-CB-20260910-002']],liveStatus=[['','','','',liveBatch[2],liveAlloc[0][3],'M3P3','PLANNED','ACTIVE','2026-10-20T00:00:00.000Z'],['','','','',liveBatch[2],liveAlloc[1][3],'M3P4','PLANNED','ACTIVE','2026-10-20T00:00:00.000Z']],liveMatch=bseActiveAllocationFindMatchesByPlots_(lf.plot_ids||[],[liveBatch],liveAlloc,liveReview,liveStatus);
  const tests=[
    ['historical CADANGAN header does not create proposal state',f.event_status==='COMPLETED'],
    ['sent date is used when treatment date absent',f.event_date==='2026-10-04'],
    ['plots are canonical and complete',f.plot_ids.join('|')==='M3P1|M3P2'],
    ['dosage values are preserved without invented units',f.treatment_description==='Acerio - 30\nAbamectin - 20'&&!/(ml|mg|g|l|liter)/i.test(f.treatment_description)],
    ['RAWATAN DIBUAT labelled description is preserved',replay&&replay.validation==='PASS'&&rf.treatment_description==='Semburan racun kulat'&&rf.event_status==='COMPLETED'&&rf.event_date==='2026-09-22'&&rf.plot_ids.join('|')==='M2P1'],
    ['live Racun free-date format parses explicit date',lf.event_date==='2026-10-22'],
    ['live M3-P34 expands to M3P3 and M3P4',lf.plot_ids&&lf.plot_ids.join('|')==='M3P3|M3P4'],
    ['numbered plot heading is not misread as treatment product',lf.treatment_description==='Amirstartop - 200\nCalcium - 300\nKhoros - 80\nCyperup - 100'],
    ['crop may be omitted when ACTIVE plots identify one canonical batch',liveMatch.kind==='UNIQUE'&&liveMatch.crop==='Peria'&&liveMatch.variety==='Hup Nong'&&live.candidates[0].missing.length===1&&live.candidates[0].missing[0]==='crop'],
    ['workflow becomes one completed Treatment candidate',result.validation==='PASS'&&result.candidates.length===1&&result.candidates[0].target==='Treatment_Event_Log'],
    ['TEST only',result.production_write===false&&replay&&replay.production_write===false]
  ];
  const failures=tests.filter(t=>!t[1]);if(failures.length)throw new Error('D-043 treatment harness gagal: '+failures.map(t=>t[0]).join(', '));return tests;
}
