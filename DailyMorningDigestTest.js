/** @NotOnlyCurrentDoc */
// PILOT_TEST-only scheduled last-day morning digest. Independent of Telegram polling automation.
const BSE_DAILY_DIGEST_TZ='Asia/Kuala_Lumpur';
const BSE_DAILY_DIGEST_TIME='08:01';
const BSE_DAILY_DIGEST_HANDLER='bseDailyMorningDigestTick';
const BSE_DAILY_DIGEST_ENABLED_PROPERTY='BSE_DAILY_DIGEST_ENABLED';
const BSE_DAILY_DIGEST_TIME_PROPERTY='BSE_DAILY_DIGEST_TIME_MYT';
const BSE_DAILY_DIGEST_AUDIT_HEADERS=['digest_date','owner_id','telegram_user_id','private_chat_id','status','message_id','sent_at','last_error','production_write'];
const BSE_DAILY_DIGEST_CONFIG_AUDIT_HEADERS=['configured_at','environment','enabled','time_myt','next_run_utc','trigger_uid','production_write'];
const BSE_DAILY_DIGEST_TRIGGER_UID_PROPERTY='BSE_DAILY_DIGEST_TRIGGER_UID';

function bseDailyDigestAuditSheet_(book){
  let sheet=book.getSheetByName('TEST_DAILY_DIGEST_AUDIT');
  if(!sheet)sheet=book.insertSheet('TEST_DAILY_DIGEST_AUDIT');
  bseEnsureAdditiveHeaders_(sheet,BSE_DAILY_DIGEST_AUDIT_HEADERS);
  return sheet;
}

function bseDailyDigestConfigAuditSheet_(book){
  let sheet=book.getSheetByName('TEST_DAILY_DIGEST_CONFIG_AUDIT');
  if(!sheet)sheet=book.insertSheet('TEST_DAILY_DIGEST_CONFIG_AUDIT');
  bseEnsureAdditiveHeaders_(sheet,BSE_DAILY_DIGEST_CONFIG_AUDIT_HEADERS);
  return sheet;
}

function bseDailyDigestYesterdayMyt_(now){
  const stamp=Utilities.formatDate(now||new Date(),BSE_DAILY_DIGEST_TZ,'yyyy-MM-dd');
  const p=stamp.split('-').map(Number);
  const utc=new Date(Date.UTC(p[0],p[1]-1,p[2]-1,0,0,0));
  return Utilities.formatDate(utc,BSE_DAILY_DIGEST_TZ,'yyyy-MM-dd');
}

function bseDailyDigestNextRun_(now){
  const d=now||new Date();
  const ymd=Utilities.formatDate(d,BSE_DAILY_DIGEST_TZ,'yyyy-MM-dd').split('-').map(Number);
  let target=new Date(Date.UTC(ymd[0],ymd[1]-1,ymd[2],0,1,0)); // 08:01 MYT == 00:01 UTC
  if(target.getTime()<=d.getTime())target=new Date(target.getTime()+24*60*60*1000);
  return target;
}

function bseDailyDigestEnsureNextTrigger_(){
  const triggers=ScriptApp.getProjectTriggers();
  triggers.filter(t=>t.getHandlerFunction()===BSE_DAILY_DIGEST_HANDLER).forEach(t=>ScriptApp.deleteTrigger(t));
  const next=bseDailyDigestNextRun_(new Date());
  const trigger=ScriptApp.newTrigger(BSE_DAILY_DIGEST_HANDLER).timeBased().at(next).create();
  return {next:next,trigger_uid:String(trigger.getUniqueId())};
}

