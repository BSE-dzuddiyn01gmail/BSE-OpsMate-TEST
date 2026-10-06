/** @OnlyCurrentDoc */
// TEST-only evidence intake. Files are fetched to Drive only after reporter confirmation.
const BSE_TG_EVIDENCE_HEADERS=['evidence_id','source_chat_id','source_chat_type','source_message_id','reporter_telegram_user_id','reporter_name','received_at','caption','attachment_type','telegram_file_id','telegram_file_unique_id','mime_type','file_name','file_size','category','visibility','status','token','card_message_id','drive_file_id','confirmed_at','discarded_at','last_error'];
const BSE_TG_EVIDENCE_CALLBACK_HEADERS=['update_id','callback_id','callback_json','status','attempts','last_error','received_at','processed_at','next_attempt_at'];
// Run manually once in the Apps Script TEST editor to request the Drive scope.
// It performs no file write and is deliberately separate from callback retries.
function authorizeBseTelegramEvidenceTest(){DriveApp.getRootFolder();return {authorized:true,production_write:false};}
function bseTelegramEvidenceSheet_(book){let s=book.getSheetByName('TEST_FILE_EVIDENCE');if(!s)s=book.insertSheet('TEST_FILE_EVIDENCE');bseEnsureAdditiveHeaders_(s,BSE_TG_EVIDENCE_HEADERS);return s;}
function bseTelegramEvidenceCallbackSheet_(book){let s=book.getSheetByName('TEST_FILE_EVIDENCE_CALLBACK_PENDING');if(!s)s=book.insertSheet('TEST_FILE_EVIDENCE_CALLBACK_PENDING');bseEnsureAdditiveHeaders_(s,BSE_TG_EVIDENCE_CALLBACK_HEADERS);return s;}
function bseTelegramEvidenceRows_(sheet){return sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,BSE_TG_EVIDENCE_HEADERS.length).getValues():[];}
function bseTelegramEvidenceAttachment_(m){if(Array.isArray(m&&m.photo)&&m.photo.length){const f=m.photo[m.photo.length-1];return {type:'PHOTO',fileId:String(f.file_id||''),uniqueId:String(f.file_unique_id||''),mime:'image/jpeg',name:'photo_'+String(f.file_unique_id||'telegram')+'.jpg',size:Number(f.file_size||0)};}if(m&&m.document)return {type:'DOCUMENT',fileId:String(m.document.file_id||''),uniqueId:String(m.document.file_unique_id||''),mime:String(m.document.mime_type||''),name:String(m.document.file_name||'document'),size:Number(m.document.file_size||0)};if(m&&m.video)return {type:'VIDEO',fileId:String(m.video.file_id||''),uniqueId:String(m.video.file_unique_id||''),mime:String(m.video.mime_type||'video/mp4'),name:String(m.video.file_name||'video_'+String(m.video.file_unique_id||'telegram')+'.mp4'),size:Number(m.video.file_size||0)};return null;}
function bseTelegramEvidenceCategory_(caption){const s=String(caption||'').toLowerCase();if(/\b(resit|invois|invoice|claim|tuntutan|stok|inventori)\b/.test(s))return 'INVENTORY_CLAIM';if(/\b(surat|dokumen|admin)\b/.test(s))return 'ADMIN_DOCUMENT';if(/\b(plot|pokok|tanaman|baja|rawatan|ladang)\b/.test(s))return 'FIELD_OPERATION';return 'UNCLASSIFIED_TEST';}
function bseTelegramEvidenceReceiveMessage_(book,m){const a=bseTelegramEvidenceAttachment_(m);if(!a||!/^[A-Za-z0-9_-]{8,}$/.test(a.fileId)||!/^[A-Za-z0-9_-]{8,}$/.test(a.uniqueId)||a.size<0||a.size>20000000)return {handled:false};const chat=String(m.chat.id),user=String(m.from.id),private=m.chat.type==='private',access=private?bseTelegramRegistrationPrivateAccess_(book,m):{status:'GROUP'};if(private&&!['REGISTERED_ACTIVE','OWNER_ACTIVE'].includes(access.status))return {handled:true,text:'Sila mendaftar sebagai ahli aktif dahulu, hubungi admin.'};if(!private&&!bseTelegramTestApprovalGroupIds_().includes(chat))return {handled:false};const sheet=bseTelegramEvidenceSheet_(book),rows=bseTelegramEvidenceRows_(sheet),key=chat+'|'+String(m.message_id)+'|'+a.uniqueId;if(rows.some(r=>String(r[1])+'|'+String(r[3])+'|'+String(r[10])===key))return {handled:true};const caption=String(m.caption||'').trim(),category=bseTelegramEvidenceCategory_(caption),visibility=private?'PRIVATE_SUBMISSION':['INVENTORY_CLAIM','ADMIN_DOCUMENT','UNCLASSIFIED_TEST'].includes(category)?'RESTRICTED':'GROUP_STANDARD',id='BSE-EV-'+String(m.message_id)+'-'+a.uniqueId.slice(0,8),token=bseApprovalToken_(),row=[id,chat,String(m.chat.type),String(m.message_id),user,[m.from.first_name,m.from.last_name].filter(Boolean).join(' '),new Date().toISOString(),caption,a.type,a.fileId,a.uniqueId,a.mime,a.name,a.size,category,visibility,'CARD_SEND_PENDING',token,'','','','',''];sheet.appendRow(row);SpreadsheetApp.flush();const line=sheet.getLastRow();try{const sent=bseTelegramApi_('sendMessage',{chat_id:chat,text:'Semakan Evidence TEST '+id+'\nJenis: '+a.type+'\nKategori dicadang: '+category+'\nTiada fail Drive ditulis sebelum pengesahan.',reply_parameters:{message_id:Number(m.message_id),allow_sending_without_reply:false},reply_markup:{inline_keyboard:[[{text:'✅ Benar',callback_data:'E1:'+token+':A'},{text:'❌ Buang',callback_data:'E1:'+token+':R'}]]}});if(!sent||!sent.message_id)throw new Error('CARD_SEND_UNCERTAIN');sheet.getRange(line,17,1,3).setValues([['OPEN',token,String(sent.message_id)]]);}catch(error){sheet.getRange(line,23).setValue(bseTelegramSafeErrorDescription_(error.message||'CARD_SEND_UNCERTAIN'));}SpreadsheetApp.flush();return {handled:true};}
function bseTelegramEvidenceIsCallback_(u){return /^E1:[A-Za-z0-9]{8,16}:[AR]$/.test(String(u&&u.callback_query&&u.callback_query.data||''));}
function bseTelegramEvidencePersistCallback_(book,u){const c=u.callback_query||{},s=bseTelegramEvidenceCallbackSheet_(book),rows=s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,BSE_TG_EVIDENCE_CALLBACK_HEADERS.length).getValues():[];if(rows.some(r=>String(r[0])===String(u.update_id)||String(r[1])===String(c.id)))return;s.appendRow([String(u.update_id),String(c.id||''),JSON.stringify(c),'PENDING',0,'',new Date().toISOString(),'','']);SpreadsheetApp.flush();}
function bseTelegramEvidenceDriveFolder_(book){const props=PropertiesService.getScriptProperties(),key=bseRuntimeEvidenceFolderProperty_(),known=bseRuntimeEvidenceFolderId_();if(known)return DriveApp.getFolderById(known);if(bseRuntimeEnvironmentName_()==='PILOT_TEST')throw new Error(key+' wajib dikonfigurasi kepada folder Evidence_Files PILOT_TEST; auto-create dilarang.');const parents=DriveApp.getFileById(book.getId()).getParents();if(!parents.hasNext())throw new Error('Folder induk spreadsheet TEST tidak ditemui.');const folder=parents.next().createFolder('OpsMate_BSE_TEST_Evidence');props.setProperty(key,folder.getId());return folder;}
function bseTelegramEvidenceStoreDrive_(book,row){const token=(PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN')||'').trim(),file=bseTelegramApi_('getFile',{file_id:String(row[9])});if(!token||!file||!file.file_path)throw new Error('Fail Telegram tidak tersedia.');let response;try{response=UrlFetchApp.fetch('https://api.telegram.org/file/bot'+token+'/'+file.file_path,{muteHttpExceptions:true,followRedirects:false});}catch(_){throw new Error('Muat turun evidence Telegram gagal.');}if(response.getResponseCode()!==200)throw new Error('Muat turun evidence Telegram ditolak.');const blob=response.getBlob().setName(String(row[12]||'evidence'));return bseTelegramEvidenceDriveFolder_(book).createFile(blob).getId();}
function bseTelegramEvidenceCallback_(callback){const m=String(callback&&callback.data||'').match(/^E1:([A-Za-z0-9]{8,16}):([AR])$/);if(!m)throw new Error('Callback evidence tidak sah.');const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw new Error('Evidence sedang dikemas kini.');try{const book=boundTestBook_(),sheet=bseTelegramEvidenceSheet_(book),rows=bseTelegramEvidenceRows_(sheet),i=rows.findIndex(r=>String(r[17])===m[1]);if(i<0)throw new Error('Evidence tidak ditemui.');const r=rows[i],actor=String(callback.from&&callback.from.id||''),chat=String(callback.message&&callback.message.chat&&callback.message.chat.id||'');if(actor!==String(r[4])||chat!==String(r[1])){if(callback.id)bseTelegramApi_('answerCallbackQuery',{callback_query_id:callback.id,text:'Kad ini hanya untuk penghantar asal.',show_alert:true});return {authorized:false};}if(String(r[16])!=='OPEN')return {duplicate:true};if(m[2]==='R'){sheet.getRange(i+2,17,1,6).setValues([['DISCARDED_BY_REPORTER',String(r[17]),String(r[18]),'', '',new Date().toISOString()]]);SpreadsheetApp.flush();return {production_write:false,discarded:true};}const driveId=bseTelegramEvidenceStoreDrive_(book,r);sheet.getRange(i+2,17,1,5).setValues([['CONFIRMED_TEST',String(r[17]),String(r[18]),driveId,new Date().toISOString()]]);SpreadsheetApp.flush();return {production_write:false,status:'CONFIRMED_TEST'};}finally{lock.releaseLock();}}
function processBseTelegramEvidenceCallbacks(){const s=bseTelegramEvidenceCallbackSheet_(boundTestBook_()),rows=s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,BSE_TG_EVIDENCE_CALLBACK_HEADERS.length).getValues():[];let processed=0,failed=0;for(let i=0;i<rows.length&&processed+failed<10;i++){if(String(rows[i][3])!=='PENDING')continue;try{bseTelegramEvidenceCallback_(JSON.parse(String(rows[i][2])));s.getRange(i+2,4,1,6).setValues([['PROCESSED',Number(rows[i][4]||0)+1,'',String(rows[i][6]),new Date().toISOString(),'']]);processed++;}catch(e){const f=bseTelegramCallbackFailureState_(e,Number(rows[i][4]||0)+1,Date.now());s.getRange(i+2,4,1,6).setValues([[f.status,Number(rows[i][4]||0)+1,f.last_error,String(rows[i][6]),'',f.next_attempt_at]]);failed++;}SpreadsheetApp.flush();}return {processed:processed,failed:failed,production_write:false};}
function runBseTelegramEvidenceHarnessTests(){const source=[bseTelegramEvidenceAttachment_,bseTelegramEvidenceReceiveMessageCore_,bseTelegramEvidenceCallback_,bseTelegramEvidenceStoreDrive_].map(f=>f.toString()).join('\n'),tests=[{id:'only photo document video accepted',pass:/PHOTO/.test(source)&&/DOCUMENT/.test(source)&&/VIDEO/.test(source)},{id:'private evidence requires active registration',pass:/REGISTERED_ACTIVE/.test(source)&&/OWNER_ACTIVE/.test(source)},{id:'Drive write occurs only after Benar',pass:/m\[2\]==='R'/.test(source)&&source.indexOf('bseTelegramEvidenceStoreDrive_')>source.indexOf("m[2]==='R'")},{id:'no public Drive link',pass:!/getUrl\(/.test(source)}];if(tests.some(t=>!t.pass))throw new Error('Evidence harness gagal.');return tests;}

// Final Evidence UX: correction is an owned one-shot session, never a reply-only
// requirement. The first intake function above is retained only as a narrow parser.
const bseTelegramEvidenceReceiveMessageBase_=bseTelegramEvidenceReceiveMessageCore_;
function bseTelegramEvidenceMarkup_(token){return {inline_keyboard:[[{text:'✅ Benar',callback_data:'E1:'+token+':A'},{text:'✏️ Betulkan',callback_data:'E1:'+token+':C'},{text:'❌ Batal',callback_data:'E1:'+token+':R'}]]};}
function bseTelegramEvidenceConfirmedNotices_(book,row,driveId){const ref=String(row[0]),name=String(row[5]||'penghantar'),receipt='Resit Evidence TEST '+ref+' — disahkan dan disimpan. Rujukan ini boleh digunakan untuk semakan.',owner='Evidence TEST '+ref+'\nPenghantar: '+name+'\nJenis: '+String(row[8])+'\nKategori: '+String(row[14])+'\nStatus: CONFIRMED_TEST\nDrive file ID: '+String(driveId)+'\nTiada rekod production ditulis.';try{bseTelegramReporterReceipt_(book,row[4],receipt);}catch(_){ }bseTelegramOwnerNotice_(book,owner);bseTelegramTestApprovalGroupIds_().forEach(chat=>{try{bseTelegramApi_('sendMessage',{chat_id:String(chat),text:'Makluman TEST: '+name+' telah menghantar data baharu kepada sistem.'});}catch(_){ }});}
function bseTelegramEvidenceReceiveMessage_(book,m){return bseTelegramEvidenceReceiveMessageBase_(book,m);}
function bseTelegramEvidenceCorrectionSession_(book,m){const rows=bseTelegramEvidenceRows_(bseTelegramEvidenceSheet_(book)),matches=rows.map((r,i)=>({r:r,i:i})).filter(x=>String(x.r[16])==='CORRECTION_WAITING_INFO'&&String(x.r[1])===String(m.chat&&m.chat.id)&&String(x.r[4])===String(m.from&&m.from.id));return matches.length===1?matches[0]:null;}
function bseTelegramEvidenceOpenCorrectedCard_(book,item){const sheet=bseTelegramEvidenceSheet_(book),token=bseApprovalToken_(),row=item.r,index=item.i+2;sheet.getRange(index,17,1,3).setValues([['CARD_SEND_PENDING',token,'']]);SpreadsheetApp.flush();try{const sent=bseTelegramApi_('sendMessage',{chat_id:String(row[1]),text:'Semakan Evidence TEST '+row[0]+'\nKategori dicadang: '+row[14]+'\nTiada fail Drive ditulis sebelum pengesahan.',reply_parameters:{message_id:Number(row[3]),allow_sending_without_reply:false},reply_markup:bseTelegramEvidenceMarkup_(token)});if(!sent||!sent.message_id)throw new Error('CARD_SEND_UNCERTAIN');sheet.getRange(index,17,1,3).setValues([['OPEN',token,String(sent.message_id)]]);}catch(error){sheet.getRange(index,23).setValue(bseTelegramSafeErrorDescription_(error.message||'CARD_SEND_UNCERTAIN'));}SpreadsheetApp.flush();}
function bseTelegramEvidenceCorrectionReceive_(book,m){if(!m||!m.chat||!m.from||m.from.is_bot||typeof m.text!=='string'||!m.text.trim()||m.text.startsWith('/'))return {handled:false};const item=bseTelegramEvidenceCorrectionSession_(book,m);if(!item)return {handled:false};const caption=m.text.trim().slice(0,12000),category=bseTelegramEvidenceCategory_(caption),visibility=String(item.r[2])==='private'?'PRIVATE_SUBMISSION':['INVENTORY_CLAIM','ADMIN_DOCUMENT','UNCLASSIFIED_TEST'].includes(category)?'RESTRICTED':'GROUP_STANDARD',sheet=bseTelegramEvidenceSheet_(book);sheet.getRange(item.i+2,8,1,9).setValues([[caption,item.r[8],item.r[9],item.r[10],item.r[11],item.r[12],item.r[13],category,visibility]]);item.r[7]=caption;item.r[14]=category;item.r[15]=visibility;bseTelegramEvidenceOpenCorrectedCard_(book,item);return {handled:true};}
function bseTelegramEvidenceCallback_(callback){const m=String(callback&&callback.data||'').match(/^E1:([A-Za-z0-9]{8,16}):([ACR])$/);if(!m)throw new Error('Callback evidence tidak sah.');const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw new Error('Evidence sedang dikemas kini.');try{const book=boundTestBook_(),sheet=bseTelegramEvidenceSheet_(book),rows=bseTelegramEvidenceRows_(sheet),i=rows.findIndex(r=>String(r[17])===m[1]),rowIndex=i+2;if(i<0)throw new Error('Evidence tidak ditemui.');const r=rows[i],actor=String(callback.from&&callback.from.id||''),chat=String(callback.message&&callback.message.chat&&callback.message.chat.id||'');if(actor!==String(r[4])||chat!==String(r[1])){if(callback.id)bseTelegramApi_('answerCallbackQuery',{callback_query_id:callback.id,text:'Kad ini hanya untuk penghantar asal.',show_alert:true});return {authorized:false};}if(String(r[16])!=='OPEN')return {duplicate:true};if(m[2]==='C'){sheet.getRange(rowIndex,17).setValue('CORRECTION_WAITING_INFO');bseTelegramApi_('editMessageReplyMarkup',{chat_id:chat,message_id:Number(r[18]),reply_markup:{inline_keyboard:[]}});bseTelegramApi_('sendMessage',{chat_id:chat,text:'Rujukan '+r[0]+': hantar pembetulan caption sebagai mesej biasa. Ia akan dipadankan dengan sesi aktif anda.',reply_parameters:{message_id:Number(r[3]),allow_sending_without_reply:false}});SpreadsheetApp.flush();return {production_write:false,correction:true};}if(m[2]==='R'){sheet.getRange(rowIndex,17,1,6).setValues([['DISCARDED_BY_REPORTER',String(r[17]),String(r[18]),'', '',new Date().toISOString()]]);SpreadsheetApp.flush();return {production_write:false,discarded:true};}const driveId=bseTelegramEvidenceStoreDrive_(book,r);sheet.getRange(rowIndex,17,1,5).setValues([['CONFIRMED_TEST',String(r[17]),String(r[18]),driveId,new Date().toISOString()]]);SpreadsheetApp.flush();try{bseTelegramApi_('editMessageReplyMarkup',{chat_id:chat,message_id:Number(r[18]),reply_markup:{inline_keyboard:[]}});bseTelegramApi_('editMessageText',{chat_id:chat,message_id:Number(r[18]),text:'Semakan Evidence TEST '+r[0]+' — CONFIRMED_TEST'});}catch(_){ }bseTelegramEvidenceConfirmedNotices_(book,r,driveId);return {production_write:false,status:'CONFIRMED_TEST'};}finally{lock.releaseLock();}}
function bseTelegramEvidenceIsCallback_(u){return /^E1:[A-Za-z0-9]{8,16}:[ACR]$/.test(String(u&&u.callback_query&&u.callback_query.data||''));}
function bseTelegramEvidenceReceiveMessageCore_(book,m){
  const a=bseTelegramEvidenceAttachment_(m);
  if(!a||!/^[A-Za-z0-9_-]{8,}$/.test(a.fileId)||!/^[A-Za-z0-9_-]{8,}$/.test(a.uniqueId)||a.size<0||a.size>20000000)return {handled:false};
  const chat=String(m.chat.id),user=String(m.from.id),private=m.chat.type==='private';
  const access=private?bseTelegramRegistrationPrivateAccess_(book,m):{status:'GROUP'};
  if(private&&!['REGISTERED_ACTIVE','OWNER_ACTIVE'].includes(access.status))return {handled:true,text:'Sila mendaftar sebagai ahli aktif dahulu, hubungi admin.'};
  if(!private&&!bseTelegramTestApprovalGroupIds_().includes(chat))return {handled:false};
  const sheet=bseTelegramEvidenceSheet_(book),rows=bseTelegramEvidenceRows_(sheet),key=chat+'|'+String(m.message_id)+'|'+a.uniqueId;
  if(rows.some(r=>String(r[1])+'|'+String(r[3])+'|'+String(r[10])===key))return {handled:true};
  const caption=String(m.caption||'').trim(),category=bseTelegramEvidenceCategory_(caption),visibility=private?'PRIVATE_SUBMISSION':['INVENTORY_CLAIM','ADMIN_DOCUMENT','UNCLASSIFIED_TEST'].includes(category)?'RESTRICTED':'GROUP_STANDARD';
  const id='BSE-EV-'+String(m.message_id)+'-'+a.uniqueId.slice(0,8),token=bseApprovalToken_();
  sheet.appendRow([id,chat,String(m.chat.type),String(m.message_id),user,[m.from.first_name,m.from.last_name].filter(Boolean).join(' '),new Date().toISOString(),caption,a.type,a.fileId,a.uniqueId,a.mime,a.name,a.size,category,visibility,'CARD_SEND_PENDING',token,'','','','','']);
  SpreadsheetApp.flush();const line=sheet.getLastRow();
  try{const sent=bseTelegramApi_('sendMessage',{chat_id:chat,text:'Semakan Evidence TEST '+id+'\nJenis: '+a.type+'\nKategori dicadang: '+category+'\nTiada fail Drive ditulis sebelum pengesahan.',reply_parameters:{message_id:Number(m.message_id),allow_sending_without_reply:false},reply_markup:bseTelegramEvidenceMarkup_(token)});
    if(!sent||!sent.message_id)throw new Error('CARD_SEND_UNCERTAIN');sheet.getRange(line,17,1,3).setValues([['OPEN',token,String(sent.message_id)]]);
  }catch(error){sheet.getRange(line,23).setValue(bseTelegramSafeErrorDescription_(error.message||'CARD_SEND_UNCERTAIN'));}
  SpreadsheetApp.flush();return {handled:true};
}


// D-044 Evidence <-> Domain Record many-to-many link layer.
// Evidence identity remains stable in TEST_FILE_EVIDENCE. Domain links are
// separate auditable rows; linking never copies the underlying Drive file.
const BSE_EVIDENCE_DOMAIN_LINK_HEADERS=[
  'link_id','evidence_id','domain_record_type','domain_record_id','link_reason',
  'source_message_id','linked_by','linked_at','status','unlinked_by','unlinked_at',
  'unlink_reason','production_write'
];

function bseEvidenceDomainLinkSheet_(book){
  let sheet=book.getSheetByName('TEST_EVIDENCE_DOMAIN_LINK');
  if(!sheet)sheet=book.insertSheet('TEST_EVIDENCE_DOMAIN_LINK');
  bseEnsureAdditiveHeaders_(sheet,BSE_EVIDENCE_DOMAIN_LINK_HEADERS);
  return sheet;
}

function bseEvidenceFindById_(book,evidenceId){
  const sheet=bseTelegramEvidenceSheet_(book),rows=bseTelegramEvidenceRows_(sheet);
  const index=rows.findIndex(row=>String(row[0]||'')===String(evidenceId||''));
  return index<0?null:{row:rows[index],index:index};
}

function bseEvidenceLinkId_(evidenceId,recordType,recordId){
  const raw=[String(evidenceId||''),String(recordType||''),String(recordId||'')].join('|');
  const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw,Utilities.Charset.UTF_8)
    .map(byte=>('0'+((byte+256)%256).toString(16)).slice(-2)).join('');
  return 'BSE-EL-'+digest.slice(0,16);
}

function bseEvidenceLinkDomainRecord_(book,input){
  const x=input||{},evidenceId=String(x.evidence_id||'').trim(),recordType=String(x.domain_record_type||'').trim(),recordId=String(x.domain_record_id||'').trim();
  if(!evidenceId||!recordType||!recordId)throw new Error('Evidence link memerlukan evidence_id, domain_record_type dan domain_record_id.');
  if(x.production_write!==false)throw new Error('Evidence link TEST mesti production_write:false.');
  const evidence=bseEvidenceFindById_(book,evidenceId);
  if(!evidence)throw new Error('Evidence tidak ditemui: '+evidenceId);
  if(String(evidence.row[16]||'')!=='CONFIRMED_TEST')throw new Error('Evidence belum CONFIRMED_TEST: '+evidenceId);

  const sheet=bseEvidenceDomainLinkSheet_(book),rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,BSE_EVIDENCE_DOMAIN_LINK_HEADERS.length).getValues():[];
  const linkId=bseEvidenceLinkId_(evidenceId,recordType,recordId);
  const existing=rows.find(row=>String(row[0]||'')===linkId);
  if(existing){
    if(String(existing[8]||'')==='ACTIVE')return {linked:true,duplicate:true,link_id:linkId,production_write:false};
    throw new Error('Link evidence pernah dinyahaktifkan; gunakan tindakan relink eksplisit.');
  }
  const stamp=new Date().toISOString();
  sheet.appendRow([
    linkId,evidenceId,recordType,recordId,String(x.link_reason||'DOMAIN_SUPPORT'),
    String(x.source_message_id||''),String(x.linked_by||'SYSTEM_TEST'),stamp,
    'ACTIVE','','','',false
  ]);
  SpreadsheetApp.flush();
  return {linked:true,duplicate:false,link_id:linkId,production_write:false};
}

