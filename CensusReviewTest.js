/** @OnlyCurrentDoc */
// TEST-only human review for explicit Plant Census proposals. Allocation baseline and transplant ledger are read-only.

const BSE_PLANT_CENSUS_HEADERS=['source_key','queue_update_id','census_id','batch_id','allocation_id','plot_id','census_date','crop','living_plant_count','verification_status','original_note','approved_at','reviewer','payload_hash'];
const BSE_PLANT_CENSUS_REVIEW_HEADERS=['review_id','source_key','queue_update_id','target','payload_hash','decision','reviewer','review_note','reviewed_at','queue_status_before','candidate_json','census_ids','batch_id'];

function approveTelegramPlantCensusByReference(){const reference=bsePromptPlantCensusReference_('Lulus Banci Pokok TEST');if(reference)return bseReviewTelegramPlantCensusByReference_('APPROVED',reference,'');}
function rejectTelegramPlantCensusByReference(){
  const reference=bsePromptPlantCensusReference_('Tolak Banci Pokok TEST');if(!reference)return;
  const ui=SpreadsheetApp.getUi(),response=ui.prompt('Tolak Banci Pokok TEST','Nyatakan sebab penolakan:',ui.ButtonSet.OK_CANCEL);
  if(response.getSelectedButton()!==ui.Button.OK)return;
  const note=response.getResponseText().trim();if(!note)throw new Error('Sebab penolakan wajib diisi.');
  return bseReviewTelegramPlantCensusByReference_('REJECTED',reference,note);
}
function bsePromptPlantCensusReference_(title){
  const ui=SpreadsheetApp.getUi(),response=ui.prompt(title,'Masukkan rujukan tepat, contohnya BSE-TG-123456:',ui.ButtonSet.OK_CANCEL);
  if(response.getSelectedButton()!==ui.Button.OK)return '';
  const reference=response.getResponseText().trim();if(!/^BSE-TG-\d+$/.test(reference))throw new Error('Rujukan mesti tepat dalam format BSE-TG-<update_id>.');return reference;
}

