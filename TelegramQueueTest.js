/** @OnlyCurrentDoc */
// Manual TEST receiver. Requires Code.gs and TelegramTest.gs. No production writes.
const BSE_TG_QUEUE_HEADERS=['update_id','chat_id','user_id','message_id','original_note','received_at','status','ack_status','ack_message_id','candidate_json','processing_attempts','next_attempt_at','last_error','reply_to_message_id','parent_update_id','question_message_id','source_metadata_json','source_message_date'];
function receiveBseTelegramTest() {
  const book=boundTestBook_(),props=PropertiesService.getScriptProperties();
  const chat=bseRuntimeLegacyChatId_();
  const user=bseRuntimeLegacyUserId_();
  const groups=bseTelegramTestApprovalGroupIds_();
  if((!/^\d+$/.test(chat)||!/^\d+$/.test(user)||chat!==user)&&!groups.length)throw new Error('Tetapkan private '+bseRuntimeEnvironmentLabel_()+' legacy atau approval group allow-list environment.');
  const rejectReplies=[];let receiverError=null;
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw new Error('Penerimaan lain sedang berjalan.');
  try {
    const me=bseTelegramApi_('getMe',{});
    if(!me||me.username!==bseRuntimeBotUsername_())throw new Error('Identiti bot '+bseRuntimeEnvironmentLabel_()+' tidak sepadan.');
    if(bseTelegramApi_('getWebhookInfo',{}).url)throw new Error('Webhook aktif; tiada perubahan dibuat.');
    const queue=bseTelegramQueue_(book);
    const offsetText=props.getProperty('BSE_TELEGRAM_OFFSET')||'0';
    if(!/^\d+$/.test(offsetText))throw new Error('Offset Telegram tidak sah.');
    const updates=bseTelegramApi_('getUpdates',{offset:Number(offsetText),limit:20,timeout:0,allowed_updates:['message','callback_query']});
    if(!Array.isArray(updates))throw new Error('Respons updates tidak sah.');
    const saved=queue.getLastRow()>1?queue.getRange(2,1,queue.getLastRow()-1,BSE_TG_QUEUE_HEADERS.length).getValues():[];
    const seen=new Set(saved.map(r=>String(r[0])));
    let added=0;
    for(const update of updates) {
      if(!Number.isSafeInteger(update.update_id))throw new Error('Update ID tidak sah.');
      if(update.callback_query){if(typeof bseTelegramEvidenceIsCallback_==='function'&&bseTelegramEvidenceIsCallback_(update))bseTelegramEvidencePersistCallback_(book,update);else if(typeof bseTelegramRegistrationIsCallback_==='function'&&bseTelegramRegistrationIsCallback_(update))bseTelegramRegistrationPersistCallback_(book,update);else bseTelegramApprovalPersistCallback_(book,update);props.setProperty('BSE_TELEGRAM_OFFSET',String(update.update_id+1));continue;}
      const m=update.message;
      const privateStart=m&&m.chat&&m.from&&m.chat.type==='private'&&String(m.chat.id)===String(m.from.id)&&bseTelegramPrivateOptInCommand_(m.text,me.username);
      const allowedPrivate=m&&m.chat&&m.from&&m.chat.type==='private'&&String(m.chat.id)===chat&&String(m.from.id)===user;
      const allowedGroup=m&&m.chat&&m.from&&['group','supergroup'].includes(m.chat.type)&&groups.includes(String(m.chat.id));
      const sourceChat=m&&m.chat?String(m.chat.id):'',reporter=m&&m.from?String(m.from.id):'',replyId=m&&m.reply_to_message?String(m.reply_to_message.message_id):'';
      const sourceMessageDate=m&&Number.isSafeInteger(Number(m.date))?new Date(Number(m.date)*1000).toISOString():'';
      const rejectPromptReply=replyId&&bseTelegramApprovalRejectPromptMatch_(book,sourceChat,reporter,replyId);
      const inventoryClarificationReply=replyId&&typeof bseInventoryFindClarificationPrompt_==='function'&&bseInventoryFindClarificationPrompt_(book,sourceChat,reporter,replyId);
      const inventoryClarificationPrompt=inventoryClarificationReply||(!replyId&&typeof bseInventoryFindActiveClarificationPrompt_==='function'&&bseInventoryFindActiveClarificationPrompt_(book,sourceChat,reporter));
      const correctionSession=!replyId&&typeof bseTelegramCorrectionSessionMatch_==='function'?bseTelegramCorrectionSessionMatch_(book,sourceChat,reporter,saved):{match:null,ambiguous:false};
      let evidence=null;
      if(privateStart){const registration=typeof bseTelegramRegistrationHandleStart_==='function'?bseTelegramRegistrationHandleStart_(book,m,me.username):bseTelegramPrivateOptInRegister_(book,m,me.username);if(registration&&registration.text)bseTelegramPrivateCommandReply_(m,registration.text);}
      else if(m&&m.chat&&m.from&&m.chat.type==='private'&&bseTelegramDeleteCommand_(m.text)){
        const deletion=bseTelegramDeleteReceiveCommand_(book,m);
        if(deletion.text)bseTelegramPrivateCommandReply_(m,deletion.text);
      }
      else if(typeof bseTelegramReportRetrieve_==='function'&&typeof bseTelegramReportCommand_==='function'&&bseTelegramReportCommand_(m&&m.text)&&(m&&m.chat&&(m.chat.type==='private'||allowedGroup))){
        const report=bseTelegramReportRetrieve_(book,m);
        if(report.handled&&report.text){if(m.chat.type==='private')bseTelegramPrivateCommandReply_(m,report.text);else bseTelegramApi_('sendMessage',{chat_id:sourceChat,text:report.text,reply_parameters:{message_id:Number(m.message_id),allow_sending_without_reply:true}});}
      }
      else if(typeof bseTelegramHistoryRetrieve_==='function'&&typeof bseTelegramHistoryCommand_==='function'&&bseTelegramHistoryCommand_(m&&m.text)&&(m&&m.chat&&(m.chat.type==='private'||allowedGroup))){
        const history=bseTelegramHistoryRetrieve_(book,m);
        if(history.handled&&history.text){if(m.chat.type==='private')bseTelegramPrivateCommandReply_(m,history.text);else bseTelegramApi_('sendMessage',{chat_id:sourceChat,text:history.text,reply_parameters:{message_id:Number(m.message_id),allow_sending_without_reply:true}});}
      }
      else if(typeof bseTelegramEvidenceRetrieve_==='function'&&typeof bseTelegramEvidenceRetrieveCommand_==='function'&&bseTelegramEvidenceRetrieveCommand_(m&&m.text)){
        const retrieval=bseTelegramEvidenceRetrieve_(book,m);
        if(retrieval.handled&&retrieval.text)bseTelegramPrivateCommandReply_(m,retrieval.text);
      }
      else if(typeof bseTelegramRecordRetrieve_==='function'&&typeof bseTelegramRecordRetrieveCommand_==='function'&&bseTelegramRecordRetrieveCommand_(m&&m.text)){
        const retrieval=bseTelegramRecordRetrieve_(book,m);
        if(retrieval.handled&&retrieval.text){if(m&&m.chat&&m.chat.type==='private')bseTelegramPrivateCommandReply_(m,retrieval.text);else if(m&&m.chat&&m.message_id)bseTelegramApi_('sendMessage',{chat_id:sourceChat,text:retrieval.text,reply_parameters:{message_id:Number(m.message_id),allow_sending_without_reply:true}});}
      }
      else if(typeof bseTelegramPlotStatusRetrieve_==='function'&&typeof bseTelegramPlotRetrievalCommand_==='function'&&bseTelegramPlotRetrievalCommand_(m&&m.text)&&(m&&m.chat&&(m.chat.type==='private'||allowedGroup))){
        const statusRetrieval=bseTelegramPlotStatusRetrieve_(book,m);
        if(statusRetrieval.handled&&statusRetrieval.text){if(m.chat.type==='private')bseTelegramPrivateCommandReply_(m,statusRetrieval.text);else bseTelegramApi_('sendMessage',{chat_id:sourceChat,text:statusRetrieval.text,reply_parameters:{message_id:Number(m.message_id),allow_sending_without_reply:true}});}
      }
      else if(rejectPromptReply){rejectReplies.push({chat_id:sourceChat,message_id:String(m.message_id),reply_to_message_id:replyId,user_id:reporter,text:typeof m.text==='string'?m.text:''});}
      else if(typeof bseTelegramEvidenceCorrectionReceive_==='function'&&bseTelegramEvidenceCorrectionReceive_(book,m).handled){}
      else if((evidence=typeof bseTelegramEvidenceReceiveMessage_==='function'?bseTelegramEvidenceReceiveMessage_(book,m):null)&&evidence.handled){if(evidence.text)bseTelegramPrivateCommandReply_(m,evidence.text);}
      else if(m&&m.chat&&m.from&&m.chat.type==='private'&&!allowedPrivate&&typeof bseTelegramRegistrationPrivateAccess_==='function'){const access=bseTelegramRegistrationPrivateAccess_(book,m);if(access&&access.text)bseTelegramPrivateCommandReply_(m,access.text);}
      else if(inventoryClarificationPrompt&&m&&m.chat&&m.from&&!m.from.is_bot&&(allowedPrivate||allowedGroup)&&!seen.has(String(update.update_id))) {
        const text=typeof m.text==='string'?m.text:'',meta=JSON.stringify({source_chat_id:sourceChat,source_chat_type:String(m.chat.type||''),reporter_telegram_user_id:reporter,reporter_username:String(m.from.username||''),reporter_name:[m.from.first_name,m.from.last_name].filter(Boolean).join(' ')});
        const questionMessageId=replyId||String(inventoryClarificationPrompt.row[7]);
        const values=[String(update.update_id),sourceChat,reporter,String(m.message_id),text,new Date().toISOString(),'D1_CLARIFICATION_PENDING','SENT','', '',0,'','',replyId,String(inventoryClarificationPrompt.reference).replace(/^BSE-TG-/,''),questionMessageId,meta,sourceMessageDate];
        const row=queue.getLastRow()+1;if(row>queue.getMaxRows())queue.insertRowsAfter(queue.getMaxRows(),row-queue.getMaxRows());
        queue.getRange(row,1,1,values.length).setNumberFormat('@').setValues([values.map(bseTelegramCell_)]);SpreadsheetApp.flush();seen.add(String(update.update_id));saved.push(values);added++;
      }
      else if(correctionSession.match&&m&&m.chat&&m.from&&!m.from.is_bot&&(allowedPrivate||allowedGroup)&&!seen.has(String(update.update_id))) {
        const text=typeof m.text==='string'?m.text:'',supported=Boolean(text.trim())&&!text.startsWith('/')&&text.length<=12000;
        const meta=JSON.stringify({source_chat_id:sourceChat,source_chat_type:String(m.chat.type||''),reporter_telegram_user_id:reporter,reporter_username:String(m.from.username||''),reporter_name:[m.from.first_name,m.from.last_name].filter(Boolean).join(' '),correction_reference:String(correctionSession.match.row[0])});
        const values=[String(update.update_id),sourceChat,reporter,String(m.message_id),text,new Date().toISOString(),supported?'QUEUED':'UNSUPPORTED','SENT','','',0,'','',replyId,String(correctionSession.match.row[0]).replace(/^BSE-TG-/,''),String(correctionSession.match.row[23]),meta,sourceMessageDate];
        const row=queue.getLastRow()+1;if(row>queue.getMaxRows())queue.insertRowsAfter(queue.getMaxRows(),row-queue.getMaxRows());
        queue.getRange(row,1,1,values.length).setNumberFormat('@').setValues([values.map(bseTelegramCell_)]);SpreadsheetApp.flush();seen.add(String(update.update_id));saved.push(values);added++;
        bseTelegramCloseCorrectionSession_(book,correctionSession.match,String(update.update_id));
      }
      else if(m&&m.chat&&m.from&&!m.from.is_bot&&(allowedPrivate||allowedGroup)&&!(allowedGroup&&m.text==='P1-C TEST setup')&&!seen.has(String(update.update_id))) {
        const text=typeof m.text==='string'?m.text:'';
        const command=text.startsWith('/');
        const supported=Boolean(text.trim())&&!command&&text.length<=12000;
        const outOfScope=bseTelegramTestSiteAOutOfScope_(text);
        const assetUnsupported=!outOfScope&&bseTelegramTestAssetObservationUnsupported_(text);
        const parent=replyId?saved.find(r=>String(r[15])===replyId&&String(r[1])===sourceChat&&String(r[2])===reporter&&r[6]==='WAITING_INFO'):null;
        const used=parent&&saved.some(r=>String(r[14])===String(parent[0]));
        const linked=parent&&!used&&supported;
        const status=outOfScope?'OUT_OF_SCOPE_TEST':assetUnsupported?'ASSET_OBSERVATION_UNSUPPORTED_TEST':command?'COMMAND':(replyId&&!linked||correctionSession.ambiguous)?'UNLINKED_REPLY':supported?'QUEUED':'UNSUPPORTED';
        const meta=JSON.stringify({source_chat_id:sourceChat,source_chat_type:String(m.chat.type||''),reporter_telegram_user_id:reporter,reporter_username:String(m.from.username||''),reporter_name:[m.from.first_name,m.from.last_name].filter(Boolean).join(' ')});
        const values=[String(update.update_id),sourceChat,reporter,String(m.message_id),text,new Date().toISOString(),status,'PENDING','','',0,'','',replyId,linked?String(parent[0]):'','',meta,sourceMessageDate];
        const row=queue.getLastRow()+1;
        if(row>queue.getMaxRows())queue.insertRowsAfter(queue.getMaxRows(),row-queue.getMaxRows());
        queue.getRange(row,1,1,values.length).setNumberFormat('@').setValues([values.map(bseTelegramCell_)]);
        SpreadsheetApp.flush(); // Only advance the offset after durable storage.
        seen.add(String(update.update_id));saved.push(values);added++;
        if(allowedGroup&&supported)bseTelegramPrivateOptInNudge_(book,sourceChat,m.from,String(m.message_id),'GROUP_REPORT');
        if(replyId)rejectReplies.push({chat_id:sourceChat,message_id:String(m.message_id),reply_to_message_id:replyId,user_id:reporter,text:text});
      }
      // Unauthorized/non-message updates receive no reply and are not stored.
      props.setProperty('BSE_TELEGRAM_OFFSET',String(update.update_id+1));
    }
    // Acknowledgements are retried independently of receiving new updates.
    const rows=queue.getLastRow()>1?queue.getRange(2,1,queue.getLastRow()-1,BSE_TG_QUEUE_HEADERS.length).getValues():[];
    let sent=0;
    for(let i=0;i<rows.length&&sent<10;i++) {
      const r=rows[i];if(r[7]!=='PENDING'||!(String(r[1])===chat&&String(r[2])===user||groups.includes(String(r[1]))))continue;
      const text=r[6]==='OUT_OF_SCOPE_TEST'?'Laporan ini luar skop BSE Site B dan tidak diproses.':r[6]==='ASSET_OBSERVATION_UNSUPPORTED_TEST'?'Pemerhatian aset belum disokong dalam TEST.':r[6]==='UNLINKED_REPLY'?'Jawapan belum dipadankan dengan satu sesi yang sah. Pastikan ia dihantar oleh pelapor asal dalam chat asal.':r[6]==='COMMAND'?'Bot BSE TEST sedia menerima laporan teks. Tiada rekod production akan ditulis.':r[6]==='UNSUPPORTED'?'Mod TEST ini menerima laporan teks sahaja. Sila hantar semula sebagai teks.':'Laporan diterima dan sudah disimpan untuk diproses. Rujukan: BSE-TG-'+r[0]+'. (Mod TEST)';
      try {
        const payload={chat_id:String(r[1]),text:text};
        if(['OUT_OF_SCOPE_TEST','ASSET_OBSERVATION_UNSUPPORTED_TEST','UNLINKED_REPLY'].includes(r[6])&&/^\d+$/.test(String(r[3]||'')))payload.reply_parameters={message_id:Number(r[3]),allow_sending_without_reply:true};
        const reply=bseTelegramApi_('sendMessage',payload);
        queue.getRange(i+2,8,1,2).setValues([['SENT',String(reply.message_id)]]);sent++;
      } catch(_) {console.log('ACK_PENDING: mesej tersimpan; balasan akan dicuba pada run berikutnya.');break;}
    }
    console.log('TELEGRAM_RECEIVE_DONE: '+JSON.stringify({stored:added,replies_sent:sent,queue:'TELEGRAM_TEST_QUEUE',production_write:false}));
  } catch(error) {receiverError=error;console.log('TELEGRAM_RECEIVE_ERROR: '+String(error.message||''));} finally {lock.releaseLock();}
  try{processBseTelegramApprovalCallbacks();}catch(error){console.log('APPROVAL_CALLBACK_PENDING: '+String(error.message||''));}
  try{if(typeof processBseTelegramRegistrationCallbacks==='function')processBseTelegramRegistrationCallbacks();}catch(error){console.log('REGISTRATION_CALLBACK_PENDING: '+String(error.message||''));}
  try{const evidenceCallbacks=processBseTelegramEvidenceCallbacks();console.log('EVIDENCE_CALLBACK_DONE: '+JSON.stringify(evidenceCallbacks));}catch(error){console.log('EVIDENCE_CALLBACK_PENDING: '+String(error.message||''));}
  try{if(typeof processBseTelegramInventoryClarificationReplies==='function')processBseTelegramInventoryClarificationReplies();}catch(error){console.log('INVENTORY_CLARIFICATION_PENDING: '+String(error.message||''));}
  rejectReplies.forEach(reply=>{try{bseTelegramApprovalRejectReason_(reply);}catch(error){console.log('APPROVAL_REJECT_REASON_PENDING: '+String(error.message||''));}});
  if(receiverError)throw receiverError;
}

