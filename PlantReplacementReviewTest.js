/** @OnlyCurrentDoc */
// TEST-only Plant Replacement / Sulam domain.
// A replacement event records an explicit field action only. It never mutates
// Plant Census or the baseline Plot Allocation authority.

const BSE_PLANT_REPLACEMENT_LOG_HEADERS=[
  'source_key','queue_update_id','event_id','event_date','plot_id','module_id',
  'batch_id','allocation_id','crop','replacement_count','replacement_type',
  'reported_by','reported_by_telegram_user_id','source_message_id','evidence_reference',
  'verification_status','production_write','original_note','confirmed_at','reviewer','payload_hash'
];
const BSE_PLANT_REPLACEMENT_REVIEW_HEADERS=[
  'review_id','source_key','queue_update_id','target','payload_hash','decision',
  'reviewer','review_note','reviewed_at','queue_status_before','candidate_json',
  'event_id','batch_id','allocation_id'
];

function bsePlantReplacementSheet_(book,name,headers){
  let sheet=book.getSheetByName(name);
  if(!sheet)sheet=book.insertSheet(name);
  bseEnsureAdditiveHeaders_(sheet,headers);
  return sheet;
}
function bsePlantReplacementRows_(sheet,width){
  return sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues():[];
}
function bsePlantReplacementSignal_(text){
  return /\b(?:sulam|ganti\s+anak\s+pokok|tambah\s+anak\s+pokok|replacement)\b/i.test(String(text||''));
}
function bsePlantReplacementDate_(text,receivedAt){
  const source=String(text||''),m=source.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})\b/);
  if(m){
    const day=Number(m[1]),month=Number(m[2]),year=Number(m[3].length===2?'20'+m[3]:m[3]),d=new Date(Date.UTC(year,month-1,day));
    if(year===2026&&d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day)return year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    return '';
  }
  const d=new Date(receivedAt||'');
  return isNaN(d.getTime())?'':Utilities.formatDate(d,'Asia/Kuala_Lumpur','yyyy-MM-dd');
}
function bsePlantReplacementLocation_(text){
  const m=String(text||'').toUpperCase().match(/\bM\s*([1-9]\d*)\s*P\s*([1-9]\d*)\b/);
  return m?{plot_id:'M'+m[1]+'P'+m[2],module_id:'M'+m[1]}:{plot_id:'',module_id:''};
}
function bsePlantReplacementCrop_(text){
  const m=String(text||'').match(/(?:Jenis\s+Tanaman|Tanaman|Crop)\s*[:=-]?\s*([^\n]+)/i);
  return m?String(m[1]||'').trim():'';
}
function bsePlantReplacementCount_(text){
  const source=String(text||'');
  let m=source.match(/\b(?:sulam|ganti\s+anak\s+pokok|tambah\s+anak\s+pokok|replacement)\b\s*[:=-]?\s*(\d+)\s*(?:pokok|anak\s+pokok)?\b/i);
  if(!m)m=source.match(/\b(\d+)\s*(?:pokok|anak\s+pokok)\b[^\n]{0,24}\b(?:sulam|replacement)\b/i);
  return m?Number(m[1]):null;
}
function bsePlantReplacementParseMessage_(text,receivedAt){
  const source=String(text||'').trim();
  if(!source||!bsePlantReplacementSignal_(source))return null;
  const loc=bsePlantReplacementLocation_(source),count=bsePlantReplacementCount_(source),eventDate=bsePlantReplacementDate_(source,receivedAt),crop=bsePlantReplacementCrop_(source);
  const missing=[];
  if(!eventDate)missing.push('event_date');
  if(!loc.plot_id)missing.push('plot_id');
  if(!Number.isInteger(count)||count<=0)missing.push('replacement_count');
  if(!crop)missing.push('crop');
  const fields={
    project_id:'BSE_SB',system_year:2026,record_type:'PLANT_REPLACEMENT',
    event_date:eventDate,plot_id:loc.plot_id,module_id:loc.module_id,crop:crop,
    replacement_count:count,replacement_type:'SULAM',
    reported_by:'',reported_by_telegram_user_id:'',source_message_id:'',
    evidence_refs:[],verification_status:'PROVISIONAL',original_note:source,
    production_write:false
  };
  return {validation:missing.length?'NEED_INFO':'PASS',production_write:false,candidates:[{
    target:'Plant_Replacement_Event_Log',validation:missing.length?'NEED_INFO':'PASS',
    missing:missing,fields:fields
  }]};
}
function bsePlantReplacementApplyReporterSnapshot_(result,job){
  if(!result||!Array.isArray(result.candidates)||!job)return result;
  result.candidates.forEach(candidate=>{
    if(!candidate||candidate.target!=='Plant_Replacement_Event_Log')return;
    const f=candidate.fields||(candidate.fields={}),id=String(job.reporterTelegramUserId||'');
    f.reported_by=String(job.reporterName||job.reporterUsername||(id?'Telegram '+id:'')).trim();
    f.reported_by_telegram_user_id=id;
    f.source_message_id=String(job.messageId||job.rootId||'');
  });
  return result;
}
function bsePlantReplacementActiveMatchByPlot_(book,eventDate,plotId){
  const batches=bseTransplantRowsByName_(book,'TEST_CROP_BATCH',BSE_CROP_BATCH_HEADERS);
  const allocations=bseTransplantRowsByName_(book,'TEST_PLOT_ALLOCATION',BSE_PLOT_ALLOCATION_HEADERS);
  const reviews=bseTransplantRowsByName_(book,'TEST_CROP_BATCH_REVIEW',BSE_CROP_BATCH_REVIEW_HEADERS);
  const statuses=bseTransplantRowsByName_(book,'TEST_ALLOCATION_STATUS_EVENT',BSE_ALLOCATION_STATUS_EVENT_HEADERS);
  const transplants=bseTransplantRowsByName_(book,'TEST_TRANSPLANT_EVENT',BSE_TRANSPLANT_EVENT_HEADERS);
  const eligible=bseCensusStatusEventsAsOf_(eventDate,statuses,transplants);
  return bseActiveAllocationFindMatchesByPlots_([plotId],batches,allocations,reviews,eligible);
}
function bsePlantReplacementResolveOperationalContext_(book,result){
  const out=JSON.parse(JSON.stringify(result));
  if(!out||!Array.isArray(out.candidates)||out.candidates.length!==1)return out;
  const c=out.candidates[0],f=c&&c.fields||{};
  if(c.target!=='Plant_Replacement_Event_Log')return out;
  if(f.event_date&&f.plot_id){
    const match=bsePlantReplacementActiveMatchByPlot_(book,f.event_date,f.plot_id);
    if(match.kind==='UNIQUE'){
      if(!String(f.crop||'').trim())f.crop=String(match.crop||'').trim();
      if(String(f.crop||'').trim()&&bseTransplantNormalizeCrop_(f.crop)!==bseTransplantNormalizeCrop_(match.crop)){
        c.missing=Array.from(new Set((c.missing||[]).concat(['batch_match'])));
      }
    }else c.missing=Array.from(new Set((c.missing||[]).concat(['batch_match'])));
  }
  c.missing=(c.missing||[]).filter(key=>!(key==='crop'&&String(f.crop||'').trim()));
  c.validation=c.missing.length?'NEED_INFO':'PASS';
  out.validation=c.validation;
  return out;
}
function bsePlantReplacementFinalizeResult_(book,result,job){
  const resolved=bsePlantReplacementResolveOperationalContext_(book,result);
  bsePlantReplacementApplyReporterSnapshot_(resolved,job);
  return bseTelegramWorkerFinalizeResult_(book,resolved,job);
}
function bsePlantReplacementValidateCandidate_(result){
  if(!result||result.production_write!==false||result.validation!=='PASS'||!Array.isArray(result.candidates)||result.candidates.length!==1)throw new Error('Plant Replacement bukan calon TEST PASS yang selamat.');
  const c=result.candidates[0],f=c&&c.fields||{};
  if(!c||c.target!=='Plant_Replacement_Event_Log'||c.validation!=='PASS'||!Array.isArray(c.missing)||c.missing.length)throw new Error('Calon Plant Replacement tidak sah.');
  if(f.project_id!=='BSE_SB'||f.system_year!==2026||f.record_type!=='PLANT_REPLACEMENT'||f.verification_status!=='PROVISIONAL'||f.production_write!==false)throw new Error('Kontrak Plant Replacement TEST tidak sah.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(f.event_date||''))||!/^M[1-9]\d*P[1-9]\d*$/.test(String(f.plot_id||''))||!String(f.crop||'').trim()||!Number.isInteger(Number(f.replacement_count))||Number(f.replacement_count)<=0||String(f.replacement_type||'')!=='SULAM')throw new Error('Fakta Plant Replacement tidak lengkap.');
  return {candidate:c,fields:f};
}
function bsePlantReplacementReviewCore_(book,reviewContext){
  const context=bseReviewContextValidate_(reviewContext);
  if(context.action!=='APPROVED')throw new Error('Plant Replacement hanya direkod selepas Benar penghantar.');
  const picked=bsePlantReplacementValidateCandidate_(context.proposalResult),c=picked.candidate,f=picked.fields;
  const match=bsePlantReplacementActiveMatchByPlot_(book,f.event_date,f.plot_id);
  if(match.kind!=='UNIQUE'||bseTransplantNormalizeCrop_(match.crop)!==bseTransplantNormalizeCrop_(f.crop))throw new Error('Allocation ACTIVE Plant Replacement tidak sepadan; tiada write dibuat.');
  const payloadHash=bseApprovalHash_(c),sourceKey=String(context.reference)+'|Plant_Replacement_Event_Log';
  const stamp=new Date().toISOString(),reviewer=String(context.actor_name||context.actor_id||'TEST_OPERATOR');
  const log=bsePlantReplacementSheet_(book,'TEST_PLANT_REPLACEMENT_EVENT',BSE_PLANT_REPLACEMENT_LOG_HEADERS);
  const review=bsePlantReplacementSheet_(book,'TEST_PLANT_REPLACEMENT_REVIEW',BSE_PLANT_REPLACEMENT_REVIEW_HEADERS);
  const logs=bsePlantReplacementRows_(log,BSE_PLANT_REPLACEMENT_LOG_HEADERS.length),reviews=bsePlantReplacementRows_(review,BSE_PLANT_REPLACEMENT_REVIEW_HEADERS.length);
  const priorLog=logs.find(r=>String(r[0])===sourceKey),priorReview=reviews.find(r=>String(r[1])===sourceKey);
  if(priorReview){
    if(String(priorReview[4])!==payloadHash||String(priorReview[5])!=='APPROVED')throw new Error('Konflik audit Plant Replacement sedia ada.');
    if(!priorLog||String(priorLog[20])!==payloadHash)throw new Error('Audit Plant Replacement tidak sepadan dengan log.');
    return {source_key:sourceKey,event_id:String(priorLog[2]||''),duplicate:true,production_write:false};
  }
  if(priorLog)throw new Error('Log Plant Replacement tanpa audit ditemui; tiada write tambahan dibuat.');
  const eventId='BSE-SB-PR-'+payloadHash.slice(0,12);
  const evidence=Array.isArray(f.evidence_refs)?f.evidence_refs.join(','):String(f.evidence_reference||'');
  log.appendRow([
    sourceKey,String(context.reference).replace(/^BSE-TG-/,''),eventId,f.event_date,f.plot_id,f.module_id||String(f.plot_id).split('P')[0],
    match.batch_id,String(match.allocations[0]&&match.allocations[0].allocation_id||''),f.crop,Number(f.replacement_count),'SULAM',
    f.reported_by||'',f.reported_by_telegram_user_id||'',f.source_message_id||String(context.reference).replace(/^BSE-TG-/,''),evidence,
    'VERIFIED_TEST',false,f.original_note||'',stamp,reviewer,payloadHash
  ]);
  SpreadsheetApp.flush();
  review.appendRow([
    Utilities.getUuid(),sourceKey,String(context.reference).replace(/^BSE-TG-/,''),'Plant_Replacement_Event_Log',
    payloadHash,'APPROVED',reviewer,'',stamp,'NEEDS_HUMAN_REVIEW',JSON.stringify(c),eventId,match.batch_id,
    String(match.allocations[0]&&match.allocations[0].allocation_id||'')
  ]);
  SpreadsheetApp.flush();
  if(typeof bseEvidenceLinkMany_==='function'&&bseEvidenceRefs_(f.evidence_refs||f.evidence_reference||[]).length){
    bseEvidenceLinkMany_(book,{
      evidence_refs:f.evidence_refs||f.evidence_reference||[],
      domain_record_type:'PLANT_REPLACEMENT',domain_record_id:eventId,
      link_reason:'DOMAIN_SUPPORT',source_message_id:f.source_message_id||String(context.reference||''),
      linked_by:reviewer,production_write:false
    });
  }
  return {source_key:sourceKey,event_id:eventId,batch_id:match.batch_id,allocation_id:String(match.allocations[0]&&match.allocations[0].allocation_id||''),duplicate:false,production_write:false};
}
function bsePlantReplacementConfirmedSummaryFromRows_(reference,rows){
  const row=(rows||[])[(rows||[]).length-1];if(!row)return '';
  return [
    'REKOD SULAM / PLANT REPLACEMENT',
    'Rujukan : '+String(reference||''),
    'Tarikh : '+bseApprovalDisplayDate_(row[3]),
    'Plot : '+String(row[4]||''),
    'Tanaman : '+String(row[8]||''),
    'Bilangan sulam : '+String(row[9]||'')+' pokok',
    'Status : REPORTER_CONFIRMED',
    'Nota : rekod ini tidak mengubah Plant Census secara automatik.',
    'Mod TEST - tiada rekod production ditulis.'
  ].join('\n');
}
function bsePlantReplacementConfirmedSummary_(book,reference,outcome){
  const key=String(outcome&&outcome.source_key||'');if(!key)return '';
  const rows=bsePlantReplacementRows_(bsePlantReplacementSheet_(book,'TEST_PLANT_REPLACEMENT_EVENT',BSE_PLANT_REPLACEMENT_LOG_HEADERS),BSE_PLANT_REPLACEMENT_LOG_HEADERS.length).filter(r=>String(r[0])===key);
  return bsePlantReplacementConfirmedSummaryFromRows_(reference,rows);
}
function installBsePlantReplacementSchemaTest(){
  if(bseRuntimeEnvironmentName_()!=='PILOT_TEST')throw new Error('Plant Replacement schema installer hanya untuk PILOT_TEST.');
  const book=boundTestBook_();
  bsePlantReplacementSheet_(book,'TEST_PLANT_REPLACEMENT_EVENT',BSE_PLANT_REPLACEMENT_LOG_HEADERS);
  bsePlantReplacementSheet_(book,'TEST_PLANT_REPLACEMENT_REVIEW',BSE_PLANT_REPLACEMENT_REVIEW_HEADERS);
  SpreadsheetApp.flush();
  return {event_sheet:bseRuntimeSheetName_('TEST_PLANT_REPLACEMENT_EVENT'),review_sheet:bseRuntimeSheetName_('TEST_PLANT_REPLACEMENT_REVIEW'),production_write:false};
}

function runBsePlantReplacementAcceptanceHarnessTests(){
  const parsed=bsePlantReplacementParseMessage_('12/10/2026 Sulam 20 pokok M3P3','2026-10-12T00:00:00.000Z');
  const explicit=bsePlantReplacementParseMessage_('Sulam 12 pokok M2P1\nTanaman: Timun','2026-10-12T00:00:00.000Z');
  const condition=bsePlantConditionParseMessage_('Sulam 20 pokok M3P3','2026-10-12T00:00:00.000Z');
  const f=parsed.candidates[0].fields,e=explicit.candidates[0].fields;
  const tests=[
    {id:'replacement wording routes to dedicated target',pass:parsed&&parsed.candidates[0].target==='Plant_Replacement_Event_Log'&&f.replacement_count===20&&f.plot_id==='M3P3'&&f.event_date==='2026-10-12'},
    {id:'explicit crop is preserved',pass:e.crop==='Timun'&&e.replacement_count===12&&explicit.validation==='PASS'},
    {id:'missing crop waits for active allocation resolution',pass:parsed.validation==='NEED_INFO'&&parsed.candidates[0].missing.includes('crop')},
    {id:'plant condition continues to reject replacement wording',pass:condition===null},
    {id:'replacement event never contains census mutation field',pass:!Object.prototype.hasOwnProperty.call(f,'living_plant_count')&&!Object.prototype.hasOwnProperty.call(f,'healthy_count')},
    {id:'TEST only',pass:parsed.production_write===false&&f.production_write===false}
  ];
  const failed=tests.filter(t=>!t.pass);if(failed.length)throw new Error('Plant Replacement acceptance harness gagal: '+failed.map(t=>t.id).join(', '));return tests;
}
function runBsePlantReplacementApprovalHarnessTests(){
  const result={validation:'PASS',production_write:false,candidates:[{target:'Plant_Replacement_Event_Log',validation:'PASS',missing:[],fields:{
    project_id:'BSE_SB',system_year:2026,record_type:'PLANT_REPLACEMENT',event_date:'2026-10-12',plot_id:'M3P3',module_id:'M3',crop:'Peria',
    replacement_count:20,replacement_type:'SULAM',reported_by:'Reporter',reported_by_telegram_user_id:'1',source_message_id:'2',evidence_refs:[],
    verification_status:'PROVISIONAL',original_note:'Sulam 20 pokok M3P3',production_write:false
  }}]};
  const summary=bsePlantReplacementConfirmedSummaryFromRows_('BSE-TG-1',[['key','1','event',new Date('2026-10-12T00:00:00.000+08:00'),'M3P3','M3','batch','alloc','Peria',20,'SULAM','','','','','VERIFIED_TEST',false,'','','','hash']]);
  const core=bsePlantReplacementReviewCore_.toString();
  const tests=[
    {id:'approval domain has dedicated review core',pass:bseApprovalDomain_(result).target==='Plant_Replacement_Event_Log'&&bseApprovalDomain_(result).core===bsePlantReplacementReviewCore_},
    {id:'writer requires active allocation match',pass:/bsePlantReplacementActiveMatchByPlot_/.test(core)&&/kind!=='UNIQUE'/.test(core)},
    {id:'writer is idempotent and TEST-only',pass:/priorReview/.test(core)&&/priorLog/.test(core)&&/production_write:false/.test(core)},
    {id:'confirmed summary exposes exact replacement facts with formatted date',pass:/12\/10\/2026/.test(summary)&&/M3P3/.test(summary)&&/Peria/.test(summary)&&/20 pokok/.test(summary)&&/tidak mengubah Plant Census/.test(summary)}
  ];
  const failed=tests.filter(t=>!t.pass);if(failed.length)throw new Error('Plant Replacement approval harness gagal: '+failed.map(t=>t.id).join(', '));return tests;
}
function runBsePlantReplacementRouterHarnessTests(){
  const worker=processBseTelegramTestQueue.toString();
  const tests=[
    {id:'replacement parser precedes plant condition and Gemini',pass:worker.indexOf('bsePlantReplacementParseMessage_(job.input,job.receivedAt)')>=0&&worker.indexOf('bsePlantReplacementParseMessage_(job.input,job.receivedAt)')<worker.indexOf('bsePlantConditionParseMessage_(job.input,job.receivedAt)')&&worker.indexOf('bsePlantReplacementParseMessage_(job.input,job.receivedAt)')<worker.indexOf('bseUnifiedProcess_(job.input,job.receivedAt)')},
    {id:'replacement uses dedicated finalizer',pass:/bsePlantReplacementFinalizeResult_/.test(worker)}
  ];
  const failed=tests.filter(t=>!t.pass);if(failed.length)throw new Error('Plant Replacement router harness gagal: '+failed.map(t=>t.id).join(', '));return tests;
}