function bseReviewTelegramPlantCensusByReference_(decision,reference,note){
  bseCensusRequireDecision_(decision,note);if(!/^BSE-TG-\d+$/.test(reference))throw new Error('Rujukan mesti tepat dalam format BSE-TG-<update_id>.');
  const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw new Error('Barisan sedang dikemas kini. Cuba semula.');
  try{
    const book=boundTestBook_(),queue=bseTelegramQueue_(book),rows=bseCropBatchRows_(queue,BSE_TG_QUEUE_HEADERS.length),updateId=reference.slice(7);
    const matches=rows.map((row,index)=>({row:row,sheetRow:index+2})).filter(item=>String(item.row[0])===updateId);
    if(matches.length!==1)throw new Error('Rujukan mesti sepadan dengan tepat satu baris TELEGRAM_TEST_QUEUE.');
    const selected=matches[0],status=String(selected.row[6]||''),root=bseCropBatchRoot_(rows,selected.row),proposal=bseCensusProposal_(selected.row[9],root.provenance);
    const sourceKey='BSE-TG-'+root.updateId+'|Plant_Census_Log',payloadHash=bseCropBatchHash_(proposal.canonical),expectedStatus=decision==='APPROVED'?'PLANT_CENSUS_APPROVED_TEST':'PLANT_CENSUS_REJECTED_TEST';
    const reviewSheet=book.getSheetByName('TEST_PLANT_CENSUS_REVIEW')?bseCropBatchSheet_(book,'TEST_PLANT_CENSUS_REVIEW',BSE_PLANT_CENSUS_REVIEW_HEADERS):null;
    const censusSheet=book.getSheetByName('TEST_PLANT_CENSUS')?bseCropBatchSheet_(book,'TEST_PLANT_CENSUS',BSE_PLANT_CENSUS_HEADERS):null;
    const reviews=reviewSheet?bseCropBatchRows_(reviewSheet,BSE_PLANT_CENSUS_REVIEW_HEADERS.length):[],censusRows=censusSheet?bseCropBatchRows_(censusSheet,BSE_PLANT_CENSUS_HEADERS.length):[];
    const prior=reviews.find(row=>String(row[1])===sourceKey);
    if(prior){
      if(String(prior[4])!==payloadHash||String(prior[5])!==decision)throw new Error('Konflik semakan sedia ada untuk source_key ini.');
      const censusIds=String(prior[11]||'').split('|').filter(Boolean),batchId=String(prior[12]||'');
      if(decision==='APPROVED')bseCensusAssertApprovedRows_(censusRows,sourceKey,payloadHash,proposal.entries,censusIds,batchId);
      else if(censusRows.some(row=>String(row[0])===sourceKey))throw new Error('Audit REJECTED bercanggah dengan rekod Banci Pokok TEST.');
      if(status===expectedStatus)return {source_key:sourceKey,decision:decision,duplicate:true,production_write:false};
      if(status!=='NEEDS_HUMAN_REVIEW')throw new Error('Status queue tidak konsisten dengan audit Banci Pokok sedia ada.');
      queue.getRange(selected.sheetRow,7).setValue(expectedStatus);SpreadsheetApp.flush();return {source_key:sourceKey,decision:decision,duplicate:true,production_write:false};
    }
    if(status!=='NEEDS_HUMAN_REVIEW')throw new Error('Baris queue bukan NEEDS_HUMAN_REVIEW.');
    if(censusRows.some(row=>String(row[0])===sourceKey))throw new Error('Konflik rekod Banci Pokok TEST sedia ada.');
    const match=bseCensusMatchForBook_(book,proposal);if(decision==='APPROVED'&&match.kind!=='UNIQUE')throw new Error('Batch Crop Batch atau allocation ACTIVE tidak sepadan; tiada write dibuat.');
    const reviewer=bseCropBatchReviewer_(),stamp=new Date().toISOString(),reviewOut=reviewSheet||bseCropBatchSheet_(book,'TEST_PLANT_CENSUS_REVIEW',BSE_PLANT_CENSUS_REVIEW_HEADERS);let censusIds=[],batchId='';
    if(decision==='APPROVED'){
      const censusOut=censusSheet||bseCropBatchSheet_(book,'TEST_PLANT_CENSUS',BSE_PLANT_CENSUS_HEADERS);batchId=match.batch_id;censusIds=bseCensusNextIds_(censusRows,proposal.fields.event_date,proposal.entries.length);
      proposal.entries.forEach((entry,index)=>{const allocation=match.allocations.find(item=>item.plot_id===entry.plot_id);bseCropBatchAppend_(censusOut,[sourceKey,root.updateId,censusIds[index],batchId,allocation.allocation_id,entry.plot_id,proposal.fields.event_date,proposal.fields.crop,entry.living_plant_count,'VERIFIED_TEST',root.provenance,stamp,reviewer,payloadHash]);});
      SpreadsheetApp.flush();
    }
    bseCropBatchAppend_(reviewOut,[Utilities.getUuid(),sourceKey,root.updateId,'Plant_Census_Log',payloadHash,decision,reviewer,String(note||'').trim(),stamp,status,JSON.stringify(proposal.canonical),censusIds.join('|'),batchId]);
    SpreadsheetApp.flush();queue.getRange(selected.sheetRow,7).setValue(expectedStatus);SpreadsheetApp.flush();
    console.log('PLANT_CENSUS_REVIEW_SAVED: '+JSON.stringify({source_key:sourceKey,decision:decision,production_write:false}));
    return {source_key:sourceKey,decision:decision,duplicate:false,production_write:false};
  }finally{lock.releaseLock();}
}