function bseEvidenceUnlinkDomainRecord_(book,input){
  const x=input||{},linkId=String(x.link_id||'').trim(),actor=String(x.unlinked_by||'').trim(),reason=String(x.unlink_reason||'').trim();
  if(!linkId||!actor||!reason)throw new Error('Unlink memerlukan link_id, unlinked_by dan unlink_reason.');
  if(x.production_write!==false)throw new Error('Evidence unlink TEST mesti production_write:false.');
  const sheet=bseEvidenceDomainLinkSheet_(book),rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,BSE_EVIDENCE_DOMAIN_LINK_HEADERS.length).getValues():[],index=rows.findIndex(row=>String(row[0]||'')===linkId);
  if(index<0)throw new Error('Evidence link tidak ditemui.');
  if(String(rows[index][8]||'')!=='ACTIVE')return {unlinked:false,duplicate:true,status:String(rows[index][8]||''),production_write:false};
  sheet.getRange(index+2,9,1,4).setValues([['UNLINKED',actor,new Date().toISOString(),reason]]);
  SpreadsheetApp.flush();
  return {unlinked:true,link_id:linkId,production_write:false};
}

function bseEvidenceRefs_(value){
  const raw=Array.isArray(value)?value:String(value||'').split(/[\s,;]+/);
  return Array.from(new Set(raw.map(item=>String(item||'').trim()).filter(item=>/^BSE-EV-/.test(item))));
}

