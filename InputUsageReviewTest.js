/** @OnlyCurrentDoc */
// Canonical farm Input_Usage_Log -> derived inventory movement boundary.
// Input usage remains the authoritative farm fact. Inventory receives a derived
// INVENTORY_OUT movement tagged USAGE_CONSUMPTION; it is not the canonical source.

const BSE_INPUT_USAGE_LOG_HEADERS=[
  'source_key','queue_update_id','candidate_index','event_date','plot_id','item_name',
  'quantity','unit','verification_status','original_note','inventory_source_key',
  'inventory_event_id','confirmed_at','reviewer','payload_hash'
];
const BSE_INPUT_USAGE_REVIEW_HEADERS=[
  'review_id','source_key','queue_update_id','candidate_index','target','payload_hash',
  'decision','reviewer','review_note','reviewed_at','queue_status_before',
  'inventory_source_key','inventory_event_id','candidate_json'
];

function bseInputUsageSheet_(book,name,headers){
  let sheet=book.getSheetByName(name);
  if(!sheet)sheet=book.insertSheet(name);
  if(!sheet.getLastRow()){
    if(sheet.getMaxColumns()<headers.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),headers.length-sheet.getMaxColumns());
    sheet.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  const actual=sheet.getRange(1,1,1,headers.length).getValues()[0].map(String);
  if(actual.join('|')!==headers.join('|'))throw new Error('Header '+name+' tidak sepadan.');
  return sheet;
}
function bseInputUsageRows_(sheet,width){
  return sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues():[];
}
function bseInputUsageCell_(value){
  return typeof value==='string'&&/^\s*[=+@-]/.test(value)?"'"+value:value;
}
function bseInputUsageAppend_(sheet,values){
  const row=sheet.getLastRow()+1;
  if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),row-sheet.getMaxRows());
  sheet.getRange(row,1,1,values.length).setNumberFormat('@').setValues([values.map(bseInputUsageCell_)]).setWrap(true);
}
function bseInputUsageCandidate_(result){
  if(!result||result.production_write!==false||result.validation!=='PASS'||!Array.isArray(result.candidates))throw new Error('Hasil Input Usage bukan calon TEST PASS.');
  const matches=result.candidates.filter(c=>c&&c.target==='Input_Usage_Log');
  if(matches.length!==1)throw new Error('Mesti ada tepat satu Input_Usage_Log untuk tindakan ini.');
  const candidate=matches[0],f=candidate.fields||{};
  if(candidate.validation!=='PASS'||!Array.isArray(candidate.missing)||candidate.missing.length)throw new Error('Input Usage belum lengkap.');
  if(f.record_type!=='INPUT_USAGE')throw new Error('record_type Input Usage tidak sah.');
  ['event_date','item_name','unit'].forEach(k=>{if(!String(f[k]||'').trim())throw new Error('Medan wajib Input Usage tidak lengkap: '+k);});
  const qty=bseInventoryValidateQuantity_(f.quantity,f.unit);
  if(!qty.ok)throw new Error('quantity/unit Input Usage tidak sah.');
  return candidate;
}
function bseInputUsageSourceKey_(reference,candidate){
  return String(reference)+'|Input_Usage_Log|'+bseApprovalHash_(candidate).slice(0,12);
}
function bseInputUsageToInventoryOut_(reference,candidate,usageSourceKey){
  const f=candidate.fields||{},qty=bseInventoryValidateQuantity_(f.quantity,f.unit);
  if(!qty.ok)throw new Error('Input Usage tidak boleh dipetakan ke inventory.');
  return {
    domain:'INVENTORY_OUT',
    source_key:String(usageSourceKey)+'|INVENTORY_OUT',
    production_write:false,
    original_note:String(f.original_note||''),
    item_name:String(f.item_name||''),
    quantity:qty.quantity,
    unit:qty.unit,
    event_date:String(f.event_date||''),
    destination:String(f.plot_id||''),
    movement_type:'USAGE_CONSUMPTION',
    router_confidence:'DERIVED_FROM_INPUT_USAGE',
    usage_source_key:String(usageSourceKey),
    derivation_type:'USAGE_CONSUMPTION'
  };
}
function bseInputUsageReviewCore_(book,reviewContext){
  const context=bseReviewContextValidate_(reviewContext);
  if(context.action!=='APPROVED')throw new Error('Input Usage hanya direkod selepas Benar penghantar.');
  const candidate=bseInputUsageCandidate_(context.proposalResult),f=candidate.fields||{};
  const payloadHash=bseApprovalHash_(candidate),sourceKey=bseInputUsageSourceKey_(context.reference,candidate);
  const inventoryProposal=bseInputUsageToInventoryOut_(context.reference,candidate,sourceKey);
  const log=bseInputUsageSheet_(book,'TEST_INPUT_USAGE_LOG',BSE_INPUT_USAGE_LOG_HEADERS);
  const review=bseInputUsageSheet_(book,'TEST_INPUT_USAGE_REVIEW',BSE_INPUT_USAGE_REVIEW_HEADERS);
  const logs=bseInputUsageRows_(log,BSE_INPUT_USAGE_LOG_HEADERS.length),reviews=bseInputUsageRows_(review,BSE_INPUT_USAGE_REVIEW_HEADERS.length);
  const priorLog=logs.find(r=>String(r[0])===sourceKey),priorReview=reviews.find(r=>String(r[1])===sourceKey);

  if(priorReview){
    if(String(priorReview[5])!==payloadHash||String(priorReview[6])!=='APPROVED')throw new Error('Konflik audit Input Usage sedia ada.');
    if(!priorLog||String(priorLog[14])!==payloadHash)throw new Error('Audit Input Usage tidak sepadan dengan log.');
  }

  // Derived inventory write is separately idempotent and must not own queue state.
  const inventoryContext=Object.assign({},context,{
    proposal:inventoryProposal,
    suppress_queue_status:true
  });
  const inventoryOutcome=bseInventoryReviewCore_(book,inventoryContext);
  if(!inventoryOutcome||inventoryOutcome.validation!=='PASS'||inventoryOutcome.decision!=='APPROVED'||inventoryOutcome.production_write!==false){
    throw new Error('Derived inventory write gagal; canonical Input Usage belum ditutup.');
  }

  if(priorReview){
    if(String(priorReview[11])!==String(inventoryProposal.source_key)||String(priorReview[12])!==String(inventoryOutcome.event_id||''))throw new Error('Lineage Input Usage ke inventory bercanggah.');
    return {source_key:sourceKey,payload_hash:payloadHash,inventory_source_key:inventoryProposal.source_key,inventory_event_id:inventoryOutcome.event_id,duplicate:true,production_write:false};
  }

  const stamp=new Date().toISOString(),reviewer=String(context.actor_name||context.actor_id||'TEST_OPERATOR'),candidateIndex=Number.isInteger(context.candidate_index)?context.candidate_index:0;
  if(priorLog){
    if(String(priorLog[14])!==payloadHash)throw new Error('PARTIAL_WRITE_CONFLICT: canonical Input Usage hash berbeza.');
    // Recover missing review after derived inventory idempotently verified.
    bseInputUsageAppend_(review,[Utilities.getUuid(),sourceKey,String(context.reference).replace(/^BSE-TG-/,''),candidateIndex,'Input_Usage_Log',payloadHash,'APPROVED',reviewer,'RECOVERED_REVIEW_AFTER_PARTIAL_WRITE',stamp,'NEEDS_HUMAN_REVIEW',inventoryProposal.source_key,String(inventoryOutcome.event_id||''),JSON.stringify(candidate)]);
    SpreadsheetApp.flush();
    return {source_key:sourceKey,payload_hash:payloadHash,inventory_source_key:inventoryProposal.source_key,inventory_event_id:inventoryOutcome.event_id,recovered:true,production_write:false};
  }

  bseInputUsageAppend_(log,[sourceKey,String(context.reference).replace(/^BSE-TG-/,''),candidateIndex,String(f.event_date||''),String(f.plot_id||''),String(f.item_name||''),f.quantity,String(f.unit||''),String(f.verification_status||'PROVISIONAL'),String(f.original_note||''),inventoryProposal.source_key,String(inventoryOutcome.event_id||''),stamp,reviewer,payloadHash]);
  SpreadsheetApp.flush();
  bseInputUsageAppend_(review,[Utilities.getUuid(),sourceKey,String(context.reference).replace(/^BSE-TG-/,''),candidateIndex,'Input_Usage_Log',payloadHash,'APPROVED',reviewer,'',stamp,'NEEDS_HUMAN_REVIEW',inventoryProposal.source_key,String(inventoryOutcome.event_id||''),JSON.stringify(candidate)]);
  SpreadsheetApp.flush();
  return {source_key:sourceKey,payload_hash:payloadHash,inventory_source_key:inventoryProposal.source_key,inventory_event_id:inventoryOutcome.event_id,duplicate:false,production_write:false};
}
function bseInputUsageConfirmedSummaryFromRows_(reference,rows){
  const row=(rows||[])[(rows||[]).length-1];if(!row)return '';
  const lines=['PENGGUNAAN INPUT','Rujukan : '+String(reference||''),'Tarikh : '+bseApprovalDisplayDate_(String(row[3]||''))];
  if(String(row[4]||'').trim())lines.push('Plot : '+String(row[4]));
  lines.push('Item : '+String(row[5]||''),'Digunakan : '+String(row[6]||'')+' '+String(row[7]||''),'Pergerakan stok : INVENTORY_OUT / USAGE_CONSUMPTION','Status : REPORTER_CONFIRMED','Mod TEST - tiada rekod production ditulis.');
  return lines.join('\n');
}
function bseInputUsageConfirmedSummary_(book,reference,outcome){
  const key=String(outcome&&outcome.source_key||'');if(!key)return '';
  const rows=bseInputUsageRows_(bseInputUsageSheet_(book,'TEST_INPUT_USAGE_LOG',BSE_INPUT_USAGE_LOG_HEADERS),BSE_INPUT_USAGE_LOG_HEADERS.length).filter(r=>String(r[0])===key);
  return bseInputUsageConfirmedSummaryFromRows_(reference,rows);
}

