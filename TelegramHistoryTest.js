/** @OnlyCurrentDoc */
// TEST-only PM history. Owner/admin see all authorized canonical records.
// REGISTERED_ACTIVE users may retrieve only records allowed by existing visibility boundaries.
const BSE_TG_HISTORY_AUDIT_HEADERS=['requested_at','telegram_user_id','private_chat_id','period','outcome','reason','matched_count','displayed_count'];
const BSE_TG_HISTORY_MAX_MATCHES=100;
const BSE_TG_HISTORY_MAX_DISPLAY=20;
const BSE_TG_HISTORY_TZ='Asia/Kuala_Lumpur';
const BSE_TG_HISTORY_MYT_OFFSET_MS=8*60*60*1000;

function bseTelegramHistoryAudit_(book){
  let s=book.getSheetByName('TEST_TELEGRAM_HISTORY_AUDIT');
  if(!s)s=book.insertSheet('TEST_TELEGRAM_HISTORY_AUDIT');
  bseEnsureAdditiveHeaders_(s,BSE_TG_HISTORY_AUDIT_HEADERS);
  return s;
}

function bseTelegramHistoryDateParts_(value){
  const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return null;
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]),probe=new Date(Date.UTC(y,mo-1,d));
  return probe.getUTCFullYear()===y&&probe.getUTCMonth()===mo-1&&probe.getUTCDate()===d?{y:y,m:mo,d:d}:null;
}
function bseTelegramHistoryIsoDateFromUtc_(date){
  return Utilities.formatDate(date,'UTC','yyyy-MM-dd');
}
function bseTelegramHistoryAddDays_(ymd,days){
  const p=bseTelegramHistoryDateParts_(ymd);
  if(!p)return '';
  return bseTelegramHistoryIsoDateFromUtc_(new Date(Date.UTC(p.y,p.m-1,p.d+Number(days||0))));
}
function bseTelegramHistoryMytDate_(now){
  return Utilities.formatDate(now||new Date(),BSE_TG_HISTORY_TZ,'yyyy-MM-dd');
}
function bseTelegramHistoryWeekStartForMytDate_(ymd){
  const p=bseTelegramHistoryDateParts_(ymd);
  if(!p)return '';
  const probe=new Date(Date.UTC(p.y,p.m-1,p.d));
  const day=probe.getUTCDay(); // Sun=0 ... Fri=5
  const daysSinceFriday=(day-5+7)%7;
  return bseTelegramHistoryAddDays_(ymd,-daysSinceFriday);
}
function bseTelegramHistoryLastCompleteWeek_(now){
  const today=bseTelegramHistoryMytDate_(now||new Date());
  const currentStart=bseTelegramHistoryWeekStartForMytDate_(today);
  const start=bseTelegramHistoryAddDays_(currentStart,-7);
  return {start:start,end:bseTelegramHistoryAddDays_(start,6),kind:'WEEK',period:start+'..'+bseTelegramHistoryAddDays_(start,6)};
}
function bseTelegramHistoryExplicitWeek_(start){
  const p=bseTelegramHistoryDateParts_(start);
  if(!p)return null;
  const probe=new Date(Date.UTC(p.y,p.m-1,p.d));
  if(probe.getUTCDay()!==5)return null;
  const end=bseTelegramHistoryAddDays_(start,6);
  return {start:start,end:end,kind:'WEEK',period:start+'..'+end};
}
function bseTelegramHistoryNthWeekOfMonth_(monthKey,weekNumber){
  const m=String(monthKey||'').match(/^(\d{4})-(\d{2})$/),n=Number(weekNumber);
  if(!m||!Number.isInteger(n)||n<1||n>5)return null;
  const y=Number(m[1]),mo=Number(m[2]);
  if(mo<1||mo>12)return null;
  const first=new Date(Date.UTC(y,mo-1,1)),daysUntilFriday=(5-first.getUTCDay()+7)%7;
  const startDate=new Date(Date.UTC(y,mo-1,1+daysUntilFriday+(n-1)*7));
  if(startDate.getUTCMonth()!==mo-1)return null;
  const start=bseTelegramHistoryIsoDateFromUtc_(startDate),end=bseTelegramHistoryAddDays_(start,6);
  return {start:start,end:end,kind:'WEEK',period:start+'..'+end,month:monthKey,week_number:n};
}

