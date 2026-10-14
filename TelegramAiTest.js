/** @OnlyCurrentDoc */
// TEST-only free-form Gemini Q&A. NON_CANONICAL: no domain write, no approval, no BSE record lookup.
const BSE_AI_KB_FOLDER_PROPERTY='BSE_AI_KB_DRIVE_FOLDER_ID';
const BSE_AI_FILE_SEARCH_STORE_PROPERTY='BSE_AI_FILE_SEARCH_STORE';
const BSE_AI_KB_REFRESHED_AT_PROPERTY='BSE_AI_KB_REFRESHED_AT';
const BSE_AI_SISMARP_CACHE_URL='https://raw.githubusercontent.com/BSE-dzuddiyn01gmail/BSE-OpsMate-TEST/sismarp-cache/data/sismarp/current.json';
const BSE_AI_KB_SOURCES=[
  {id:'IRAC_MOA_11_5',title:'IRAC_MoA_Classification_v11.5_Feb_2026.pdf',url:'https://irac-online.org/documents/moa-classification/',mime:'application/pdf',kind:'IRAC',version:'11.5 Feb 2026',freshness_days:365},
  {id:'DOA_PESTICIDE_PORTAL',title:'DOA_Maklumat_Racun_Perosak_2026_snapshot.txt',url:'https://www.doa.gov.my/index.php/pages/view/302?mid=141',mime:'text/plain',kind:'DOA',version:'portal snapshot',freshness_days:35}
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
    hasKb?'Anda mempunyai File Search knowledge base pertanian. Untuk soalan pertanian, utamakan sumber KB sebelum pengetahuan umum. Jika soalan menyebut IRAC, kumpulan IRAC atau Mode of Action (MoA), WAJIB gunakan File Search KB dan jangan nyatakan nombor kumpulan/MoA sebagai fakta jika tiada grounding daripada KB.':'Knowledge base pertanian belum dikonfigurasi; nyatakan jika jawapan pertanian hanya menggunakan pengetahuan umum model.',
    'Untuk racun perosak Malaysia: pendaftaran produk dikawal oleh Lembaga Racun Makhluk Perosak/Jabatan Pertanian; SISMARP ialah pangkalan rujukan maklumat racun berdaftar yang disyorkan bagi tanaman/perosak tertentu. Jangan kata produk didaftarkan melalui SISMARP. IRAC ialah rujukan Mode of Action dan resistance management, BUKAN bukti sesuatu racun diluluskan di Malaysia.',
    'Jangan mereka kadar, PHI, MRL, pendaftaran, label, atau status syor. Jika SISMARP CURRENT tersedia dan freshness masih sah, gunakan hasil semasa itu hanya untuk padanan query/filter yang diberikan. Jika total=0, sebut tiada padanan SISMARP semasa untuk kombinasi/filter itu; JANGAN tukar 0 padanan menjadi dakwaan bahawa bahan aktif atau produk itu tidak berdaftar di Malaysia secara umum. Jika cache stale/tidak tersedia atau tiada filter eksplisit, nyatakan batas semakan dan jangan membuat kesimpulan pendaftaran.',
    'Boleh beri penerangan, pilihan dan pertimbangan umum, tetapi jangan gambarkan cadangan sebagai approval atau arahan kerja BSE.',
    'Susun jawapan supaya mudah dibaca di Telegram. Jika soalan mempunyai beberapa bahagian, pecahkan jawapan mengikut bahagian dan beri tajuk ringkas bagi setiap bahagian.',
    'Gunakan **Tajuk** hanya untuk tajuk/pembahagian utama. Jangan guna asterisk untuk bullet; guna tanda •. Elakkan markdown table, heading #, code fence, dan hiasan markdown berlebihan.',
    'Jawab dalam Bahasa Melayu yang ringkas dan praktikal kecuali pengguna meminta bahasa lain.'
  ].join('\n');
}
function bseAiExtractText_(data){
  const c=data&&Array.isArray(data.candidates)?data.candidates[0]:null;
  if(!c||!c.content||!Array.isArray(c.content.parts))return '';
  return c.content.parts.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('').replace(/[\r\n]{3,}/g,'\n\n').trim();
}
function bseAiGroundingDetails_(data){
  const c=data&&Array.isArray(data.candidates)?data.candidates[0]:null;
  const chunks=c&&c.groundingMetadata&&Array.isArray(c.groundingMetadata.groundingChunks)?c.groundingMetadata.groundingChunks:[];
  const seen=new Set(),out=[];
  chunks.forEach(ch=>{const r=ch&&ch.retrievedContext;if(!r)return;const meta=Array.isArray(r.customMetadata)?r.customMetadata:[],get=k=>{const m=meta.find(x=>String(x.key||'')===k);return String(m&&(m.stringValue||m.string_value)||'').trim();},title=get('source_title')||String(r.title||'').trim();if(title&&!seen.has(title)){seen.add(title);out.push({title:title,url:get('source_url'),authority:get('source_authority')});}});
  return out.slice(0,6);
}
function bseAiGroundingSources_(data){return bseAiGroundingDetails_(data).map(x=>x.title);}
function bseAiSismarpQuestion_(question){return /\b(?:sismarp|racun|perosak|pestisid|pesticide|berdaftar|pendaftaran|perawis|bahan aktif|jenama racun|thrips|trip)\b/i.test(String(question||''));}
function bseAiSismarpPlan_(question){
  const q=String(question||'').replace(/\s+/g,' ').trim(),out={crop:'',pest:'',active_ingredient:'',trade_name:''};let m;
  m=q.match(/(?:tanaman|pada)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ-]{1,30})(?=\b|\?|,|\.|$)/i);if(m)out.crop=m[1];
  if(!out.crop){m=q.match(/berdaftar\s+(?:untuk|bagi)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ-]{1,30})/i);if(m)out.crop=m[1];}
  m=q.match(/(?:kawal|mengawal|untuk)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ -]{1,35}?)\s+pada\s+(?:tanaman\s+)?[A-Za-zÀ-ÿ-]+/i);if(m)out.pest=m[1].trim();
  m=q.match(/(?:perosak|nama perosak)\s*[:\-]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ -]{1,35})/i);if(m)out.pest=m[1].trim();
  if(!out.pest){m=q.match(/(?:kawalan|mengawal|kawal)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ -]{1,35}?)(?=\s*[:;,?.]|\s+(?:di|pada|untuk|bagi|adakah|apakah|dan)\b|$)/i);if(m)out.pest=m[1].trim();}
  m=q.match(/(?:perawis(?: aktif)?|bahan aktif)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9 .-]{1,40})/i);if(m)out.active_ingredient=m[1].trim();
  if(/^(?:ini|itu|tersebut|yang)$/i.test(out.active_ingredient))out.active_ingredient='';
  m=q.match(/(?:jenama racun|jenama|produk)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9 .-]{1,40})/i);if(m)out.trade_name=m[1].trim();
  return out;
}
function bseAiSismarpNorm_(value){return String(value||'').toLowerCase().replace(/\s+/g,' ').trim();}
function bseAiSismarpContains_(value,needle){const n=bseAiSismarpNorm_(needle);return !n||bseAiSismarpNorm_(value).indexOf(n)>=0;}
function bseAiSismarpDetectActive_(question,rows){
  const q=' '+bseAiSismarpNorm_(question)+' ',seen=new Set(),terms=[];
  (rows||[]).forEach(r=>{const t=bseAiSismarpNorm_(r&&r.a);if(t.length>=4&&!seen.has(t)){seen.add(t);terms.push(t);}});
  terms.sort((a,b)=>b.length-a.length);
  return terms.find(t=>q.indexOf(' '+t+' ')>=0||q.indexOf(' '+t+',')>=0||q.indexOf(' '+t+'?')>=0||q.endsWith(' '+t+' '))||'';
}
function bseAiSismarpCurrent_(question){
  if(!bseAiSismarpQuestion_(question))return null;
  const plan=bseAiSismarpPlan_(question);let response;
  try{response=UrlFetchApp.fetch(BSE_AI_SISMARP_CACHE_URL,{method:'get',muteHttpExceptions:true,followRedirects:true,headers:{'Cache-Control':'no-cache'}});}catch(error){return {available:false,reason:'CACHE_FETCH_ERROR',error:String(error.message||'').slice(0,120),query:plan,cache_url:BSE_AI_SISMARP_CACHE_URL,production_write:false};}
  const status=response.getResponseCode();if(status!==200)return {available:false,reason:'CACHE_HTTP_'+status,query:plan,cache_url:BSE_AI_SISMARP_CACHE_URL,production_write:false};
  let cache;try{cache=JSON.parse(response.getContentText());}catch(_){return {available:false,reason:'CACHE_INVALID_JSON',query:plan,cache_url:BSE_AI_SISMARP_CACHE_URL,production_write:false};}
  if(!cache||!Array.isArray(cache.rows)||!cache.refreshed_at)return {available:false,reason:'CACHE_SCHEMA_INVALID',query:plan,cache_url:BSE_AI_SISMARP_CACHE_URL,production_write:false};
  const refreshed=Date.parse(String(cache.refreshed_at)),freshness=Math.max(1,Number(cache.freshness_days||14)),ageDays=Number.isFinite(refreshed)?(Date.now()-refreshed)/86400000:Infinity;
  if(!Number.isFinite(ageDays)||ageDays<0||ageDays>freshness)return {available:false,reason:'CACHE_STALE',query:plan,cache_refreshed_at:String(cache.refreshed_at||''),age_days:Number.isFinite(ageDays)?Number(ageDays.toFixed(2)):null,freshness_days:freshness,source_url:String(cache.source||''),cache_url:BSE_AI_SISMARP_CACHE_URL,production_write:false};
  if(!plan.active_ingredient)plan.active_ingredient=bseAiSismarpDetectActive_(question,cache.rows);
  if(!Object.keys(plan).some(k=>plan[k]))return {available:false,reason:'NO_EXPLICIT_FILTER',query:plan,cache_refreshed_at:cache.refreshed_at,source_url:String(cache.source||''),cache_url:BSE_AI_SISMARP_CACHE_URL,production_write:false};
  const matched=cache.rows.filter(r=>bseAiSismarpContains_(r.c,plan.crop)&&(!plan.pest||(bseAiSismarpContains_(r.p,plan.pest)||bseAiSismarpContains_(r.s,plan.pest)))&&bseAiSismarpContains_(r.a,plan.active_ingredient)&&bseAiSismarpContains_(r.t,plan.trade_name));
  const rows=matched.slice(0,30).map(r=>({detail_id:String(r.i||''),crop:String(r.c||''),pest_scientific:String(r.s||''),pest_common:String(r.p||''),trade_name:String(r.t||''),active_ingredient:String(r.a||'')}));
  return {available:true,current:true,checked_at:new Date().toISOString(),cache_refreshed_at:String(cache.refreshed_at),age_days:Number(ageDays.toFixed(2)),freshness_days:freshness,query:plan,total:matched.length,rows:rows,source:'SISMARP — Jabatan Pertanian Malaysia',source_url:String(cache.source||'http://www.portal.doa.gov.my/sismarp/'),cache_url:BSE_AI_SISMARP_CACHE_URL,production_write:false};
}
function diagnoseBseAiSismarpTest(){return bseAiSismarpCurrent_('Adakah abamectin berdaftar untuk peria di Malaysia?');}
function diagnoseBseAiSismarpThripsTest(){return bseAiSismarpCurrent_('Racun apa untuk thrips pada peria?');}
function diagnoseBseAiSismarpPositiveTest(){return bseAiSismarpCurrent_('Adakah deltamethrin berdaftar untuk peria di Malaysia?');}
function diagnoseBseAiSismarpNaturalQueryTest(){return bseAiSismarpCurrent_('Deltamethrin untuk tanaman peria bagi kawalan lalat buah: adakah ada padanan dalam SISMARP semasa, apakah kumpulan IRAC bahan aktif ini, dan nyatakan sumber rujukan?');}
function bseAiIracGroundingQuestion_(question,currentSismarp){
  const active=String(currentSismarp&&currentSismarp.query&&currentSismarp.query.active_ingredient||'').trim();
  return bseAiIracQuestion_(question)&&active?(active+' kumpulan IRAC berapa?'):String(question||'');
}
function bseAiIracGroundedReliable_(question){
  let result=bseAiIracGrounded_(question);
  for(let retry=0;retry<2&&result&&!result.available&&/^(?:IRAC_GROUNDING_HTTP_(?:0|429|5\d\d)|IRAC_GROUNDING_MISSING|IRAC_GROUNDING_INVALID_RESPONSE)$/.test(String(result.reason||''));retry++){
    Utilities.sleep(750*(retry+1));
    result=bseAiIracGrounded_(question);
  }
  return result;
}
function bseAiIracQuestion_(question){return /\b(?:IRAC|mode of action|MoA|kumpulan\s+IRAC)\b/i.test(String(question||''));}
function bseAiIracGrounded_(question){
  if(!bseAiIracQuestion_(question))return null;
  const props=PropertiesService.getScriptProperties(),key=String(props.getProperty('GEMINI_API_KEY')||'').trim(),store=String(props.getProperty(BSE_AI_FILE_SEARCH_STORE_PROPERTY)||'').trim(),preferred=String(props.getProperty('GEMINI_AI_MODEL')||props.getProperty('GEMINI_MODEL')||'').trim(),models=['gemini-3.5-flash-lite',preferred].filter((v,i,a)=>v&&a.indexOf(v)===i);
  if(!key||!store||!models.length)return {available:false,reason:'IRAC_KB_NOT_CONFIGURED',production_write:false};
  const payload={systemInstruction:{parts:[{text:'Gunakan HANYA File Search KB yang diberikan. Cari fakta IRAC/MoA yang relevan dengan soalan. Jangan gunakan pengetahuan model. Jika fakta tidak ditemui dalam KB, jawab tepat NOT_FOUND.'}]},contents:[{role:'user',parts:[{text:String(question||'')}]}],tools:[{fileSearch:{fileSearchStoreNames:[store]}}],generationConfig:{maxOutputTokens:700,temperature:0}};
  let response=null,status=0,modelUsed='';
  for(let mi=0;mi<models.length;mi++){modelUsed=models[mi];const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(modelUsed)+':generateContent';for(let attempt=0;attempt<2;attempt++){try{response=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',headers:{'x-goog-api-key':key},muteHttpExceptions:true,followRedirects:false,payload:JSON.stringify(payload)});}catch(_){response=null;}status=response?response.getResponseCode():0;if(status===200)break;if(![0,429,500,502,503,504].includes(status)||attempt===1)break;Utilities.sleep(500*(attempt+1));}if(status===200)break;if(![0,429,500,502,503,504].includes(status))break;}
  if(!response||status!==200)return {available:false,reason:'IRAC_GROUNDING_HTTP_'+status,model_used:modelUsed,production_write:false};
  let data;try{data=JSON.parse(response.getContentText());}catch(_){return {available:false,reason:'IRAC_GROUNDING_INVALID_RESPONSE',model_used:modelUsed,production_write:false};}
  const text=bseAiExtractText_(data),details=bseAiGroundingDetails_(data).filter(x=>/IRAC/i.test(String(x.title||'')+' '+String(x.authority||'')));
  if(!details.length||!text||/^NOT_FOUND\b/i.test(text))return {available:false,reason:'IRAC_GROUNDING_MISSING',model_used:modelUsed,production_write:false};
  return {available:true,text:text,source_details:details,sources:details.map(x=>x.title),model_used:modelUsed,production_write:false};
}
function diagnoseBseAiIracGroundingTest(){return bseAiIracGrounded_('Abamectin kumpulan IRAC berapa?');}
function bseAiGeminiAnswer_(question,currentSismarp,iracGrounded){
  const props=PropertiesService.getScriptProperties();
  const key=String(props.getProperty('GEMINI_API_KEY')||'').trim();
  const preferredModel=String(props.getProperty('GEMINI_AI_MODEL')||props.getProperty('GEMINI_MODEL')||'').trim();
  const models=[preferredModel,'gemini-3.5-flash-lite'].filter((v,i,a)=>v&&a.indexOf(v)===i);
  const store=String(props.getProperty(BSE_AI_FILE_SEARCH_STORE_PROPERTY)||'').trim();
  if(!key)throw new Error('GEMINI_API_KEY belum tersedia.');
  if(!models.length)throw new Error('Model Gemini belum dikonfigurasi.');
  if(bseAiIracQuestion_(question)&&!(iracGrounded&&iracGrounded.available))throw new Error('IRAC grounding daripada KB tidak tersedia; klasifikasi tidak dijawab untuk mengelakkan jawapan tanpa sumber.');
  const currentContext=currentSismarp?('\n\nCURRENT_SISMARP_CONTEXT_JSON:\n'+JSON.stringify(currentSismarp)+'\nGunakan konteks SISMARP CURRENT ini sebagai fakta semasa hanya untuk padanan query/filter yang dinyatakan apabila available=true. Jangan tambah produk, tanaman, perosak, nombor pendaftaran atau status yang tiada dalam konteks. Jika total=0, nyatakan tepat bahawa tiada padanan SISMARP semasa ditemui untuk filter tersebut; jangan simpulkan bahan aktif/produk tidak berdaftar di Malaysia secara umum. Jika available=false, nyatakan semakan semasa tidak tersedia/stale dan jangan membuat kesimpulan pendaftaran.'):'';
  const iracContext=iracGrounded&&iracGrounded.available?('\n\nGROUNDED_IRAC_CONTEXT:\n'+String(iracGrounded.text||'')+'\nGunakan konteks IRAC ini sahaja untuk klasifikasi IRAC/MoA; jangan tambah klasifikasi dari pengetahuan model.'):'';
  const payload={
    systemInstruction:{parts:[{text:bseTelegramAiSystemPrompt_(!!store)}]},
    contents:[{role:'user',parts:[{text:question+currentContext+iracContext}]}],
    generationConfig:{maxOutputTokens:1800,temperature:0.25}
  };
  if(store&&!(iracGrounded&&iracGrounded.available))payload.tools=[{fileSearch:{fileSearchStoreNames:[store]}}];
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
  const sourceDetails=bseAiGroundingDetails_(data),seen=new Set(sourceDetails.map(x=>x.title));
  (iracGrounded&&iracGrounded.source_details||[]).forEach(x=>{if(x&&x.title&&!seen.has(x.title)){seen.add(x.title);sourceDetails.push(x);}});
  return {text:text,sources:sourceDetails.map(x=>x.title),source_details:sourceDetails,kb_used:!!store,model_used:modelUsed,sismarp_current:currentSismarp||null,production_write:false};
}
function bseTelegramAiRender_(answer){
  const lines=['**🤖 AI — NON_CANONICAL**','',String(answer.text||'').trim()],current=answer.sismarp_current;
  if(current){lines.push('','**SISMARP CURRENT**');if(current.available){lines.push('• Status: derived cache semasa sah','• Padanan query: '+String(current.total||0),'• Snapshot: '+String(current.cache_refreshed_at||''),'• Umur cache: '+String(current.age_days==null?'?':current.age_days)+' hari','• Sumber authority: SISMARP — Jabatan Pertanian Malaysia');if(Number(current.total||0)===0)lines.push('• Nota: 0 padanan tidak membuktikan bahan aktif/produk tiada pendaftaran Malaysia secara umum.');}else{lines.push('• Status: semakan semasa tidak tersedia','• Sebab: '+String(current.reason||'UNKNOWN'));if(current.cache_refreshed_at)lines.push('• Snapshot terakhir: '+current.cache_refreshed_at);}}
  if(answer.sources&&answer.sources.length){lines.push('','**Rujukan KB**');answer.sources.forEach(s=>lines.push('• '+s));}
  const details=(answer.source_details||[]).filter(x=>x&&x.url);if(details.length){lines.push('','**Butiran sumber**');details.forEach(x=>lines.push('• '+x.title+' — '+x.url));}
  if(current&&current.source_url)lines.push('• SISMARP — '+current.source_url);
  lines.push('','Rujukan AI sahaja. Bukan rekod, approval atau arahan operasi BSE.');
  return lines.join('\n');
}
function bseTelegramAiToHtml_(text){
  let s=String(text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  s=s.replace(/^#{1,6}\s+/gm,'');
  s=s.replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>');
  s=s.replace(/^\s*[-*]\s+/gm,'• ');
  s=s.replace(/\*/g,'');
  return s.replace(/[\r\n]{3,}/g,'\n\n').trim();
}
function bseTelegramAiSend_(m,text){
  const chunks=[];let rest=String(text||'');
  while(rest.length>3600){let cut=rest.lastIndexOf('\n',3600);if(cut<2400)cut=3600;chunks.push(rest.slice(0,cut));rest=rest.slice(cut).replace(/^\s+/,'');}
  if(rest)chunks.push(rest);
  chunks.forEach((chunk,i)=>{const payload={chat_id:String(m.chat.id),text:bseTelegramAiToHtml_(chunk),parse_mode:'HTML'};if(i===0&&m.message_id)payload.reply_parameters={message_id:Number(m.message_id),allow_sending_without_reply:true};bseTelegramApi_('sendMessage',payload);});
  return chunks.length;
}
function bseTelegramAiReceive_(book,m,allowedPrivate,allowedGroup){
  if(!bseTelegramAiCommand_(m&&m.text))return {handled:false};
  if(!bseTelegramAiAccessAllowed_(book,m,allowedPrivate,allowedGroup))return {handled:true,unauthorized:true,production_write:false};
  const question=bseTelegramAiQuestion_(m.text);
  if(!question){bseTelegramAiSend_(m,'Gunakan: /ai <soalan>\nContoh: /ai abamectin kumpulan IRAC berapa?');return {handled:true,production_write:false};}
  if(question.length>6000){bseTelegramAiSend_(m,'Soalan terlalu panjang. Had /ai ialah 6000 aksara.');return {handled:true,production_write:false};}
  try{
    const currentSismarp=bseAiSismarpCurrent_(question),iracQuestion=bseAiIracGroundingQuestion_(question,currentSismarp),iracGrounded=bseAiIracGroundedReliable_(iracQuestion),answer=bseAiGeminiAnswer_(question,currentSismarp,iracGrounded);
    bseTelegramAiSend_(m,bseTelegramAiRender_(answer));
    console.log('BSE_AI_REPLY_SENT: '+JSON.stringify({kb_used:answer.kb_used,source_count:answer.sources.length,sismarp_current:!!(currentSismarp&&currentSismarp.available),production_write:false}));
    return {handled:true,kb_used:answer.kb_used,source_count:answer.sources.length,sismarp_current:!!(currentSismarp&&currentSismarp.available),production_write:false};
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
function configureBseAiKnowledgeBasePilotTest(){
  if(bseRuntimeEnvironmentName_()!=='PILOT_TEST')throw new Error('Fungsi ini PILOT_TEST sahaja.');
  const id='1vqLIJW-mJQ0vUo51sX7xiqsDAbvU4PGz';
  PropertiesService.getScriptProperties().setProperty(BSE_AI_KB_FOLDER_PROPERTY,id);
  return {configured:true,folder_id:id,verified_external:true,production_write:false};
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
  props.setProperty(BSE_AI_KB_REFRESHED_AT_PROPERTY,new Date().toISOString());
  return {store:store,sources:results,refreshed_at:props.getProperty(BSE_AI_KB_REFRESHED_AT_PROPERTY),production_write:false};
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
  const props=PropertiesService.getScriptProperties(),refreshedAt=String(props.getProperty(BSE_AI_KB_REFRESHED_AT_PROPERTY)||''),ageDays=refreshedAt?(Date.now()-Date.parse(refreshedAt))/86400000:null;
  return {folder_bound:!!String(props.getProperty(BSE_AI_KB_FOLDER_PROPERTY)||''),file_search_store_bound:!!String(props.getProperty(BSE_AI_FILE_SEARCH_STORE_PROPERTY)||''),refreshed_at:refreshedAt||'',stale:ageDays==null?true:ageDays>35,sources:BSE_AI_KB_SOURCES.map(s=>({id:s.id,version:s.version,freshness_days:s.freshness_days,imported:props.getProperty('BSE_AI_KB_IMPORTED_'+s.id)==='1'})),production_write:false};
}
function getBseAiKnowledgeBaseManifestTest(){return getBseAiKnowledgeBaseStatusTest();}
function refreshBseAiKnowledgeBaseTest(){return rebuildBseAiFileSearchTest();}
function runBseTelegramAiHarnessTests(){
  const src=[bseTelegramAiReceive_,bseAiGeminiAnswer_,bseTelegramAiSystemPrompt_].map(f=>f.toString()).join('\n');
  const tests=[
    {id:'/ai parser accepts free-form question',pass:bseTelegramAiCommand_('/ai apa kumpulan IRAC abamectin?')&&bseTelegramAiQuestion_('/ai apa kumpulan IRAC abamectin?')==='apa kumpulan IRAC abamectin?'},
    {id:'AI path is explicitly NON_CANONICAL',pass:/NON_CANONICAL/.test(bseTelegramAiSystemPrompt_(true))},
    {id:'AI path has no canonical/domain writer',pass:!/ReviewCore_|Measurement_Log|Observation_Log|Treatment_Log|Inventory_Log|production_write\s*:\s*true/.test(src)},
    {id:'File Search is optional and property-bound',pass:/BSE_AI_FILE_SEARCH_STORE_PROPERTY/.test(bseAiGeminiAnswer_.toString())&&/fileSearchStoreNames/.test(bseAiGeminiAnswer_.toString())},
    {id:'Malaysia pesticide authority boundary preserved',pass:/pendaftaran produk dikawal oleh Lembaga Racun Makhluk Perosak\/Jabatan Pertanian/.test(bseTelegramAiSystemPrompt_(true))&&/Jangan kata produk didaftarkan melalui SISMARP/.test(bseTelegramAiSystemPrompt_(true))&&/IRAC.*BUKAN/.test(bseTelegramAiSystemPrompt_(true))},
    {id:'SISMARP planner extracts explicit crop and pest only',pass:bseAiSismarpPlan_('Adakah abamectin berdaftar untuk peria di Malaysia?').crop.toLowerCase()==='peria'&&bseAiSismarpPlan_('racun apa untuk thrips pada peria?').pest.toLowerCase()==='thrips'&&bseAiSismarpPlan_('racun apa untuk thrips pada peria?').crop.toLowerCase()==='peria'},
    {id:'SISMARP planner handles natural kawalan phrase and ignores active pronoun',pass:(()=>{const p=bseAiSismarpPlan_('Deltamethrin untuk tanaman peria bagi kawalan lalat buah: adakah ada padanan dalam SISMARP semasa, apakah kumpulan IRAC bahan aktif ini, dan nyatakan sumber rujukan?');return p.crop.toLowerCase()==='peria'&&p.pest.toLowerCase()==='lalat buah'&&p.active_ingredient==='';})()},
    {id:'SISMARP current retriever uses HTTPS derived cache and is read-only',pass:/raw\.githubusercontent\.com/.test(BSE_AI_SISMARP_CACHE_URL)&&/CACHE_STALE/.test(bseAiSismarpCurrent_.toString())&&!/appendRow|setValue|setValues/.test(bseAiSismarpCurrent_.toString())},
    {id:'Telegram presentation renders bold headings without visible asterisks',pass:bseTelegramAiToHtml_('**Bahagian 1**\n* item').includes('<b>Bahagian 1</b>')&&!bseTelegramAiToHtml_('**Bahagian 1**\n* item').includes('*')&&bseTelegramAiToHtml_('**Bahagian 1**\n* item').includes('• item')},
    {id:'Telegram AI renders SISMARP current freshness and source details',pass:/SISMARP CURRENT/.test(bseTelegramAiRender_({text:'x',sources:[],source_details:[{title:'DOA',url:'https://doa.gov.my'}],sismarp_current:{available:true,total:1,cache_refreshed_at:'2026-10-14T00:00:00Z',age_days:0,source_url:'http://www.portal.doa.gov.my/sismarp/'}}))&&/Butiran sumber/.test(bseTelegramAiRender_({text:'x',sources:[],source_details:[{title:'DOA',url:'https://doa.gov.my'}]}))},
    {id:'zero SISMARP match is explicitly not general non-registration proof',pass:/0 padanan tidak membuktikan/.test(bseTelegramAiRender_({text:'x',sources:[],source_details:[],sismarp_current:{available:true,total:0,cache_refreshed_at:'2026-10-14T00:00:00Z',age_days:0,source_url:'http://www.portal.doa.gov.my/sismarp/'}}))&&/jangan simpulkan bahan aktif\/produk tidak berdaftar/.test(bseAiGeminiAnswer_.toString())},
    {id:'KB manifest has refresh timestamp and stale policy',pass:/BSE_AI_KB_REFRESHED_AT_PROPERTY/.test(bootstrapBseAiFileSearchTest.toString()+getBseAiKnowledgeBaseStatusTest.toString())&&/ageDays>35/.test(getBseAiKnowledgeBaseStatusTest.toString())&&/rebuildBseAiFileSearchTest/.test(refreshBseAiKnowledgeBaseTest.toString())},
    {id:'Telegram send uses HTML parse mode',pass:/parse_mode:'HTML'/.test(bseTelegramAiSend_.toString())},
    {id:'IRAC classification is code-gated by grounded File Search',pass:/IRAC grounding daripada KB tidak tersedia/.test(bseAiGeminiAnswer_.toString())&&/HANYA File Search KB/.test(bseAiIracGrounded_.toString())},
    {id:'IRAC grounding narrows combined pesticide question to detected active ingredient',pass:(()=>{const q='Deltamethrin untuk tanaman peria bagi kawalan lalat buah: adakah ada padanan dalam SISMARP semasa, apakah kumpulan IRAC bahan aktif ini, dan nyatakan sumber rujukan?',current={query:{active_ingredient:'deltamethrin'}};return bseAiIracGroundingQuestion_(q,current)==='deltamethrin kumpulan IRAC berapa?';})()},
    {id:'IRAC grounding retries transient or missing File Search result without model-knowledge fallback',pass:/retry<2/.test(bseAiIracGroundedReliable_.toString())&&/IRAC_GROUNDING_MISSING/.test(bseAiIracGroundedReliable_.toString())&&!/generateContent|GEMINI_API_KEY/.test(bseAiIracGroundedReliable_.toString())},
    {id:'no question persistence',pass:!/appendRow|setValue|setValues/.test(bseTelegramAiReceive_.toString()+bseAiGeminiAnswer_.toString()+bseAiSismarpCurrent_.toString()+bseAiIracGrounded_.toString())}
  ];
  const bad=tests.filter(t=>!t.pass);if(bad.length)throw new Error('AI harness gagal: '+bad.map(t=>t.id).join(', '));return tests;
}

function runBseAiCurrentSismarpSmokeTest(){
  const question='Abamectin kumpulan IRAC berapa dan adakah ia berdaftar untuk peria di Malaysia?';
  const current=bseAiSismarpCurrent_(question),irac=bseAiIracGroundedReliable_(bseAiIracGroundingQuestion_(question,current)),answer=bseAiGeminiAnswer_(question,current,irac);
  return {current:{available:current&&current.available,total:current&&current.total,query:current&&current.query,cache_refreshed_at:current&&current.cache_refreshed_at,age_days:current&&current.age_days},irac:{available:irac&&irac.available,sources:irac&&irac.sources||[],reason:irac&&irac.reason||''},answer:String(answer.text||'').slice(0,1800),sources:answer.sources,rendered:bseTelegramAiRender_(answer).slice(0,3200),production_write:false};
}
function runBseAiNaturalQuerySmokeTest(){
  const question='Deltamethrin untuk tanaman peria bagi kawalan lalat buah: adakah ada padanan dalam SISMARP semasa, apakah kumpulan IRAC bahan aktif ini, dan nyatakan sumber rujukan?';
  const current=bseAiSismarpCurrent_(question),irac=bseAiIracGroundedReliable_(bseAiIracGroundingQuestion_(question,current)),answer=bseAiGeminiAnswer_(question,current,irac);
  return {current:{available:current&&current.available,total:current&&current.total,query:current&&current.query,cache_refreshed_at:current&&current.cache_refreshed_at},irac:{available:irac&&irac.available,sources:irac&&irac.sources||[],reason:irac&&irac.reason||''},answer:String(answer.text||'').slice(0,1800),sources:answer.sources,rendered:bseTelegramAiRender_(answer).slice(0,3200),production_write:false};
}
function runBseAiKnowledgeBaseSmokeTest(){
  const aq='Abamectin berada dalam kumpulan IRAC berapa? Adakah klasifikasi IRAC sahaja membuktikan bahan itu berdaftar atau disyorkan di Malaysia? Jawab ringkas dan nyatakan batas sumber.',agriculture=bseAiGeminiAnswer_(aq,null,bseAiIracGrounded_(aq));
  const general=bseAiGeminiAnswer_('Apakah ibu negara Jepun? Jawab satu ayat.',null,null);
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