function bseChlorineUsageDate_(header,receivedAt){
  const m=String(header||'').match(/\((\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})\)\s*$/);
  if(!m)return bseInventoryMalaysiaDate_(receivedAt);
  const day=Number(m[1]),month=Number(m[2]),year=Number(m[3].length===2?'20'+m[3]:m[3]),d=new Date(Date.UTC(year,month-1,day));
  return year===2026&&d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day?year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'):'';
}
function bseChlorineUsageParseMessage_(text,receivedAt){
  const context=typeof bseUnifiedSourceContext_==='function'?bseUnifiedSourceContext_(text):{original:String(text||''),provenance:String(text||'')};
  const source=String(context.original||'').trim(),provenance=String(context.provenance||source);
  if(!source)return null;
  const lines=source.split(/\r?\n/).map(line=>line.trim()).filter(Boolean),header=lines[0]||'';
  if(!/\bchlorine\b/i.test(header)||/\bM[1-9]\d*P[1-9]\d*\b/i.test(header)||lines.length<2)return null;
  const eventDate=bseChlorineUsageDate_(header,receivedAt);if(!eventDate)return null;
  const rows=[],seen=new Set();
  for(const line of lines.slice(1)){
    const m=line.match(/^-?\s*(M[1-9]\d*P[1-9]\d*)\s*-\s*(\d+(?:[.,]\d+)?)\s*botol(?:\s*=\s*(\d+(?:[.,]\d+)?)\s*tong\s+biru)?\s*$/i);
    if(!m)return null;
    const plot=String(m[1]).toUpperCase(),quantity=Number(String(m[2]).replace(',','.'));
    if(!Number.isFinite(quantity)||quantity<=0||seen.has(plot))return null;
    seen.add(plot);rows.push({plot_id:plot,quantity:quantity});
  }
  if(!rows.length)return null;
  const candidates=rows.map(row=>({target:'Input_Usage_Log',validation:'PASS',missing:[],fields:{project_id:'BSE_SB',system_year:2026,event_date:eventDate,record_type:'INPUT_USAGE',verification_status:'PROVISIONAL',original_note:provenance,plot_id:row.plot_id,item_name:'Chlorine Tablets',quantity:row.quantity,unit:'botol'}}));
  return {validation:'PASS',production_write:false,candidates:candidates};
}
function runBseInputUsageInventoryMappingHarnessTests(){
  const note='17/9/2026 M2P3 pagi tadi selesai spray Abamectin. Jumlah sebenar Abamectin digunakan 100 ml. Kelulusan Manager belum disahkan.';
  const chlorineOld=bseChlorineUsageParseMessage_('(gambar pil chlorine)\nM1P1 - 1 botol\nM1P2 - 1 botol\n\nM4P1 - 1 botol\nM4P2 - 1 botol','2026-09-21T04:00:00.000Z');
  const chlorineLiveText='Chlorine Tablets (15/10/26)\n- M3P3 - 2 Botol=2 tong biru\n- M3P4 - 2 Botol=2 tong biru',chlorineLive=bseChlorineUsageParseMessage_(chlorineLiveText,'2026-10-15T00:00:00.000Z'),chlorineGuarded=chlorineLive?bseUnifiedGuard_(JSON.parse(JSON.stringify(chlorineLive)),{received_at:'2026-10-15T00:00:00.000Z'}):null;
  const result={validation:'PASS',production_write:false,candidates:[{target:'Input_Usage_Log',validation:'PASS',missing:[],fields:{project_id:'BSE_SB',system_year:2026,event_date:'2026-09-17',record_type:'INPUT_USAGE',verification_status:'PROVISIONAL',original_note:note,plot_id:'M2P3',item_name:'Abamectin',quantity:100,unit:'ml'}}]};
  const candidate=bseInputUsageCandidate_(result),sourceKey=bseInputUsageSourceKey_('BSE-TG-1',candidate),mapped=bseInputUsageToInventoryOut_('BSE-TG-1',candidate,sourceKey);
  const core=bseInputUsageReviewCore_.toString(),inventory=bseInventoryReviewCore_.toString();
  const tests=[
    {id:'Input Usage remains canonical farm record',pass:candidate.target==='Input_Usage_Log'&&candidate.fields.record_type==='INPUT_USAGE'},
    {id:'mapper emits inventory OUT only',pass:mapped.domain==='INVENTORY_OUT'&&mapped.movement_type==='USAGE_CONSUMPTION'&&mapped.quantity===100&&mapped.unit==='ml'&&mapped.destination==='M2P3'},
    {id:'derived inventory carries canonical lineage',pass:mapped.usage_source_key===sourceKey&&mapped.source_key===sourceKey+'|INVENTORY_OUT'&&mapped.derivation_type==='USAGE_CONSUMPTION'},
    {id:'mapper never enables production write',pass:mapped.production_write===false},
    {id:'Input Usage core writes canonical log and invokes inventory derivation',pass:/TEST_INPUT_USAGE_LOG/.test(core)&&/bseInputUsageToInventoryOut_/.test(core)&&/bseInventoryReviewCore_/.test(core)},
    {id:'derived inventory cannot own aggregate Telegram queue status',pass:/suppress_queue_status:true/.test(core)&&/suppress_queue_status/.test(inventory)},
    {id:'approval domain uses dedicated Input Usage boundary',pass:bseApprovalDomain_(result).core===bseInputUsageReviewCore_},
    {id:'legacy chlorine corpus becomes deterministic per-plot Input Usage',pass:chlorineOld&&chlorineOld.validation==='PASS'&&chlorineOld.candidates.length===4&&chlorineOld.candidates.every(c=>c.target==='Input_Usage_Log'&&c.fields.quantity===1&&c.fields.unit==='botol'&&c.fields.event_date==='2026-09-21')&&chlorineOld.candidates.map(c=>c.fields.plot_id).join('|')==='M1P1|M1P2|M4P1|M4P2'},
    {id:'live chlorine format preserves explicit date bottles and plots',pass:chlorineLive&&chlorineLive.validation==='PASS'&&chlorineLive.candidates.length===2&&chlorineLive.candidates.every(c=>c.fields.item_name==='Chlorine Tablets'&&c.fields.quantity===2&&c.fields.unit==='botol'&&c.fields.event_date==='2026-10-15'&&/2 Botol=2 tong biru/.test(c.fields.original_note))&&chlorineLive.candidates.map(c=>c.fields.plot_id).join('|')==='M3P3|M3P4'},
    {id:'chlorine candidates survive unified guard without crop inference',pass:chlorineGuarded&&chlorineGuarded.validation==='PASS'&&chlorineGuarded.candidates.length===2&&chlorineGuarded.candidates.every(c=>c.target==='Input_Usage_Log'&&c.validation==='PASS'&&!c.missing.length&&!Object.prototype.hasOwnProperty.call(c.fields,'crop'))},
    {id:'chlorine parser fails closed on duplicate plot or unrelated stock text',pass:bseChlorineUsageParseMessage_('Chlorine Tablets (15/10/26)\nM3P3 - 2 botol\nM3P3 - 2 botol','2026-10-15T00:00:00.000Z')===null&&bseChlorineUsageParseMessage_('Chlorine stok 2 botol','2026-10-15T00:00:00.000Z')===null}
  ];
  const failures=tests.filter(t=>!t.pass);if(failures.length)throw new Error('Input Usage mapping harness gagal: '+failures.map(t=>t.id).join(', '));return tests;
}