function bseTelegramHistoryCommand_(text,now){
  const raw=String(text||'').trim();
  if(!/^\/history\b/i.test(raw))return null;
  let m=raw.match(/^\/history\s+(?:week|minggu)\s+(?:last|lepas)\s*$/i);
  if(m)return bseTelegramHistoryLastCompleteWeek_(now||new Date());
  m=raw.match(/^\/history\s+(?:week|minggu)\s+(\d)\s+(\d{4}-\d{2})\s*$/i);
  if(m){
    const week=bseTelegramHistoryNthWeekOfMonth_(m[2],Number(m[1]));
    return week||{invalid:true,reason:'WEEK_NOT_IN_MONTH'};
  }
  m=raw.match(/^\/history\s+(?:week|minggu)\s+(\d{4}-\d{2}-\d{2})\s*$/i);
  if(m){
    const week=bseTelegramHistoryExplicitWeek_(m[1]);
    return week||{invalid:true,reason:'WEEK_START_MUST_BE_FRIDAY'};
  }
  m=raw.match(/^\/history\s+month\s+(\d{4}-\d{2})\s*$/i);
  if(m)return bseTelegramHistoryCommand_('/history '+m[1],now);
  m=raw.match(/^\/history\s+(\d{4}-(?:\d{2})(?:-\d{2})?)\s*$/i);
  if(!m)return {invalid:true,reason:'FORMAT'};
  const key=m[1],parts=key.split('-').map(Number),month=parts[1],day=parts[2];
  if(month<1||month>12||(day!==undefined&&(day<1||day>31)))return {invalid:true,reason:'DATE'};
  if(day!==undefined){
    const probe=new Date(Date.UTC(parts[0],month-1,day));
    if(probe.getUTCFullYear()!==parts[0]||probe.getUTCMonth()!==month-1||probe.getUTCDate()!==day)return {invalid:true,reason:'DATE'};
  }
  return {period:key,kind:day===undefined?'MONTH':'DAY'};
}

