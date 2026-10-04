/** @OnlyCurrentDoc */
// D-041 TEST-only Leave / Attendance domain.
// Operational reference only: never HR, payroll, entitlement, balance, or approval authority.

const BSE_LEAVE_HEADERS=[
  'source_key','leave_event_id','record_type','employee_name','leave_date','leave_end_date',
  'leave_type','leave_type_raw','reason','approval_note','reported_by','reported_by_telegram_user_id',
  'source_message_id','status','production_write','original_note','created_at','confirmed_at',
  'reviewer','payload_hash'
];

function bseLeaveSheet_(book){
  let sheet=book.getSheetByName('TEST_LEAVE_RECORD');
  if(!sheet)sheet=book.insertSheet('TEST_LEAVE_RECORD');
  bseEnsureAdditiveHeaders_(sheet,BSE_LEAVE_HEADERS);
  return sheet;
}

function bseLeaveMalaysiaDate_(receivedAt){
  if(!receivedAt)return '';
  const date=new Date(receivedAt);if(isNaN(date.getTime()))return '';
  return Utilities.formatDate(date,'Asia/Kuala_Lumpur','yyyy-MM-dd');
}

function bseLeaveCanonicalDate_(raw){
  const text=String(raw||'').trim();
  const m=text.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2}|\d{4}))?$/);
  if(!m)return '';
  const day=Number(m[1]),month=Number(m[2]),year=m[3]?Number(m[3].length===2?'20'+m[3]:m[3]):2026;
  const date=new Date(Date.UTC(year,month-1,day));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return '';
  return year+'-'+('0'+month).slice(-2)+'-'+('0'+day).slice(-2);
}

function bseLeaveType_(text){
  const source=String(text||''),explicit=[];
  const yes=(token)=>new RegExp('\\b'+token+'\\b\\s*[:=-]?\\s*(?:yes|ya|y)','i').test(source);
  if(yes('GANTI'))explicit.push({raw:'GANTI',value:'Replacement Leave'});
  if(yes('EL'))explicit.push({raw:'EL',value:'Emergency Leave'});
  if(yes('AL'))explicit.push({raw:'AL',value:'Annual Leave'});
  if(yes('MC'))explicit.push({raw:'MC',value:'Medical Leave'});
  if(yes('OFFDAY')||yes('OFF DAY'))explicit.push({raw:'OFFDAY',value:'Off Day'});
  if(explicit.length===1)return {ok:true,raw:explicit[0].raw,value:explicit[0].value};
  if(explicit.length>1)return {ok:false,ambiguous:true,options:explicit};

  const rules=[
    [/\bOFF\s*DAY\b|\bOFFDAY\b/i,'OFFDAY','Off Day'],
    [/\bGANTI\b/i,'GANTI','Replacement Leave'],
    [/\bMC\b|medical\s+leave/i,'MC','Medical Leave'],
    [/\bEL\b|emergency\s+leave/i,'EL','Emergency Leave'],
    [/\bAL\b|annual\s+leave/i,'AL','Annual Leave']
  ];
  for(const rule of rules)if(rule[0].test(source))return {ok:true,raw:rule[1],value:rule[2]};
  return {ok:false,ambiguous:false,options:[]};
}

function bseLeaveEmployee_(text){
  const source=String(text||'');
  const m=source.match(/(?:^|\n)\s*(?:NAMA|Name|Nama Pekerja)\s*[:=-]?\s*([^\n]+)/i);
  return m?String(m[1]||'').trim():'';
}

function bseLeaveDates_(text,receivedAt){
  const source=String(text||'');
  const labelled=source.match(/(?:TARIKH\s+CUTI|Tarikh|Date)\s*[:=-]?\s*([^\n]+)/i);
  const segment=String(labelled&&labelled[1]||'');
  const all=(segment.match(/\d{1,2}[\/-]\d{1,2}(?:[\/-](?:\d{2}|\d{4}))?/g)||[]).map(bseLeaveCanonicalDate_).filter(Boolean);
  if(all.length)return {start:all[0],end:all[1]||'',explicit:true,valid:true};
  const bare=(source.match(/\b\d{1,2}[\/-]\d{1,2}[\/-](?:\d{2}|\d{4})\b/g)||[]).map(bseLeaveCanonicalDate_).filter(Boolean);
  if(bare.length)return {start:bare[0],end:bare[1]||'',explicit:true,valid:true};
  return {start:'',end:'',explicit:false,valid:true};
}

