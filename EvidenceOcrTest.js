/** @OnlyCurrentDoc */
// Minimum OCR PoC for confirmed PHOTO Evidence only.
// OCR output is NON_CANONICAL until explicit /ocr confirm <evidence_id>.
// No domain writer, diagnosis, table reconstruction, or production write.

const BSE_EVIDENCE_OCR_HEADERS=[
  'evidence_id','drive_file_id','mime_type','ocr_text','ocr_status','model',
  'requested_by_telegram_user_id','requested_at','confirmed_by_telegram_user_id',
  'confirmed_at','discarded_at','payload_hash','last_error','production_write'
];

function bseEvidenceOcrSheet_(book){
  let s=book.getSheetByName('TEST_EVIDENCE_OCR');
  if(!s)s=book.insertSheet('TEST_EVIDENCE_OCR');
  bseEnsureAdditiveHeaders_(s,BSE_EVIDENCE_OCR_HEADERS);
  return s;
}
function bseEvidenceOcrRows_(sheet){return sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,BSE_EVIDENCE_OCR_HEADERS.length).getValues():[];}
function bseEvidenceOcrCommand_(text){
  const raw=String(text||'').trim();
  let m=raw.match(/^\/ocr\s+(BSE-EV-[A-Za-z0-9_-]+)\s*$/i);
  if(m)return {action:'EXTRACT',evidence_id:m[1]};
  m=raw.match(/^\/ocr\s+(confirm|discard)\s+(BSE-EV-[A-Za-z0-9_-]+)\s*$/i);
  if(m)return {action:m[1].toUpperCase(),evidence_id:m[2]};
  return null;
}
function bseEvidenceOcrAccess_(book,message,evidence){
  const access=bseTelegramRegistrationPrivateAccess_(book,message),user=String(message&&message.from&&message.from.id||'');
  if(!['REGISTERED_ACTIVE','OWNER_ACTIVE'].includes(access.status))return {ok:false,reason:access.status,user:user};
  const owner=bseTestOwnerForTelegramUser_(book,user).ok,reporter=String(evidence&&evidence.row&&evidence.row[4]||'')===user;
  return {ok:owner||reporter,reason:owner?'OWNER_ACTIVE':reporter?'ORIGINAL_REPORTER':'VISIBILITY_DENIED',user:user};
}
function bseEvidenceOcrHash_(value){
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value||''),Utilities.Charset.UTF_8)
    .map(byte=>('0'+((byte+256)%256).toString(16)).slice(-2)).join('');
}
function bseEvidenceOcrExtract_(telegramFileId,mimeType){
  const props=PropertiesService.getScriptProperties(),key=String(props.getProperty('GEMINI_API_KEY')||'').trim(),model=String(props.getProperty('GEMINI_MODEL')||'').trim(),botToken=String(props.getProperty('TELEGRAM_BOT_TOKEN')||'').trim();
  if(!key)throw new Error('GEMINI_API_KEY belum disimpan.');
  if(model!=='gemini-3.1-flash-lite')throw new Error('GEMINI_MODEL mesti gemini-3.1-flash-lite.');
  if(!botToken)throw new Error('TELEGRAM_BOT_TOKEN belum disimpan.');
  const info=bseTelegramApi_('getFile',{file_id:String(telegramFileId||'')});
  if(!info||!info.file_path)throw new Error('Fail Telegram OCR tidak tersedia.');
  let fileResponse;try{fileResponse=UrlFetchApp.fetch('https://api.telegram.org/file/bot'+botToken+'/'+info.file_path,{muteHttpExceptions:true,followRedirects:false});}catch(_){throw new Error('Muat turun PHOTO OCR gagal.');}
  if(fileResponse.getResponseCode()!==200)throw new Error('Muat turun PHOTO OCR ditolak.');
  const bytes=fileResponse.getBlob().getBytes();
  if(bytes.length>10*1024*1024)throw new Error('Imej terlalu besar untuk OCR minimum PoC.');
  const prompt=[
    'OCR ONLY. Extract visible printed text from this image.',
    'Return plain text only, preserving line breaks where useful.',
    'Do not interpret, summarize, classify, diagnose, infer missing words, reconstruct tables, or add commentary.',
    'If text is unreadable, return exactly: [UNREADABLE]'
  ].join('\n');
  const payload={contents:[{role:'user',parts:[{text:prompt},{inlineData:{mimeType:String(mimeType||'image/jpeg'),data:Utilities.base64Encode(bytes)}}]}],generationConfig:{temperature:0,maxOutputTokens:2048}};
  let response;
  try{response=UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{method:'post',contentType:'application/json',headers:{'x-goog-api-key':key},muteHttpExceptions:true,followRedirects:false,payload:JSON.stringify(payload)});}
  catch(_){throw new Error('OCR Gemini call gagal.');}
  if(response.getResponseCode()!==200)throw new Error('OCR Gemini HTTP '+response.getResponseCode()+'.');
  let data;try{data=JSON.parse(response.getContentText());}catch(_){throw new Error('OCR response bukan JSON.');}
  const answer=data.candidates&&data.candidates[0],text=(answer&&answer.content&&answer.content.parts||[]).filter(p=>typeof p.text==='string').map(p=>p.text).join('').trim();
  if(!text)throw new Error('OCR tidak menghasilkan text.');
  return {text:text.slice(0,12000),model:model};
}
function bseEvidenceOcrRetrieve_(book,message){
  const cmd=bseEvidenceOcrCommand_(message&&message.text);
  if(!cmd)return {handled:false};
  const evidence=bseEvidenceFindById_(book,cmd.evidence_id);
  if(!evidence)return {handled:true,text:'Evidence TEST tidak ditemui.'};
  const row=evidence.row,access=bseEvidenceOcrAccess_(book,message,evidence);
  if(!access.ok)return {handled:true,text:access.reason==='NOT_PRIVATE'?'OCR hanya melalui PM bot.':'Anda tidak mempunyai akses kepada Evidence ini.'};
  if(String(row[16]||'')!=='CONFIRMED_TEST')return {handled:true,text:'OCR hanya untuk Evidence yang sudah CONFIRMED_TEST.'};
  if(String(row[8]||'')!=='PHOTO'||!/^image\//i.test(String(row[11]||'')))return {handled:true,text:'OCR minimum PoC hanya menyokong PHOTO/image.'};
  const driveId=String(row[19]||''),telegramFileId=String(row[9]||'');
  if(!driveId)return {handled:true,text:'Evidence ini belum mempunyai fail Drive TEST.'};
  if(!telegramFileId)return {handled:true,text:'Evidence ini tiada Telegram file_id untuk OCR.'};
  const sheet=bseEvidenceOcrSheet_(book),rows=bseEvidenceOcrRows_(sheet),existing=rows.map((r,i)=>({r:r,i:i})).filter(x=>String(x.r[0])===cmd.evidence_id).slice(-1)[0];
  if(cmd.action==='CONFIRM'){
    if(!existing||String(existing.r[4])!=='PROPOSED_NON_CANONICAL')return {handled:true,text:'Tiada hasil OCR NON_CANONICAL yang menunggu pengesahan.'};
    sheet.getRange(existing.i+2,5).setValue('OCR_CONFIRMED_TEST');
    sheet.getRange(existing.i+2,9,1,2).setValues([[access.user,new Date().toISOString()]]);
    SpreadsheetApp.flush();
    return {handled:true,text:'OCR TEST '+cmd.evidence_id+' disahkan sebagai metadata Evidence. Ia masih tidak menulis mana-mana domain record.',production_write:false};
  }
  if(cmd.action==='DISCARD'){
    if(!existing||!['PROPOSED_NON_CANONICAL','OCR_CONFIRMED_TEST'].includes(String(existing.r[4])))return {handled:true,text:'Tiada hasil OCR yang boleh dibuang.'};
    sheet.getRange(existing.i+2,5).setValue('OCR_DISCARDED');
    sheet.getRange(existing.i+2,11).setValue(new Date().toISOString());
    SpreadsheetApp.flush();
    return {handled:true,text:'Hasil OCR TEST dibuang. Evidence asal kekal.',production_write:false};
  }
  if(existing&&String(existing.r[4])==='OCR_CONFIRMED_TEST')return {handled:true,text:'OCR CONFIRMED TEST '+cmd.evidence_id+'\n'+String(existing.r[3]||'')+'\n\nMetadata sahaja; tiada domain write.',production_write:false};
  if(existing&&String(existing.r[4])==='PROPOSED_NON_CANONICAL')return {handled:true,text:'OCR NON_CANONICAL '+cmd.evidence_id+'\n'+String(existing.r[3]||'')+'\n\nJika tepat: /ocr confirm '+cmd.evidence_id+'\nJika salah: /ocr discard '+cmd.evidence_id,production_write:false};
  const ocr=bseEvidenceOcrExtract_(telegramFileId,String(row[11]||'image/jpeg')),stamp=new Date().toISOString(),hash=bseEvidenceOcrHash_(driveId+'|'+ocr.text);
  sheet.appendRow([cmd.evidence_id,driveId,String(row[11]||''),ocr.text,'PROPOSED_NON_CANONICAL',ocr.model,access.user,stamp,'','','',hash,'',false]);
  SpreadsheetApp.flush();
  return {handled:true,text:'OCR NON_CANONICAL '+cmd.evidence_id+'\n'+ocr.text+'\n\nSemak dahulu. Jika tepat: /ocr confirm '+cmd.evidence_id+'\nJika salah: /ocr discard '+cmd.evidence_id+'\nTiada domain record ditulis.',production_write:false};
}
function installBseEvidenceOcrSchemaTest(){
  if(bseRuntimeEnvironmentName_()!=='PILOT_TEST')throw new Error('OCR schema installer hanya untuk PILOT_TEST.');
  const s=bseEvidenceOcrSheet_(boundTestBook_());SpreadsheetApp.flush();
  return {sheet:bseRuntimeSheetName_('TEST_EVIDENCE_OCR'),headers:BSE_EVIDENCE_OCR_HEADERS.length,production_write:false};
}
function runBseEvidenceOcrHarnessTests(){
  const extract=bseEvidenceOcrExtract_.toString(),retrieve=bseEvidenceOcrRetrieve_.toString(),tests=[
    {id:'command supports extract confirm discard only',pass:bseEvidenceOcrCommand_('/ocr BSE-EV-156-AQADUxRr').action==='EXTRACT'&&bseEvidenceOcrCommand_('/ocr confirm BSE-EV-156-AQADUxRr').action==='CONFIRM'&&bseEvidenceOcrCommand_('/ocr discard BSE-EV-156-AQADUxRr').action==='DISCARD'&&!bseEvidenceOcrCommand_('/ocr anything else')},
    {id:'confirmed PHOTO Evidence required',pass:/CONFIRMED_TEST/.test(retrieve)&&/PHOTO/.test(retrieve)&&/image\\\//.test(retrieve)},
    {id:'OCR is plain-text extraction only',pass:/OCR ONLY/.test(extract)&&/Do not interpret/.test(extract)&&/reconstruct tables/.test(extract)&&/diagnose/.test(extract)},
    {id:'Gemini fixed model and inline image only',pass:/gemini-3\.1-flash-lite/.test(extract)&&/inlineData/.test(extract)&&/getFile/.test(extract)&&!/DriveApp/.test(extract)},
    {id:'human confirmation required before confirmed metadata',pass:/PROPOSED_NON_CANONICAL/.test(retrieve)&&/OCR_CONFIRMED_TEST/.test(retrieve)&&/cmd\.action==='CONFIRM'/.test(retrieve)},
    {id:'no domain or production writer',pass:!/ReviewCore_|production_write\s*:\s*true/.test(extract+'\n'+retrieve)}
  ];
  const failed=tests.filter(t=>!t.pass);if(failed.length)throw new Error('Evidence OCR harness gagal: '+failed.map(t=>t.id).join(', '));return tests;
}
