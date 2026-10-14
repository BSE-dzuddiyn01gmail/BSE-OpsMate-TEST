/** @OnlyCurrentDoc */
// TEST-only EC Leaching retrieval. Read-only against confirmed TEST_EC_LEACHATE rows.
// Reuses /history date/week semantics, including nth Friday week inside a selected month.
const BSE_EC_HISTORY_AUDIT_HEADERS=['requested_at','telegram_user_id','private_chat_id','period','outcome','reason','matched_batches','matched_rows','displayed_rows','production_write'];

function bseTelegramEcHistoryAudit_(book){
  let s=book.getSheetByName('TEST_EC_HISTORY_AUDIT');
  if(!s)s=book.insertSheet('TEST_EC_HISTORY_AUDIT');
  bseEnsureAdditiveHeaders_(s,BSE_EC_HISTORY_AUDIT_HEADERS);
  return s;
}
function bseTelegramEcHistoryCommand_(text,now){
  const raw=String(text||'').trim();
  if(!/^\/ec_history\b/i.test(raw))return null;
  const translated=raw.replace(/^\/ec_history\b/i,'/history');
  return bseTelegramHistoryCommand_(translated,now);
}
function bseTelegramEcHistoryRows_(book,command){
  const sheet=book.getSheetByName('TEST_EC_LEACHATE');
  if(!sheet)return [];
  const rows=bseEcLeachateRows_(sheet,BSE_EC_LEACHATE_HEADERS.length);
  return rows.filter(row=>
    String(row[11]||'')==='REPORTER_CONFIRMED_TEST'&&
    (row[12]===false||String(row[12]).toLowerCase()==='false')&&
    bseTelegramHistoryInCommandPeriod_(bseTelegramHistoryDate_(row[3]),command)
  );
}
function bseTelegramEcHistoryGroups_(rows){
  const map=new Map();
  (rows||[]).forEach(row=>{
    const key=[String(row[0]||''),String(row[1]||''),String(row[3]||''),String(row[4]||'')].join('|');
    if(!map.has(key))map.set(key,{source_key:String(row[0]||''),batch_id:String(row[1]||''),date:bseTelegramHistoryDate_(row[3]),session:String(row[4]||''),reporter_user_id:String(row[15]||''),rows:[]});
    map.get(key).rows.push(row);
  });
  return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.session.localeCompare(b.session)||a.source_key.localeCompare(b.source_key));
}
function bseTelegramEcHistoryReadingLine_(row){
  const scope=String(row[5]||''),moduleId=String(row[6]||''),plotId=String(row[7]||''),label=scope==='MODULE'?moduleId:plotId,status=String(row[10]||'');
  if(!label)return '';
  if(status==='NOT_MEASURED')return label+' — x : x';
  if(status==='AK_ZERO')return label+' — '+bseEcLeachateDisplayNumber_(row[8])+' : AK';
  if(status==='NUMERIC')return label+' — '+bseEcLeachateDisplayNumber_(row[8])+' : '+bseEcLeachateDisplayNumber_(row[9]);
  return label+' — status '+status;
}
function bseTelegramEcHistoryRender_(command,groups,maxChars){
  const limit=Math.max(1000,Number(maxChars||3900)),lines=['EC LEACHING TEST — '+bseTelegramHistoryPeriodLabel_(command)];
  let displayedRows=0,truncated=false;
  if(!groups.length)lines.push('Tiada rekod EC Leaching TEST yang disahkan dalam sela masa ini.');
  for(const group of groups){
    const ref=group.source_key.replace(/\|EC_Leachate_Log$/,'');
    const header=['',group.date+' '+group.session,ref].join('\n');
    if((lines.join('\n')+'\n'+header).length>limit){truncated=true;break;}
    lines.push('',group.date+' '+group.session+' | '+ref);
    for(const row of group.rows){
      const item='• '+bseTelegramEcHistoryReadingLine_(row);
      if((lines.join('\n')+'\n'+item).length>limit-100){truncated=true;break;}
      lines.push(item);displayedRows++;
    }
    if(truncated)break;
  }
  if(truncated)lines.push('','Output dipendekkan; kecilkan sela masa untuk lihat semua bacaan.');
  lines.push('','Mod TEST — bacaan dibaca daripada TEST_EC_LEACHATE; tiada production write.');
  return {text:lines.join('\n').slice(0,4090),displayed_rows:displayedRows,truncated:truncated};
}
function bseTelegramEcHistoryRetrieve_(book,m){
  const command=bseTelegramEcHistoryCommand_(m&&m.text);
  if(!command)return {handled:false};
  const user=String(m&&m.from&&m.from.id||''),chat=String(m&&m.chat&&m.chat.id||''),period=command.period||'';
  const audit=(outcome,reason,batches,rows,displayed)=>{
    bseTelegramEcHistoryAudit_(book).appendRow([new Date().toISOString(),user,chat,period,outcome,reason,Number(batches||0),Number(rows||0),Number(displayed||0),false]);
    SpreadsheetApp.flush();
  };
  if(command.invalid){
    audit('DENIED',command.reason||'INVALID_PERIOD',0,0,0);
    return {handled:true,text:'Format: /ec_history YYYY-MM | /ec_history YYYY-MM-DD | /ec_history week last | /ec_history week N YYYY-MM | /ec_history week YYYY-MM-DD (tarikh Jumaat).'};
  }
  const access=bseTelegramHistoryAccess_(book,m);
  if(!access.ok){
    audit('DENIED',access.reason,0,0,0);
    return {handled:true,text:'EC history hanya boleh diminta melalui PM oleh owner/admin atau user TEST yang aktif.'};
  }
  const rows=bseTelegramEcHistoryRows_(book,command),groups=bseTelegramEcHistoryGroups_(rows),rendered=bseTelegramEcHistoryRender_(command,groups,3900);
  audit('SENT',access.reason,groups.length,rows.length,rendered.displayed_rows);
  return {handled:true,text:rendered.text,matched_batches:groups.length,matched_rows:rows.length,displayed_rows:rendered.displayed_rows,production_write:false};
}
function installBseTelegramEcHistorySchemaTest(){
  if(bseRuntimeEnvironmentName_()!=='PILOT_TEST')throw new Error('EC history schema hanya dibenarkan dalam PILOT_TEST.');
  const book=boundTestBook_();bseTelegramEcHistoryAudit_(book);
  return {audit_sheet:bseRuntimeSheetName_('TEST_EC_HISTORY_AUDIT'),production_write:false};
}
function diagnoseBseEcHistoryCoverageTest(){
  const book=boundTestBook_(),sheet=book.getSheetByName('TEST_EC_LEACHATE');
  if(!sheet)return {confirmed_rows:0,dates:[],production_write:false};
  const rows=bseEcLeachateRows_(sheet,BSE_EC_LEACHATE_HEADERS.length).filter(row=>String(row[11]||'')==='REPORTER_CONFIRMED_TEST'&&(row[12]===false||String(row[12]).toLowerCase()==='false'));
  const dates=[...new Set(rows.map(row=>bseTelegramHistoryDate_(row[3])).filter(Boolean))].sort();
  return {confirmed_rows:rows.length,dates:dates,production_write:false};
}
function diagnoseBseEcNthWeekHistoryTest(){
  const book=boundTestBook_(),command=bseTelegramEcHistoryCommand_('/ec_history week 2 2026-10'),rows=bseTelegramEcHistoryRows_(book,command),groups=bseTelegramEcHistoryGroups_(rows),rendered=bseTelegramEcHistoryRender_(command,groups,3900);
  return {period:command.period,matched_batches:groups.length,matched_rows:rows.length,displayed_rows:rendered.displayed_rows,text:rendered.text,production_write:false};
}
function diagnoseBseEcKnownWeekTest(){
  const book=boundTestBook_(),command=bseTelegramEcHistoryCommand_('/ec_history week 3 2026-09'),rows=bseTelegramEcHistoryRows_(book,command),groups=bseTelegramEcHistoryGroups_(rows),rendered=bseTelegramEcHistoryRender_(command,groups,3900);
  return {period:command.period,matched_batches:groups.length,matched_rows:rows.length,displayed_rows:rendered.displayed_rows,text:rendered.text,production_write:false};
}
function runBseTelegramEcHistoryHarnessTests(){
  const nth=bseTelegramEcHistoryCommand_('/ec_history week 2 2026-10');
  const month=bseTelegramEcHistoryCommand_('/ec_history 2026-10');
  const rows=[
    ['BSE-TG-1|EC_Leachate_Log','B1','1','2026-10-10','PAGI','PLOT','M3','M3P1',2.03,0,'AK_ZERO','REPORTER_CONFIRMED_TEST',false,'','', '11','h'],
    ['BSE-TG-1|EC_Leachate_Log','B1','1','2026-10-10','PAGI','PLOT','M3','M3P3',1.47,2.5,'NUMERIC','REPORTER_CONFIRMED_TEST',false,'','', '11','h'],
    ['BSE-TG-2|EC_Leachate_Log','B2','2','2026-10-20','PETANG','MODULE','M7','','','','NOT_MEASURED','REPORTER_CONFIRMED_TEST',false,'','', '12','h']
  ];
  const groups=bseTelegramEcHistoryGroups_(rows),rendered=bseTelegramEcHistoryRender_(nth,groups.slice(0,1),3900),source=[bseTelegramEcHistoryRetrieve_,bseTelegramEcHistoryRows_].map(fn=>fn.toString()).join('\n');
  const tests=[
    {id:'EC history reuses nth Friday week semantics',pass:nth.kind==='WEEK'&&nth.start==='2026-10-09'&&nth.end==='2026-10-15'&&month.kind==='MONTH'},
    {id:'EC rows group by source batch date and session',pass:groups.length===2&&groups[0].rows.length===2&&groups[1].rows.length===1},
    {id:'EC rendering preserves AK numeric and normal numeric readings',pass:/M3P1 — 2.03 : AK/.test(rendered.text)&&/M3P3 — 1.47 : 2.5/.test(rendered.text)},
    {id:'only confirmed TEST rows are read',pass:/REPORTER_CONFIRMED_TEST/.test(bseTelegramEcHistoryRows_.toString())&&/production_write/.test(source)},
    {id:'PM owner or registered-active access is reused',pass:/bseTelegramHistoryAccess_/.test(bseTelegramEcHistoryRetrieve_.toString())},
    {id:'retrieval has no EC writer or production writer',pass:!/appendRow\(.*TEST_EC_LEACHATE|bseEcLeachateReviewCore_|production_write\s*:\s*true/.test(source)}
  ];
  const bad=tests.filter(t=>!t.pass);if(bad.length)throw new Error('EC history harness gagal: '+bad.map(t=>t.id).join(', '));
  return tests;
}
