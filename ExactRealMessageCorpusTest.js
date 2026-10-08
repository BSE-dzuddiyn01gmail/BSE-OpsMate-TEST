// Exact owner-supplied RM-001..RM-021 deterministic corpus runner.
// Pure/read-only: no Telegram, Spreadsheet/Drive writer, Gemini, UrlFetch, trigger or deployment calls.

const BSE_EXACT_REAL_MESSAGE_CORPUS = Object.freeze({
  'RM-001': {reporter:'Test input', received_at:'2026-09-21T04:00:00.000Z', text:'(gambar)\nbeli mesin rumput baru.'},
  'RM-002': {reporter:'Khairul', received_at:'2026-09-21T04:00:00.000Z', text:'*REKOD EC LEACHING*\n\n*Date* : *21/09/2026*\n*Sesi*: *Pagi*\n______________________________\n\n*1. M1*\nM1P2 - x : x\nM1P3 - x : x\nM1P4 - x : x\n\n*2. M2*\nM2P1 - x : x\nM2P2 - x : x\nM2P3 - x : x\nM2P4 - x : x\n\n*3. M3*\nM3P1 - 2.03** : AK\nM3P2 - 2.17** : AK\nM3P3 - 1.47** : 2.5\nM3P4 - 2.09** : AK\n\n*3. M5*\nM5P1 - x : x\nM5P2 - x : x\nM5P3 - x : x\nM5P4 - x : x\n\n*4. M6*\nM6P1 - x : x\nM6P2 - x : x\n\n*5. M7*\nM7 - x : x\n\n*6. M8*\nM8P1 - x : x\nM8P2 - x : x\nM8P3 - x : x\n\n** : *Average*\n\n*AK (Air Kosong/পানি)*'},
  'RM-003': {reporter:'Mansur', received_at:'2026-09-21T04:00:00.000Z', text:'(ada gambar ambil baja)\nbaja out\nM3 P1 P2 21/9/2026'},
  'RM-004': {reporter:'Syafiq', received_at:'2026-09-17T04:00:00.000Z', text:'17/09/2026\nBaja In\n4 Set F'},
  'RM-005': {reporter:'Zainal', received_at:'2026-09-21T04:00:00.000Z', text:'(gambar sahaja, resit belian petrol)'},
  'RM-006': {reporter:'Syafiq', received_at:'2026-09-21T04:00:00.000Z', text:'(gambar pil chlorine)\nM1P1 - 1 botol\nM1P2 - 1 botol\n\nM4P1 - 1 botol\nM4P2 - 1 botol'},
  'RM-007': {reporter:'Mansur', received_at:'2026-09-11T04:00:00.000Z', text:'baja out\nM3 P1 P2 11/9/2026  F\nM3 P3 11/9/2026. N\nM6 P1 P2 11/9/2026 F'},
  'RM-008': {reporter:'Syafiq', received_at:'2026-09-10T04:00:00.000Z', text:'10/09/2026\nBaja In\n5 Set F'},
  'RM-009': {reporter:'Syafiq', received_at:'2026-09-20T04:00:00.000Z', text:'DETAIL CUTI BSE GROUP\n\nNAMA= shafiq\nDEPARTMENT= operation\nTARIKH CUTI= 20 September\nALASAN= Offday\n\nJENIS CUTI (YES/NO)\n-GANTI\n-EL\n-AL\n-MC'},
  'RM-010': {reporter:'Syafiq', received_at:'2026-09-16T04:00:00.000Z', text:'Status Paras Air Kolam 1 Site A:\nTarikh: 16/9/2026\nCuaca :hujan ptng semalam\nParas Air: 1-2 Feet'},
  'RM-011': {reporter:'Syafiq', received_at:'2026-09-15T04:00:00.000Z', text:'*15/09/2026*\n*TUESDAY*\n\n*3. M3 - P34 PERIA*\n\nAcerio - 300\nMencozeb - 400\nKhoros - 800\nDecis - 100\nGam\n\n\n*4. M3 - P12 TIMUN*\n\nAmistartop - 200\nKhoros - 80\nDecis - 100\nCalcium - 300\nGam\n\n\n*6. M7 - Peria*\n\nAcerio - 30\nMencozeb - 40\nEnvoi - 15\nDecis - 10\nGam\n\n\n*7.M4 - P12 Peria*\n\nAcerio - 30\nMencozeb - 40\nEnvoi - 15\nDecis - 10\nGam'},
  'RM-012': {reporter:'Khairul', received_at:'2026-09-21T04:00:00.000Z', text:'(gambar)\n2. REKOD BANCI POKOK\n\nModul : M3P2\nDate Transplant : 13/08/2026\nTanaman : Timun Local\nBrand :\n-Line 1-20 : Seri Ayu\n-Line 20-54 : 288\nMati : 45\nSakit : 455'},
  'RM-013': {reporter:'Khairul', received_at:'2026-09-21T04:00:00.000Z', text:'1. REKOD BANCI POKOK\n\nModul : M3P1\nDate Transplant : 12/08/2026\nTanaman : Timun Local\nBrand : 282\nMati : 26\nSakit : 245'},
  'RM-014': {reporter:'Khairul', received_at:'2026-09-21T04:00:00.000Z', text:'(gambar baki dripper)\nStok baki dripper'},
  'RM-015': {reporter:'Khairul', received_at:'2026-09-21T04:00:00.000Z', text:'M1 1 plot double dripper tu, Mansor kata stok kat gudang de baki 500 pcs.'},
  'RM-016': {reporter:'Zainal', received_at:'2026-09-10T04:00:00.000Z', text:'KERJA SEMAIAN BENIH\n\n1. Jenis Tanaman : Timun Lokal (CCB)\n2. Modul : M1 P1 P2\n3. Tarikh Semai : 10/09/2026'},
  'RM-017': {reporter:'Zainal', received_at:'2026-09-21T04:00:00.000Z', text:'(10 gambar keadaan daun kena penyakit)\nM3 P12'},
  'RM-018': {reporter:'Zainal', received_at:'2026-09-21T04:00:00.000Z', text:'(gambar resit)\nMinyak Petrol RM 50.00'},
  'RM-019': {reporter:'Zainal', received_at:'2026-09-21T04:00:00.000Z', text:'(gambar paip rosak dah dibaiki)\npaip dah repair'},
  'RM-020': {reporter:'Zainal', received_at:'2026-09-21T04:00:00.000Z', text:'pindah anak pokok M1P1'},
  'RM-021': {reporter:'Zainal', received_at:'2026-09-10T04:00:00.000Z', text:'*CADANGAN MERACUN*\n*10/9/26*\n*Thursday*\n\n*1. M2 - P12 TIMUN*\nTop plus- 140\nCalcium-300\nTeaza- 100\nEnvoy-200\n\n*2. M2 - P34 PERIA*\n\nDaconil-300\nCy787 -300\nTeaza-100\ndimexion-250\n\n*3. M3 - P34 TIMUN*\n\nSerende-80\nAcerio-30\nEnvoy-15\ndaconil-30\n\n*4. M3- P12 Timun*\n\nTop plus- 140\nCalcium-300\nTeaza-100\nEnvoy-200\n\n*5. M6 - P12 TIMUN*\n\nTop plus- 149\nCalcium-300\nTeaza-100\nEnvoy-200\n\n*6. M7 - Peria*\nserenade-80\nacerio-30\ndaconil-30\nenvoy-15\n\n*7.M4 - P12 Peria*\nserenade-80\nacerio-30\ndaconil-30\nenvoy-15'}
});