function bseLeaveRecordType_(text){
  const source=String(text||'');
  if(/\b(?:attendance\s+note|catatan\s+kehadiran|hadir|tidak\s+hadir)\b/i.test(source))return 'ATTENDANCE_NOTE';
  if(/\b(?:telah\s+direkod|rekod\s+cuti|cuti\s+direkod|confirmed\s+leave)\b/i.test(source))return 'LEAVE_RECORD';
  return 'LEAVE_REQUEST';
}

function bseLeaveParseMessage_(text,receivedAt){
  const source=String(text||'').trim();
  if(!source||!/\b(?:cuti|off\s*day|offday|annual\s+leave|medical\s+leave|emergency\s+leave|\bAL\b|\bMC\b|\bEL\b|\bGANTI\b)\b/i.test(source))return null;

  const type=bseLeaveType_(source),dates=bseLeaveDates_(source,receivedAt),employee=bseLeaveEmployee_(source),recordType=bseLeaveRecordType_(source);
  const reasonMatch=source.match(/(?:ALASAN|Sebab|Reason)\s*[:=-]?\s*([^\n]+)/i);
  const approvalMatch=source.match(/(?:approved\s+by|diluluskan\s+oleh|manager\s+approved)\s*[:=-]?\s*([^\n]+)/i);
  const fields={
    project_id:'BSE_SB',system_year:2026,record_type:recordType,
    employee_name:employee,leave_date:dates.start,leave_end_date:dates.end,
    leave_type:type.ok?type.value:'',leave_type_raw:type.ok?type.raw:'',
    reason:reasonMatch?String(reasonMatch[1]||'').trim():'',
    approval_note:approvalMatch?String(approvalMatch[0]||'').trim():'',
    reported_by:'',reported_by_telegram_user_id:'',source_message_id:'',
    original_note:source,verification_status:'PROVISIONAL',production_write:false,
    router_confidence:type.ok&&employee&&dates.start?'HIGH':'LOW'
  };
  const missing=[];
  if(!employee)missing.push('employee_name');
  if(!dates.start)missing.push('leave_date');
  if(!type.ok)missing.push(type.ambiguous?'leave_type_ambiguous':'leave_type');
  return {
    validation:missing.length?'NEED_INFO':'PASS',production_write:false,
    candidates:[{target:'Leave_Record_Log',validation:missing.length?'NEED_INFO':'PASS',missing:missing,fields:fields}]
  };
}

function bseLeaveApplyReporterSnapshot_(result,job){
  if(!result||!Array.isArray(result.candidates)||!job)return result;
  result.candidates.forEach(candidate=>{
    if(!candidate||candidate.target!=='Leave_Record_Log')return;
    const f=candidate.fields||(candidate.fields={}),id=String(job.reporterTelegramUserId||'');
    f.reported_by=String(job.reporterName||job.reporterUsername||(id?'Telegram '+id:'')).trim();
    f.reported_by_telegram_user_id=id;
    f.source_message_id=String(job.messageId||job.rootId||'');
  });
  return result;
}

function bseLeaveValidateProposal_(proposal){
  const p=proposal||{},missing=[];
  if(!['LEAVE_REQUEST','LEAVE_RECORD','ATTENDANCE_NOTE'].includes(String(p.record_type||'')))missing.push('record_type');
  if(!String(p.employee_name||'').trim())missing.push('employee_name');
  if(!String(p.leave_date||'').trim())missing.push('leave_date');
  if(!String(p.leave_type||'').trim())missing.push('leave_type');
  if(p.production_write!==false)missing.push('production_write');
  return missing.length?{ok:false,validation:'NEED_INFO',missing:Array.from(new Set(missing))}:{ok:true,validation:'PASS',missing:[]};
}

function bseLeavePayloadHash_(value){return bseInventoryPayloadHash_(value);}

