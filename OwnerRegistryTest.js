// Canonical TEST-only Owner Registry. No Google Tasks, trigger, or Telegram send capability.
const BSE_TEST_OWNER_REGISTRY_HEADERS=[
  'owner_id','owner_name','telegram_user_id','private_chat_id',
  'google_tasklist_id','is_active','is_admin','updated_at'
];

function bseTestOwnerRegistry_(book){
  if(!book||typeof book.getSheetByName!=='function')throw new Error('Owner Registry workbook tidak sah.');
  let sheet=book.getSheetByName('TEST_OWNER_REGISTRY');
  if(!sheet)sheet=book.insertSheet('TEST_OWNER_REGISTRY');
  if(typeof bseEnsureAdditiveHeaders_!=='function')throw new Error('Additive header guard diperlukan.');
  bseEnsureAdditiveHeaders_(sheet,BSE_TEST_OWNER_REGISTRY_HEADERS);
  return sheet;
}
function bseTestOwnerRows_(book){
  const sheet=bseTestOwnerRegistry_(book);
  return sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,BSE_TEST_OWNER_REGISTRY_HEADERS.length).getValues():[];
}
function bseTestRegistryBoolean_(value){return value===true||String(value||'').trim().toUpperCase()==='TRUE';}
function bseTestOwnerFromRow_(row){return {
  owner_id:String(row[0]||'').trim(),owner_name:String(row[1]||'').trim(),
  telegram_user_id:String(row[2]||'').trim(),private_chat_id:String(row[3]||'').trim(),
  google_tasklist_id:String(row[4]||'').trim(),is_active:bseTestRegistryBoolean_(row[5]),
  is_admin:bseTestRegistryBoolean_(row[6]),updated_at:String(row[7]||'').trim()
};}
function bseTestOwnerForTelegramUser_(book,telegramUserId){
  const userId=String(telegramUserId||'').trim();
  const matches=bseTestOwnerRows_(book).map(bseTestOwnerFromRow_).filter(owner=>owner.telegram_user_id===userId);
  if(!userId||!matches.length)return {ok:false,owner_id:'',reason:'UNKNOWN_OWNER'};
  if(matches.length!==1)return {ok:false,owner_id:'',reason:'OWNER_REGISTRY_DUPLICATE'};
  const owner=matches[0];
  if(!owner.owner_id)return Object.assign(owner,{ok:false,reason:'OWNER_ID_INVALID'});
  if(!owner.is_active)return Object.assign(owner,{ok:false,reason:'OWNER_INACTIVE'});
  if(!/^\d+$/.test(owner.private_chat_id))return Object.assign(owner,{ok:false,reason:'OWNER_PRIVATE_CHAT_UNAVAILABLE'});
  return Object.assign(owner,{ok:true,reason:''});
}
function runBseOwnerRegistryHarnessTests(){
  const valid=bseTestOwnerFromRow_(['owner-1','Owner','913757987','123456','','TRUE','FALSE','']);
  const tests=[
    {id:'required schema',pass:BSE_TEST_OWNER_REGISTRY_HEADERS.join('|')==='owner_id|owner_name|telegram_user_id|private_chat_id|google_tasklist_id|is_active|is_admin|updated_at'},
    {id:'valid owner row',pass:valid.owner_id==='owner-1'&&valid.is_active===true&&valid.is_admin===false},
    {id:'no Tasks trigger or Telegram dependency',pass:!/Tasks\.|ScriptApp\.|bseTelegramApi_/.test([bseTestOwnerRegistry_,bseTestOwnerRows_,bseTestOwnerForTelegramUser_].map(fn=>fn.toString()).join('\n'))}
  ];
  const failed=tests.filter(t=>!t.pass);if(failed.length)throw new Error('Owner Registry harness gagal: '+failed.map(t=>t.id).join(', '));
  return tests;
}