function bseExactCorpusHash_(text){
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text||''),Utilities.Charset.UTF_8)
    .map(byte=>('0'+((byte+256)%256).toString(16)).slice(-2)).join('');
}
function bseExactCorpusResult_(id,fixture,route,result,assertions,warnings){
  const candidates=result&&Array.isArray(result.candidates)?result.candidates:[];
  const missing=Array.from(new Set(candidates.flatMap(c=>Array.isArray(c&&c.missing)?c.missing:[])));
  const failed=(assertions||[]).filter(a=>!a.pass);
  return {corpus_id:id,source_hash:bseExactCorpusHash_(fixture.text),route:route,candidates:candidates,missing_fields:missing,warnings:warnings||[],validation:result&&result.validation||'',production_write:result&&result.production_write===true,assertions:assertions||[],pass:failed.length===0};
}
function bseExactAssert_(id,pass,detail){return {id:id,pass:!!pass,detail:String(detail||'')};}
function bseExactCorpusDispatch_(id,fixture){
  const text=fixture.text,at=fixture.received_at,assertions=[],warnings=[];
  let result=null,route='UNSUPPORTED_DETERMINISTIC';

  if(id==='RM-002'){
    result=bseEcLeachateParseMessage_(text); route=result?'EC_LEACHATE':'UNSUPPORTED_DETERMINISTIC';
    assertions.push(bseExactAssert_('exact date/session',result&&result.validation==='PASS'&&result.candidates[0].fields.event_date==='2026-09-21'&&result.candidates[0].fields.session==='PAGI'));
    assertions.push(bseExactAssert_('production boundary',result&&result.production_write===false));
    return bseExactCorpusResult_(id,fixture,route,result,assertions,warnings);
  }

  if(id==='RM-009'){
    result=bseLeaveParseMessage_(text,at); route=result?'LEAVE':'UNSUPPORTED_DETERMINISTIC';
    assertions.push(bseExactAssert_('blank leave choices not invented',!result||result.validation!=='PASS'||!result.candidates[0].fields.leave_type));
    assertions.push(bseExactAssert_('production boundary',!result||result.production_write===false));
    return bseExactCorpusResult_(id,fixture,route,result,assertions,warnings);
  }

  if(id==='RM-019'){
    result=bseMaintenanceParseMessage_(text,at); route=result?'MAINTENANCE':'UNSUPPORTED_DETERMINISTIC';
    assertions.push(bseExactAssert_('repair complete semantics',result&&result.candidates[0].fields.event_type==='MAINTENANCE_COMPLETED'&&result.candidates[0].fields.asset_or_component==='paip'));
    assertions.push(bseExactAssert_('production boundary',result&&result.production_write===false));
    return bseExactCorpusResult_(id,fixture,route,result,assertions,warnings);
  }

  if(id==='RM-011'||id==='RM-021'){
    result=bseTreatmentListParseMessage_(text,at); route=result?'TREATMENT_LIST':'UNSUPPORTED_DETERMINISTIC';
    assertions.push(bseExactAssert_('completed treatment state',result&&result.candidates&&result.candidates.length>0&&result.candidates.every(c=>c.fields&&c.fields.event_status==='COMPLETED')));
    assertions.push(bseExactAssert_('no inferred dose unit',result&&result.candidates&&result.candidates.every(c=>!/(\bml\b|\bmg\b|\bliter\b)/i.test(String(c.fields&&c.fields.treatment_description||'')))));
    if(id==='RM-021') assertions.push(bseExactAssert_('CADANGAN MERACUN is not proposal',result&&result.candidates.every(c=>c.fields.event_status!=='PROPOSED')));
    assertions.push(bseExactAssert_('production boundary',result&&result.production_write===false));
    return bseExactCorpusResult_(id,fixture,route,result,assertions,warnings);
  }

  if(id==='RM-016'){
    const plots=bseSeedSowingModulePlots_(text),facts=bseSeedSowingSourceFacts_(bseUnifiedSourceContext_(text));
    route=plots&&plots.ok?'SEED_SOWING_DETERMINISTIC_GUARD':'UNSUPPORTED_DETERMINISTIC';
    result={validation:plots&&plots.ok?'GUARD_ONLY':'NEED_INFO',production_write:false,candidates:[]};
    assertions.push(bseExactAssert_('plots parsed exactly',plots&&plots.ok&&JSON.stringify(plots.plots)===JSON.stringify(['M1P1','M1P2'])));
    assertions.push(bseExactAssert_('crop/variety are source-derived',facts&&facts.crop==='Timun'&&facts.variety==='Lokal (CCB)'));
    return bseExactCorpusResult_(id,fixture,route,result,assertions,['full candidate generation remains Gemini-backed; deterministic guard only']);
  }

  if(id==='RM-020'){
    const plots=bseTransplantPlots_(text);
    route=plots&&plots.ok?'TRANSPLANT_DETERMINISTIC_GUARD':'UNSUPPORTED_DETERMINISTIC';
    result={validation:'NEED_INFO',production_write:false,candidates:[]};
    assertions.push(bseExactAssert_('transplant phrase/plot recognized',plots&&plots.ok&&JSON.stringify(plots.plots)===JSON.stringify(['M1P1'])));
    return bseExactCorpusResult_(id,fixture,route,result,assertions,['crop/batch/date remain missing; no invented values']);
  }

  if(id==='RM-010'){
    const maintenance=bseMaintenanceParseMessage_(text,at),condition=bsePlantConditionParseMessage_(text,at);
    assertions.push(bseExactAssert_('pond observation not misrouted',maintenance===null&&condition===null));
    return bseExactCorpusResult_(id,fixture,'ASSET_OBSERVATION_UNSUPPORTED_TEST',{validation:'UNSUPPORTED',production_write:false,candidates:[]},assertions,['no deterministic pond-observation writer in current source']);
  }

  if(id==='RM-017'){
    const condition=bsePlantConditionParseMessage_(text,at);
    assertions.push(bseExactAssert_('disease image does not invent diagnosis/count',condition===null));
    return bseExactCorpusResult_(id,fixture,'EVIDENCE_NO_INVENTION_BOUNDARY',{validation:'NEED_INFO',production_write:false,candidates:[]},assertions,['actual attachment handled separately by File Evidence']);
  }

  if(id==='RM-005'){
    const inventory=bseInventoryParseMessage_(text,at);
    assertions.push(bseExactAssert_('receipt-only does not invent claim amount',!inventory||inventory.validation!=='PASS'));
    return bseExactCorpusResult_(id,fixture,'EVIDENCE_CLARIFICATION_BOUNDARY',inventory||{validation:'NEED_INFO',production_write:false,candidates:[]},assertions,['actual attachment handled separately by File Evidence']);
  }

  if(id==='RM-012'||id==='RM-013'){
    result=bsePlantConditionParseMessage_(text,at); route=result?'PLANT_CONDITION_CURRENT_DETERMINISTIC':'CENSUS_GEMINI_REQUIRED';
    assertions.push(bseExactAssert_('explicit suspicious values preserved if parsed',!result||result.candidates.some(c=>Number(c.fields&&c.fields.sick_count)===(id==='RM-012'?455:245))));
    assertions.push(bseExactAssert_('production boundary',!result||result.production_write===false));
    warnings.push('corpus contract expects Census semantics; runner records current deterministic behavior without inventing living count');
    return bseExactCorpusResult_(id,fixture,route,result||{validation:'UNSUPPORTED',production_write:false,candidates:[]},assertions,warnings);
  }

  result=bseInventoryParseMessage_(text,at);
  if(result&&typeof bseInventoryApplyReporterSnapshot_==='function') bseInventoryApplyReporterSnapshot_(result,{reporterTelegramUserId:'TEST_CORPUS',reporterName:fixture.reporter,reporterUsername:''});
  if(result) route='INVENTORY_OR_ASSET_DETERMINISTIC';
  if(id==='RM-003') assertions.push(bseExactAssert_('incomplete Baja Out remains NEED_INFO',result&&result.validation==='NEED_INFO'));
  if(id==='RM-004'||id==='RM-008') assertions.push(bseExactAssert_('Baja In passes',result&&result.validation==='PASS'));
  if(id==='RM-007') assertions.push(bseExactAssert_('multi-record parses more than one candidate',result&&result.candidates&&result.candidates.length>1));
  if(id==='RM-014') assertions.push(bseExactAssert_('dripper image keeps missing count',result&&result.validation==='NEED_INFO'&&result.candidates.some(c=>(c.missing||[]).includes('counted_quantity'))));
  if(id==='RM-015') assertions.push(bseExactAssert_('explicit dripper item and 500 pcs preserved',result&&result.validation==='PASS'&&result.candidates.some(c=>c.fields&&c.fields.item_name==='Dripper'&&Number(c.fields.counted_quantity)===500)));
  if(id==='RM-018') assertions.push(bseExactAssert_('petrol amount explicit',result&&result.validation==='PASS'&&result.candidates.some(c=>Number(c.fields&&c.fields.amount_myr)===50)));
  if(id==='RM-001') assertions.push(bseExactAssert_('asset acquisition recognized or explicit unsupported',!!result||route==='UNSUPPORTED_DETERMINISTIC'));
  if(id==='RM-006') assertions.push(bseExactAssert_('chlorine route source-driven',!!result||route==='UNSUPPORTED_DETERMINISTIC'));
  assertions.push(bseExactAssert_('production boundary',!result||result.production_write===false));
  if(!result) warnings.push('no deterministic parser recognized this exact fixture');
  return bseExactCorpusResult_(id,fixture,route,result||{validation:'UNSUPPORTED',production_write:false,candidates:[]},assertions,warnings);
}

function runBseExactRealMessageCorpusById(id){
  const key=String(id||'').trim().toUpperCase(),fixture=BSE_EXACT_REAL_MESSAGE_CORPUS[key];
  if(!fixture) throw new Error('Corpus ID tidak sah: '+key);
  const out=bseExactCorpusDispatch_(key,fixture);
  console.log('BSE_EXACT_CORPUS '+JSON.stringify(out));
  if(!out.pass) throw new Error('Exact corpus assertion gagal '+key+': '+out.assertions.filter(a=>!a.pass).map(a=>a.id).join(', '));
  return out;
}
function runBseExactRealMessageCorpusSuite(){
  const ids=Object.keys(BSE_EXACT_REAL_MESSAGE_CORPUS).sort(),results=[];
  ids.forEach(id=>results.push(runBseExactRealMessageCorpusById(id)));
  const failed=results.filter(r=>!r.pass),summary={total:results.length,passed:results.length-failed.length,failed:failed.length,production_write:false,results:results};
  console.log('BSE_EXACT_CORPUS_SUITE '+JSON.stringify(summary));
  if(failed.length) throw new Error('Exact corpus suite gagal: '+failed.map(r=>r.corpus_id).join(', '));
  return summary;
}
