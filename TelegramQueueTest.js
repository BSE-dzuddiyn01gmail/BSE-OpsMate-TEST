/** @OnlyCurrentDoc */
// Manual TEST receiver. Requires Code.gs and TelegramTest.gs. No production writes.
const BSE_TG_QUEUE_HEADERS=['update_id','chat_id','user_id','message_id','original_note','received_at','status','ack_status','ack_message_id','candidate_json','processing_attempts','next_attempt_at','last_error','reply_to_message_id','parent_update_id','question_message_id'];
function receiveBseTelegramTest() {
  const book=boundTestBook_(),props=PropertiesService.getScriptProperties();
  const chat=(props.getProperty('TELEGRAM_TEST_CHAT_ID')||'').trim();
  const user=(props.getProperty('TELEGRAM_TEST_USER_ID')||'').trim();
  if(!/^\d+$/.test(chat)||!/^\d+$/.test(user)||chat!==user)throw new Error('Tetapkan chat ID dan user ID peribadi TEST yang sepadan.');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw new Error('Penerimaan lain sedang berjalan.');
  try {
    const me=bseTelegramApi_('getMe',{});
    if(!me||me.username!=='bse_kerani_test_bot')throw new Error('Identiti bot tidak sepadan.');
    if(bseTelegramApi_('getWebhookInfo',{}).url)throw new Error('Webhook aktif; tiada perubahan dibuat.');
    const queue=bseTelegramQueue_(book);
    const offsetText=props.getProperty('BSE_TELEGRAM_OFFSET')||'0';
    if(!/^\d+$/.test(offsetText))throw new Error('Offset Telegram tidak sah.');
    const updates=bseTelegramApi_('getUpdates',{offset:Number(offsetText),limit:20,timeout:0,allowed_updates:['message']});
    if(!Array.isArray(updates))throw new Error('Respons updates tidak sah.');
    const saved=queue.getLastRow()>1?queue.getRange(2,1,queue.getLastRow()-1,BSE_TG_QUEUE_HEADERS.length).getValues():[];
    const seen=new Set(saved.map(r=>String(r[0])));
    let added=0;
    for(const update of updates) {
      if(!Number.isSafeInteger(update.update_id))throw new Error('Update ID tidak sah.');
      const m=update.message;
      if(m&&m.chat&&m.from&&m.chat.type==='private'&&!m.from.is_bot&&String(m.chat.id)===chat&&String(m.from.id)===user&&!seen.has(String(update.update_id))) {
        const text=typeof m.text==='string'?m.text:'';
        const command=text.startsWith('/');
        const supported=Boolean(text.trim())&&!command&&text.length<=12000;
        const replyId=m.reply_to_message?String(m.reply_to_message.message_id):'';
        const parent=replyId?saved.find(r=>String(r[15])===replyId&&String(r[1])===chat&&String(r[2])===user&&r[6]==='WAITING_INFO'):null;
        const used=parent&&saved.some(r=>String(r[14])===String(parent[0]));
        const linked=parent&&!used&&supported;
        const status=command?'COMMAND':replyId&&!linked?'UNLINKED_REPLY':supported?'QUEUED':'UNSUPPORTED';
        const values=[String(update.update_id),chat,user,String(m.message_id),text,new Date().toISOString(),status,'PENDING','','',0,'','',replyId,linked?String(parent[0]):'',''];
        const row=queue.getLastRow()+1;
        if(row>queue.getMaxRows())queue.insertRowsAfter(queue.getMaxRows(),row-queue.getMaxRows());
        queue.getRange(row,1,1,values.length).setNumberFormat('@').setValues([values.map(bseTelegramCell_)]);
        SpreadsheetApp.flush(); // Only advance the offset after durable storage.
        seen.add(String(update.update_id));saved.push(values);added++;
      }
      // Unauthorized/non-message updates receive no reply and are not stored.
      props.setProperty('BSE_TELEGRAM_OFFSET',String(update.update_id+1));
    }
    // Acknowledgements are retried independently of receiving new updates.
    const rows=queue.getLastRow()>1?queue.getRange(2,1,queue.getLastRow()-1,BSE_TG_QUEUE_HEADERS.length).getValues():[];
    let sent=0;
    for(let i=0;i<rows.length&&sent<10;i++) {
      const r=rows[i];if(r[7]!=='PENDING'||String(r[1])!==chat||String(r[2])!==user)continue;
      const text=r[6]==='UNLINKED_REPLY'?'Jawapan belum dipadankan. Sila gunakan Reply pada soalan terbaru bot yang belum dijawab.':r[6]==='COMMAND'?'Bot BSE TEST sedia menerima laporan teks. Tiada rekod production akan ditulis.':r[6]==='UNSUPPORTED'?'Mod TEST ini menerima laporan teks sahaja. Sila hantar semula sebagai teks.':'Laporan diterima dan sudah disimpan untuk diproses. Rujukan: BSE-TG-'+r[0]+'. (Mod TEST)';
      try {
        const reply=bseTelegramApi_('sendMessage',{chat_id:chat,text:text});
        queue.getRange(i+2,8,1,2).setValues([['SENT',String(reply.message_id)]]);sent++;
      } catch(_) {console.log('ACK_PENDING: mesej tersimpan; balasan akan dicuba pada run berikutnya.');break;}
    }
    console.log('TELEGRAM_RECEIVE_DONE: '+JSON.stringify({stored:added,replies_sent:sent,queue:'TELEGRAM_TEST_QUEUE',production_write:false}));
  } finally {lock.releaseLock();}
}
function bseTelegramQueue_(book) {
  let sheet=book.getSheetByName('TELEGRAM_TEST_QUEUE');
  if(!sheet)sheet=book.insertSheet('TELEGRAM_TEST_QUEUE');
  if(!sheet.getLastRow()){
    if(sheet.getMaxColumns()<BSE_TG_QUEUE_HEADERS.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),BSE_TG_QUEUE_HEADERS.length-sheet.getMaxColumns());
    sheet.getRange(1,1,1,BSE_TG_QUEUE_HEADERS.length).setValues([BSE_TG_QUEUE_HEADERS]).setFontWeight('bold');sheet.setFrozenRows(1);sheet.setColumnWidth(5,400);
  }
  const current=sheet.getRange(1,1,1,BSE_TG_QUEUE_HEADERS.length).getValues()[0];
  if(current.slice(0,13).join('|')===BSE_TG_QUEUE_HEADERS.slice(0,13).join('|')&&current.slice(13).every(v=>!v)) {
    if(sheet.getMaxColumns()<16)sheet.insertColumnsAfter(sheet.getMaxColumns(),16-sheet.getMaxColumns());
    sheet.getRange(1,14,1,3).setValues([BSE_TG_QUEUE_HEADERS.slice(13)]);
  }
  if(sheet.getRange(1,1,1,BSE_TG_QUEUE_HEADERS.length).getValues()[0].join('|')!==BSE_TG_QUEUE_HEADERS.join('|'))throw new Error('Header TELEGRAM_TEST_QUEUE tidak sepadan.');
  return sheet;
}
function bseTelegramCell_(v){return typeof v==='string'&&/^\s*[=+@-]/.test(v)?"'"+v:v;}