function installBseDailyMorningDigest(){
  if(bseRuntimeEnvironmentName_()!=='PILOT_TEST')throw new Error('Daily digest scheduler ini hanya dibenarkan dalam PILOT_TEST.');
  bseTelegramAutomationBook_();
  const props=PropertiesService.getScriptProperties();
  props.setProperty(BSE_DAILY_DIGEST_TIME_PROPERTY,BSE_DAILY_DIGEST_TIME);
  props.setProperty(BSE_DAILY_DIGEST_ENABLED_PROPERTY,'OFF');
  const created=bseDailyDigestEnsureNextTrigger_();
  props.setProperty(BSE_DAILY_DIGEST_TRIGGER_UID_PROPERTY,created.trigger_uid);
  props.setProperty(BSE_DAILY_DIGEST_ENABLED_PROPERTY,'ON');
  const book=boundTestBook_();
  bseDailyDigestConfigAuditSheet_(book).appendRow([new Date().toISOString(),bseRuntimeEnvironmentName_(),'ON',BSE_DAILY_DIGEST_TIME,created.next.toISOString(),created.trigger_uid,false]);
  SpreadsheetApp.flush();
  console.log('DAILY_DIGEST_ON: next='+created.next.toISOString()+' / '+BSE_DAILY_DIGEST_TIME+' MYT; production_write=false');
  return {enabled:true,time_myt:BSE_DAILY_DIGEST_TIME,next_run_utc:created.next.toISOString(),trigger_uid:created.trigger_uid,production_write:false};
}

function stopBseDailyMorningDigest(){
  PropertiesService.getScriptProperties().setProperty(BSE_DAILY_DIGEST_ENABLED_PROPERTY,'OFF');
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===BSE_DAILY_DIGEST_HANDLER).forEach(t=>ScriptApp.deleteTrigger(t));
  return {enabled:false,production_write:false};
}

function bseDailyDigestAlreadySent_(rows,date,chatId){
  return (rows||[]).some(r=>String(r[0])===String(date)&&String(r[3])===String(chatId)&&String(r[4])==='SENT');
}

function bseDailyMorningDigestSend_(book,now){
  const date=bseDailyDigestYesterdayMyt_(now||new Date());
  const audit=bseDailyDigestAuditSheet_(book);
  const rows=audit.getLastRow()>1?audit.getRange(2,1,audit.getLastRow()-1,BSE_DAILY_DIGEST_AUDIT_HEADERS.length).getValues():[];
  const owners=bseTestOwnerRows_(book).map(bseTestOwnerFromRow_).filter(o=>o.is_active&&/^\d+$/.test(o.telegram_user_id)&&/^\d+$/.test(o.private_chat_id));
  const unique=owners.filter((o,i,a)=>a.findIndex(x=>x.private_chat_id===o.private_chat_id)===i);
  const outcomes=[];
  unique.forEach(owner=>{
    if(bseDailyDigestAlreadySent_(rows,date,owner.private_chat_id)){outcomes.push({owner_id:owner.owner_id,status:'ALREADY_SENT'});return;}
    const synthetic={text:'/report '+date,from:{id:Number(owner.telegram_user_id)},chat:{id:Number(owner.private_chat_id),type:'private'}};
    const report=bseTelegramReportRetrieve_(book,synthetic);
    if(!report||!report.handled||!report.text){audit.appendRow([date,owner.owner_id,owner.telegram_user_id,owner.private_chat_id,'FAILED','',new Date().toISOString(),'REPORT_RENDER_FAILED',false]);outcomes.push({owner_id:owner.owner_id,status:'FAILED'});return;}
    try{
      const sent=bseTelegramApi_('sendMessage',{chat_id:String(owner.private_chat_id),text:'DAILY MORNING DIGEST — laporan semalam\n'+report.text});
      if(!sent||!sent.message_id)throw new Error('DIGEST_SEND_UNCERTAIN');
      audit.appendRow([date,owner.owner_id,owner.telegram_user_id,owner.private_chat_id,'SENT',String(sent.message_id),new Date().toISOString(),'',
        false]);
      outcomes.push({owner_id:owner.owner_id,status:'SENT',message_id:String(sent.message_id)});
    }catch(error){
      audit.appendRow([date,owner.owner_id,owner.telegram_user_id,owner.private_chat_id,'FAILED','',new Date().toISOString(),bseTelegramSafeErrorDescription_(error.message||'DIGEST_SEND_FAILED'),false]);
      outcomes.push({owner_id:owner.owner_id,status:'FAILED'});
    }
  });
  SpreadsheetApp.flush();
  return {date:date,outcomes:outcomes,production_write:false};
}

