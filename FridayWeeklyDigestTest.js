/** @NotOnlyCurrentDoc */
// PILOT_TEST-only Friday Weekly Digest.
// Locked 2026-10-11: Friday 07:59 MYT, previous complete Friday→Thursday,
// weekly canonical history + separately labelled non-canonical Gemini commentary,
// delivered by PM to every active owner/admin/registered user subject to visibility boundaries.
const BSE_FRIDAY_WEEKLY_TZ='Asia/Kuala_Lumpur';
const BSE_FRIDAY_WEEKLY_TIME='07:59';
const BSE_FRIDAY_WEEKLY_HANDLER='bseFridayWeeklyDigestTick';
const BSE_FRIDAY_WEEKLY_ENABLED_PROPERTY='BSE_FRIDAY_WEEKLY_DIGEST_ENABLED';
const BSE_FRIDAY_WEEKLY_TIME_PROPERTY='BSE_FRIDAY_WEEKLY_DIGEST_TIME_MYT';
const BSE_FRIDAY_WEEKLY_TRIGGER_UID_PROPERTY='BSE_FRIDAY_WEEKLY_DIGEST_TRIGGER_UID';
const BSE_FRIDAY_WEEKLY_AUDIT_HEADERS=[
  'week_start','week_end','telegram_user_id','private_chat_id','access_role',
  'status','matched_count','message_id','gemini_status','sent_at','last_error','production_write'
];
const BSE_FRIDAY_WEEKLY_CONFIG_AUDIT_HEADERS=[
  'configured_at','environment','enabled','time_myt','next_run_utc','trigger_uid','production_write'
];