function bseTelegramHistoryDate_(value){
  if(Object.prototype.toString.call(value)==='[object Date]'&&!isNaN(value.getTime()))return Utilities.formatDate(value,BSE_TG_HISTORY_TZ,'yyyy-MM-dd');
  const raw=String(value||'').trim(),match=raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if(match)return match[1];
  const parsed=new Date(raw);
  return isNaN(parsed.getTime())?'':Utilities.formatDate(parsed,BSE_TG_HISTORY_TZ,'yyyy-MM-dd');
}
function bseTelegramHistoryInPeriod_(date,period){
  return String(date||'')===String(period)||String(date||'').indexOf(String(period)+'-')===0;
}
function bseTelegramHistoryInCommandPeriod_(date,command){
  if(!command||command.invalid)return false;
  const d=String(date||'');
  if(command.kind==='WEEK')return d>=String(command.start||'')&&d<=String(command.end||'');
  return bseTelegramHistoryInPeriod_(d,command.period);
}
function bseTelegramHistoryPeriodLabel_(command){
  return command&&command.kind==='WEEK'?String(command.start)+' → '+String(command.end):String(command&&command.period||'');
}
function bseTelegramHistorySafeLine_(event){
  return [event.date,event.reference,event.category,event.summary].map(v=>String(v||'').replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim()).join(' | ').slice(0,220);
}
function bseTelegramHistoryApprovalResult_(aggregate,approvalSourceKey,expectedHash){
  if(!aggregate||aggregate.production_write!==false||aggregate.validation!=='PASS')return null;
  let selected=aggregate;
  const index=bseApprovalCandidateIndexFromSourceKey_(approvalSourceKey);
  if(index!=null){
    try{selected=bseApprovalCandidateEnvelope_(aggregate,index);}catch(_){return null;}
  }
  return bseApprovalHash_(selected)===String(expectedHash||'')?selected:null;
}
function bseTelegramHistoryRecordEvents_(book){
  const queueRows=bseTelegramRecordReadRows_(book,'TELEGRAM_TEST_QUEUE',BSE_TG_QUEUE_HEADERS.length);
  const approvalRows=bseTelegramRecordReadRows_(book,'TEST_TELEGRAM_APPROVAL_UI',BSE_APPROVAL_UI_HEADERS.length);
  const events=[];
  approvalRows.filter(row=>String(row[17])==='REPORTER_CONFIRMED').forEach(approval=>{
    const reference=String(approval[0]||'');
    const matches=queueRows.filter(row=>'BSE-TG-'+String(row[0])===reference&&String(row[6])!=='VOIDED_TEST');
    if(matches.length!==1)return;
    const queue=matches[0];
    let aggregate;
    try{aggregate=JSON.parse(String(queue[9]||''));}catch(_){return;}
    const result=bseTelegramHistoryApprovalResult_(aggregate,String(approval[1]||''),String(approval[2]||''));
    if(!result)return;
    let meta={};
    try{meta=JSON.parse(String(queue[16]||'{}'));}catch(_){}
    const privateSource=String(meta.source_chat_type||'')==='private';
    const category=bseTelegramRecordCandidateCategory_(result,privateSource);
    const visibility=privateSource?'PRIVATE_SUBMISSION':(['FIELD_OPERATION','ASSET_EQUIPMENT'].includes(category)?'GROUP_STANDARD':'RESTRICTED');
    const candidates=(result.candidates||[]).map(bseTelegramRecordSafeCandidateLine_).filter(Boolean);
    events.push({
      date:bseTelegramHistoryDate_(approval[15]||queue[17]||queue[5]),
      reference:reference,
      category:category,
      summary:candidates.join(' / ').slice(0,160),
      reporter_user_id:String(queue[2]||''),
      visibility:visibility
    });
  });
  return events;
}
function bseTelegramHistoryEvidenceEvents_(book){
  const sheet=book.getSheetByName('TEST_FILE_EVIDENCE');
  if(!sheet)return [];
  return bseTelegramRecordReadRows_(book,'TEST_FILE_EVIDENCE',BSE_TG_EVIDENCE_HEADERS.length)
    .filter(row=>String(row[16])==='CONFIRMED_TEST')
    .map(row=>({
      date:bseTelegramHistoryDate_(row[20]||row[6]),
      reference:String(row[0]||''),
      category:String(row[14]||'UNCLASSIFIED_TEST'),
      summary:'Evidence '+String(row[8]||'UNKNOWN'),
      reporter_user_id:String(row[4]||''),
      visibility:String(row[15]||'RESTRICTED')
    }));
}
function bseTelegramHistoryAllEvents_(book){
  return bseTelegramHistoryRecordEvents_(book).concat(bseTelegramHistoryEvidenceEvents_(book));
}
function bseTelegramHistoryEventVisibleTo_(event,userId,isOwner){
  if(isOwner)return true;
  if(String(event&&event.reporter_user_id||'')===String(userId||''))return true;
  return String(event&&event.visibility||'')==='GROUP_STANDARD';
}
function bseTelegramHistoryEventsFor_(book,command,userId,isOwner){
  return bseTelegramHistoryAllEvents_(book)
    .filter(event=>bseTelegramHistoryInCommandPeriod_(event.date,command))
    .filter(event=>bseTelegramHistoryEventVisibleTo_(event,userId,isOwner))
    .sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.reference).localeCompare(String(b.reference)))
    .slice(0,BSE_TG_HISTORY_MAX_MATCHES);
}
function bseTelegramHistoryAccess_(book,message){
  const user=String(message&&message.from&&message.from.id||''),chat=String(message&&message.chat&&message.chat.id||'');
  if(!message||!message.chat||message.chat.type!=='private'||user!==chat)return {ok:false,reason:'NOT_PRIVATE',user:user,chat:chat,is_owner:false};
  const owner=bseTestOwnerForTelegramUser_(book,user);
  if(owner.ok&&String(owner.private_chat_id)===chat)return {ok:true,reason:'OWNER_ACTIVE',user:user,chat:chat,is_owner:true};
  const access=bseTelegramRegistrationPrivateAccess_(book,message);
  if(access.status==='REGISTERED_ACTIVE')return {ok:true,reason:'REGISTERED_ACTIVE',user:user,chat:chat,is_owner:false};
  return {ok:false,reason:'NOT_REGISTERED_ACTIVE',user:user,chat:chat,is_owner:false};
}
function bseTelegramHistoryRetrieve_(book,m){
  const command=bseTelegramHistoryCommand_(m&&m.text);
  if(!command)return {handled:false};
  const user=String(m&&m.from&&m.from.id||''),chat=String(m&&m.chat&&m.chat.id||''),period=command.period||'';
  const audit=(outcome,reason,matched,displayed)=>{
    bseTelegramHistoryAudit_(book).appendRow([new Date().toISOString(),user,chat,period,outcome,reason,Number(matched||0),Number(displayed||0)]);
    SpreadsheetApp.flush();
  };
  if(command.invalid){
    audit('DENIED',command.reason||'INVALID_PERIOD',0,0);
    return {handled:true,text:'Format: /history YYYY-MM | /history YYYY-MM-DD | /history week last | /history week N YYYY-MM | /history week YYYY-MM-DD (tarikh Jumaat). Minggu N bermula pada Jumaat ke-N dalam bulan itu.'};
  }
  const access=bseTelegramHistoryAccess_(book,m);
  if(!access.ok){
    audit('DENIED',access.reason,0,0);
    return {handled:true,text:'History hanya boleh diminta melalui PM oleh owner/admin atau user TEST yang aktif.'};
  }
  const all=bseTelegramHistoryEventsFor_(book,command,user,access.is_owner),displayed=all.slice(0,BSE_TG_HISTORY_MAX_DISPLAY);
  const lines=['Sejarah TEST — '+bseTelegramHistoryPeriodLabel_(command)];
  if(!displayed.length)lines.push('Tiada rekod TEST yang boleh dipaparkan dalam sela masa ini.');
  else displayed.forEach(event=>lines.push(bseTelegramHistorySafeLine_(event)));
  if(all.length>displayed.length)lines.push('Dipaparkan '+displayed.length+' daripada '+all.length+' rekod yang dipadankan.');
  lines.push('Mod TEST — tiada rekod production ditulis.');
  audit('SENT',access.reason,all.length,displayed.length);
  return {handled:true,text:lines.join('\n'),production_write:false};
}

