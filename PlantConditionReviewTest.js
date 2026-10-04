/** @OnlyCurrentDoc */
// D-045 TEST-only Plant Condition domain.
// Current plant condition is distinct from replacement/sulam actions and from the
// existing living-plant census. It never auto-creates replacement events or
// silently changes census/population totals.

const BSE_PLANT_CONDITION_HEADERS=[
  'source_key','condition_id','event_date','plot_id','module_id','crop',
  'dead_count','sick_count','healthy_count','reported_by','reported_by_telegram_user_id',
  'source_message_id','evidence_reference','status','production_write','original_note',
  'created_at','confirmed_at','reviewer','payload_hash'
];

function bsePlantConditionSheet_(book){
  let sheet=book.getSheetByName('TEST_PLANT_CONDITION');
  if(!sheet)sheet=book.insertSheet('TEST_PLANT_CONDITION');
  bseEnsureAdditiveHeaders_(sheet,BSE_PLANT_CONDITION_HEADERS);
  return sheet;
}

function bsePlantConditionDate_(text,receivedAt){
  const source=String(text||''),m=source.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})\b/);
  if(m){
    const day=Number(m[1]),month=Number(m[2]),year=Number(m[3].length===2?'20'+m[3]:m[3]),d=new Date(Date.UTC(year,month-1,day));
    if(year===2026&&d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day)return year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    return '';
  }
  if(!receivedAt)return '';
  const d=new Date(receivedAt);if(isNaN(d.getTime()))return '';
  return Utilities.formatDate(d,'Asia/Kuala_Lumpur','yyyy-MM-dd');
}

function bsePlantConditionLocation_(text){
  const source=String(text||'').toUpperCase();
  const plot=source.match(/\bM\s*([1-9]\d*)\s*P\s*([1-9]\d*)\b/);
  if(plot)return {plot_id:'M'+plot[1]+'P'+plot[2],module_id:'M'+plot[1]};
  const module=source.match(/\bM\s*([1-9]\d*)\b/);
  return {plot_id:'',module_id:module?'M'+module[1]:''};
}

function bsePlantConditionCrop_(text){
  const m=String(text||'').match(/(?:Jenis\s+Tanaman|Tanaman|Crop|Varieti|Brand)\s*[:=-]?\s*([^\n]+)/i);
  return m?String(m[1]||'').trim():'';
}

function bsePlantConditionCount_(text,labelPattern){
  const re=new RegExp('(?:^|\\s)(?:'+labelPattern+')\\s*[:=-]?\\s*(\\d+)\\b','i');
  const m=String(text||'').match(re);
  return m?Number(m[1]):null;
}

function bsePlantConditionReplacementSignal_(text){
  return /\b(?:sulam|ganti\s+anak\s+pokok|tambah\s+anak\s+pokok|replacement)\b/i.test(String(text||''));
}

function bsePlantConditionParseMessage_(text,receivedAt){
  const source=String(text||'').trim();
  if(!source||bsePlantConditionReplacementSignal_(source))return null;
  const dead=bsePlantConditionCount_(source,'Mati|Dead');
  const sick=bsePlantConditionCount_(source,'Sakit|Sick');
  const healthy=bsePlantConditionCount_(source,'Hidup|Healthy');
  if(dead===null&&sick===null&&healthy===null)return null;

  const loc=bsePlantConditionLocation_(source),eventDate=bsePlantConditionDate_(source,receivedAt),crop=bsePlantConditionCrop_(source);
  const fields={
    project_id:'BSE_SB',system_year:2026,record_type:'PLANT_CONDITION',
    event_date:eventDate,plot_id:loc.plot_id,module_id:loc.module_id,crop:crop,
    dead_count:dead,sick_count:sick,healthy_count:healthy,
    reported_by:'',reported_by_telegram_user_id:'',source_message_id:'',evidence_refs:[],
    original_note:source,verification_status:'PROVISIONAL',production_write:false,
    router_confidence:(loc.plot_id||loc.module_id)&&eventDate?'HIGH':'LOW'
  };
  const missing=[];
  if(!loc.plot_id&&!loc.module_id)missing.push('plot_or_module');
  if(!eventDate)missing.push('event_date');
  return {validation:missing.length?'NEED_INFO':'PASS',production_write:false,candidates:[{
    target:'Plant_Condition_Log',validation:missing.length?'NEED_INFO':'PASS',missing:missing,fields:fields
  }]};
}

function bsePlantConditionApplyReporterSnapshot_(result,job){
  if(!result||!Array.isArray(result.candidates)||!job)return result;
  result.candidates.forEach(candidate=>{
    if(!candidate||candidate.target!=='Plant_Condition_Log')return;
    const f=candidate.fields||(candidate.fields={}),id=String(job.reporterTelegramUserId||'');
    f.reported_by=String(job.reporterName||job.reporterUsername||(id?'Telegram '+id:'')).trim();
    f.reported_by_telegram_user_id=id;
    f.source_message_id=String(job.messageId||job.rootId||'');
  });
  return result;
}

