/** @OnlyCurrentDoc */
// TEST-only free-form Gemini Q&A. NON_CANONICAL: no domain write, no approval, no BSE record lookup.
const BSE_AI_KB_FOLDER_PROPERTY='BSE_AI_KB_DRIVE_FOLDER_ID';
const BSE_AI_FILE_SEARCH_STORE_PROPERTY='BSE_AI_FILE_SEARCH_STORE';
const BSE_AI_KB_SOURCES=[
  {id:'IRAC_MOA_11_5',title:'IRAC_MoA_Classification_v11.5_Feb_2026.pdf',url:'https://irac-online.org/documents/moa-classification/',mime:'application/pdf',kind:'IRAC'},
  {id:'DOA_PESTICIDE_PORTAL',title:'DOA_Maklumat_Racun_Perosak_2026_snapshot.txt',url:'https://www.doa.gov.my/index.php/pages/view/302?mid=141',mime:'text/plain',kind:'DOA'}
];

function bseTelegramAiCommand_(text){
  return /^\/ai(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(String(text||'').trim());
}
function bseTelegramAiQuestion_(text){
  return String(text||'').trim().replace(/^\/ai(?:@[A-Za-z0-9_]+)?\s*/i,'').trim();
}
function bseTelegramAiAccessAllowed_(book,m,allowedPrivate,allowedGroup){
  if(allowedPrivate||allowedGroup)return true;
  if(!(m&&m.chat&&m.from&&m.chat.type==='private'))return false;
  if(typeof bseTelegramRegistrationPrivateAccess_!=='function')return false;
  const access=bseTelegramRegistrationPrivateAccess_(book,m)||{};
  return ['REGISTERED_ACTIVE','OWNER_ACTIVE'].includes(String(access.status||''));
}
function bseTelegramAiSystemPrompt_(hasKb){
  return [
    'Anda ialah pembantu Q&A OpsMate BSE dalam mod PILOT_TEST.',
    'Semua jawapan anda adalah NON_CANONICAL: bukan rekod BSE, bukan approval, bukan arahan operasi rasmi, dan tidak boleh mendakwa telah mengubah sebarang data.',
    'Jangan baca atau reka data operasi/canonical BSE. Jika pengguna meminta stok, sejarah, status plot atau rekod BSE, jelaskan bahawa /ai tidak mempunyai akses kepada rekod canonical dan arahkan pengguna menggunakan command retrieval rasmi.',
    hasKb?'Anda mempunyai File Search knowledge base pertanian. Untuk soalan pertanian, utamakan sumber KB sebelum pengetahuan umum.':'Knowledge base pertanian belum dikonfigurasi; nyatakan jika jawapan pertanian hanya menggunakan pengetahuan umum model.',
    'Untuk racun perosak Malaysia: SISMARP/Jabatan Pertanian ialah rujukan pendaftaran/pengesyoran tempatan. IRAC ialah rujukan Mode of Action dan resistance management, BUKAN bukti sesuatu racun diluluskan di Malaysia.',
    'Jangan mereka kadar, PHI, MRL, pendaftaran, label, atau status syor. Jika sumber KB tidak menyokong butiran itu, nyatakan bahawa ia perlu disemak pada sumber semasa SISMARP/label berdaftar.',
    'Boleh beri penerangan, pilihan dan pertimbangan umum, tetapi jangan gambarkan cadangan sebagai approval atau arahan kerja BSE.',
    'Jawab dalam Bahasa Melayu yang ringkas dan praktikal kecuali pengguna meminta bahasa lain.'
  ].join('\n');
}
function bseAiExtractText_(data){
  const c=data&&Array.isArray(data.candidates)?data.candidates[0]:null;
  if(!c||!c.content||!Array.isArray(c.content.parts))return '';
  return c.content.parts.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('').replace(/[\r\n]{3,}/g,'\n\n').trim();
}
function bseAiGroundingSources_(data){
  const c=data&&Array.isArray(data.candidates)?data.candidates[0]:null;
  const chunks=c&&c.groundingMetadata&&Array.isArray(c.groundingMetadata.groundingChunks)?c.groundingMetadata.groundingChunks:[];
  const seen=new Set(),out=[];
  chunks.forEach(ch=>{const r=ch&&ch.retrievedContext;if(!r)return;const meta=Array.isArray(r.customMetadata)?r.customMetadata:[],sourceMeta=meta.find(m=>String(m.key||'')==='source_title'),title=String(sourceMeta&&(sourceMeta.stringValue||sourceMeta.string_value)||r.title||'').trim();if(title&&!seen.has(title)){seen.add(title);out.push(title);}});
  return out.slice(0,6);
}
function bseAiGeminiAnswer_(question){
  const props=PropertiesService.getScriptProperties();
  const key=String(props.getProperty('GEMINI_API_KEY')||'').trim();
  const preferredModel=String(props.getProperty('GEMINI_AI_MODEL')||props.getProperty('GEMINI_MODEL')||'').trim();
  const models=[preferredModel,'gemini-3.5-flash-lite'].filter((v,i,a)=>v&&a.indexOf(v)===i);
  const store=String(props.getProperty(BSE_AI_FILE_SEARCH_STORE_PROPERTY)||'').trim();
  if(!key)throw new Error('GEMINI_API_KEY belum tersedia.');
  if(!models.length)throw new Error('Model Gemini belum dikonfigurasi.');
  const payload={
    systemInstruction:{parts:[{text:bseTelegramAiSystemPrompt_(!!store)}]},
    contents:[{role:'user',parts:[{text:question}]}],
    generationConfig:{maxOutputTokens:1800,temperature:0.25}
  };
  if(store)payload.tools=[{fileSearch:{fileSearchStoreNames:[store]}}];
  let response=null,status=0,modelUsed='';
  for(let mi=0;mi<models.length;mi++){
    modelUsed=models[mi];
    const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(modelUsed)+':generateContent';
    for(let attempt=0;attempt<2;attempt++){
      try{response=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',headers:{'x-goog-api-key':key},muteHttpExceptions:true,followRedirects:false,payload:JSON.stringify(payload)});}catch(_){response=null;}
      status=response?response.getResponseCode():0;
      if(status===200)break;
      if(![0,429,500,502,503,504].includes(status)||attempt===1)break;
      Utilities.sleep(800*(attempt+1));
    }
    if(status===200)break;
    if(![0,429,500,502,503,504].includes(status))break;
  }
  if(!response)throw new Error('Panggilan Gemini gagal.');
  if(status!==200)throw new Error('Gemini HTTP '+status+'.');
  let data;try{data=JSON.parse(response.getContentText());}catch(_){throw new Error('Respons Gemini tidak sah.');}
  const text=bseAiExtractText_(data);
  if(!text)throw new Error('Gemini tidak memulangkan jawapan.');
  return {text:text,sources:bseAiGroundingSources_(data),kb_used:!!store,model_used:modelUsed,production_write:false};
}
function bseTelegramAiRender_(answer){
  const lines=['🤖 AI — NON_CANONICAL','',String(answer.text||'').trim()];
  if(answer.sources&&answer.sources.length){lines.push('','Rujukan KB:');answer.sources.forEach(s=>lines.push('• '+s));}
  lines.push('','Rujukan AI sahaja. Bukan rekod, approval atau arahan operasi BSE.');
  return lines.join('\n');
}
function bseTelegramAiSend_(m,text){
  const chunks=[];let rest=String(text||'');
  while(rest.length>3900){let cut=rest.lastIndexOf('\n',3900);if(cut<2500)cut=3900;chunks.push(rest.slice(0,cut));rest=rest.slice(cut).replace(/^\s+/,'');}
  if(rest)chunks.push(rest);
  chunks.forEach((chunk,i)=>{const payload={chat_id:String(m.chat.id),text:chunk};if(i===0&&m.message_id)payload.reply_parameters={message_id:Number(m.message_id),allow_sending_without_reply:true};bseTelegramApi_('sendMessage',payload);});
  return chunks.length;
}
function bseTelegramAiReceive_(book,m,allowedPrivate,allowedGroup){
  if(!bseTelegramAiCommand_(m&&m.text))return {handled:false};
  if(!bseTelegramAiAccessAllowed_(book,m,allowedPrivate,allowedGroup))return {handled:true,unauthorized:true,production_write:false};
  const question=bseTelegramAiQuestion_(m.text);
  if(!question){bseTelegramAiSend_(m,'Gunakan: /ai <soalan>\nContoh: /ai abamectin kumpulan IRAC berapa?');return {handled:true,production_write:false};}
  if(question.length>6000){bseTelegramAiSend_(m,'Soalan terlalu panjang. Had /ai ialah 6000 aksara.');return {handled:true,production_write:false};}
  try{
    const answer=bseAiGeminiAnswer_(question);
    bseTelegramAiSend_(m,bseTelegramAiRender_(answer));
    console.log('BSE_AI_REPLY_SENT: '+JSON.stringify({kb_used:answer.kb_used,source_count:answer.sources.length,production_write:false}));
    return {handled:true,kb_used:answer.kb_used,source_count:answer.sources.length,production_write:false};
  }catch(error){
    bseTelegramAiSend_(m,'AI tidak dapat menjawab sekarang. '+String(error.message||'Ralat tidak diketahui').replace(/AIza[A-Za-z0-9_-]+/g,'[REDACTED]').slice(0,180));
    return {handled:true,error:true,production_write:false};
  }
}

function bseAiKbConfiguredFolder_(){
  const id=String(PropertiesService.getScriptProperties().getProperty(BSE_AI_KB_FOLDER_PROPERTY)||'').trim();
  if(!id)throw new Error(BSE_AI_KB_FOLDER_PROPERTY+' belum dikonfigurasi.');
  return DriveApp.getFolderById(id);
}
function configureBseAiKnowledgeBaseFolderTest(folderId){
  if(bseRuntimeEnvironmentName_()!=='PILOT_TEST')throw new Error('Fungsi ini PILOT_TEST sahaja.');
  const id=String(folderId||'').trim();if(!/^[A-Za-z0-9_-]{10,}$/.test(id))throw new Error('Folder ID tidak sah.');
  const folder=DriveApp.getFolderById(id);if(folder.getName()!=='08_KB_REFERENCE')throw new Error('Folder KB mesti bernama 08_KB_REFERENCE.');
  PropertiesService.getScriptProperties().setProperty(BSE_AI_KB_FOLDER_PROPERTY,id);
  return {configured:true,folder_name:folder.getName(),production_write:false};
}
function bseAiKbStripHtml_(html){
  return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#8211;|&ndash;/g,'-').replace(/\s+/g,' ').trim();
}
function bseAiKbArchiveSource_(folder,source){
  const files=folder.getFilesByName(source.title);if(files.hasNext())return files.next();
  const response=UrlFetchApp.fetch(source.url,{muteHttpExceptions:true,followRedirects:true});
  if(response.getResponseCode()!==200)throw new Error(source.id+' download HTTP '+response.getResponseCode());
  if(source.mime==='text/plain'){
    const text=['SOURCE: '+source.url,'SNAPSHOT_AT: '+new Date().toISOString(),'AUTHORITY: Jabatan Pertanian Malaysia / ePengembangan','','CONTENT:',bseAiKbStripHtml_(response.getContentText())].join('\n');
    return folder.createFile(source.title,text,MimeType.PLAIN_TEXT);
  }
  return folder.createFile(response.getBlob().setName(source.title));
}
function bseAiGeminiRequest_(url,options){
  const key=String(PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')||'').trim();
  if(!key)throw new Error('GEMINI_API_KEY belum tersedia.');
  const o=Object.assign({muteHttpExceptions:true,followRedirects:false},options||{});
  o.headers=Object.assign({},o.headers||{}, {'x-goog-api-key':key});
  const r=UrlFetchApp.fetch(url,o);if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('Gemini KB HTTP '+r.getResponseCode()+'.');
  return r;
}
function bseAiFileSearchStore_(){
  const props=PropertiesService.getScriptProperties();
  const existing=String(props.getProperty(BSE_AI_FILE_SEARCH_STORE_PROPERTY)||'').trim();
  if(existing)return existing;
  const r=bseAiGeminiRequest_('https://generativelanguage.googleapis.com/v1beta/fileSearchStores',{
    method:'post',contentType:'application/json',payload:JSON.stringify({displayName:'OpsMate_BSE_PILOT_TEST_Agriculture_KB',embeddingModel:'models/gemini-embedding-2'})
  });
  const data=JSON.parse(r.getContentText());if(!data.name)throw new Error('File Search store tidak dicipta.');
  props.setProperty(BSE_AI_FILE_SEARCH_STORE_PROPERTY,String(data.name));
  return String(data.name);
}
function bseAiUploadBlobApi_(blob,displayName){
  const bytes=blob.getBytes(),mime=blob.getContentType()||'application/octet-stream';
  const key=String(PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')||'').trim();
  const start=UrlFetchApp.fetch('https://generativelanguage.googleapis.com/upload/v1beta/files',{
    method:'post',headers:{'x-goog-api-key':key,'X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start','X-Goog-Upload-Header-Content-Length':String(bytes.length),'X-Goog-Upload-Header-Content-Type':mime},
    contentType:'application/json',muteHttpExceptions:true,payload:JSON.stringify({file:{displayName:String(displayName||'kb-source')}})
  });
  if(start.getResponseCode()<200||start.getResponseCode()>=300)throw new Error('Gemini file upload init HTTP '+start.getResponseCode()+'.');
  const uploadUrl=start.getHeaders()['X-Goog-Upload-URL']||start.getHeaders()['x-goog-upload-url'];if(!uploadUrl)throw new Error('Gemini upload URL tiada.');
  const finish=UrlFetchApp.fetch(uploadUrl,{method:'post',headers:{'X-Goog-Upload-Offset':'0','X-Goog-Upload-Command':'upload, finalize'},contentType:mime,muteHttpExceptions:true,payload:blob});
  if(finish.getResponseCode()<200||finish.getResponseCode()>=300)throw new Error('Gemini file upload HTTP '+finish.getResponseCode()+'.');
  const data=JSON.parse(finish.getContentText());if(!data.file||!data.file.name)throw new Error('Gemini file name tiada.');
  return data.file.name;
}
function bseAiImportToStore_(store,fileName,source){
  const metadata=source?[{key:'source_title',stringValue:String(source.title||source.id)},{key:'source_authority',stringValue:String(source.kind||'REFERENCE')},{key:'source_url',stringValue:String(source.url||'')}]:[];
  const r=bseAiGeminiRequest_('https://generativelanguage.googleapis.com/v1beta/'+store+':importFile',{
    method:'post',contentType:'application/json',payload:JSON.stringify({fileName:fileName,customMetadata:metadata})
  });
  let op=JSON.parse(r.getContentText()),tries=0;
  while(op&&!op.done&&op.name&&tries<12){Utilities.sleep(2500);const poll=bseAiGeminiRequest_('https://generativelanguage.googleapis.com/v1beta/'+op.name,{method:'get'});op=JSON.parse(poll.getContentText());tries++;}
  if(!op||!op.done)throw new Error('Import File Search belum selesai.');
  if(op.error)throw new Error('Import File Search gagal.');
  return true;
}
function bseAiSourceBlobFromWeb_(source){
  const response=UrlFetchApp.fetch(source.url,{muteHttpExceptions:true,followRedirects:true});
  if(response.getResponseCode()!==200)throw new Error(source.id+' source HTTP '+response.getResponseCode()+'.');
  if(source.mime==='text/plain'){
    const text=['SOURCE: '+source.url,'SNAPSHOT_AT: '+new Date().toISOString(),'AUTHORITY: Jabatan Pertanian Malaysia / ePengembangan','','CONTENT:',bseAiKbStripHtml_(response.getContentText())].join('\\n');
    return Utilities.newBlob(text,'text/plain',source.title);
  }
  return response.getBlob().setName(source.title);
}
function bootstrapBseAiFileSearchTest(){
  if(bseRuntimeEnvironmentName_()!=='PILOT_TEST')throw new Error('PILOT_TEST sahaja.');
  const store=bseAiFileSearchStore_(),props=PropertiesService.getScriptProperties(),results=[];
  BSE_AI_KB_SOURCES.forEach(source=>{
    const flag='BSE_AI_KB_IMPORTED_'+source.id;
    if(props.getProperty(flag)!=='1'){
      const blob=bseAiSourceBlobFromWeb_(source),fileName=bseAiUploadBlobApi_(blob,source.title);
      bseAiImportToStore_(store,fileName,source);props.setProperty(flag,'1');
    }
    results.push({id:source.id,imported:props.getProperty(flag)==='1'});
  });
  return {store:store,sources:results,production_write:false};
}
function archiveBseAiKnowledgeBaseDriveTest(){
  if(bseRuntimeEnvironmentName_()!=='PILOT_TEST')throw new Error('PILOT_TEST sahaja.');
  const root=bseAiKbConfiguredFolder_(),results=[];
  BSE_AI_KB_SOURCES.forEach(source=>{
    const subName=source.kind==='IRAC'?'IRAC':'DOA_SISMARP',subs=root.getFoldersByName(subName),folder=subs.hasNext()?subs.next():root.createFolder(subName);
    const file=bseAiKbArchiveSource_(folder,source);results.push({id:source.id,drive_file_id:file.getId()});
  });
  return {sources:results,production_write:false};
}
function getBseAiKnowledgeBaseStatusTest(){
  const props=PropertiesService.getScriptProperties();
  return {folder_bound:!!String(props.getProperty(BSE_AI_KB_FOLDER_PROPERTY)||''),file_search_store_bound:!!String(props.getProperty(BSE_AI_FILE_SEARCH_STORE_PROPERTY)||''),sources:BSE_AI_KB_SOURCES.map(s=>({id:s.id,imported:props.getProperty('BSE_AI_KB_IMPORTED_'+s.id)==='1'})),production_write:false};
}
function runBseTelegramAiHarnessTests(){
  const src=[bseTelegramAiReceive_,bseAiGeminiAnswer_,bseTelegramAiSystemPrompt_].map(f=>f.toString()).join('\n');
  const tests=[
    {id:'/ai parser accepts free-form question',pass:bseTelegramAiCommand_('/ai apa kumpulan IRAC abamectin?')&&bseTelegramAiQuestion_('/ai apa kumpulan IRAC abamectin?')==='apa kumpulan IRAC abamectin?'},
    {id:'AI path is explicitly NON_CANONICAL',pass:/NON_CANONICAL/.test(bseTelegramAiSystemPrompt_(true))},
    {id:'AI path has no canonical/domain writer',pass:!/ReviewCore_|Measurement_Log|Observation_Log|Treatment_Log|Inventory_Log|production_write\s*:\s*true/.test(src)},
    {id:'File Search is optional and property-bound',pass:/BSE_AI_FILE_SEARCH_STORE_PROPERTY/.test(bseAiGeminiAnswer_.toString())&&/fileSearchStoreNames/.test(bseAiGeminiAnswer_.toString())},
    {id:'Malaysia pesticide authority boundary preserved',pass:/SISMARP\/Jabatan Pertanian/.test(bseTelegramAiSystemPrompt_(true))&&/IRAC.*BUKAN/.test(bseTelegramAiSystemPrompt_(true))},
    {id:'no question persistence',pass:!/appendRow|setValue|setValues/.test(bseTelegramAiReceive_.toString()+bseAiGeminiAnswer_.toString())}
  ];
  const bad=tests.filter(t=>!t.pass);if(bad.length)throw new Error('AI harness gagal: '+bad.map(t=>t.id).join(', '));return tests;
}

function runBseAiKnowledgeBaseSmokeTest(){
  const agriculture=bseAiGeminiAnswer_('Abamectin berada dalam kumpulan IRAC berapa? Adakah klasifikasi IRAC sahaja membuktikan bahan itu berdaftar atau disyorkan di Malaysia? Jawab ringkas dan nyatakan batas sumber.');
  const general=bseAiGeminiAnswer_('Apakah ibu negara Jepun? Jawab satu ayat.');
  return {agriculture:{text:String(agriculture.text||'').slice(0,1200),sources:agriculture.sources,kb_used:agriculture.kb_used},general:{text:String(general.text||'').slice(0,500),sources:general.sources,kb_used:general.kb_used},production_write:false};
}

function getBseAiFileSearchStoreHealthTest(){
  const store=String(PropertiesService.getScriptProperties().getProperty(BSE_AI_FILE_SEARCH_STORE_PROPERTY)||'').trim();
  if(!store)return {bound:false,production_write:false};
  const meta=JSON.parse(bseAiGeminiRequest_('https://generativelanguage.googleapis.com/v1beta/'+store,{method:'get'}).getContentText());
  const docs=JSON.parse(bseAiGeminiRequest_('https://generativelanguage.googleapis.com/v1beta/'+store+'/documents?pageSize=20',{method:'get'}).getContentText());
  return {bound:true,active_documents:Number(meta.activeDocumentsCount||0),pending_documents:Number(meta.pendingDocumentsCount||0),failed_documents:Number(meta.failedDocumentsCount||0),documents:(docs.documents||[]).map(d=>({display_name:d.displayName||'',state:d.state||''})),production_write:false};
}
function runBseAiGeneralModelSmokeTest(){
  const props=PropertiesService.getScriptProperties(),key=String(props.getProperty('GEMINI_API_KEY')||'').trim(),model=String(props.getProperty('GEMINI_AI_MODEL')||props.getProperty('GEMINI_MODEL')||'').trim();
  const r=UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'post',contentType:'application/json',headers:{'x-goog-api-key':key},muteHttpExceptions:true,payload:JSON.stringify({contents:[{role:'user',parts:[{text:'Apakah ibu negara Jepun? Jawab satu ayat.'}]}],generationConfig:{maxOutputTokens:80,temperature:0}})});
  const status=r.getResponseCode(),data=status===200?JSON.parse(r.getContentText()):null;
  return {status:status,text:status===200?bseAiExtractText_(data):'',production_write:false};
}

function rebuildBseAiFileSearchTest(){
  if(bseRuntimeEnvironmentName_()!=='PILOT_TEST')throw new Error('PILOT_TEST sahaja.');
  const props=PropertiesService.getScriptProperties(),oldStore=String(props.getProperty(BSE_AI_FILE_SEARCH_STORE_PROPERTY)||'').trim();
  if(oldStore){const r=bseAiGeminiRequest_('https://generativelanguage.googleapis.com/v1beta/'+oldStore+'?force=true',{method:'delete'});if(r.getResponseCode()!==200)throw new Error('KB lama tidak dapat dipadam.');}
  props.deleteProperty(BSE_AI_FILE_SEARCH_STORE_PROPERTY);
  BSE_AI_KB_SOURCES.forEach(s=>props.deleteProperty('BSE_AI_KB_IMPORTED_'+s.id));
  return bootstrapBseAiFileSearchTest();
}
