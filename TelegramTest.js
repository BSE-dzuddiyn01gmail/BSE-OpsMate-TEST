/** @OnlyCurrentDoc */
// Read-only Telegram connection check. No messages sent, no updates consumed.
function testBseTelegramConnection() {
  boundTestBook_();
  const me=bseTelegramApi_('getMe',{}),expected=bseRuntimeBotUsername_();
  if(!me||me.is_bot!==true||me.username!==expected)throw new Error('Token tidak sepadan dengan bot '+bseRuntimeEnvironmentLabel_()+' @'+expected+'.');
  const webhook=bseTelegramApi_('getWebhookInfo',{});
  console.log('TELEGRAM_CONNECTION_OK: @'+me.username);
  console.log(webhook.url?'WEBHOOK_ACTIVE: konfigurasi sedia ada perlu diperiksa sebelum polling. Tiada perubahan dibuat.':'WEBHOOK_NONE: boleh sediakan penerimaan TEST melalui polling.');
  return {connected:true,username:me.username,webhook_active:Boolean(webhook.url)};
}
function bseTelegramApi_(method,payload) {
  // Keep the token out of logs and exception messages: Telegram embeds it in the URL.
  const token=(PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN')||'').trim();
  if(!token)throw new Error('TELEGRAM_BOT_TOKEN belum disimpan.');
  if(!['getMe','getWebhookInfo','getUpdates','getFile','getMyCommands','setMyCommands','sendMessage','sendPhoto','sendDocument','sendVideo','answerCallbackQuery','editMessageText','editMessageReplyMarkup'].includes(method))throw new Error('Kaedah Telegram tidak dibenarkan.');
  let body=Object.assign({},payload||{});const inboundPrivateReply=body.__bse_inbound_private_reply===true;
  delete body.__bse_inbound_private_reply;
  body=bseRuntimeTelegramPayload_(method,body);
  if(['sendMessage','sendPhoto','sendDocument','sendVideo'].includes(method)) {
    if(!bseTelegramTestAllowedSendChat_(body.chat_id)&&!bseTelegramTestSafeInboundPrivateReply_(body,inboundPrivateReply))throw new Error('Penghantaran hanya untuk chat TEST yang dibenarkan.');
  }
  let response;
  try {
    response=UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'post',contentType:'application/json',payload:JSON.stringify(body),muteHttpExceptions:true,followRedirects:false});
  } catch(_){throw new Error('Sambungan Telegram gagal; token tidak dipaparkan.');}
  const status=response.getResponseCode();
  let data;
  try{data=JSON.parse(response.getContentText());}catch(_){throw new Error('Respons Telegram bukan JSON sah.');}
  if(status!==200)throw new Error('Telegram HTTP '+status+': '+bseTelegramSafeErrorDescription_(data&&data.description));
  if(data.ok!==true)throw new Error('Telegram menolak permintaan; token tidak dipaparkan.');
  return data.result;
}

function bseTelegramSafeErrorDescription_(description){return String(description||'Tiada description Telegram.').replace(/bot\d+:[A-Za-z0-9_-]+|\b\d{6,12}:[A-Za-z0-9_-]{20,}\b/gi,'[redacted]').replace(/[\r\n]+/g,' ').slice(0,240);}

function bseTelegramTestApprovalGroupIds_(){
  return bseTelegramTestApprovalGroupConfig_(bseRuntimeApprovalGroupsRaw_()).ids;
}
function bseTelegramTestApprovalGroupConfig_(raw){const values=String(raw||'').split(',').map(value=>value.trim()).filter(Boolean);return {ids:values.filter(value=>/^-?\d+$/.test(value)),valid:!values.length||values.length===values.filter(value=>/^-?\d+$/.test(value)).length};}
function bseTelegramTestAllowedSendChat_(chatId){
  const id=String(chatId||'').trim();
  const legacy=bseRuntimeLegacyChatId_();
  if(id&&id===legacy)return true;
  if(bseTelegramTestApprovalGroupIds_().includes(id))return true;
  try{if(typeof bseTelegramRegistrationKnownPrivateChat_==='function'&&bseTelegramRegistrationKnownPrivateChat_(id))return true;}catch(_){ }
  try{return bseTestOwnerRows_(boundTestBook_()).some(owner=>String(owner[3]||'').trim()===id);}catch(_){return false;}
}
function bseTelegramTestSafeInboundPrivateReply_(payload,enabled){const chatId=String(payload&&payload.chat_id||'').trim(),reply=payload&&payload.reply_parameters;return enabled&&/^\d+$/.test(chatId)&&reply&&Number.isSafeInteger(Number(reply.message_id))&&Number(reply.message_id)>0;}

// Shows candidate IDs only. Does not authorize a chat, advance offset, or send replies.
function findBseTelegramTestChat() {
  const connection=testBseTelegramConnection();
  if(connection.webhook_active)throw new Error('Webhook aktif; hentikan penemuan polling.');
  const updates=bseTelegramApi_('getUpdates',{timeout:0,limit:100,allowed_updates:['message']});
  if(!Array.isArray(updates))throw new Error('Senarai updates tidak sah.');
  const matches={},startToken=bseRuntimeStartToken_(),botUsername=bseRuntimeBotUsername_();
  updates.forEach(u=>{
    const m=u.message;
    if(!m||!m.chat||m.chat.type!=='private'||!m.from||m.from.is_bot||typeof m.text!=='string')return;
    if(!bseRuntimeStartCommandMatches_(m.text,botUsername))return;
    if(!Number.isSafeInteger(m.chat.id)||!Number.isSafeInteger(m.from.id)||m.chat.id!==m.from.id)return;
    matches[String(m.chat.id)]={chat_id:String(m.chat.id),user_id:String(m.from.id),username:m.from.username||'',update_id:u.update_id};
  });
  const candidates=Object.values(matches);
  if(!candidates.length)console.log('CHAT_NOT_FOUND: hantar /start '+startToken+' dalam chat peribadi bot, kemudian cuba lagi.');
  candidates.forEach(c=>console.log(bseRuntimeEnvironmentLabel_()+'_CHAT_CANDIDATE: '+JSON.stringify(c)));
  return candidates;
}