function bsePlantConditionValidateProposal_(proposal){
  const p=proposal||{},missing=[];
  if(String(p.record_type||'')!=='PLANT_CONDITION')missing.push('record_type');
  if(!String(p.plot_id||p.module_id||'').trim())missing.push('plot_or_module');
  if(!String(p.event_date||'').trim())missing.push('event_date');
  const counts=[p.dead_count,p.sick_count,p.healthy_count].filter(v=>v!==null&&v!==''&&v!==undefined);
  if(!counts.length)missing.push('condition_count');
  if(counts.some(v=>!Number.isInteger(Number(v))||Number(v)<0))missing.push('condition_count');
  if(p.production_write!==false)missing.push('production_write');
  return missing.length?{ok:false,validation:'NEED_INFO',missing:Array.from(new Set(missing))}:{ok:true,validation:'PASS',missing:[]};
}

function bsePlantConditionReviewCore_(book,reviewContext){
  const context=bseReviewContextValidate_(reviewContext),result=context.proposalResult||{},candidate=result.candidates&&result.candidates[0],proposal=Object.assign({},candidate&&candidate.fields||{});
  if(!candidate||candidate.target!=='Plant_Condition_Log')throw new Error('Calon keadaan pokok tidak sah.');
  proposal.production_write=false;
  if(!proposal.reported_by){
    const id=String(context.reporter_telegram_user_id||'');
    proposal.reported_by=String(context.reporter_name||context.reporter_username||(id?'Telegram '+id:'')).trim();
    proposal.reported_by_telegram_user_id=id;
  }
  const check=bsePlantConditionValidateProposal_(proposal);
  if(!check.ok)return {validation:'NEED_INFO',decision:'',missing:check.missing,production_write:false};

  const sourceKey=String(context.reference||'')+'|PLANT_CONDITION',payloadHash=bseInventoryPayloadHash_(proposal),stamp=new Date().toISOString();
  if(context.action==='APPROVED'){
    const sheet=bsePlantConditionSheet_(book),rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,BSE_PLANT_CONDITION_HEADERS.length).getValues():[];
    const existing=rows.find(row=>String(row[0])===sourceKey);
    if(existing){
      if(String(existing[19]||'')!==payloadHash)throw new Error('source_key keadaan pokok mempunyai payload berbeza.');
      return {validation:'PASS',decision:'APPROVED',duplicate:true,event_id:String(existing[1]||''),production_write:false};
    }
    const eventId='BSE-SB-PC-'+payloadHash.slice(0,12);
    sheet.appendRow([
      sourceKey,eventId,proposal.event_date,proposal.plot_id||'',proposal.module_id||'',proposal.crop||'',
      proposal.dead_count===null?'':proposal.dead_count,proposal.sick_count===null?'':proposal.sick_count,proposal.healthy_count===null?'':proposal.healthy_count,
      proposal.reported_by||'',proposal.reported_by_telegram_user_id||'',proposal.source_message_id||String(context.reference||''),
      Array.isArray(proposal.evidence_refs)?proposal.evidence_refs.join(','):String(proposal.evidence_reference||''),
      'APPROVED_TEST',false,proposal.original_note||'',stamp,stamp,context.actor_name||'',payloadHash
    ]);
    if(typeof bseEvidenceLinkMany_==='function'&&bseEvidenceRefs_(proposal.evidence_refs||proposal.evidence_reference||[]).length){
      bseEvidenceLinkMany_(book,{
        evidence_refs:proposal.evidence_refs||proposal.evidence_reference||[],
        domain_record_type:'PLANT_CONDITION',domain_record_id:eventId,
        link_reason:'DOMAIN_SUPPORT',source_message_id:proposal.source_message_id||String(context.reference||''),
        linked_by:context.actor_name||context.actor_id||'SYSTEM_TEST',production_write:false
      });
    }
    SpreadsheetApp.flush();
    return {validation:'PASS',decision:'APPROVED',event_id:eventId,production_write:false,write_scope:'TEST_APPEND_ONLY'};
  }
  return {validation:'PASS',decision:context.action,production_write:false};
}

function runBsePlantConditionD045AcceptanceHarnessTests(){
  const condition=bsePlantConditionParseMessage_('M3P2 Mati 45 Sakit 455','2026-10-04T07:30:00.000Z');
  const replacement=bsePlantConditionParseMessage_('Sulam 20 pokok M3P2','2026-10-04T07:30:00.000Z');
  const mixed=bsePlantConditionParseMessage_('M3P2 Hidup 2300 Mati 45 Sakit 455','2026-10-04T07:30:00.000Z');
  const f=condition.candidates[0].fields,m=mixed.candidates[0].fields;
  const tests=[
    ['Mati/Sakit becomes plant condition',condition.validation==='PASS'&&f.record_type==='PLANT_CONDITION'&&f.plot_id==='M3P2'&&f.dead_count===45&&f.sick_count===455],
    ['replacement wording is excluded from condition parser',replacement===null],
    ['healthy count is preserved only when explicit',f.healthy_count===null&&m.healthy_count===2300],
    ['condition does not infer sulam quantity',!Object.prototype.hasOwnProperty.call(f,'replacement_count')],
    ['condition is separate from Plant_Census_Log',condition.candidates[0].target==='Plant_Condition_Log'],
    ['sent date fallback works',f.event_date==='2026-10-04'],
    ['crop is optional when not explicit',f.crop===''&&!condition.candidates[0].missing.includes('crop')],
    ['TEST only',condition.production_write===false&&mixed.production_write===false]
  ];
  const failures=tests.filter(t=>!t[1]);if(failures.length)throw new Error('D-045 plant condition harness gagal: '+failures.map(t=>t[0]).join(', '));return tests;
}