function diagnoseBseNthWeekHistoryTest(){
  const book=boundTestBook_(),owner=bseTestOwnerRows_(book).map(bseTestOwnerFromRow_).find(o=>o.is_active&&o.is_admin)||bseTestOwnerRows_(book).map(bseTestOwnerFromRow_).find(o=>o.is_active);
  if(!owner)throw new Error('Owner TEST aktif tidak ditemui.');
  const command=bseTelegramHistoryCommand_('/history week 2 2026-10'),events=bseTelegramHistoryEventsFor_(book,command,owner.telegram_user_id,true);
  return {period:command.period,start:command.start,end:command.end,event_count:events.length,categories:[...new Set(events.map(e=>e.category))],dates:[...new Set(events.map(e=>e.date))],production_write:false};
}
function runBseTelegramHistoryHarnessTests(){
  const day=bseTelegramHistoryCommand_('/history 2026-09-21');
  const month=bseTelegramHistoryCommand_('/history 2026-09');
  const alias=bseTelegramHistoryCommand_('/history month 2026-09');
  const last=bseTelegramHistoryCommand_('/history week last',new Date('2026-10-16T00:00:00.000Z'));
  const explicit=bseTelegramHistoryCommand_('/history week 2026-10-09');
  const nth=bseTelegramHistoryCommand_('/history week 2 2026-10');
  const nthMalay=bseTelegramHistoryCommand_('/history minggu 2 2026-10');
  const multi={validation:'PASS',production_write:false,candidates:[
    {target:'Operation_Log',validation:'PASS',missing:[],fields:{operation_type:'SPRAY'}},
    {target:'Input_Usage_Log',validation:'PASS',missing:[],fields:{item_name:'Abamectin',quantity:100,unit:'ml'}}
  ]};
  const c2=bseApprovalCandidateEnvelope_(multi,1);
  const standard={reporter_user_id:'1',visibility:'GROUP_STANDARD'};
  const privateEvent={reporter_user_id:'1',visibility:'PRIVATE_SUBMISSION'};
  const source=[
    bseTelegramHistoryRetrieve_,bseTelegramHistoryAccess_,bseTelegramHistoryEventVisibleTo_,
    bseTelegramHistoryApprovalResult_,bseTelegramHistoryRecordEvents_,bseTelegramHistoryEvidenceEvents_
  ].map(fn=>fn.toString()).join('\n');
  const tests=[
    {id:'D-048 candidate hash selects only confirmed candidate envelope',pass:bseTelegramHistoryApprovalResult_(multi,'BSE-TG-1|Input_Usage_Log|C2',bseApprovalHash_(c2))&&bseTelegramHistoryApprovalResult_(multi,'BSE-TG-1|Input_Usage_Log|C2',bseApprovalHash_(c2)).candidates.length===1&&bseTelegramHistoryApprovalResult_(multi,'BSE-TG-1|Input_Usage_Log|C2',bseApprovalHash_(c2)).candidates[0].target==='Input_Usage_Log'&&!bseTelegramHistoryApprovalResult_(multi,'BSE-TG-1|Input_Usage_Log|C2',bseApprovalHash_(multi))},
    {id:'day month and month alias remain accepted',pass:day.period==='2026-09-21'&&month.kind==='MONTH'&&alias.period==='2026-09'&&bseTelegramHistoryCommand_('/history 2026-02-30').invalid===true},
    {id:'weekly history uses completed Friday to Thursday window',pass:last.kind==='WEEK'&&last.start==='2026-10-09'&&last.end==='2026-10-15'&&explicit.start==='2026-10-09'&&explicit.end==='2026-10-15'},
    {id:'user can select nth Friday week inside a month',pass:nth.kind==='WEEK'&&nth.week_number===2&&nth.month==='2026-10'&&nth.start==='2026-10-09'&&nth.end==='2026-10-15'&&nthMalay.start===nth.start&&bseTelegramHistoryCommand_('/history week 5 2026-02').invalid===true},
    {id:'explicit weekly history requires Friday anchor',pass:bseTelegramHistoryCommand_('/history week 2026-10-10').invalid===true},
    {id:'week period matching is bounded',pass:bseTelegramHistoryInCommandPeriod_('2026-10-09',explicit)&&bseTelegramHistoryInCommandPeriod_('2026-10-15',explicit)&&!bseTelegramHistoryInCommandPeriod_('2026-10-16',explicit)},
    {id:'visibility allows owner reporter or group-standard only',pass:bseTelegramHistoryEventVisibleTo_(privateEvent,'2',true)&&bseTelegramHistoryEventVisibleTo_(privateEvent,'1',false)&&!bseTelegramHistoryEventVisibleTo_(privateEvent,'2',false)&&bseTelegramHistoryEventVisibleTo_(standard,'2',false)},
    {id:'PM active registration or owner is mandatory',pass:/REGISTERED_ACTIVE/.test(source)&&/OWNER_ACTIVE/.test(source)&&/NOT_PRIVATE/.test(source)},
    {id:'only confirmed and integrity-checked records are read',pass:/REPORTER_CONFIRMED/.test(source)&&/bseApprovalHash_/.test(source)&&/VOIDED_TEST/.test(source)&&/CONFIRMED_TEST/.test(source)},
    {id:'response excludes original text and payload',pass:!/original_note|candidate_json|caption/.test(bseTelegramHistorySafeLine_.toString()+bseTelegramHistoryRetrieve_.toString())},
    {id:'no domain or production writer',pass:!/bse(?:Measurement|CropBatch|Transplant|PlantCensus|Treatment|Inventory|Observation)ReviewCore_|production_write\s*:\s*true/.test(source)}
  ];
  console.log('TELEGRAM_HISTORY_HARNESS: '+JSON.stringify(tests));
  const failures=tests.filter(t=>!t.pass);
  if(failures.length)throw new Error('Telegram history harness gagal: '+failures.map(t=>t.id).join(', '));
  return tests;
}
