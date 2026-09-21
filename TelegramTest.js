/** @OnlyCurrentDoc */
// Read-only Telegram connection check. No messages sent, no updates consumed.
function testBseTelegramConnection() {
  boundTestBook_();
  const me=bseTelegramApi_('getMe',{});
  if(!me||me.is_bot!==true||me.username!=='bse_kerani_test_bot')throw new Error('Token tidak sepadan dengan bot TEST bse_kerani_test_bot.');
  const webhook=bseTelegramApi_('getWebhookInfo',{});
  console.log('TELEGRAM_CONNECTION_OK: @'+me.username);
  console.log(webhook.url?'WEBHOOK_ACTIVE: konfigurasi sedia ada perlu diperiksa sebelum polling. Tiada perubahan dibuat.':'WEBHOOK_NONE: boleh sediakan penerimaan TEST melalui polling.');
  return {connected:true,username:me.username,webhook_active:Boolean(webhook.url)};
}
function bseTelegramApi_(method,payload) {
  // Keep the token out of logs and exception messages: Telegram embeds it in the URL.
  const token=(PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN')||'').trim();
  if(!token)throw new Error('TELEGRAM_BOT_TOKEN belum disimpan.');
  if(!['getMe','getWebhookInfo','getUpdates','sendMessage'].includes(method))throw new Error('Kaedah Telegram tidak dibenarkan.');
  if(method==='sendMessage') {
    const allowed=(PropertiesService.getScriptProperties().getProperty('TELEGRAM_TEST_CHAT_ID')||'').trim();
    if(!allowed||String(payload.chat_id)!==allowed)throw new Error('Penghantaran hanya untuk chat TEST yang ditetapkan.');
  }
  let response;
  try {
    response=UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'post',contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true,followRedirects:false});
  } catch(_){throw new Error('Sambungan Telegram gagal; token tidak dipaparkan.');}
  const status=response.getResponseCode();
  if(status!==200)throw new Error('Telegram HTTP '+status+'. Semak token atau cuba kemudian.');
  let data;
  try{data=JSON.parse(response.getContentText());}catch(_){throw new Error('Respons Telegram bukan JSON sah.');}
  if(data.ok!==true)throw new Error('Telegram menolak permintaan; token tidak dipaparkan.');
  return data.result;
}

// Shows candidate IDs only. Does not authorize a chat, advance offset, or send replies.
function findBseTelegramTestChat() {
  const connection=testBseTelegramConnection();
  if(connection.webhook_active)throw new Error('Webhook aktif; hentikan penemuan polling.');
  const updates=bseTelegramApi_('getUpdates',{timeout:0,limit:100,allowed_updates:['message']});
  if(!Array.isArray(updates))throw new Error('Senarai updates tidak sah.');
  const matches={};
  updates.forEach(u=>{
    const m=u.message;
    if(!m||!m.chat||m.chat.type!=='private'||!m.from||m.from.is_bot||typeof m.text!=='string')return;
    if(!/^\/start(?:@bse_kerani_test_bot)?\s+BSE_TEST\s*$/.test(m.text))return;
    if(!Number.isSafeInteger(m.chat.id)||!Number.isSafeInteger(m.from.id)||m.chat.id!==m.from.id)return;
    matches[String(m.chat.id)]={chat_id:String(m.chat.id),user_id:String(m.from.id),username:m.from.username||'',update_id:u.update_id};
  });
  const candidates=Object.values(matches);
  if(!candidates.length)console.log('CHAT_NOT_FOUND: hantar /start BSE_TEST dalam chat peribadi bot, kemudian cuba lagi.');
  candidates.forEach(c=>console.log('TEST_CHAT_CANDIDATE: '+JSON.stringify(c)));
  return candidates;
}