function bseCensusRequireDecision_(decision,note){if(!['APPROVED','REJECTED'].includes(decision))throw new Error('Keputusan semakan tidak sah.');if(decision==='REJECTED'&&!String(note||'').trim())throw new Error('Sebab penolakan wajib diisi.');}
function bseCensusProposal_(encoded,original){
  let result;try{result=JSON.parse(String(encoded||''));}catch(_){throw new Error('candidate_json tidak sah.');}
  if(!result||typeof result!=='object'||Array.isArray(result)||Object.keys(result).some(key=>!['validation','production_write','candidates'].includes(key))||result.validation!=='PASS'||result.production_write!==false||!Array.isArray(result.candidates)||result.candidates.length!==1)throw new Error('Hasil Banci Pokok TEST tidak sah.');
  const candidate=result.candidates[0],fields=candidate&&candidate.fields,allowed=['project_id','system_year','event_date','record_type','verification_status','original_note','crop','census_entries'];
  if(!candidate||candidate.target!=='Plant_Census_Log'||candidate.validation!=='PASS'||!Array.isArray(candidate.missing)||candidate.missing.length||!fields||typeof fields!=='object'||Array.isArray(fields)||Object.keys(fields).some(key=>!allowed.includes(key))||fields.project_id!=='BSE_SB'||fields.system_year!==2026||fields.record_type!=='PLANT_CENSUS'||fields.verification_status!=='PROVISIONAL'||fields.original_note!==original||typeof fields.crop!=='string'||!fields.crop.trim()||!bseCropBatchDate_(fields.event_date)||!Array.isArray(fields.census_entries)||!fields.census_entries.length)throw new Error('Calon Banci Pokok gagal semakan kontrak TEST.');
  const entries=fields.census_entries.map(entry=>({plot_id:String(entry&&entry.plot_id||''),living_plant_count:entry&&entry.living_plant_count})).sort((left,right)=>bseCropBatchPlotCompare_(left.plot_id,right.plot_id));
  if(entries.some(entry=>!/^M[1-9]\d*P[1-9]\d*$/.test(entry.plot_id)||!Number.isInteger(entry.living_plant_count)||entry.living_plant_count<0)||new Set(entries.map(entry=>entry.plot_id)).size!==entries.length||JSON.stringify(entries)!==JSON.stringify(fields.census_entries))throw new Error('Entry Banci Pokok mesti unik, diisih kanonik, dan mempunyai integer sifar atau lebih.');
  const canonical={census_date:fields.event_date,crop:fields.crop,census_entries:entries,verification_status:'PROVISIONAL',original_note:original,production_write:false};
  return {fields:fields,entries:entries,canonical:canonical};
}