function bseDailyMorningDigestTick(){
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty(BSE_DAILY_DIGEST_ENABLED_PROPERTY)!=='ON')return {skipped:'OFF',production_write:false};
  if(bseRuntimeEnvironmentName_()!=='PILOT_TEST')throw new Error('Daily digest tick hanya dibenarkan dalam PILOT_TEST.');
  bseTelegramAutomationBook_();
  const book=boundTestBook_();
  let result;
  try{result=bseDailyMorningDigestSend_(book,new Date());}
  finally{const created=bseDailyDigestEnsureNextTrigger_();PropertiesService.getScriptProperties().setProperty(BSE_DAILY_DIGEST_TRIGGER_UID_PROPERTY,created.trigger_uid);}
  return result;
}

function runBseDailyMorningDigestHarnessTests(){
  const before=new Date('2026-10-11T00:00:00.000Z'); // 08:00 MYT
  const after=new Date('2026-10-11T00:02:00.000Z');  // 08:02 MYT
  const nextBefore=bseDailyDigestNextRun_(before),nextAfter=bseDailyDigestNextRun_(after);
  const rows=[['2026-10-10','owner','913','913','SENT','1','','',false]];
  const source=[installBseDailyMorningDigest,bseDailyMorningDigestTick,bseDailyMorningDigestSend_].map(f=>f.toString()).join('\n');
  const tests=[
    {id:'08:01 MYT resolves to 00:01 UTC same date',pass:nextBefore.toISOString()==='2026-10-11T00:01:00.000Z'},
    {id:'after 08:01 schedules next MYT day',pass:nextAfter.toISOString()==='2026-10-12T00:01:00.000Z'},
    {id:'last-day date uses MYT boundary',pass:bseDailyDigestYesterdayMyt_(new Date('2026-10-11T00:01:00.000Z'))==='2026-10-10'},
    {id:'dedup is per date and private chat',pass:bseDailyDigestAlreadySent_(rows,'2026-10-10','913')&&!bseDailyDigestAlreadySent_(rows,'2026-10-11','913')},
    {id:'uses canonical report renderer and PM owner registry',pass:/bseTelegramReportRetrieve_/.test(source)&&/bseTestOwnerRows_/.test(source)&&/private_chat_id/.test(source)},
    {id:'does not enable general Telegram automation',pass:!/BSE_TELEGRAM_AUTOMATION.*ON/.test(source)&&!/bseTelegramTick\(/.test(source)},
    {id:'PILOT_TEST and production boundary explicit',pass:/PILOT_TEST/.test(source)&&/production_write:false/.test(source)},
    {id:'all digest sheet access uses runtime-mapped book',pass:installBseDailyMorningDigest.toString().includes('const book=boundTestBook_()')&&bseDailyMorningDigestTick.toString().includes('const book=boundTestBook_()')&&!source.includes('bseDailyMorningDigestSend_(SpreadsheetApp.getActiveSpreadsheet')}
  ];
  const failures=tests.filter(t=>!t.pass);if(failures.length)throw new Error('Daily digest harness gagal: '+failures.map(t=>t.id).join(', '));
  return tests;
}

function diagnoseBseDailyMorningDigestConfig(){
  const props=PropertiesService.getScriptProperties();
  return {environment:bseRuntimeEnvironmentName_(),enabled:props.getProperty(BSE_DAILY_DIGEST_ENABLED_PROPERTY)||'OFF',time_myt:props.getProperty(BSE_DAILY_DIGEST_TIME_PROPERTY)||'',trigger_uid:props.getProperty(BSE_DAILY_DIGEST_TRIGGER_UID_PROPERTY)||'',production_write:false};
}
function diagnoseBseDailyMorningDigest(){
  const base=diagnoseBseDailyMorningDigestConfig();
  const triggers=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===BSE_DAILY_DIGEST_HANDLER);
  base.trigger_count=triggers.length;return base;
}
