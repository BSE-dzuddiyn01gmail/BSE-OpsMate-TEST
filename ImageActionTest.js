/** @OnlyCurrentDoc */
// TEST-only chooser for PHOTO messages sent without a caption.
// Prevents Telegram command-menu UX limitations from forcing users to type slash commands as captions.
const BSE_IMAGE_ACTION_HEADERS=[
  'token','source_chat_id','source_chat_type','source_message_id','reporter_telegram_user_id','reporter_name',
  'telegram_file_id','telegram_file_unique_id','mime_type','file_name','file_size','created_at','status',
  'prompt_message_id','selected_action','processed_at','last_error','production_write'
];
const BSE_IMAGE_ACTION_CALLBACK_HEADERS=[
  'update_id','callback_id','callback_json','status','attempts','last_error','received_at','processed_at','next_attempt_at'
];

function bseImageActionSheet_(book){
  let s=book.getSheetByName('TEST_IMAGE_ACTION_PENDING');
  if(!s)s=book.insertSheet('TEST_IMAGE_ACTION_PENDING');
  bseEnsureAdditiveHeaders_(s,BSE_IMAGE_ACTION_HEADERS);
  return s;
}
function bseImageActionCallbackSheet_(book){
  let s=book.getSheetByName('TEST_IMAGE_ACTION_CALLBACK_PENDING');
  if(!s)s=book.insertSheet('TEST_IMAGE_ACTION_CALLBACK_PENDING');
  bseEnsureAdditiveHeaders_(s,BSE_IMAGE_ACTION_CALLBACK_HEADERS);
  return s;
}
function bseImageActionRows_(sheet){
  return sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,BSE_IMAGE_ACTION_HEADERS.length).getValues():[];
}
function bseImageActionMarkup_(token){
  return {inline_keyboard:[
    [{text:'🔍 Analisis gambar',callback_data:'IA1:'+token+':A'},{text:'📝 Ekstrak teks',callback_data:'IA1:'+token+':T'}],
    [{text:'📎 Simpan Evidence',callback_data:'IA1:'+token+':E'},{text:'✖ Buang',callback_data:'IA1:'+token+':R'}]
  ]};
}
function bseImageActionIsCallback_(u){
  return /^IA1:[A-Za-z0-9]{8,16}:[ATER]$/.test(String(u&&u.callback_query&&u.callback_query.data||''));
}
function bseImageActionPromptText_(){
  return '[PILOT TEST]\nGambar diterima tanpa arahan. Pilih tindakan di bawah.\nGambar belum diproses dan belum disimpan ke Drive.';
}
function bseImageActionEnsurePrompt_(sheet,index,row){
  if(!row||!['PROMPT_SEND_PENDING','OPEN'].includes(String(row[12]||'')))return false;
  if(String(row[12])==='OPEN'&&/^\d+$/.test(String(row[13]||'')))return true;
  try{
    const sent=bseTelegramApi_('sendMessage',{
      chat_id:String(row[1]),
      text:bseImageActionPromptText_(),
      reply_parameters:{message_id:Number(row[3]),allow_sending_without_reply:true},
      reply_markup:bseImageActionMarkup_(String(row[0]))
    });
    if(!sent||!sent.message_id)throw new Error('IMAGE_ACTION_PROMPT_SEND_UNCERTAIN');
    sheet.getRange(index+2,13,1,5).setValues([['OPEN',String(sent.message_id),'','','']]);
    SpreadsheetApp.flush();
    return true;
  }catch(error){
    sheet.getRange(index+2,13).setValue('PROMPT_SEND_PENDING');
    sheet.getRange(index+2,17).setValue(bseTelegramSafeErrorDescription_(error&&error.message||'IMAGE_ACTION_PROMPT_FAILED'));
    SpreadsheetApp.flush();
    return false;
  }
}
function bseImageActionReceive_(book,m){
  const a=bseTelegramEvidenceAttachment_(m);
  if(!a||a.type!=='PHOTO'||!/^image\//i.test(a.mime))return {handled:false};
  if(String(m&&m.caption||'').trim())return {handled:false};
  if(!m||!m.chat||!m.from||m.from.is_bot)return {handled:false};
  const chat=String(m.chat.id),user=String(m.from.id),private=String(m.chat.type)==='private';
  const access=private?bseTelegramRegistrationPrivateAccess_(book,m):{status:'GROUP'};
  if(private&&!['REGISTERED_ACTIVE','OWNER_ACTIVE'].includes(access.status))return {handled:true,text:'Sila mendaftar sebagai ahli aktif dahulu, hubungi admin.'};
  if(!private&&!bseTelegramTestApprovalGroupIds_().includes(chat))return {handled:false};
  const sheet=bseImageActionSheet_(book),rows=bseImageActionRows_(sheet);
  const existing=rows.findIndex(r=>String(r[1])===chat&&String(r[3])===String(m.message_id)&&String(r[7])===a.uniqueId);
  if(existing>=0){bseImageActionEnsurePrompt_(sheet,existing,rows[existing]);return {handled:true,duplicate:true,production_write:false};}
  const token=bseApprovalToken_(),name=[m.from.first_name,m.from.last_name].filter(Boolean).join(' '),row=[
    token,chat,String(m.chat.type),String(m.message_id),user,name,a.fileId,a.uniqueId,a.mime,a.name,a.size,
    new Date().toISOString(),'PROMPT_SEND_PENDING','','','','',false
  ];
  sheet.appendRow(row);SpreadsheetApp.flush();
  const index=sheet.getLastRow()-2;
  bseImageActionEnsurePrompt_(sheet,index,row);
  return {handled:true,prompted:true,token:token,production_write:false};
}
function bseImageActionPersistCallback_(book,u){
  if(!bseImageActionIsCallback_(u))throw new Error('Callback image action tidak sah.');
  const c=u.callback_query||{},s=bseImageActionCallbackSheet_(book),rows=s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,BSE_IMAGE_ACTION_CALLBACK_HEADERS.length).getValues():[];
  if(rows.some(r=>String(r[0])===String(u.update_id)||String(r[1])===String(c.id)))return {duplicate:true};
  s.appendRow([String(u.update_id),String(c.id||''),JSON.stringify(c),'PENDING',0,'',new Date().toISOString(),'','']);
  SpreadsheetApp.flush();
  return {persisted:true};
}
function bseImageActionSyntheticMessage_(row,action){
  const caption=action==='A'?'/image_analysis':action==='T'?'/image_to_text':'';
  return {
    message_id:Number(row[3]),
    chat:{id:String(row[1]),type:String(row[2])},
    from:{id:String(row[4]),is_bot:false,first_name:String(row[5]||'')},
    caption:caption,
    photo:[{file_id:String(row[6]),file_unique_id:String(row[7]),file_size:Number(row[10]||0)}]
  };
}
function bseImageActionClosePrompt_(row,text){
  const chat=String(row[1]),messageId=Number(row[13]);
  if(!messageId)return;
  try{bseTelegramApi_('editMessageReplyMarkup',{chat_id:chat,message_id:messageId,reply_markup:{inline_keyboard:[]}});}catch(_){}
  try{bseTelegramApi_('editMessageText',{chat_id:chat,message_id:messageId,text:'[PILOT TEST]\n'+text});}catch(_){}
}
function bseImageActionCallback_(book,callback){
  const m=String(callback&&callback.data||'').match(/^IA1:([A-Za-z0-9]{8,16}):([ATER])$/);
  if(!m)throw new Error('Callback image action tidak sah.');
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw new Error('Image action sedang diproses.');
  try{
    const sheet=bseImageActionSheet_(book),rows=bseImageActionRows_(sheet),index=rows.findIndex(r=>String(r[0])===m[1]);
    if(index<0)throw new Error('Image action tidak ditemui.');
    const row=rows[index],actor=String(callback.from&&callback.from.id||''),chat=String(callback.message&&callback.message.chat&&callback.message.chat.id||'');
    if(actor!==String(row[4])||chat!==String(row[1])){
      if(callback.id)bseTelegramApi_('answerCallbackQuery',{callback_query_id:callback.id,text:'Pilihan ini hanya untuk penghantar gambar.',show_alert:true});
      return {authorized:false,production_write:false};
    }
    if(String(row[12])!=='OPEN'){
      if(callback.id)bseTelegramApi_('answerCallbackQuery',{callback_query_id:callback.id,text:'Pilihan gambar ini sudah diproses.'});
      return {duplicate:true,status:String(row[12]),production_write:false};
    }
    const action=m[2],synthetic=bseImageActionSyntheticMessage_(row,action);
    let label='',result={handled:true};
    if(action==='A'){result=bseImageProcessingReceive_(book,synthetic);label='Analisis gambar dipilih.';}
    else if(action==='T'){result=bseImageProcessingReceive_(book,synthetic);label='Ekstrak teks dipilih.';}
    else if(action==='E'){result=bseTelegramEvidenceReceiveMessage_(book,synthetic);label='Simpan Evidence dipilih; semak kad pengesahan Evidence.';}
    else {label='Gambar dibuang daripada flow ini. Tiada processing atau Drive write dibuat.';}
    if(action!=='R'&&(!result||!result.handled))throw new Error('IMAGE_ACTION_DOWNSTREAM_NOT_HANDLED');
    const status=action==='A'?'SELECTED_ANALYSIS':action==='T'?'SELECTED_TEXT':action==='E'?'SELECTED_EVIDENCE':'DISCARDED';
    sheet.getRange(index+2,13,1,5).setValues([[status,String(row[13]||''),action,new Date().toISOString(),'']]);SpreadsheetApp.flush();
    bseImageActionClosePrompt_(row,label);
    if(callback.id)bseTelegramApi_('answerCallbackQuery',{callback_query_id:callback.id,text:label.slice(0,180)});
    return {selected:action,status:status,production_write:false};
  }finally{lock.releaseLock();}
}
function processBseImageActionCallbacksTest(){
  const book=boundTestBook_(),sheet=bseImageActionSheet_(book),rows=bseImageActionRows_(sheet);
  for(let i=0;i<rows.length;i++){if(String(rows[i][12])==='PROMPT_SEND_PENDING'){bseImageActionEnsurePrompt_(sheet,i,rows[i]);break;}}
  const cb=bseImageActionCallbackSheet_(book),callbacks=cb.getLastRow()>1?cb.getRange(2,1,cb.getLastRow()-1,BSE_IMAGE_ACTION_CALLBACK_HEADERS.length).getValues():[],now=Date.now();
  for(let i=0;i<callbacks.length;i++){
    const row=callbacks[i],next=Date.parse(String(row[8]||''));if(String(row[3])!=='PENDING'||(!isNaN(next)&&next>now))continue;
    const attempt=Number(row[4]||0)+1;
    try{
      bseImageActionCallback_(book,JSON.parse(String(row[2])));
      cb.getRange(i+2,4,1,6).setValues([['PROCESSED',attempt,'',String(row[6]),new Date().toISOString(),'']]);
    }catch(error){
      const failure=bseTelegramCallbackFailureState_(error,attempt,now);
      cb.getRange(i+2,4,1,6).setValues([[failure.status,attempt,failure.last_error,String(row[6]),'',failure.next_attempt_at]]);
    }
    SpreadsheetApp.flush();break;
  }
  return {production_write:false};
}
function installBseImageActionSchemaTest(){
  if(bseRuntimeEnvironmentName_()!=='PILOT_TEST')throw new Error('Image action schema hanya dibenarkan dalam PILOT_TEST.');
  const book=boundTestBook_();bseImageActionSheet_(book);bseImageActionCallbackSheet_(book);
  return {pending_sheet:bseRuntimeSheetName_('TEST_IMAGE_ACTION_PENDING'),callback_sheet:bseRuntimeSheetName_('TEST_IMAGE_ACTION_CALLBACK_PENDING'),production_write:false};
}
function runBseImageActionHarnessTests(){
  const markup=bseImageActionMarkup_('Abc123xY9'),receive=bseImageActionReceive_.toString(),callback=bseImageActionCallback_.toString(),processor=processBseImageActionCallbacksTest.toString(),synthetic=bseImageActionSyntheticMessage_(['t','1','private','10','1','Ali','f','u','image/jpeg','x.jpg',123],'A');
  const buttons=markup.inline_keyboard.flat();
  const tests=[
    {id:'captionless photo chooser exposes four explicit actions',pass:buttons.length===4&&buttons.some(b=>/Analisis/.test(b.text))&&buttons.some(b=>/Ekstrak/.test(b.text))&&buttons.some(b=>/Evidence/.test(b.text))&&buttons.some(b=>/Buang/.test(b.text))},
    {id:'chooser only intercepts PHOTO without caption',pass:/a\.type!=='PHOTO'/.test(receive)&&/String\(m&&m\.caption/.test(receive)},
    {id:'synthetic analysis reuses original Telegram file id',pass:synthetic.caption==='/image_analysis'&&synthetic.photo[0].file_id==='f'&&synthetic.message_id===10},
    {id:'analysis and OCR reuse existing image processing intake',pass:/bseImageProcessingReceive_/.test(callback)&&/SELECTED_ANALYSIS/.test(callback)&&/SELECTED_TEXT/.test(callback)},
    {id:'evidence action reuses existing human-confirmed Evidence flow',pass:/bseTelegramEvidenceReceiveMessage_/.test(callback)&&/SELECTED_EVIDENCE/.test(callback)},
    {id:'callback is durable and retryable',pass:/bseImageActionCallbackSheet_/.test(bseImageActionPersistCallback_.toString())&&/bseTelegramCallbackFailureState_/.test(processor)},
    {id:'no domain or production writer',pass:!/bse(?:Measurement|CropBatch|Transplant|PlantCensus|Treatment|Inventory|Observation)ReviewCore_|production_write\s*:\s*true/.test(receive+callback+processor)}
  ];
  const bad=tests.filter(t=>!t.pass);if(bad.length)throw new Error('Image action harness gagal: '+bad.map(t=>t.id).join(', '));
  return tests;
}