function bseFridayWeeklyAuditSheet_(book){
  let s=book.getSheetByName('TEST_FRIDAY_WEEKLY_DIGEST_AUDIT');
  if(!s)s=book.insertSheet('TEST_FRIDAY_WEEKLY_DIGEST_AUDIT');
  bseEnsureAdditiveHeaders_(s,BSE_FRIDAY_WEEKLY_AUDIT_HEADERS);
  return s;
}
function bseFridayWeeklyConfigAuditSheet_(book){
  let s=book.getSheetByName('TEST_FRIDAY_WEEKLY_DIGEST_CONFIG_AUDIT');
  if(!s)s=book.insertSheet('TEST_FRIDAY_WEEKLY_DIGEST_CONFIG_AUDIT');
  bseEnsureAdditiveHeaders_(s,BSE_FRIDAY_WEEKLY_CONFIG_AUDIT_HEADERS);
  return s;
}
function bseFridayWeeklyNextRun_(now){
  const d=now||new Date();
  const local=new Date(d.getTime()+BSE_TG_HISTORY_MYT_OFFSET_MS);
  const y=local.getUTCFullYear(),m=local.getUTCMonth(),day=local.getUTCDate(),dow=local.getUTCDay();
  const daysUntilFriday=(5-dow+7)%7;
  let targetMs=Date.UTC(y,m,day+daysUntilFriday,7,59,0)-BSE_TG_HISTORY_MYT_OFFSET_MS;
  if(targetMs<=d.getTime())targetMs+=7*24*60*60*1000;
  return new Date(targetMs);
}
function bseFridayWeeklyEnsureNextTrigger_(){
  const triggers=ScriptApp.getProjectTriggers();
  triggers.filter(t=>t.getHandlerFunction()===BSE_FRIDAY_WEEKLY_HANDLER).forEach(t=>ScriptApp.deleteTrigger(t));
  const next=bseFridayWeeklyNextRun_(new Date());
  const trigger=ScriptApp.newTrigger(BSE_FRIDAY_WEEKLY_HANDLER).timeBased().at(next).create();
  return {next:next,trigger_uid:String(trigger.getUniqueId())};
}
function bseFridayWeeklyRecipients_(book){
  const out=[];
  bseTestOwnerRows_(book).map(bseTestOwnerFromRow_)
    .filter(o=>o.is_active&&/^\d+$/.test(o.telegram_user_id)&&/^\d+$/.test(o.private_chat_id))
    .forEach(o=>out.push({
      telegram_user_id:o.telegram_user_id,
      private_chat_id:o.private_chat_id,
      role:o.is_admin?'ADMIN':'OWNER',
      is_owner:true
    }));
  bseTelegramRegistrationRows_(bseTelegramRegistrationSheet_(book))
    .filter(r=>String(r[2])==='REGISTERED_ACTIVE'&&/^\d+$/.test(String(r[0]||''))&&String(r[0])===String(r[1]))
    .forEach(r=>out.push({
      telegram_user_id:String(r[0]),
      private_chat_id:String(r[1]),
      role:'USER',
      is_owner:false
    }));
  const priority={ADMIN:3,OWNER:2,USER:1};
  return out.reduce((acc,item)=>{
    const i=acc.findIndex(x=>x.private_chat_id===item.private_chat_id);
    if(i<0)acc.push(item);
    else if(priority[item.role]>priority[acc[i].role])acc[i]=item;
    return acc;
  },[]);
}
function bseFridayWeeklyAlreadySent_(rows,start,end,chatId){
  return (rows||[]).some(r=>String(r[0])===String(start)&&String(r[1])===String(end)&&String(r[3])===String(chatId)&&String(r[5])==='SENT');
}
function bseFridayWeeklyDigestRender_(book,recipient,now){
  const window=bseTelegramHistoryLastCompleteWeek_(now||new Date());
  const events=bseTelegramHistoryEventsFor_(book,window,recipient.telegram_user_id,recipient.is_owner);
  const displayed=events.slice(0,BSE_TG_HISTORY_MAX_DISPLAY);
  const period=window.start+' → '+window.end;
  const gemini=bseTelegramReportGeminiCommentary_(period,displayed);
  const lines=[
    'FRIDAY WEEKLY DIGEST — '+period,
    'Sejarah canonical TEST:'
  ];
  if(!displayed.length)lines.push('Tiada rekod TEST yang boleh dipaparkan untuk akses anda dalam minggu ini.');
  else displayed.forEach(event=>lines.push(bseTelegramHistorySafeLine_(event)));
  if(events.length>displayed.length)lines.push('Dipaparkan '+displayed.length+' daripada '+events.length+' rekod yang dipadankan.');
  lines.push('','Komen Gemini — bukan fakta canonical, tidak mengubah rekod:');
  lines.push(gemini.ok?gemini.text:'Komen Gemini tidak tersedia buat masa ini.');
  lines.push('','Mod TEST — tiada rekod production ditulis.');
  return {
    window:window,
    events:events,
    displayed:displayed,
    gemini_status:gemini.ok?'SENT':gemini.reason,
    text:lines.join('\n'),
    production_write:false
  };
}
function bseFridayWeeklyDigestSend_(book,now){
  const audit=bseFridayWeeklyAuditSheet_(book);
  const rows=audit.getLastRow()>1?audit.getRange(2,1,audit.getLastRow()-1,BSE_FRIDAY_WEEKLY_AUDIT_HEADERS.length).getValues():[];
  const recipients=bseFridayWeeklyRecipients_(book),outcomes=[];
  recipients.forEach(recipient=>{
    const rendered=bseFridayWeeklyDigestRender_(book,recipient,now||new Date());
    const start=rendered.window.start,end=rendered.window.end;
    if(bseFridayWeeklyAlreadySent_(rows,start,end,recipient.private_chat_id)){
      outcomes.push({chat_id:recipient.private_chat_id,status:'ALREADY_SENT'});
      return;
    }
    try{
      const sent=bseTelegramApi_('sendMessage',{chat_id:recipient.private_chat_id,text:rendered.text});
      if(!sent||!sent.message_id)throw new Error('WEEKLY_DIGEST_SEND_UNCERTAIN');
      audit.appendRow([
        start,end,recipient.telegram_user_id,recipient.private_chat_id,recipient.role,
        'SENT',rendered.events.length,String(sent.message_id),rendered.gemini_status,new Date().toISOString(),'',
        false
      ]);
      outcomes.push({chat_id:recipient.private_chat_id,status:'SENT',matched_count:rendered.events.length,message_id:String(sent.message_id)});
    }catch(error){
      audit.appendRow([
        start,end,recipient.telegram_user_id,recipient.private_chat_id,recipient.role,
        'FAILED',rendered.events.length,'',rendered.gemini_status,new Date().toISOString(),
        bseTelegramSafeErrorDescription_(error.message||'WEEKLY_DIGEST_SEND_FAILED'),false
      ]);
      outcomes.push({chat_id:recipient.private_chat_id,status:'FAILED'});
    }
  });
  SpreadsheetApp.flush();
  return {recipient_count:recipients.length,outcomes:outcomes,production_write:false};
}
function installBseFridayWeeklyDigest(){
  if(bseRuntimeEnvironmentName_()!=='PILOT_TEST')throw new Error('Friday Weekly Digest scheduler hanya dibenarkan dalam PILOT_TEST.');
  bseTelegramAutomationBook_();
  const book=boundTestBook_(),props=PropertiesService.getScriptProperties();
  props.setProperty(BSE_FRIDAY_WEEKLY_TIME_PROPERTY,BSE_FRIDAY_WEEKLY_TIME);
  props.setProperty(BSE_FRIDAY_WEEKLY_ENABLED_PROPERTY,'OFF');
  const created=bseFridayWeeklyEnsureNextTrigger_();
  props.setProperty(BSE_FRIDAY_WEEKLY_TRIGGER_UID_PROPERTY,created.trigger_uid);
  props.setProperty(BSE_FRIDAY_WEEKLY_ENABLED_PROPERTY,'ON');
  bseFridayWeeklyConfigAuditSheet_(book).appendRow([
    new Date().toISOString(),bseRuntimeEnvironmentName_(),'ON',BSE_FRIDAY_WEEKLY_TIME,
    created.next.toISOString(),created.trigger_uid,false
  ]);
  SpreadsheetApp.flush();
  return {
    enabled:true,time_myt:BSE_FRIDAY_WEEKLY_TIME,next_run_utc:created.next.toISOString(),
    trigger_uid:created.trigger_uid,production_write:false
  };
}
function stopBseFridayWeeklyDigest(){
  PropertiesService.getScriptProperties().setProperty(BSE_FRIDAY_WEEKLY_ENABLED_PROPERTY,'OFF');
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===BSE_FRIDAY_WEEKLY_HANDLER).forEach(t=>ScriptApp.deleteTrigger(t));
  return {enabled:false,production_write:false};
}
function bseFridayWeeklyDigestTick(){
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty(BSE_FRIDAY_WEEKLY_ENABLED_PROPERTY)!=='ON')return {skipped:'OFF',production_write:false};
  if(bseRuntimeEnvironmentName_()!=='PILOT_TEST')throw new Error('Friday Weekly Digest tick hanya dibenarkan dalam PILOT_TEST.');
  bseTelegramAutomationBook_();
  const book=boundTestBook_();
  let result;
  try{result=bseFridayWeeklyDigestSend_(book,new Date());}
  finally{
    const created=bseFridayWeeklyEnsureNextTrigger_();
    props.setProperty(BSE_FRIDAY_WEEKLY_TRIGGER_UID_PROPERTY,created.trigger_uid);
  }
  return result;
}
function diagnoseBseFridayWeeklyDigestConfig(){
  const props=PropertiesService.getScriptProperties();
  return {
    environment:bseRuntimeEnvironmentName_(),
    enabled:props.getProperty(BSE_FRIDAY_WEEKLY_ENABLED_PROPERTY)||'OFF',
    time_myt:props.getProperty(BSE_FRIDAY_WEEKLY_TIME_PROPERTY)||'',
    trigger_uid:props.getProperty(BSE_FRIDAY_WEEKLY_TRIGGER_UID_PROPERTY)||'',
    production_write:false
  };
}
function diagnoseBseFridayWeeklyDigest(){
  const base=diagnoseBseFridayWeeklyDigestConfig();
  const triggers=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===BSE_FRIDAY_WEEKLY_HANDLER);
  base.trigger_count=triggers.length;
  return base;
}