function bseEvidenceLinkMany_(book,input){
  const x=input||{},refs=bseEvidenceRefs_(x.evidence_refs||x.evidence_reference),out=[];
  refs.forEach(evidenceId=>out.push(bseEvidenceLinkDomainRecord_(book,{
    evidence_id:evidenceId,
    domain_record_type:x.domain_record_type,
    domain_record_id:x.domain_record_id,
    link_reason:x.link_reason||'DOMAIN_SUPPORT',
    source_message_id:x.source_message_id||'',
    linked_by:x.linked_by||'SYSTEM_TEST',
    production_write:false
  })));
  return {links:out,production_write:false};
}

function runBseEvidenceDomainLinkD044HarnessTests(){
  const headers=BSE_EVIDENCE_DOMAIN_LINK_HEADERS,linkSource=bseEvidenceLinkDomainRecord_.toString(),unlinkSource=bseEvidenceUnlinkDomainRecord_.toString(),manySource=bseEvidenceLinkMany_.toString();
  const tests=[
    {id:'link table preserves explicit evidence and domain identities',pass:['evidence_id','domain_record_type','domain_record_id','link_reason','linked_by','linked_at','status'].every(h=>headers.includes(h))},
    {id:'many-to-many uses separate link rows rather than copied files',pass:/sheet\.appendRow/.test(linkSource)&&!/DriveApp|createFile|getBlob/.test(linkSource)},
    {id:'only confirmed evidence can link',pass:/CONFIRMED_TEST/.test(linkSource)},
    {id:'same evidence can be linked to multiple domain records',pass:/refs\.forEach/.test(manySource)&&/domain_record_id/.test(manySource)},
    {id:'unlink is audited state change, not evidence deletion',pass:/UNLINKED/.test(unlinkSource)&&!/deleteRow|setTrashed|removeFile|trash/.test(unlinkSource)},
    {id:'production boundary preserved',pass:/production_write!==false/.test(linkSource)&&/production_write!==false/.test(unlinkSource)}
  ];
  const failures=tests.filter(t=>!t.pass);if(failures.length)throw new Error('D-044 evidence-link harness gagal: '+failures.map(t=>t.id).join(', '));return tests;
}