function bseActiveAllocationEffectiveStatuses_(statusEvents){
  const latest={};statusEvents.forEach((row,index)=>{const allocationId=String(row[5]||''),stamp=Date.parse(String(row[9]||'')),value=Number.isFinite(stamp)?stamp:-1,prior=latest[allocationId];if(allocationId&&(!prior||value>prior.value||value===prior.value&&index>prior.index))latest[allocationId]={status:String(row[8]||''),value:value,index:index};});
  return latest;
}
function bseActiveAllocationFindMatches_(cropValue,plotIds,batches,allocations,reviews,statusEvents){
  const crop=bseTransplantNormalizeCrop_(cropValue),approved=new Set(reviews.filter(row=>String(row[3])==='Crop_Batch_Log'&&String(row[5])==='APPROVED').map(row=>String(row[11]))),effective=bseActiveAllocationEffectiveStatuses_(statusEvents),matches=[];
  batches.forEach(batch=>{const batchId=String(batch[2]||'');if(!batchId||!approved.has(batchId)||bseTransplantNormalizeCrop_(batch[4])!==crop)return;const selected=plotIds.map(plotId=>{const row=allocations.find(allocation=>String(allocation[2])===batchId&&String(allocation[5])===plotId&&String(allocation[6])==='PLANNED');if(!row||!effective[String(row[3])]||effective[String(row[3])].status!=='ACTIVE')return null;return {allocation_id:String(row[3]),plot_id:plotId};});if(selected.every(Boolean))matches.push({batch_id:batchId,allocations:selected});});
  return matches.length===1?Object.assign({kind:'UNIQUE'},matches[0]):{kind:matches.length?'MULTIPLE':'NONE',matches:matches};
}
function bseCensusEffectiveStatuses_(statusEvents){return bseActiveAllocationEffectiveStatuses_(statusEvents);}
function bseCensusFindMatches_(proposal,batches,allocations,reviews,statusEvents){return bseActiveAllocationFindMatches_(proposal.fields.crop,proposal.entries.map(entry=>entry.plot_id),batches,allocations,reviews,statusEvents);}
function bseCensusMatchForBook_(book,proposal){return bseCensusFindMatches_(proposal,bseTransplantRowsByName_(book,'TEST_CROP_BATCH',BSE_CROP_BATCH_HEADERS),bseTransplantRowsByName_(book,'TEST_PLOT_ALLOCATION',BSE_PLOT_ALLOCATION_HEADERS),bseTransplantRowsByName_(book,'TEST_CROP_BATCH_REVIEW',BSE_CROP_BATCH_REVIEW_HEADERS),bseTransplantRowsByName_(book,'TEST_ALLOCATION_STATUS_EVENT',BSE_ALLOCATION_STATUS_EVENT_HEADERS));}
function bseCensusQueueGuard_(book,result){
  if(!result||!Array.isArray(result.candidates)||result.candidates.length!==1||!result.candidates[0]||result.candidates[0].target!=='Plant_Census_Log'||result.validation!=='PASS')return result;
  let proposal;try{proposal=bseCensusProposal_(JSON.stringify(result),String(result.candidates[0].fields.original_note||''));}catch(_){return bseCensusMarkNeedInfo_(result);}
  return bseCensusApplyMatch_(result,bseCensusMatchForBook_(book,proposal));
}
function bseCensusApplyMatch_(result,match){return match&&match.kind==='UNIQUE'?result:bseCensusMarkNeedInfo_(result);}
function bseCensusMarkNeedInfo_(result){result.validation='NEED_INFO';result.candidates.forEach(candidate=>{if(!candidate)return;candidate.validation='NEED_INFO';candidate.missing=Array.from(new Set((Array.isArray(candidate.missing)?candidate.missing:[]).concat(['batch_match'])));});return result;}
function bseCensusNextIds_(rows,date,count){
  if(!bseCropBatchDate_(date)||!Number.isInteger(count)||count<1)throw new Error('Tarikh atau bilangan ID banci tidak sah.');const prefix='BSE-SB-PC-'+date.replace(/-/g,'')+'-',used=rows.map(row=>String(row[2]||''));let highest=0;used.forEach(id=>{const match=id.match(new RegExp('^'+prefix+'(\\d{3})$'));if(match)highest=Math.max(highest,Number(match[1]));});if(highest+count>999)throw new Error('Siri banci harian telah penuh.');return Array.from({length:count},(_,index)=>prefix+String(highest+index+1).padStart(3,'0'));}
function bseCensusAssertApprovedRows_(rows,sourceKey,payloadHash,entries,censusIds,batchId){
  const matches=rows.filter(row=>String(row[0])===sourceKey);if(!batchId||matches.length!==entries.length||censusIds.length!==entries.length||matches.some((row,index)=>String(row[2])!==censusIds[index]||String(row[3])!==batchId||String(row[5])!==entries[index].plot_id||Number(row[8])!==entries[index].living_plant_count||String(row[9])!=='VERIFIED_TEST'||String(row[13])!==payloadHash))throw new Error('Audit APPROVED tidak sepadan dengan rekod Banci Pokok TEST.');
}

