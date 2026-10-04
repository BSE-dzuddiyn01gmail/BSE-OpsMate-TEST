/** @OnlyCurrentDoc */
// D-042 TEST-only Maintenance / Operation Event domain.
// Operational reference only: not CMMS, warranty, work-order, or cost authority.

const BSE_MAINTENANCE_HEADERS=[
  'source_key','maintenance_event_id','event_type','asset_or_component','event_date',
  'location','issue_detail','action_detail','person_or_team','asset_id','cost_myr','material_used',
  'reported_by','reported_by_telegram_user_id','source_message_id','evidence_reference',
  'status','production_write','original_note','created_at','confirmed_at','reviewer','payload_hash'
];

function bseMaintenanceSheet_(book){
  let sheet=book.getSheetByName('TEST_MAINTENANCE_EVENT');
  if(!sheet)sheet=book.insertSheet('TEST_MAINTENANCE_EVENT');
  bseEnsureAdditiveHeaders_(sheet,BSE_MAINTENANCE_HEADERS);
  return sheet;
}

function bseMaintenanceDate_(text,receivedAt){
  const source=String(text||''),m=source.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})\b/);
  if(m){
    const day=Number(m[1]),month=Number(m[2]),year=Number(m[3].length===2?'20'+m[3]:m[3]),d=new Date(Date.UTC(year,month-1,day));
    if(d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day)return year+'-'+('0'+month).slice(-2)+'-'+('0'+day).slice(-2);
    return '';
  }
  if(!receivedAt)return '';
  const date=new Date(receivedAt);if(isNaN(date.getTime()))return '';
  return Utilities.formatDate(date,'Asia/Kuala_Lumpur','yyyy-MM-dd');
}

function bseMaintenanceEventType_(text){
  const source=String(text||'');
  if(/\b(?:dah|sudah|telah)\s+(?:repair|baiki|dibaiki|siap)|\b(?:repair|baiki)\s+(?:dah|sudah|siap)|\bselesai\b|\bsiap\s+baiki\b/i.test(source))return 'MAINTENANCE_COMPLETED';
  if(/\b(?:repair|baiki|membaiki|dibaiki|servis|maintenance)\b/i.test(source))return 'MAINTENANCE_ACTION';
  if(/\b(?:rosak|pecah|bocor|tersumbat|tak\s+fungsi|tidak\s+berfungsi|fault|problem|masalah)\b/i.test(source))return 'MAINTENANCE_ISSUE';
  return '';
}

function bseMaintenanceComponent_(text){
  const source=String(text||'');
  const labelled=source.match(/(?:Aset|Komponen|Component|Asset)\s*[:=-]?\s*([^\n]+)/i);
  if(labelled)return String(labelled[1]||'').trim();
  const known=source.match(/\b(paip|pump|pam|valve|injap|motor|filter|penapis|hos|sensor|socket|soket|tank|tangki|dripper|mesin(?:\s+rumput)?)\b/i);
  return known?String(known[1]||'').trim():'';
}

function bseMaintenanceLocation_(text){
  const source=String(text||'').toUpperCase();
  const plot=source.match(/\bM\s*(\d+)\s*P\s*(\d+)\b/);
  if(plot)return 'M'+plot[1]+'P'+plot[2];
  const module=source.match(/\bM\s*(\d+)\b/);
  return module?'M'+module[1]:'';
}

function bseMaintenanceParseMessage_(text,receivedAt){
  const source=String(text||'').trim();
  if(!source)return null;
  const eventType=bseMaintenanceEventType_(source);
  if(!eventType)return null;
  const component=bseMaintenanceComponent_(source),eventDate=bseMaintenanceDate_(source,receivedAt),location=bseMaintenanceLocation_(source);
  const fields={
    project_id:'BSE_SB',system_year:2026,record_type:eventType,event_type:eventType,
    asset_or_component:component,event_date:eventDate,location:location,
    issue_detail:eventType==='MAINTENANCE_ISSUE'?source:'',
    action_detail:eventType==='MAINTENANCE_ACTION'||eventType==='MAINTENANCE_COMPLETED'?source:'',
    person_or_team:'',asset_id:'',cost_myr:'',material_used:'',
    reported_by:'',reported_by_telegram_user_id:'',source_message_id:'',evidence_refs:[],
    original_note:source,verification_status:'PROVISIONAL',production_write:false,
    router_confidence:component&&eventDate?'HIGH':'LOW'
  };
  const missing=[];
  if(!component)missing.push('asset_or_component');
  if(!eventDate)missing.push('event_date');
  return {validation:missing.length?'NEED_INFO':'PASS',production_write:false,candidates:[{
    target:'Maintenance_Event_Log',validation:missing.length?'NEED_INFO':'PASS',missing:missing,fields:fields
  }]};
}

function bseMaintenanceApplyReporterSnapshot_(result,job){
  if(!result||!Array.isArray(result.candidates)||!job)return result;
  result.candidates.forEach(candidate=>{
    if(!candidate||candidate.target!=='Maintenance_Event_Log')return;
    const f=candidate.fields||(candidate.fields={}),id=String(job.reporterTelegramUserId||'');
    f.reported_by=String(job.reporterName||job.reporterUsername||(id?'Telegram '+id:'')).trim();
    f.reported_by_telegram_user_id=id;
    f.source_message_id=String(job.messageId||job.rootId||'');
  });
  return result;
}