function bseTelegramPrivateCommandReply_(message,text){
  if(!message||!message.chat||!message.from||message.chat.type!=='private'||String(message.chat.id)!==String(message.from.id)||!/^\d+$/.test(String(message.chat.id))||!Number.isSafeInteger(Number(message.message_id))||Number(message.message_id)<=0)throw new Error('Balasan PM masuk tidak sah.');
  return bseTelegramApi_('sendMessage',{chat_id:String(message.chat.id),text:String(text||''),reply_parameters:{message_id:Number(message.message_id),allow_sending_without_reply:false},__bse_inbound_private_reply:true});
}
function bseTelegramQueue_(book) {
  let sheet=book.getSheetByName('TELEGRAM_TEST_QUEUE');
  if(!sheet)sheet=book.insertSheet('TELEGRAM_TEST_QUEUE');
  if(!sheet.getLastRow()){
    if(sheet.getMaxColumns()<BSE_TG_QUEUE_HEADERS.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),BSE_TG_QUEUE_HEADERS.length-sheet.getMaxColumns());
    sheet.getRange(1,1,1,BSE_TG_QUEUE_HEADERS.length).setValues([BSE_TG_QUEUE_HEADERS]).setFontWeight('bold');sheet.setFrozenRows(1);sheet.setColumnWidth(5,400);
  }
  const current=sheet.getRange(1,1,1,BSE_TG_QUEUE_HEADERS.length).getValues()[0];
  const existing=sheet.getRange(1,1,1,Math.min(sheet.getLastColumn(),BSE_TG_QUEUE_HEADERS.length)).getValues()[0];
  if(existing.join('|')===BSE_TG_QUEUE_HEADERS.slice(0,existing.length).join('|')&&existing.length<BSE_TG_QUEUE_HEADERS.length){if(sheet.getMaxColumns()<BSE_TG_QUEUE_HEADERS.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),BSE_TG_QUEUE_HEADERS.length-sheet.getMaxColumns());sheet.getRange(1,existing.length+1,1,BSE_TG_QUEUE_HEADERS.length-existing.length).setValues([BSE_TG_QUEUE_HEADERS.slice(existing.length)]);}
  if(sheet.getRange(1,1,1,BSE_TG_QUEUE_HEADERS.length).getValues()[0].join('|')!==BSE_TG_QUEUE_HEADERS.join('|'))throw new Error('Header TELEGRAM_TEST_QUEUE tidak sepadan.');
  return sheet;
}
function bseTelegramCell_(v){return typeof v==='string'&&/^\s*[=+@-]/.test(v)?"'"+v:v;}
function bseTelegramFindActiveWaitingInfo_(rows,chatId,userId){
  const active=(rows||[]).filter(row=>String(row[1])===String(chatId)&&String(row[2])===String(userId)&&String(row[6])==='WAITING_INFO'&&/^\d+$/.test(String(row[15]||''))&&!rows.some(reply=>String(reply[14])===String(row[0])));
  return active.length===1?active[0]:null;
}
function bseTelegramTestSiteAOutOfScope_(text){return /\bsite\s+a\b/i.test(String(text||''));}
function bseTelegramTestAssetObservationUnsupported_(text){return /\bkolam\s+\d+\b/i.test(String(text||''));}