function runBsePlantCensusReviewHarnessTests(){
  const note='BANCI POKOK\nJenis Tanaman: Timun\nM2P1: 96 pokok\nM2P2: 0 pokok',candidate={validation:'PASS',production_write:false,candidates:[{target:'Plant_Census_Log',validation:'PASS',missing:[],fields:{project_id:'BSE_SB',system_year:2026,event_date:'2026-09-22',record_type:'PLANT_CENSUS',verification_status:'PROVISIONAL',original_note:note,crop:'Timun',census_entries:[{plot_id:'M2P1',living_plant_count:96},{plot_id:'M2P2',living_plant_count:0}]}}]},guarded=bseUnifiedGuard_(candidate,{received_at:'2026-09-22T00:00:00.000Z'}),proposal=bseCensusProposal_(JSON.stringify(guarded),note),batch=['BSE-TG-1|Crop_Batch_Log','1','BSE-SB-CB-20260922-001','2026-09-22','Timun','','BATCH_START','PROPOSED','PROVISIONAL','','','','hash'],allocations=[['k','1',batch[2],batch[2]+'-PA-001','2026-09-22','M2P1','PLANNED'],['k','1',batch[2],batch[2]+'-PA-002','2026-09-22','M2P2','PLANNED']],reviews=[['r','k','1','Crop_Batch_Log','hash','APPROVED','','','','','','BSE-SB-CB-20260922-001']],active=[['','', '', '',batch[2],allocations[0][3],'M2P1','PLANNED','ACTIVE','2026-09-22T01:00:00.000Z'],['','', '', '',batch[2],allocations[1][3],'M2P2','PLANNED','ACTIVE','2026-09-22T01:00:00.000Z']];
  const tests=[],pass=(id,fn)=>{try{fn();tests.push({id:id,pass:true});}catch(error){tests.push({id:id,pass:false,error:error.message});}};
  pass('ACTIVE single and multi-plot PASS',()=>{const single={fields:Object.assign({},proposal.fields,{census_entries:[proposal.entries[0]]}),entries:[proposal.entries[0]]};if(guarded.validation!=='PASS'||guarded.candidates[0].validation!=='PASS'||bseCensusFindMatches_(single,[batch],allocations,reviews,active).kind!=='UNIQUE'||bseCensusFindMatches_(proposal,[batch],allocations,reviews,active).kind!=='UNIQUE')throw new Error('ACTIVE match gagal');});
  pass('zero count remains valid for human review',()=>{if(proposal.entries[1].living_plant_count!==0||proposal.canonical.production_write!==false)throw new Error('count sifar tidak sah');});
  pass('PLANNED, none, multiple, crop mismatch become NEED_INFO',()=>{const planned=bseCensusFindMatches_(proposal,[batch],allocations,reviews,[]).kind,none=bseCensusFindMatches_(proposal,[],allocations,reviews,active).kind,multiple=bseCensusFindMatches_(proposal,[batch,batch.slice()],allocations,reviews,active).kind,crop=bseCensusFindMatches_({fields:Object.assign({},proposal.fields,{crop:'Peria'}),entries:proposal.entries},[batch],allocations,reviews,active).kind,needInfo=bseCensusApplyMatch_(JSON.parse(JSON.stringify(guarded)),{kind:planned});if(planned!=='NONE'||none!=='NONE'||multiple!=='MULTIPLE'||crop!=='NONE'||needInfo.validation!=='NEED_INFO'||needInfo.candidates[0].missing.indexOf('batch_match')<0)throw new Error('guard batch tidak ketat');});
  pass('missing or ambiguous count is rejected',()=>{const missing=bsePlantCensusSource_('BANCI POKOK\nJenis Tanaman: Timun\nM2P1: pokok'),ambiguous=bsePlantCensusSource_('BANCI POKOK\nJenis Tanaman: Timun\nM2 P1: 96 pokok');if(missing.ok||ambiguous.ok)throw new Error('format samar diterima');});
  pass('approve retry is idempotent and baseline unchanged',()=>{const hash='h',ids=['BSE-SB-PC-20260922-001','BSE-SB-PC-20260922-002'],rows=proposal.entries.map((entry,index)=>['sk','2',ids[index],batch[2],allocations[index][3],entry.plot_id,'2026-09-22','Timun',entry.living_plant_count,'VERIFIED_TEST','','','','h']),before=JSON.stringify({rows:rows,allocations:allocations});bseCensusAssertApprovedRows_(rows,'sk',hash,proposal.entries,ids,batch[2]);if(before!==JSON.stringify({rows:rows,allocations:allocations}))throw new Error('retry atau baseline berubah');});
  pass('reject requires reason and audit-only contract',()=>{let failed=false;try{bseCensusRequireDecision_('REJECTED','');}catch(_){failed=true;}if(!failed||/Tasks\./.test(bseReviewTelegramPlantCensusByReference_.toString()))throw new Error('reject atau Google Tasks tidak selamat');});
  console.log('PLANT_CENSUS_REVIEW_HARNESS: '+JSON.stringify(tests));const failures=tests.filter(test=>!test.pass);if(failures.length)throw new Error('Plant Census review harness gagal: '+failures.map(test=>test.id).join(', '));return tests;
}