function bseMaintenanceValidateProposal_(proposal){
  const p=proposal||{},missing=[];
  if(!['MAINTENANCE_ISSUE','MAINTENANCE_ACTION','MAINTENANCE_COMPLETED'].includes(String(p.event_type||p.record_type||'')))missing.push('event_type');
  if(!String(p.asset_or_component||'').trim())missing.push('asset_or_component');
  if(!String(p.event_date||'').trim())missing.push('event_date');
  if(p.production_write!==false)missing.push('production_write');
  return missing.length?{ok:false,validation:'NEED_INFO',missing:Array.from(new Set(missing))}:{ok:true,validation:'PASS',missing:[]};
}

function bseMaintenanceReviewCore_(book,reviewContext){
  const context=bseReviewContextValidate_(reviewContext),result=context.proposalResult||{},candidate=result.candidates&&result.candidates[0],proposal=Object.assign({},candidate&&candidate.fields||{});
  if(!candidate||candidate.target!=='Maintenance_Event_Log')throw new Error('Calon maintenance tidak sah.');
  proposal.production_write=false;
  if(!proposal.reported_by){
    const id=String(context.reporter_telegram_user_id||'');
    proposal.reported_by=String(context.reporter_name||context.reporter_username||(id?'Telegram '+id:'')).trim();
    proposal.reported_by_telegram_user_id=id;
  }
  const check=bseMaintenanceValidateProposal_(proposal);
  if(!check.ok)return {validation:'NEED_INFO',decision:'',missing:check.missing,production_write:false};

  const sourceKey=String(context.reference||'')+'|'+String(proposal.event_type||proposal.record_type||''),payloadHash=bseInventoryPayloadHash_(proposal),stamp=new Date().toISOString();
  if(context.action==='APPROVED'){
    const sheet=bseMaintenanceSheet_(book),rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,BSE_MAINTENANCE_HEADERS.length).getValues():[];
    const existing=rows.find(row=>String(row[0])===sourceKey);
    if(existing){
      if(String(existing[22]||'')!==payloadHash)throw new Error('source_key maintenance mempunyai payload berbeza.');
      return {validation:'PASS',decision:'APPROVED',duplicate:true,event_id:String(existing[1]||''),production_write:false};
    }
    const eventId='BSE-SB-MNT-'+payloadHash.slice(0,12);
    sheet.appendRow([
      sourceKey,eventId,proposal.event_type||proposal.record_type,proposal.asset_or_component,proposal.event_date,
      proposal.location||'',proposal.issue_detail||'',proposal.action_detail||'',proposal.person_or_team||'',
      proposal.asset_id||'',proposal.cost_myr||'',proposal.material_used||'',proposal.reported_by||'',
      proposal.reported_by_telegram_user_id||'',proposal.source_message_id||String(context.reference||''),
      Array.isArray(proposal.evidence_refs)?proposal.evidence_refs.join(','):String(proposal.evidence_reference||''),
      'APPROVED_TEST',false,proposal.original_note||'',stamp,stamp,context.actor_name||'',payloadHash
    ]);
    if(typeof bseEvidenceLinkMany_==='function'&&bseEvidenceRefs_(proposal.evidence_refs||proposal.evidence_reference||[]).length){
      bseEvidenceLinkMany_(book,{
        evidence_refs:proposal.evidence_refs||proposal.evidence_reference||[],
        domain_record_type:proposal.event_type||proposal.record_type,
        domain_record_id:eventId,link_reason:'DOMAIN_SUPPORT',
        source_message_id:proposal.source_message_id||String(context.reference||''),
        linked_by:context.actor_name||context.actor_id||'SYSTEM_TEST',production_write:false
      });
    }
    SpreadsheetApp.flush();
    return {validation:'PASS',decision:'APPROVED',event_id:eventId,production_write:false,write_scope:'TEST_APPEND_ONLY'};
  }
  return {validation:'PASS',decision:context.action,production_write:false};
}

function runBseMaintenanceD042AcceptanceHarnessTests(){
  const issue=bseMaintenanceParseMessage_('paip rosak M3P1','2026-10-04T06:30:00.000Z');
  const action=bseMaintenanceParseMessage_('sedang repair paip M3P1','2026-10-04T06:30:00.000Z');
  const done=bseMaintenanceParseMessage_('paip dah repair','2026-10-04T06:30:00.000Z');
  const photoOnly=bseMaintenanceParseMessage_('gambar paip','2026-10-04T06:30:00.000Z');
  const tests=[
    ['fault becomes MAINTENANCE_ISSUE',issue&&issue.validation==='PASS'&&issue.candidates[0].fields.event_type==='MAINTENANCE_ISSUE'],
    ['work in progress becomes MAINTENANCE_ACTION',action&&action.validation==='PASS'&&action.candidates[0].fields.event_type==='MAINTENANCE_ACTION'],
    ['explicit completed language becomes MAINTENANCE_COMPLETED',done&&done.validation==='PASS'&&done.candidates[0].fields.event_type==='MAINTENANCE_COMPLETED'],
    ['photo-only wording does not prove completion',photoOnly===null],
    ['location optional',done&&!done.candidates[0].missing.includes('location')],
    ['cost/material/person optional',done&&!done.candidates[0].missing.includes('cost_myr')&&!done.candidates[0].missing.includes('material_used')&&!done.candidates[0].missing.includes('person_or_team')],
    ['TEST only',[issue,action,done].every(r=>r&&r.production_write===false)]
  ];
  const failures=tests.filter(t=>!t[1]);if(failures.length)throw new Error('D-042 maintenance harness gagal: '+failures.map(t=>t[0]).join(', '));return tests;
}