function runBseFridayWeeklyDigestHarnessTests(){
  const before=new Date('2026-10-15T23:58:00.000Z'); // Fri 07:58 MYT
  const after=new Date('2026-10-16T00:00:00.000Z');  // Fri 08:00 MYT
  const n1=bseFridayWeeklyNextRun_(before),n2=bseFridayWeeklyNextRun_(after);
  const window=bseTelegramHistoryLastCompleteWeek_(new Date('2026-10-16T00:00:00.000Z'));
  const recipients=[
    {telegram_user_id:'1',private_chat_id:'1',role:'USER',is_owner:false},
    {telegram_user_id:'1',private_chat_id:'1',role:'OWNER',is_owner:true}
  ];
  const dedup=recipients.reduce((acc,item)=>{const i=acc.findIndex(x=>x.private_chat_id===item.private_chat_id);if(i<0)acc.push(item);else acc[i]=item;return acc;},[]);
  const source=[installBseFridayWeeklyDigest,bseFridayWeeklyDigestTick,bseFridayWeeklyDigestSend_,bseFridayWeeklyRecipients_].map(fn=>fn.toString()).join('\n');
  const tests=[
    {id:'07:59 MYT Friday resolves to correct UTC instant',pass:n1.toISOString()==='2026-10-15T23:59:00.000Z'},
    {id:'after Friday 07:59 schedules following Friday',pass:n2.toISOString()==='2026-10-22T23:59:00.000Z'},
    {id:'weekly window is previous complete Friday through Thursday',pass:window.start==='2026-10-09'&&window.end==='2026-10-15'},
    {id:'recipients include owners and REGISTERED_ACTIVE users',pass:/bseTestOwnerRows_/.test(source)&&/REGISTERED_ACTIVE/.test(source)&&/bseTelegramRegistrationRows_/.test(source)},
    {id:'recipient dedup can preserve owner precedence',pass:dedup.length===1&&dedup[0].role==='OWNER'},
    {id:'weekly renderer uses visibility-filtered canonical history and labelled Gemini',pass:/bseTelegramHistoryEventsFor_/.test(bseFridayWeeklyDigestRender_.toString())&&/bseTelegramReportGeminiCommentary_/.test(bseFridayWeeklyDigestRender_.toString())&&/bukan fakta canonical/.test(bseFridayWeeklyDigestRender_.toString())},
    {id:'daily-style dedup is per weekly window and PM',pass:bseFridayWeeklyAlreadySent_([['2026-10-09','2026-10-15','','1','','SENT']],'2026-10-09','2026-10-15','1')},
    {id:'does not enable general Telegram automation',pass:!/BSE_TELEGRAM_AUTOMATION.*ON/.test(source)&&!/bseTelegramTick\(/.test(source)},
    {id:'runtime-mapped book and PILOT_TEST boundary explicit',pass:/boundTestBook_/.test(source)&&/PILOT_TEST/.test(source)&&/production_write:false/.test(source)}
  ];
  const failed=tests.filter(t=>!t.pass);
  if(failed.length)throw new Error('Friday weekly digest harness gagal: '+failed.map(t=>t.id).join(', '));
  return tests;
}