function bseLeaveReviewCore_(book,reviewContext){
  const context=bseReviewContextValidate_(reviewContext),result=context.proposalResult||{},candidate=result.candidates&&result.candidates[0],proposal=Object.assign({},candidate&&candidate.fields||{});
  if(!candidate||candidate.target!=='Leave_Record_Log')throw new Error('Calon cuti tidak sah.');
  proposal.production_write=false;
  if(!proposal.reported_by){
    const id=String(context.reporter_telegram_user_id||'');
    proposal.reported_by=String(context.reporter_name||context.reporter_username||(id?'Telegram '+id:'')).trim();
    proposal.reported_by_telegram_user_id=id;
  }
  const check=bseLeaveValidateProposal_(proposal);
  if(!check.ok)return {validation:'NEED_INFO',decision:'',missing:check.missing,production_write:false};

  const sourceKey=String(context.reference||'')+'|'+String(proposal.record_type||''),payloadHash=bseLeavePayloadHash_(proposal),stamp=new Date().toISOString();
  if(context.action==='APPROVED'){
    const sheet=bseLeaveSheet_(book),rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,BSE_LEAVE_HEADERS.length).getValues():[];
    const existing=rows.find(row=>String(row[0])===sourceKey);
    if(existing){
      if(String(existing[19]||'')!==payloadHash)throw new Error('source_key cuti mempunyai payload berbeza.');
      return {validation:'PASS',decision:'APPROVED',duplicate:true,event_id:String(existing[1]||''),production_write:false};
    }
    const eventId='BSE-SB-LEAVE-'+payloadHash.slice(0,12);
    sheet.appendRow([
      sourceKey,eventId,proposal.record_type,proposal.employee_name,proposal.leave_date,proposal.leave_end_date||'',
      proposal.leave_type,proposal.leave_type_raw||'',proposal.reason||'',proposal.approval_note||'',
      proposal.reported_by||'',proposal.reported_by_telegram_user_id||'',proposal.source_message_id||String(context.reference||''),
      'APPROVED_TEST',false,proposal.original_note||'',stamp,stamp,context.actor_name||'',payloadHash
    ]);
    SpreadsheetApp.flush();
    return {validation:'PASS',decision:'APPROVED',event_id:eventId,production_write:false,write_scope:'TEST_APPEND_ONLY'};
  }
  return {validation:'PASS',decision:context.action,production_write:false};
}

function runBseLeaveD041AcceptanceHarnessTests(){
  const example=bseLeaveParseMessage_('DETAIL CUTI\nNAMA shafiq\nDEPARTMENT operation\nTARIKH CUTI 20/09/2026\nALASAN Offday\nGANTI no\nEL no\nAL no\nMC no\nOFFDAY yes','2026-10-04T06:00:00.000Z');
  const approved=bseLeaveParseMessage_('NAMA: Ali\nCUTI AL\nTARIKH CUTI: 21/09/2026\nDILULUSKAN OLEH: Manager','2026-10-04T06:00:00.000Z');
  const ambiguous=bseLeaveParseMessage_('NAMA: Ali\nTARIKH CUTI: 22/09/2026\nAL yes\nMC yes','2026-10-04T06:00:00.000Z');
  const f=example.candidates[0].fields,a=approved.candidates[0].fields;
  const tests=[
    ['normal leave detail parses employee/date/type',example.validation==='PASS'&&f.employee_name.toLowerCase()==='shafiq'&&f.leave_date==='2026-09-20'&&f.leave_type==='Off Day'],
    ['OFFDAY is not converted to Annual Leave',f.leave_type==='Off Day'&&f.leave_type_raw==='OFFDAY'],
    ['approval is preserved only when explicit',a.approval_note&&/diluluskan/i.test(a.approval_note)&&!f.approval_note],
    ['approval status is not mandatory',!example.candidates[0].missing.includes('approval_status')],
    ['multiple leave types require clarification',ambiguous.validation==='NEED_INFO'&&ambiguous.candidates[0].missing.includes('leave_type_ambiguous')],
    ['reason is optional',!example.candidates[0].missing.includes('reason')],
    ['TEST only',example.production_write===false&&approved.production_write===false&&ambiguous.production_write===false]
  ];
  const failures=tests.filter(t=>!t[1]);if(failures.length)throw new Error('D-041 leave harness gagal: '+failures.map(t=>t[0]).join(', '));return tests;
}