// Manual-only cleanup for pre-P1-B2 discovery markers. It never invokes a parser or writer.
function cleanupBseTelegramSetupMarkers(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw new Error('Barisan sedang dikemas kini.');
  try{
    const sheet=bseTelegramQueue_(boundTestBook_()),rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,BSE_TG_QUEUE_HEADERS.length).getValues():[],eligible=new Set(['QUEUED','RETRY_NEEDED','PROCESSING','RESULT_REPLY_PENDING']);let changed=0;
    rows.forEach((row,index)=>{if(String(row[4])!=='P1-C TEST setup'||!eligible.has(String(row[6]))||String(row[9]||'').trim())return;sheet.getRange(index+2,7).setValue('IGNORED_SETUP_MARKER');sheet.getRange(index+2,12,1,2).setValues([[new Date().toISOString(),'IGNORED_SETUP_MARKER_MANUAL']]);changed++;});
    SpreadsheetApp.flush();console.log('SETUP_MARKER_CLEANUP: '+JSON.stringify({changed:changed,production_write:false}));return {changed:changed,production_write:false};
  }finally{lock.releaseLock();}
}

function runBseTelegramSetupMarkerHarnessTests(){
  const source=receiveBseTelegramTest.toString(),cleanup=cleanupBseTelegramSetupMarkers.toString();
  const tests=[
    {id:'group marker bypasses queue and acknowledgement',pass:/allowedGroup&&m\.text==='P1-C TEST setup'/.test(source)},
    {id:'offset advances after marker branch',pass:source.indexOf("m.text==='P1-C TEST setup'")<source.lastIndexOf("props.setProperty('BSE_TELEGRAM_OFFSET'")},
    {id:'non-marker reports retain queue path',pass:/const values=\[String\(update\.update_id\)/.test(source)},
    {id:'cleanup is narrow and parser-free',pass:/String\(row\[4\]\)!=='P1-C TEST setup'/.test(cleanup)&&/IGNORED_SETUP_MARKER/.test(cleanup)&&!/bseUnifiedProcess_|processBseTelegramTestQueue|bseTelegramApproval/.test(cleanup)},
    {id:'cleanup has one lock and no Tasks',pass:(cleanup.match(/LockService\.getScriptLock/g)||[]).length===1&&!/Tasks\./.test(cleanup)},
    {id:'non-owner private command reply is bound to its incoming message',pass:/bseTelegramPrivateCommandReply_\(m,deletion\.text\)/.test(source)&&/reply_parameters/.test(bseTelegramPrivateCommandReply_.toString())&&/__bse_inbound_private_reply:true/.test(bseTelegramPrivateCommandReply_.toString())},
    {id:'text without evidence attachment continues to the report queue',pass:/let evidence=null;/.test(source)&&/evidence=typeof bseTelegramEvidenceReceiveMessage_/.test(source)&&/&&evidence\.handled/.test(source)}
  ];
  console.log('SETUP_MARKER_HARNESS: '+JSON.stringify(tests));const failures=tests.filter(test=>!test.pass);if(failures.length)throw new Error('Setup marker harness gagal: '+failures.map(test=>test.id).join(', '));return tests;
}

function runBseTelegramCallbackProcessorHarnessTests(){
  const receiver=receiveBseTelegramTest.toString(),tick=bseTelegramTick.toString(),processor=processBseTelegramApprovalCallbacks.toString(),tests=[
    {id:'receiver error still releases lock then processes pending callback',pass:receiver.indexOf('} catch(error) {receiverError=error')<receiver.indexOf('lock.releaseLock')&&receiver.indexOf('lock.releaseLock')<receiver.indexOf('try{processBseTelegramApprovalCallbacks()')},
    {id:'receiver processing is independent of new callback array',pass:!/callbacks\.forEach/.test(receiver)&&/try\{processBseTelegramApprovalCallbacks\(\)/.test(receiver)},
    {id:'tick processes durable callback before worker',pass:tick.indexOf('processBseTelegramApprovalCallbacks()')<tick.indexOf('processBseTelegramTestQueue()')},
    {id:'controller failure records durable retry state',pass:/catch\(error\).*bseTelegramCallbackFailureState_/.test(processor)&&/attempt=Number\(row\[6\]\|\|0\)\+1/.test(processor)},
    {id:'one pending callback per processor call with no Tasks or domain write',pass:/SpreadsheetApp\.flush\(\);return;/.test(processor)&&!/Tasks\.|bseTreatmentReviewCore_|bseMeasurementReviewCore_/.test(processor)}
  ];
  console.log('CALLBACK_PROCESSOR_HARNESS: '+JSON.stringify(tests));const failures=tests.filter(test=>!test.pass);if(failures.length)throw new Error('Callback processor harness gagal: '+failures.map(test=>test.id).join(', '));return tests;
}

function runBseTelegramInventoryClarificationReplyHarnessTests(){
  const receiver=receiveBseTelegramTest.toString(),processor=processBseTelegramInventoryClarificationReplies.toString(),tests=[
    {id:'D1 reply or one active owned session is durable pending',pass:/inventoryClarificationReply/.test(receiver)&&/bseInventoryFindActiveClarificationPrompt_/.test(receiver)&&/inventoryClarificationPrompt/.test(receiver)&&/D1_CLARIFICATION_PENDING/.test(receiver)&&/questionMessageId/.test(receiver)},
    {id:'consumable answer selects inventory',pass:typeof bseInventoryClarificationAction_==='function'&&bseInventoryClarificationAction_('habis guna')==='I'&&bseInventoryClarificationAction_('bahan operasi')==='I'},
    {id:'long-term answer selects asset proposal',pass:bseInventoryClarificationAction_('digunakan berulang untuk jangka panjang')==='A'},
    {id:'ambiguous answer stays clarification',pass:bseInventoryClarificationAction_('mungkin')==='C'&&/D1_CLARIFICATION_WAITING/.test(processor)},
    {id:'processor binds chat reporter and question',pass:/bseInventoryFindClarificationPrompt_\(book,row\[1\],row\[2\],row\[13\]\)/.test(processor)},
    {id:'retry status is selected for reprocessing',pass:/\['D1_CLARIFICATION_PENDING','D1_CLARIFICATION_RETRY'\]\.includes\(status\)/.test(processor)&&/bseInventoryFindClarificationRetry_/.test(processor)},
    {id:'card failure keeps reply retryable',pass:/APPROVAL_CARD_RETRY/.test(processor)&&/D1_CLARIFICATION_RETRY/.test(processor)&&/D1_CLARIFICATION_PROCESSED/.test(processor)},
    {id:'missing parent is not marked processed',pass:/if\(!parent\).*D1_CLARIFICATION_RETRY/.test(processor)},
    {id:'retry selection is idempotent without a second writer',pass:/outcome\.duplicate&&outcome\.status==='SELECTED'/.test(processor)&&!/bseInventoryReviewCore_/.test(processor)},
    {id:'no parser or writer before owner approval',pass:!/bseUnifiedProcess_|bseInventoryReviewCore_|production_write\s*:\s*true/.test(processor)&&/bseTelegramApprovalEnsureCard_/.test(processor)}
  ];
  const failures=tests.filter(test=>!test.pass);if(failures.length)throw new Error('Inventory clarification reply harness gagal: '+failures.map(test=>test.id).join(', '));return tests;
}
