/** @OnlyCurrentDoc */
// TEST-only PM Evidence retrieval. It returns the Telegram-held file, never a Drive URL.
const BSE_TG_RETRIEVAL_AUDIT_HEADERS=['requested_at','telegram_user_id','private_chat_id','evidence_id','outcome','reason'];
function bseTelegramRetrievalAudit_(book){let s=book.getSheetByName('TEST_TELEGRAM_RETRIEVAL_AUDIT');if(!s)s=book.insertSheet('TEST_TELEGRAM_RETRIEVAL_AUDIT');bseEnsureAdditiveHeaders_(s,BSE_TG_RETRIEVAL_AUDIT_HEADERS);return s;}
function bseTelegramEvidenceRetrieveCommand_(text){const m=String(text||'').match(/^\/retrieve\s+(BSE-EV-[A-Za-z0-9_-]+)\s*$/i);return m?m[1].toUpperCase():'';}
function bseTelegramEvidenceRetrieve_(book,m){const ref=bseTelegramEvidenceRetrieveCommand_(m&&m.text);if(!ref)return {handled:false};const user=String(m.from&&m.from.id||''),chat=String(m.chat&&m.chat.id||''),audit=(outcome,reason)=>{bseTelegramRetrievalAudit_(book).appendRow([new Date().toISOString(),user,chat,ref,outcome,reason]);SpreadsheetApp.flush();};const access=bseTelegramRegistrationPrivateAccess_(book,m);if(!['REGISTERED_ACTIVE','OWNER_ACTIVE'].includes(access.status)){audit('DENIED','NOT_REGISTERED_ACTIVE');return {handled:true,text:'Retrieval hanya untuk ahli aktif melalui PM bot.'};}const row=bseTelegramEvidenceRows_(bseTelegramEvidenceSheet_(book)).find(r=>String(r[0]).toUpperCase()===ref);if(!row||String(row[16])!=='CONFIRMED_TEST'){audit('DENIED','NOT_CONFIRMED');return {handled:true,text:'Rujukan Evidence TEST tidak ditemui atau belum disahkan.'};}const owner=bseTestOwnerForTelegramUser_(book,user).ok,reporter=String(row[4])===user,standard=String(row[15])==='GROUP_STANDARD';if(!(owner||reporter||standard)){audit('DENIED','VISIBILITY_DENIED');return {handled:true,text:'Anda tidak mempunyai akses kepada Evidence ini.'};}const method=String(row[8])==='PHOTO'?'sendPhoto':String(row[8])==='DOCUMENT'?'sendDocument':'sendVideo',key=method==='sendPhoto'?'photo':method==='sendDocument'?'document':'video';bseTelegramApi_(method,{chat_id:chat,[key]:String(row[9]),caption:'Evidence TEST '+ref});audit('SENT','TELEGRAM_FILE_ID');return {handled:true};}

function runBseTelegramRetrievalHarnessTests(){
  const parser=bseTelegramEvidenceRetrieveCommand_.toString(),receiver=receiveBseTelegramTest.toString();
  const tests=[
    {id:'accepts one exact evidence reference',pass:bseTelegramEvidenceRetrieveCommand_('/retrieve BSE-EV-501-AQADahFr')==='BSE-EV-501-AQADAHFR'},
    {id:'rejects extra command content',pass:bseTelegramEvidenceRetrieveCommand_('/retrieve BSE-EV-501-AQADahFr extra')===''},
    {id:'receiver invokes retrieval only for an exact command',pass:/bseTelegramEvidenceRetrieveCommand_\(m&&m\.text\)/.test(receiver)},
    {id:'retrieval returns Telegram file id without Drive URL',pass:/sendPhoto|sendDocument|sendVideo/.test(bseTelegramEvidenceRetrieve_.toString())&&!/getUrl\(/.test(bseTelegramEvidenceRetrieve_.toString())},
    {id:'parser is anchored',pass:/\^\\\/retrieve/.test(parser)&&/\\s\*\$/.test(parser)}
  ];
  console.log('RETRIEVAL_HARNESS: '+JSON.stringify(tests));
  const failures=tests.filter(test=>!test.pass);if(failures.length)throw new Error('Retrieval harness gagal: '+failures.map(test=>test.id).join(', '));
  return tests;
}
