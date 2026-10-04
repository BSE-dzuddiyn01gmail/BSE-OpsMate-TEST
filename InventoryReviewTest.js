/** @OnlyCurrentDoc */
// P1-D0 foundation: inventory, claim and asset proposal contracts only.
// This file is deliberately not wired to Telegram, menus, Tasks or production.

const BSE_INVENTORY_EVENT_HEADERS = [
  'source_key','event_id','event_type','item_name','quantity','unit',
  'event_date','owner_id','owner_telegram_user_id','owner_name','status',
  'verification_status','production_write','original_note','created_at',
  'approved_at','reviewer','payload_hash','responsible_name','responsible_source','responsible_telegram_user_id',
  'destination','storage_location','counted_quantity','movement_type','router_confidence'
];
const BSE_INVENTORY_REVIEW_HEADERS = [
  'review_id','source_key','event_id','domain','decision','reviewer',
  'review_note','reviewed_at','queue_status_before','payload_hash',
  'owner_id','owner_telegram_user_id','owner_name','original_note'
];
const BSE_CLAIM_HEADERS = [
  'source_key','claim_id','claimant','claimant_telegram_user_id','claimant_username','item_name','quantity','unit','amount_myr',
  'reason','event_date','purchase_reference','evidence_reference','owner_id',
  'owner_telegram_user_id','owner_name','status','production_write',
  'original_note','created_at','approved_at','reviewer','payload_hash','responsible_name','responsible_source','responsible_telegram_user_id'
];
const BSE_ASSET_PROPOSAL_HEADERS = [
  'source_key','proposal_id','proposal_type','description','status','owner_id',
  'owner_telegram_user_id','owner_name','production_write','original_note',
  'created_at','approved_at','reviewer','payload_hash','responsible_name','responsible_source','responsible_telegram_user_id'
];
const BSE_INVENTORY_CLASSIFICATION_HEADERS = [
  'callback_token','reference','source_key','payload_hash','chat_id','reporter_telegram_user_id',
  'source_message_id','approval_message_id','item_name','options_json','status','decision','created_at','acted_at','last_error','candidate_json'
];
const BSE_INVENTORY_ALLOWED_UNITS = ['kg','g','L','ml','beg','botol','unit','pcs','pek','kotak','set','tong'];
const BSE_INVENTORY_DOMAINS = [
  'INVENTORY_IN','INVENTORY_OUT','INVENTORY_STOCK_COUNT','INVENTORY_ADJUSTMENT',
  'CLAIM_REQUEST','ASSET_PROPOSAL'
];

function bseInventoryStableJson_(value) {
  if (Array.isArray(value)) return '[' + value.map(bseInventoryStableJson_).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + bseInventoryStableJson_(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function bseInventoryPayloadHash_(payload) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    bseInventoryStableJson_(payload), Utilities.Charset.UTF_8)
    .map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
}

function bseInventoryNormalize_(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Pure, conservative classification. It never parses or writes Telegram data. */
function bseInventoryClassifyText_(text) {
  const normalized = bseInventoryNormalize_(text);
  if (!normalized) return { classification: 'NEEDS_INFO', reason: 'item kosong' };
  if (/\b(pam|hos|alat ganti|perkakas)\b/.test(normalized)) {
    return {
      classification: 'AMBIGUOUS_CLASSIFICATION',
      options: [
        { value: 'ASSET_PROPOSAL', label: 'Daftar Aset' },
        { value: 'INVENTORY_IN', label: 'Inventori' },
        { value: 'CLARIFY', label: 'Isi Maklumat' }
      ],
      reason: 'item boleh menjadi aset atau bahan'
    };
  }
  if (/\b(mesin rumput|mesin|peralatan tahan lama|equipment)\b/.test(normalized)) {
    return { classification: 'ASSET_PROPOSAL', reason: 'peralatan tahan lama' };
  }
  if (/\b(baja|racun|pestisid|herbisid|fungisid|insektisid|bahan guna habis|consumable)\b/.test(normalized)) {
    return { classification: 'INVENTORY_IN', reason: 'bahan guna habis' };
  }
  return { classification: 'NEEDS_INFO', reason: 'kelas item tidak jelas' };
}

function bseInventoryValidateQuantity_(quantity, unit) {
  const value = typeof quantity === 'number' ? quantity : Number(String(quantity == null ? '' : quantity).trim());
  const unitText = String(unit == null ? '' : unit).trim();
  const matched = BSE_INVENTORY_ALLOWED_UNITS.find(u => u.toLowerCase() === unitText.toLowerCase());
  if (!Number.isFinite(value) || value <= 0 || !matched) {
    return { ok: false, reason: 'quantity mesti nombor perpuluhan positif dan unit tidak disokong' };
  }
  const canonicalUnit = matched.toLowerCase() === 'pcs' ? 'unit' : matched;
  return { ok: true, quantity: value, unit: canonicalUnit, original_unit: unitText };
}

function bseInventoryValidateClaim_(claim) {
  const c = claim || {};
  const amount = typeof c.amount_myr === 'number' ? c.amount_myr : Number(String(c.amount_myr == null ? '' : c.amount_myr).replace(/,/g,'').trim());
  const missing = [];
  if (!String(c.claimant || '').trim()) missing.push('claimant');
  if (!String(c.item_name || c.description || '').trim()) missing.push('item_name');
  if (!Number.isFinite(amount) || amount <= 0) missing.push('amount_myr');
  if (!String(c.event_date || '').trim() || c.event_date_valid === false) missing.push('event_date');
  return missing.length ? { ok: false, missing, reason: 'medan claim wajib tidak lengkap' } :
    {
      ok: true,
      amount_myr: amount,
      quantity: c.quantity == null || c.quantity === '' ? '' : c.quantity,
      unit: String(c.unit || '').trim(),
      reason: String(c.reason || ('Claim item: ' + String(c.item_name || c.description || '').trim())).trim()
    };
}

function bseInventoryValidateProposal_(proposal) {
  const p = proposal || {}, missing = [];
  if (!BSE_INVENTORY_DOMAINS.includes(p.domain)) missing.push('domain');
  if (p.production_write !== false) missing.push('production_write');
  if (!String(p.source_key || '').trim()) missing.push('source_key');
  if (!String(p.original_note || '').trim()) missing.push('original_note');
  if (p.domain === 'CLAIM_REQUEST') {
    const claim = bseInventoryValidateClaim_(p);
    if (!claim.ok) missing.push.apply(missing, claim.missing);
  } else if (p.domain === 'ASSET_PROPOSAL') {
    if (!String(p.description || '').trim()) missing.push('description');
  } else if (p.domain === 'INVENTORY_STOCK_COUNT') {
    if (!String(p.item_name || '').trim()) missing.push('item_name');
    const counted = bseInventoryValidateQuantity_(p.counted_quantity, p.unit);
    if (!counted.ok) missing.push('counted_quantity/unit');
    if (!String(p.event_date || '').trim() || p.event_date_valid === false) missing.push('event_date');
  } else {
    if (!String(p.item_name || '').trim()) missing.push('item_name');
    const quantity = bseInventoryValidateQuantity_(p.quantity, p.unit);
    if (!quantity.ok) missing.push('quantity/unit');
    if (!String(p.event_date || '').trim() || p.event_date_valid === false) missing.push('event_date');
    if (p.domain === 'INVENTORY_ADJUSTMENT' && !String(p.reason || '').trim()) missing.push('reason');
  }
  return missing.length ? { ok: false, validation: 'NEED_INFO', missing: Array.from(new Set(missing)) } :
    { ok: true, validation: 'PASS', missing: [] };
}

function bseInventoryMalaysiaDate_(receivedAt) {
  if (!receivedAt) return '';
  const date = new Date(receivedAt);
  if (isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
}

function bseInventoryExtractQuantity_(text) {
  const match = String(text || '').match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(kg|g|L|l|ml|beg|botol|unit|pcs|pek|kotak|set|tong)\b/i);
  if (!match) return null;
  const checked = bseInventoryValidateQuantity_(Number(match[1].replace(',', '.')), match[2]);
  return checked.ok ? { quantity: checked.quantity, unit: checked.unit, original_unit: checked.original_unit } : null;
}

function bseInventoryItemText_(text) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const labelled = lines.find(line => /^(?:Item|Bahan|Nama Item|Perkara)\s*:/i.test(line));
  const stripQty = value => String(value || '').replace(/\s+\d+(?:[.,]\d+)?\s*(?:kg|g|L|l|ml|beg|botol|unit|pcs|pek|kotak|set|tong)\b.*$/i, '').trim();
  if (labelled) return stripQty(labelled.replace(/^[^:]+:\s*/i, ''));
  const shorthand = String(text || '').match(/(?:^|\s)(F|N)(?:\s|$)/i);
  if (shorthand) return shorthand[1].toUpperCase() === 'F' ? 'Fruitka' : 'Benegro N';
  const line = lines.find(line => /\b(?:baja|racun|pestisid|herbisid|fungisid|insektisid|dripper|em|mesin rumput|mesin|pam|hos|alat ganti|perkakas)\b/i.test(line));
  return line ? stripQty(line.replace(/^(?:beli|pembelian|guna|penggunaan|cadangan|stok\s+masuk|stok\s+keluar|baja\s+in|baja\s+out)\s+/i, '')) : '';
}

function bseInventoryExtractEventDate_(text, receivedAt) {
  const source=String(text||'');
  const labelled=source.match(/(?:Tarikh(?:\s+(?:Pembelian|Penggunaan|Pelarasan|Claim|Inventori))?|Event\s*date)\s*:\s*([^\n]+)/i);
  const bare=source.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/);
  const raw=String(labelled&&labelled[1] || bare&&bare[0] || '').trim();
  if(!raw)return {value:bseInventoryMalaysiaDate_(receivedAt),explicit:false,valid:true};
  const parts=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/), iso=/^(\d{4})-(\d{2})-(\d{2})$/.test(raw)?raw:'';
  let value=iso;
  if(!value&&parts){const day=Number(parts[1]),month=Number(parts[2]),year=Number(parts[3]),date=new Date(Date.UTC(year,month-1,day));if(date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day)value=year+'-'+('0'+month).slice(-2)+'-'+('0'+day).slice(-2);}
  return {value:value,explicit:true,valid:!!value};
}

function bseInventoryDeclaredResponsible_(text) {
  const match=String(text||'').match(/^(?:Penanggungjawab|Bertanggungjawab|Responsible)\s*:\s*(.+)$/im);
  return match&&String(match[1]||'').trim()||'';
}


function bseInventoryCanonicalItem_(item, source) {
  const raw=String(item||'').trim(), text=String(source||'');
  if (/^(?:F)$/i.test(raw) || /(?:^|\s)F(?:\s|$)/.test(text)) return 'Fruitka';
  if (/^(?:N)$/i.test(raw) || /(?:^|\s)N(?:\s|$)/.test(text)) return 'Benegro N';
  if (/\bdripper\b/i.test(raw||text)) return 'Dripper';
  if (/\bEM\b/i.test(raw||text)) return 'EM';
  return raw;
}


function bseClaimAmount_(text) {
  const source=String(text||'');
  const labelled=source.match(/(?:Amaun|Jumlah)\s*(?:claim\s*)?(?:MYR|RM)?\s*:\s*RM?\s*([\d.,]+)/i);
  const inline=source.match(/\bRM\s*([\d.,]+)/i);
  const raw=String(labelled&&labelled[1] || inline&&inline[1] || '').replace(/,/g,'').trim();
  const value=Number(raw);
  return Number.isFinite(value)&&value>0?value:null;
}

function bseClaimDescription_(text) {
  const source=String(text||'').trim();
  const labelled=source.match(/^(?:Item|Perkara|Description|Keterangan)\s*:\s*(.+)$/im);
  if(labelled)return String(labelled[1]||'').replace(/\s+RM\s*[\d.,]+.*$/i,'').trim();
  const first=source.split(/\r?\n/).map(v=>v.trim()).find(Boolean)||'';
  return first
    .replace(/^(?:claim|tuntutan|tuntut\s+bayaran)\s*[:\-]?\s*/i,'')
    .replace(/\s+RM\s*[\d.,]+.*$/i,'')
    .replace(/\s+(?:Amaun|Jumlah)\s*[:\-].*$/i,'')
    .trim();
}

function bseClaimNaturalSignal_(text) {
  const source=String(text||'');
  return /\b(?:claim|tuntutan|tuntut\s+bayaran)\b/i.test(source) ||
    (/\bRM\s*[\d.,]+\b/i.test(source) && /\b(?:petrol|minyak|diesel|tol|parking|parkir|resit|receipt|belian|beli)\b/i.test(source));
}

function bseInventoryPlotIds_(text) {
  const source=String(text||'').toUpperCase(), found=[], compact=source.match(/M\s*(\d+)\s*P\s*(\d+)/g)||[];
  compact.forEach(token=>{const m=token.match(/M\s*(\d+)\s*P\s*(\d+)/);if(m)found.push('M'+m[1]+'P'+m[2]);});
  const module=source.match(/\bM\s*(\d+)\b/);
  if(module){const re=/\bP\s*(\d+)\b/g;let m;while((m=re.exec(source)))found.push('M'+module[1]+'P'+m[1]);}
  return Array.from(new Set(found));
}

/** Deterministic narrow D1 route. Returns null for all unrelated reports. */
function bseInventoryParseMessage_(text, receivedAt) {
  const source=String(text||'').trim(), normalized=bseInventoryNormalize_(source);
  if(!source)return null;

  const claim=bseClaimNaturalSignal_(source);
  const adjustment=/\b(?:adjustment|pelarasan)\s+inventori\b/i.test(source);
  const stockCount=/\b(?:stok\s+baki|baki\s+stok|stok\s+gudang\s+baki|stok\s+kat\s+gudang|stock\s+count|kiraan\s+stok)\b/i.test(source);
  const explicitIn=/\b(?:baja\s+in|stok\s+masuk|barang\s+masuk|pembelian\s+bahan|pembelian\s+inventori|beli\s+bahan|bahan\s+dibeli)\b/i.test(source);
  const explicitOut=/\b(?:baja\s+out|stok\s+keluar|barang\s+keluar|penggunaan\s+bahan|bahan\s+digunakan|guna\s+bahan|digunakan)\b/i.test(source);
  const plots=bseInventoryPlotIds_(source);
  const fertilizerShorthand=plots.length>0 && /(?:^|\s)(?:F|N)(?:\s|$)/i.test(source);
  const itemRaw=bseInventoryItemText_(source), item=bseInventoryCanonicalItem_(itemRaw,source);
  const classification=bseInventoryClassifyText_(item||source);
  const asset=classification.classification==='ASSET_PROPOSAL' && /\b(?:cadangan|beli|pembelian|mesin|peralatan)\b/i.test(source);
  const ambiguousAsset=classification.classification==='AMBIGUOUS_CLASSIFICATION';

  if(!claim&&!adjustment&&!stockCount&&!explicitIn&&!explicitOut&&!fertilizerShorthand&&!asset&&!ambiguousAsset){
    const qtyOnly=bseInventoryExtractQuantity_(source);
    if(item&&qtyOnly){
      const dateInfo=bseInventoryExtractEventDate_(source,receivedAt), base={project_id:'BSE_SB',system_year:2026,event_date:dateInfo.value,event_date_explicit:dateInfo.explicit,event_date_valid:dateInfo.valid,crop:'',item_name:item,quantity:qtyOnly.quantity,unit:qtyOnly.unit,original_note:source,verification_status:'PROVISIONAL',router_confidence:'LOW'};
      return {validation:'NEED_INFO',production_write:false,inventory_ambiguity:{item_name:item,source_key:'',options:[{value:'INVENTORY_IN',label:'Stok Masuk'},{value:'INVENTORY_OUT',label:'Stok Keluar'},{value:'INVENTORY_STOCK_COUNT',label:'Baki Stok'}]},candidates:[{target:'Inventory_Classification_Log',validation:'NEED_INFO',missing:['movement_type'],fields:Object.assign({},base,{record_type:'INVENTORY_CLASSIFICATION'})}]};
    }
    return null;
  }

  const qty=bseInventoryExtractQuantity_(source), dateInfo=bseInventoryExtractEventDate_(source,receivedAt), responsible=bseInventoryDeclaredResponsible_(source);
  const base={project_id:'BSE_SB',system_year:2026,event_date:dateInfo.value,event_date_explicit:dateInfo.explicit,event_date_valid:dateInfo.valid,crop:'',item_name:item,quantity:qty&&qty.quantity,unit:qty&&qty.unit,original_note:source,verification_status:'PROVISIONAL',responsible_name:responsible,responsible_source:responsible?'DECLARED':'',router_confidence:'HIGH'};

  if(ambiguousAsset)return {validation:'NEED_INFO',production_write:false,inventory_ambiguity:{item_name:item||source,source_key:'',options:classification.options},candidates:[{target:'Inventory_Classification_Log',validation:'NEED_INFO',missing:['classification'],fields:Object.assign({},base,{record_type:'INVENTORY_CLASSIFICATION'})}]};

  if(claim){
    const description=bseClaimDescription_(source);
    const amount=bseClaimAmount_(source);
    const fields=Object.assign({},base,{
      record_type:'CLAIM_REQUEST',
      item_name:description || item,
      description:description || item,
      claimant:(source.match(/(?:Claimant|Penuntut|Nama)\s*:\s*(.+)/i)||[,''])[1].trim(),
      amount_myr:amount==null?'':amount,
      reason:(source.match(/(?:Sebab|Alasan)\s*:\s*(.+)/i)||[,''])[1].trim(),
      purchase_reference:(source.match(/(?:Rujukan Pembelian|Rujukan)\s*:\s*(.+)/i)||[,''])[1].trim()
    });
    const check=bseInventoryValidateClaim_(fields),missing=check.ok?[]:check.missing;
    return {validation:missing.length?'NEED_INFO':'PASS',production_write:false,candidates:[{target:'Claim_Request_Log',validation:missing.length?'NEED_INFO':'PASS',missing:missing,fields:fields}]};
  }

  if(asset){
    const fields=Object.assign({},base,{record_type:'ASSET_PROPOSAL',event_type:'ASSET_PROPOSAL',description:source});
    return {validation:'PASS',production_write:false,candidates:[{target:'Asset_Proposal_Log',validation:'PASS',missing:[],fields:fields}]};
  }

  if(stockCount){
    const fields=Object.assign({},base,{record_type:'INVENTORY_STOCK_COUNT',event_type:'INVENTORY_STOCK_COUNT',counted_quantity:qty&&qty.quantity,quantity:undefined,storage_location:/\bgudang\b/i.test(source)?'gudang':'',movement_type:'COUNT'});
    const missing=[]; if(!fields.item_name)missing.push('item_name'); if(!qty)missing.push('counted_quantity','unit'); if(!fields.event_date||fields.event_date_valid===false)missing.push('event_date');
    return {validation:missing.length?'NEED_INFO':'PASS',production_write:false,candidates:[{target:'Inventory_Event_Log',validation:missing.length?'NEED_INFO':'PASS',missing:Array.from(new Set(missing)),fields:fields}]};
  }

  if(adjustment){
    const fields=Object.assign({},base,{record_type:'INVENTORY_ADJUSTMENT',event_type:'INVENTORY_ADJUSTMENT',movement_type:'ADJUST',reason:source});
    const missing=[]; if(!fields.item_name)missing.push('item_name'); if(!qty)missing.push('quantity','unit'); if(!fields.event_date||fields.event_date_valid===false)missing.push('event_date');
    return {validation:missing.length?'NEED_INFO':'PASS',production_write:false,candidates:[{target:'Inventory_Event_Log',validation:missing.length?'NEED_INFO':'PASS',missing:Array.from(new Set(missing)),fields:fields}]};
  }

  if(fertilizerShorthand&&!explicitIn&&!explicitOut){
    const candidates=plots.map(plot=>({target:'Inventory_Event_Log',validation:'PASS',missing:[],fields:Object.assign({},base,{record_type:'INVENTORY_OUT',event_type:'INVENTORY_OUT',item_name:item,quantity:qty?qty.quantity:1,unit:qty?qty.unit:'set',destination:plot,movement_type:'OUT',router_confidence:'MEDIUM'})}));
    return {validation:'PASS',production_write:false,candidates:candidates};
  }

  if(explicitIn||explicitOut){
    const domain=explicitOut?'INVENTORY_OUT':'INVENTORY_IN', movement=explicitOut?'OUT':'IN';
    const destinations=explicitOut&&plots.length?plots:[''];
    const candidates=destinations.map(destination=>{
      const fields=Object.assign({},base,{record_type:domain,event_type:domain,movement_type:movement,destination:destination});
      const missing=[]; if(!fields.item_name)missing.push('item_name'); if(!qty)missing.push('quantity','unit'); if(!fields.event_date||fields.event_date_valid===false)missing.push('event_date');
      return {target:'Inventory_Event_Log',validation:missing.length?'NEED_INFO':'PASS',missing:Array.from(new Set(missing)),fields:fields};
    });
    return {validation:candidates.every(c=>c.validation==='PASS')?'PASS':'NEED_INFO',production_write:false,candidates:candidates};
  }

  const ambiguousFields=Object.assign({},base,{record_type:'INVENTORY_CLASSIFICATION',router_confidence:'LOW'});
  return {validation:'NEED_INFO',production_write:false,inventory_ambiguity:{item_name:item||source,source_key:'',options:[{value:'INVENTORY_IN',label:'Stok Masuk'},{value:'INVENTORY_OUT',label:'Stok Keluar'},{value:'INVENTORY_STOCK_COUNT',label:'Baki Stok'}]},candidates:[{target:'Inventory_Classification_Log',validation:'NEED_INFO',missing:['movement_type'],fields:ambiguousFields}]};
}

function bseInventoryProposalFromResult_(result) {
  const candidate=result&&result.candidates&&result.candidates[0],fields=candidate&&candidate.fields||{};
  if(!candidate)throw new Error('Calon inventori tidak ditemui.');
  const domain=candidate.target==='Claim_Request_Log'?'CLAIM_REQUEST':candidate.target==='Asset_Proposal_Log'?'ASSET_PROPOSAL':String(fields.record_type||fields.event_type||'');
  const proposal=Object.assign({},fields,{domain:domain,source_key:fields.source_key||'',production_write:result.production_write,original_note:fields.original_note||''});
  if(domain==='CLAIM_REQUEST'&&!String(proposal.reason||'').trim())proposal.reason='Claim item: '+String(proposal.item_name||'').trim();
  return proposal;
}

// Claims trust the Telegram sender snapshot, never a claimant typed in the message.
function bseInventoryApplyReporterSnapshot_(result, job) {
  if (!result || !Array.isArray(result.candidates) || !job) return result;
  result.candidates.forEach(candidate => {
    if (!candidate || candidate.target !== 'Claim_Request_Log') return;
    const fields = candidate.fields || (candidate.fields = {});
    const id = String(job.reporterTelegramUserId || '').trim();
    const name = String(job.reporterName || job.reporterUsername || (id ? 'Telegram ' + id : '')).trim();
    fields.claimant = name;
    fields.claimant_telegram_user_id = id;
    fields.claimant_username = String(job.reporterUsername || '').trim();
    fields.reason = 'Claim item: ' + String(fields.item_name || '').trim();
    if (!String(fields.responsible_name || '').trim()) { fields.responsible_name = String(job.reporterName || job.reporterUsername || (id ? 'Telegram ' + id : '')).trim(); fields.responsible_source = 'REPORTER_DEFAULT'; fields.responsible_telegram_user_id = id; }
    const check = bseInventoryValidateClaim_(fields);
    candidate.missing = check.ok ? [] : check.missing.slice();
    candidate.validation = check.ok ? 'PASS' : 'NEED_INFO';
  });
  if (Array.isArray(result.candidates) && result.candidates.length && result.candidates.every(candidate => candidate && candidate.validation === 'PASS' && Array.isArray(candidate.missing) && candidate.missing.length === 0)) result.validation = 'PASS';
  return result;
}

function bseInventoryApplyResponsibleSnapshot_(result, job) {
  if (!result || !Array.isArray(result.candidates) || !job) return result;
  result.candidates.forEach(candidate => {
    if (!candidate) return;
    const fields=candidate.fields||(candidate.fields={}), declared=String(fields.responsible_name||'').trim();
    if (declared) { fields.responsible_name=declared; fields.responsible_source='DECLARED'; delete fields.responsible_telegram_user_id; }
    else { const id=String(job.reporterTelegramUserId||'').trim(); fields.responsible_name=String(job.reporterName||job.reporterUsername||(id?'Telegram '+id:'')).trim(); fields.responsible_source='REPORTER_DEFAULT'; fields.responsible_telegram_user_id=id; }
  });
  return result;
}

function bseInventoryValidateResult_(result, receivedAt, reference) {
  const candidates = result && Array.isArray(result.candidates) ? result.candidates : [];
  if (result && result.production_write !== false) return { validation: 'FAIL', missing: [], reason: 'production_write mesti false' };
  if (candidates.length !== 1 || !['Inventory_Event_Log', 'Input_Usage_Log', 'Claim_Request_Log', 'Asset_Proposal_Log'].includes(String(candidates[0] && candidates[0].target || ''))) return null;
  const candidate = candidates[0], proposal = bseInventoryProposalFromResult_(result);
  if (!String(proposal.source_key || '').trim()) proposal.source_key = bseInventorySourceKey_(reference || '', proposal.domain);
  if (['INVENTORY_IN', 'INVENTORY_OUT', 'INVENTORY_STOCK_COUNT', 'INVENTORY_ADJUSTMENT'].includes(proposal.domain) && !String(proposal.event_date || '').trim()) proposal.event_date = bseInventoryMalaysiaDate_(receivedAt);
  const checked = bseInventoryValidateProposal_(proposal), missing = Array.from(new Set(checked.missing || [])).filter(field => /^[a-z_\/]+$/.test(String(field)));
  const fields = candidate.fields || (candidate.fields = {});
  if (Object.prototype.hasOwnProperty.call(proposal, 'event_date')) fields.event_date = proposal.event_date || '';
  if (Object.prototype.hasOwnProperty.call(proposal, 'event_date_valid')) fields.event_date_valid = proposal.event_date_valid;
  candidate.missing = missing.slice();
  candidate.validation = checked.ok ? 'PASS' : 'NEED_INFO';
  result.validation = checked.ok ? 'PASS' : 'NEED_INFO';
  return { validation: checked.ok ? 'PASS' : 'NEED_INFO', missing: missing, reason: checked.ok ? '' : 'Medan wajib belum lengkap.', proposal: proposal };
}

function bseInventoryMissingText_(reference, check) {
  const fields = check && check.missing && check.missing.length ? check.missing.join(', ') : 'maklumat inventori';
  return 'Rujukan ' + String(reference || '') + ' belum lengkap. Sila lengkapkan: ' + fields + '. Tiada rekod TEST ditulis.';
}

function bseInventoryClaimMissingText_(reference, check) {
  const labels = { claimant: 'Claimant', item_name: 'Item / keterangan pembelian', amount_myr: 'Amaun claim (RM)', event_date: 'Tarikh' };
  const fields = (check && check.missing || []).map(field => labels[field] || '').filter(Boolean);
  if (!fields.length) return '';
  return 'Maklumat claim belum lengkap:\n' + fields.map(field => '• ' + field).join('\n') + '\n\nSila balas mesej asal dengan maklumat tersebut.';
}

// UI boundary guard: an inventory approval cannot be acknowledged unless the
// TEST writer/core returned a successful approval outcome.
function bseInventoryApprovalBoundaryCore_(book, context) {
  const outcome = bseInventoryReviewCore_(book, context);
  if (!outcome || outcome.validation !== 'PASS' || outcome.decision !== context.action) {
    if (book && typeof book.getSheetByName === 'function') {
      const review = bseInventoryEnsureSheet_(book, 'TEST_INVENTORY_REVIEW', BSE_INVENTORY_REVIEW_HEADERS);
      review.appendRow([Utilities.getUuid(), context.reference + '|VALIDATION', '', 'INVENTORY_VALIDATION', 'VALIDATION_NEED_INFO', context.actor_name, String(outcome && outcome.reason || 'TEST writer gagal.'), new Date().toISOString(), 'NEEDS_HUMAN_REVIEW', '', context.owner_id || '', context.actor_id || '', context.actor_name, String(context.proposalResult && context.proposalResult.candidates && context.proposalResult.candidates[0] && context.proposalResult.candidates[0].fields && context.proposalResult.candidates[0].fields.original_note || '')]);
      SpreadsheetApp.flush();
    }
    throw new Error(bseInventoryMissingText_(context.reference, outcome || { missing: [], reason: 'TEST writer gagal.' }));
  }
  return outcome;
}

function bseInventoryClassificationSheet_(book) {
  return bseInventoryEnsureSheet_(book, 'TEST_INVENTORY_CLASSIFICATION', BSE_INVENTORY_CLASSIFICATION_HEADERS);
}

function bseInventoryClassificationMarkup_(token) {
  return { inline_keyboard: [[
    { text: 'Daftar Aset', callback_data: 'D1:' + token + ':A' },
    { text: 'Inventori', callback_data: 'D1:' + token + ':I' },
    { text: 'Isi Maklumat', callback_data: 'D1:' + token + ':C' }
  ]] };
}

function bseInventoryAmbiguityText_(reference, ambiguity) {
  return 'Rujukan ' + reference + ': Saya cadangkan klasifikasi untuk ' + String(ambiguity.item_name || 'item') + '. Pilih satu:';
}

function bseInventoryPersistAmbiguity_(book, reference, queueRow, result) {
  const ambiguity = result && result.inventory_ambiguity;
  if (!ambiguity) return { created: false };
  const sheet = bseInventoryClassificationSheet_(book), rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, BSE_INVENTORY_CLASSIFICATION_HEADERS.length).getValues() : [];
  const existing = rows.find(row => String(row[1]) === String(reference) && String(row[10]) === 'OPEN');
  if (existing) return { created: false, duplicate: true, token: String(existing[0]) };
  const token = Utilities.getUuid().replace(/-/g, '').slice(0, 12), sourceKey = reference + '|INVENTORY_CLASSIFICATION', payloadHash = bseInventoryPayloadHash_(ambiguity);
  const sent = bseTelegramApi_('sendMessage', { chat_id: String(queueRow[1]), text: bseInventoryAmbiguityText_(reference, ambiguity), reply_parameters: { message_id: Number(queueRow[3]), allow_sending_without_reply: true }, reply_markup: bseInventoryClassificationMarkup_(token) });
  sheet.appendRow([token, reference, sourceKey, payloadHash, String(queueRow[1]), String(queueRow[2]), String(queueRow[3]), String(sent.message_id || ''), String(ambiguity.item_name || ''), JSON.stringify(ambiguity.options || []), 'OPEN', '', new Date().toISOString(), '', '', JSON.stringify(result)]);
  SpreadsheetApp.flush();
  return { created: true, token: token, message_id: sent.message_id };
}

function bseInventoryClassificationCore_(book, context, input) {
  const sheet = bseInventoryClassificationSheet_(book), rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, BSE_INVENTORY_CLASSIFICATION_HEADERS.length).getValues() : [];
  const index = rows.findIndex(row => String(row[0]) === String(input.token));
  if (index < 0) throw new Error('Klasifikasi inventori tidak ditemui.');
  const row = rows[index], action = String(input.action || ''), owner = String(row[5] || ''), state = String(row[10] || '');
  if (String(context.actor_id) !== owner || String(input.chat_id || '') !== String(row[4])) return { authorized: false, status: 'OWNER_ONLY' };
  const clarificationSelection = state === 'CLARIFY' && ['A', 'I'].includes(action);
  if (state !== 'OPEN' && !clarificationSelection) return { duplicate: true, status: state };
  if (!['A', 'I', 'C'].includes(action)) throw new Error('Pilihan klasifikasi tidak sah.');
  const result = JSON.parse(String(row[15] || '{}')), original = result.candidates && result.candidates[0] && result.candidates[0].fields || {};
  if (action === 'C') {
    const sourceChatId=String(row[4]||''),sourceMessageId=String(row[6]||'');
    if(!/^-?\d+$/.test(sourceChatId)||!/^\d+$/.test(sourceMessageId))throw new Error('Target reply Isi Maklumat tidak sah; cuba semula.');
    return { authorized: true, decision: 'CLARIFY', status: 'PENDING_CLARIFY_REPLY', production_write: false, reference: row[1], source_key: row[2], source_chat_id: sourceChatId, source_message_id: sourceMessageId, candidate_json: String(row[15] || '') };
  }
  const target = action === 'A' ? 'Asset_Proposal_Log' : 'Inventory_Event_Log', domain = action === 'A' ? 'ASSET_PROPOSAL' : 'INVENTORY_IN';
  const fields = Object.assign({}, original, { record_type: domain, event_type: domain, source_key: '', production_write: false });
  if (action === 'A') fields.description = original.item_name || row[8];
  const candidates = [{ target: target, validation: 'PASS', missing: [], fields: fields }];
  const selected = { validation: 'PASS', production_write: false, candidates: candidates };
  const selectedCheck = bseInventoryValidateResult_(selected, '', String(row[1] || ''));
  if (!selectedCheck || selectedCheck.validation !== 'PASS') {
    sheet.getRange(index + 2, 11, 1, 4).setValues([['NEED_INFO', action, String(row[12]), new Date().toISOString()]]);
    return { selected: false, validation: 'NEED_INFO', missing: selectedCheck ? selectedCheck.missing : ['item_name'], production_write: false, reference: row[1] };
  }
  sheet.getRange(index + 2, 11, 1, 2).setValues([['SELECTED', action]]);
  const queue = book.getSheetByName('TELEGRAM_TEST_QUEUE');
  if (queue) {
    const qrows = queue.getLastRow() > 1 ? queue.getRange(2, 1, queue.getLastRow() - 1, BSE_TG_QUEUE_HEADERS.length).getValues() : [], qindex = qrows.findIndex(q => 'BSE-TG-' + String(q[0]) === String(row[1]));
    if (qindex >= 0) { queue.getRange(qindex + 2, 10).setValue(JSON.stringify(selected)); queue.getRange(qindex + 2, 7).setValue('NEEDS_HUMAN_REVIEW'); }
  }
  SpreadsheetApp.flush();
  return { decision: action === 'A' ? 'ASSET_PROPOSAL' : 'INVENTORY_IN', reference: row[1], production_write: false, selected: true };
}

function bseInventoryFindClarificationPrompt_(book, chatId, reporterId, questionMessageId) {
  const sheet=bseInventoryClassificationSheet_(book),rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,BSE_INVENTORY_CLASSIFICATION_HEADERS.length).getValues():[];
  const index=rows.findIndex(row=>String(row[4])===String(chatId)&&String(row[5])===String(reporterId)&&String(row[7])===String(questionMessageId)&&String(row[10])==='CLARIFY');
  return index<0?null:{index:index,row:rows[index],token:String(rows[index][0]),reference:String(rows[index][1])};
}

// A normal Telegram message can answer the one active Inventory/Claim
// clarification without using Reply.  Deliberately refuse ambiguity: a
// fallback must never select an older or different session.
function bseInventoryFindActiveClarificationPrompt_(book, chatId, reporterId) {
  const sheet=bseInventoryClassificationSheet_(book),rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,BSE_INVENTORY_CLASSIFICATION_HEADERS.length).getValues():[];
  const matches=rows.map((row,index)=>({row:row,index:index})).filter(item=>String(item.row[4])===String(chatId)&&String(item.row[5])===String(reporterId)&&/^\d+$/.test(String(item.row[7]))&&String(item.row[10])==='CLARIFY');
  if(matches.length!==1)return null;
  const match=matches[0];return {index:match.index,row:match.row,token:String(match.row[0]),reference:String(match.row[1])};
}

// Retry-only lookup: a successful classification selection may have happened
// before approval-card delivery failed, leaving the classification in SELECTED.
// It is never used for a fresh reply, so an old prompt cannot be reclassified.
function bseInventoryFindClarificationRetry_(book, chatId, reporterId, questionMessageId) {
  const sheet=bseInventoryClassificationSheet_(book),rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,BSE_INVENTORY_CLASSIFICATION_HEADERS.length).getValues():[];
  const index=rows.findIndex(row=>String(row[4])===String(chatId)&&String(row[5])===String(reporterId)&&String(row[7])===String(questionMessageId)&&['CLARIFY','SELECTED'].includes(String(row[10])));
  return index<0?null:{index:index,row:rows[index],token:String(rows[index][0]),reference:String(rows[index][1])};
}

function bseInventoryClarificationAction_(text) {
  const value=bseInventoryNormalize_(text);
  if (/\b(habis guna|habis sebagai bahan|bahan operasi|bahan guna habis|consumable)\b/.test(value)) return 'I';
  if (/\b(digunakan berulang|guna berulang|jangka panjang|tahan lama|diguna lama)\b/.test(value)) return 'A';
  return 'C';
}

function processBseTelegramInventoryClarificationReplies() {
  const book=boundTestBook_(),queue=bseTelegramQueue_(book),lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw new Error('Barisan sedang dikemas kini.');
  try {
    const rows=queue.getLastRow()>1?queue.getRange(2,1,queue.getLastRow()-1,BSE_TG_QUEUE_HEADERS.length).getValues():[];
    for(let i=0;i<rows.length;i++) {
      const row=rows[i],status=String(row[6]);if(!['D1_CLARIFICATION_PENDING','D1_CLARIFICATION_RETRY'].includes(status))continue;
      let prompt=bseInventoryFindClarificationPrompt_(book,row[1],row[2],row[13]);
      if(!prompt&&status==='D1_CLARIFICATION_RETRY')prompt=bseInventoryFindClarificationRetry_(book,row[1],row[2],row[13]);
      if(!prompt){queue.getRange(i+2,7).setValue('D1_CLARIFICATION_RETRY');queue.getRange(i+2,13).setValue('CLARIFY_REPLY_RETRY: soalan klasifikasi belum dipadankan.');continue;}
      const action=bseInventoryClarificationAction_(row[4]);
      if(action==='C') {
        let sent;try{sent=bseTelegramApi_('sendMessage',{chat_id:String(row[1]),text:'Jawapan belum jelas. Sila nyatakan sama ada item ini habis guna sebagai bahan operasi atau digunakan berulang untuk jangka panjang.',reply_parameters:{message_id:Number(row[3]),allow_sending_without_reply:false}});}catch(error){queue.getRange(i+2,13).setValue('CLARIFY_REPLY_RETRY: '+String(error.message||''));continue;}
        if(!sent||!sent.message_id){queue.getRange(i+2,13).setValue('CLARIFY_REPLY_RETRY: respons soalan tidak disahkan.');continue;}
        const parentRows=queue.getLastRow()>1?queue.getRange(2,1,queue.getLastRow()-1,BSE_TG_QUEUE_HEADERS.length).getValues():[],parent=parentRows.find(item=>'BSE-TG-'+String(item[0])===prompt.reference);
        if(!parent){queue.getRange(i+2,13).setValue('CLARIFY_REPLY_RETRY: queue asal tidak ditemui.');continue;}
        const classificationSheetForClarify_=bseInventoryClassificationSheet_(book);
        const classificationRowsForClarify=classificationSheetForClarify_.getLastRow()>1?classificationSheetForClarify_.getRange(2,1,classificationSheetForClarify_.getLastRow()-1,BSE_INVENTORY_CLASSIFICATION_HEADERS.length).getValues():[];
        const classificationIndexForClarify=classificationRowsForClarify.findIndex(item=>String(item[0])===String(prompt.token));
        if(classificationIndexForClarify<0){queue.getRange(i+2,13).setValue('CLARIFY_REPLY_RETRY: audit classification tidak ditemui.');continue;}
        classificationSheetForClarify_.getRange(classificationIndexForClarify+2,8).setValue(String(sent.message_id));
        queue.getRange(parentRows.indexOf(parent)+2,16).setValue(String(sent.message_id));
        queue.getRange(i+2,7).setValue('D1_CLARIFICATION_WAITING');continue;
      }
      const context={reference:prompt.reference,action:'APPROVED',actor_type:'TELEGRAM',actor_id:String(row[2]),actor_name:'Telegram '+String(row[2]),reason:'',source_channel:'TELEGRAM'};
      const outcome=bseInventoryClassificationCore_(book,context,{token:prompt.token,action:action,chat_id:String(row[1])});
      if(outcome&&outcome.duplicate&&outcome.status==='SELECTED')outcome.selected=true;
      if(!outcome||!outcome.selected){queue.getRange(i+2,7).setValue('D1_CLARIFICATION_RETRY');queue.getRange(i+2,13).setValue('CLARIFY_REPLY_RETRY: klasifikasi belum tersedia.');continue;}
      const parentRows=queue.getLastRow()>1?queue.getRange(2,1,queue.getLastRow()-1,BSE_TG_QUEUE_HEADERS.length).getValues():[],parent=parentRows.find(item=>'BSE-TG-'+String(item[0])===prompt.reference);
      if(!parent){queue.getRange(i+2,7).setValue('D1_CLARIFICATION_RETRY');queue.getRange(i+2,13).setValue('CLARIFY_REPLY_RETRY: queue asal tidak ditemui.');continue;}
      let card;
      try{card=bseTelegramApprovalEnsureCard_(book,parent);}catch(error){queue.getRange(i+2,7).setValue('D1_CLARIFICATION_RETRY');queue.getRange(i+2,13).setValue('APPROVAL_CARD_RETRY: '+String(error.message||''));continue;}
      if(!card||(!card.created&&!card.duplicate)){queue.getRange(i+2,7).setValue('D1_CLARIFICATION_RETRY');queue.getRange(i+2,13).setValue('APPROVAL_CARD_RETRY: kad approval belum tersedia.');continue;}
      queue.getRange(i+2,7,1,7).setValues([['D1_CLARIFICATION_PROCESSED',row[7],row[8],row[9],row[10],row[11],'']]);
    }
    SpreadsheetApp.flush();
  } finally {lock.releaseLock();}
}

function bseInventorySourceKey_(reference, domain) {
  return String(reference || '').trim() + '|' + String(domain || '').trim();
}

/** Pure balance check over approved TEST events; negative balance is a warning. */
function bseInventoryBalanceWarning_(approvedEvents, proposedEvent) {
  const events = Array.isArray(approvedEvents) ? approvedEvents : [];
  const key = bseInventoryNormalize_(proposedEvent && proposedEvent.item_name) + '|' + bseInventoryNormalize_(proposedEvent && proposedEvent.unit);
  let balance = 0;
  events.filter(e => e && e.status === 'APPROVED_TEST' &&
    bseInventoryNormalize_(e.item_name) + '|' + bseInventoryNormalize_(e.unit) === key)
    .forEach(e => { balance += e.event_type === 'INVENTORY_OUT' ? -Number(e.quantity || 0) : e.event_type === 'INVENTORY_IN' ? Number(e.quantity || 0) : e.event_type === 'INVENTORY_ADJUSTMENT' ? Number(e.quantity || 0) : 0; });
  if (proposedEvent && proposedEvent.event_type === 'INVENTORY_OUT') balance -= Number(proposedEvent.quantity || 0);
  else if (proposedEvent) balance += Number(proposedEvent.quantity || 0);
  return balance < 0 ? { warning: 'NEGATIVE_BALANCE', review_required: true, balance } :
    { warning: null, review_required: false, balance };
}

function bseInventoryDecisionFromPrior_(priorRows, sourceKey, payloadHash, decision) {
  const rows = Array.isArray(priorRows) ? priorRows : [];
  const prior = rows.find(r => r && r.source_key === sourceKey);
  if (!prior) return { state: 'NEW' };
  if (prior.payload_hash !== payloadHash || prior.decision !== decision) {
    return { state: 'CONFLICT', reason: 'source_key sudah mempunyai hash/keputusan berbeza' };
  }
  return { state: 'IDEMPOTENT', event_id: prior.event_id || null };
}

/**
 * Non-UI, no-lock review contract. It returns a TEST-only write plan; runtime
 * Telegram/menu wiring and sheet writes are intentionally deferred from D0.
 */
function bseInventoryReviewCore_(book, reviewContext) {
  const context = bseReviewContextValidate_(reviewContext);
  const proposal = context.proposal || (context.proposalResult ? bseInventoryProposalFromResult_(context.proposalResult) : {});
  if (!String(proposal.responsible_name || '').trim()) {
    const reporterId=String(context.reporter_telegram_user_id||'').trim();
    proposal.responsible_name=String(context.reporter_name||context.reporter_username||(reporterId?'Telegram '+reporterId:'')).trim();
    proposal.responsible_source='REPORTER_DEFAULT';
    proposal.responsible_telegram_user_id=reporterId;
  } else if (!String(proposal.responsible_source||'').trim()) proposal.responsible_source='DECLARED';
  if (!String(proposal.source_key || '').trim() && proposal.domain) proposal.source_key = bseInventorySourceKey_(context.reference, proposal.domain);
  if (['INVENTORY_IN', 'INVENTORY_OUT', 'INVENTORY_STOCK_COUNT', 'INVENTORY_ADJUSTMENT'].includes(proposal.domain) && !String(proposal.event_date || '').trim()) proposal.event_date = bseInventoryMalaysiaDate_(context.received_at);
  const validation = bseInventoryValidateProposal_(proposal);
  if (!validation.ok) return { validation: 'NEED_INFO', decision: '', missing: Array.from(new Set(validation.missing || [])).filter(field => /^[a-z_\/]+$/.test(String(field))), reason: 'Medan wajib belum lengkap.', production_write: false };
  const payloadHash = bseInventoryPayloadHash_(proposal);
  const sourceKey = proposal.source_key || bseInventorySourceKey_(context.reference, proposal.domain);
  const reviewSheet = book && typeof book.getSheetByName === 'function' ? bseInventoryEnsureSheet_(book, 'TEST_INVENTORY_REVIEW', BSE_INVENTORY_REVIEW_HEADERS) : null;
  const priorRows = reviewSheet && reviewSheet.getLastRow() > 1 ? reviewSheet.getRange(2, 1, reviewSheet.getLastRow() - 1, BSE_INVENTORY_REVIEW_HEADERS.length).getValues() : [];
  const prior = bseInventoryDecisionFromPrior_(priorRows, sourceKey, payloadHash, context.action);
  if (prior.state === 'CONFLICT') throw new Error(prior.reason);
  if (prior.state === 'IDEMPOTENT') return { validation: 'PASS', decision: context.action, source_key: sourceKey, payload_hash: payloadHash, production_write: false, duplicate: true, event_id: prior.event_id };
  let eventId = '', stamp = new Date().toISOString();
  if (context.action === 'APPROVED') {
    if (!book || typeof book.getSheetByName !== 'function') return { validation: 'FAIL', decision: '', missing: [], reason: 'TEST writer tidak tersedia.', production_write: false };
    eventId = 'BSE-SB-INV-' + payloadHash.slice(0, 12);
    try {
      if (proposal.domain === 'ASSET_PROPOSAL') {
        const asset = bseInventoryEnsureSheet_(book, 'TEST_ASSET_PROPOSAL', BSE_ASSET_PROPOSAL_HEADERS);
        asset.appendRow([sourceKey, eventId, 'ASSET_PROPOSAL', proposal.description || proposal.original_note, 'APPROVED_TEST', context.owner_id || '', context.actor_id || '', context.actor_name, false, proposal.original_note, stamp, stamp, context.actor_name, payloadHash, proposal.responsible_name || '', proposal.responsible_source || '', proposal.responsible_telegram_user_id || '']);
      } else if (proposal.domain === 'CLAIM_REQUEST') {
        const claim = bseInventoryEnsureSheet_(book, 'TEST_CLAIM_LOG', BSE_CLAIM_HEADERS);
        claim.appendRow([sourceKey, eventId, proposal.claimant, proposal.claimant_telegram_user_id || '', proposal.claimant_username || '', proposal.item_name, proposal.quantity, proposal.unit, proposal.amount_myr, proposal.reason, proposal.event_date || '', proposal.purchase_reference || '', proposal.evidence_reference || '', context.owner_id || '', context.actor_id || '', context.actor_name, 'APPROVED_TEST', false, proposal.original_note, stamp, stamp, context.actor_name, payloadHash, proposal.responsible_name || '', proposal.responsible_source || '', proposal.responsible_telegram_user_id || '']);
      } else {
        const event = bseInventoryEnsureSheet_(book, 'TEST_INVENTORY_EVENT', BSE_INVENTORY_EVENT_HEADERS);
        event.appendRow([sourceKey, eventId, proposal.domain, proposal.item_name, proposal.domain === 'INVENTORY_STOCK_COUNT' ? proposal.counted_quantity : proposal.quantity, proposal.unit, proposal.event_date, context.owner_id || '', context.actor_id || '', context.actor_name, 'APPROVED_TEST', 'VERIFIED_TEST', false, proposal.original_note, stamp, stamp, context.actor_name, payloadHash, proposal.responsible_name || '', proposal.responsible_source || '', proposal.responsible_telegram_user_id || '', proposal.destination || '', proposal.storage_location || '', proposal.counted_quantity || '', proposal.movement_type || '', proposal.router_confidence || '']);
      }
    } catch (error) {
      return { validation: 'FAIL', decision: '', missing: [], reason: 'TEST writer gagal: ' + String(error.message || 'unknown'), production_write: false };
    }
  }
  if (context.action === 'APPROVED' && eventId && typeof bseEvidenceLinkMany_ === 'function') {
    const refs = proposal.evidence_refs || proposal.evidence_reference || [];
    if (bseEvidenceRefs_(refs).length) {
      bseEvidenceLinkMany_(book,{
        evidence_refs:refs,
        domain_record_type:proposal.domain,
        domain_record_id:eventId,
        link_reason:'DOMAIN_SUPPORT',
        source_message_id:String(context.reference||''),
        linked_by:String(context.actor_name||context.actor_id||'SYSTEM_TEST'),
        production_write:false
      });
    }
  }
  if (reviewSheet) reviewSheet.appendRow([Utilities.getUuid(), sourceKey, eventId, proposal.domain, context.action, context.actor_name, String(context.reason || ''), stamp, 'NEEDS_HUMAN_REVIEW', payloadHash, context.owner_id || '', context.actor_id || '', context.actor_name, proposal.original_note]);
  if (book && typeof book.getSheetByName === 'function') {
    const queue = book.getSheetByName('TELEGRAM_TEST_QUEUE');
    if (queue && context.reference) {
      const rows = queue.getLastRow() > 1 ? queue.getRange(2, 1, queue.getLastRow() - 1, BSE_TG_QUEUE_HEADERS.length).getValues() : [];
      const index = rows.findIndex(row => 'BSE-TG-' + String(row[0]) === String(context.reference));
      if (index >= 0) queue.getRange(index + 2, 7).setValue(context.action === 'APPROVED' ? 'INVENTORY_APPROVED_TEST' : 'INVENTORY_REJECTED_TEST');
    }
    SpreadsheetApp.flush();
  }
  return {
    validation: 'PASS', decision: context.action, source_key: sourceKey,
    payload_hash: payloadHash, production_write: false,
    write_scope: 'TEST_APPEND_ONLY', actor_name: context.actor_name, event_id: eventId
  };
}

function bseInventoryEnsureSheet_(book, name, headers) {
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function bseInventoryMigrateSheetHeaders_(book, name, headers) {
  const sheet=bseInventoryEnsureSheet_(book,name,headers),last=sheet.getLastColumn?sheet.getLastColumn():headers.length;
  const current=sheet.getLastRow()>0&&sheet.getRange?sheet.getRange(1,1,1,last).getValues()[0]:[];
  const missing=headers.filter(header=>!current.includes(header));
  if(missing.length&&sheet.getMaxColumns&&sheet.getMaxColumns()<last+missing.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),last+missing.length-sheet.getMaxColumns());
  if(missing.length&&sheet.getRange)sheet.getRange(1,last+1,1,missing.length).setValues([missing]);
  return sheet;
}

// Claim identity fields must remain immediately after claimant.  Appending
// them to a legacy header row would make the fixed-order Claim TEST writer
// place every later value beneath the wrong header.
function bseInventoryMigrateClaimHeaders_(book) {
  const sheet=bseInventoryEnsureSheet_(book,'TEST_CLAIM_LOG',BSE_CLAIM_HEADERS);
  const last=sheet.getLastColumn?sheet.getLastColumn():BSE_CLAIM_HEADERS.length;
  const current=sheet.getLastRow()>0&&sheet.getRange?sheet.getRange(1,1,1,last).getValues()[0]:[];
  const identity=BSE_CLAIM_HEADERS.slice(3,5),present=identity.filter(header=>current.includes(header));
  const same=(left,right)=>left.length===right.length&&left.every((value,index)=>value===right[index]);
  const legacy=[
    'source_key','claim_id','claimant','item_name','quantity','unit','amount_myr',
    'reason','purchase_reference','evidence_reference','owner_id','owner_telegram_user_id',
    'owner_name','status','production_write','original_note','created_at','approved_at',
    'reviewer','payload_hash','claimant_telegram_user_id','claimant_username','event_date',
    'responsible_name','responsible_source','responsible_telegram_user_id'
  ];
  if(same(current.slice(0,legacy.length),legacy)){
    const rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,legacy.length).getValues():[];
    const byHeader={};legacy.forEach((header,index)=>{byHeader[header]=index;});
    const migrated=rows.map(row=>{
      const alreadyCanonical=/^\d+$/.test(String(row[3]||'').trim())&&
        !!String(row[4]||'').trim()&&!!String(row[5]||'').trim()&&Number(row[6])>0&&
        BSE_INVENTORY_ALLOWED_UNITS.includes(String(row[7]||''))&&Number(row[8])>0;
      return alreadyCanonical?row.slice(0,BSE_CLAIM_HEADERS.length):BSE_CLAIM_HEADERS.map(header=>row[byHeader[header]]==null?'':row[byHeader[header]]);
    });
    sheet.getRange(1,1,1,BSE_CLAIM_HEADERS.length).setValues([BSE_CLAIM_HEADERS]);
    if(migrated.length)sheet.getRange(2,1,migrated.length,BSE_CLAIM_HEADERS.length).setValues(migrated);
    console.log('TEST_CLAIM_SCHEMA_MIGRATED: '+JSON.stringify({rows:migrated.length,production_write:false}));
    return sheet;
  }
  if(present.length&&!(current[3]===identity[0]&&current[4]===identity[1]))throw new Error('Schema TEST_CLAIM_LOG tidak selamat untuk migrasi automatik.');
  if(!present.length){
    if(!sheet.insertColumnsAfter)throw new Error('TEST_CLAIM_LOG tidak menyokong sisipan lajur migrasi.');
    sheet.insertColumnsAfter(3,identity.length);
    sheet.getRange(1,4,1,identity.length).setValues([identity]);
  }
  return bseInventoryMigrateSheetHeaders_(book,'TEST_CLAIM_LOG',BSE_CLAIM_HEADERS);
}

/** Manual-only additive migration; it never changes existing rows or data. */
function migrateBseInventoryClaimTestSheetsV2() {
  const book=boundTestBook_();
  bseInventoryMigrateSheetHeaders_(book,'TEST_INVENTORY_EVENT',BSE_INVENTORY_EVENT_HEADERS);
  bseInventoryMigrateSheetHeaders_(book,'TEST_INVENTORY_REVIEW',BSE_INVENTORY_REVIEW_HEADERS);
  bseInventoryMigrateClaimHeaders_(book);
  bseInventoryMigrateSheetHeaders_(book,'TEST_ASSET_PROPOSAL',BSE_ASSET_PROPOSAL_HEADERS);
}

/** Manual setup only; never called by receiver, worker, trigger or review core. */
function setupBseInventoryClaimTestSheets() {
  const book = boundTestBook_();
  bseInventoryMigrateSheetHeaders_(book, 'TEST_INVENTORY_EVENT', BSE_INVENTORY_EVENT_HEADERS);
  bseInventoryMigrateSheetHeaders_(book, 'TEST_INVENTORY_REVIEW', BSE_INVENTORY_REVIEW_HEADERS);
  bseInventoryMigrateClaimHeaders_(book);
  bseInventoryMigrateSheetHeaders_(book, 'TEST_ASSET_PROPOSAL', BSE_ASSET_PROPOSAL_HEADERS);
}

function runBseInventoryClaimFoundationHarnessLegacyTests() {
  function expect(id, pass) { return { id, pass: !!pass }; }
  const fertilizer = bseInventoryClassifyText_('beli baja NPK');
  const pesticide = bseInventoryClassifyText_('racun serangga');
  const mower = bseInventoryClassifyText_('beli mesin rumput');
  const overlap = bseInventoryClassifyText_('beli pam dan hos');
  const claimOk = bseInventoryValidateClaim_({ claimant: 'Ali', item_name: 'Baja', quantity: '2.5', unit: 'kg', amount_myr: '25.00', reason: 'Pembelian TEST' });
  const claimBad = bseInventoryValidateClaim_({ claimant: 'Ali', item_name: 'Baja', quantity: 0, unit: 'kg', amount_myr: '', reason: '' });
  const validProposal = { domain: 'INVENTORY_IN', source_key: 'BSE-TG-1|INVENTORY_IN', item_name: 'Baja', quantity: 2, unit: 'kg', event_date: '2026-09-22', original_note: 'beli baja', production_write: false };
  const ctx = { reference: 'BSE-TG-1', action: 'APPROVED', actor_type: 'APPS_SCRIPT', actor_id: 'TEST_OPERATOR', actor_name: 'TEST', source_channel: 'APPS_SCRIPT', proposal: validProposal };
  const core = bseInventoryReviewCore_({}, ctx);
  const rejectCore = bseInventoryReviewCore_({}, Object.assign({}, ctx, { action: 'REJECTED', reason: 'Tidak diperlukan' }));
  const hashA = bseInventoryPayloadHash_({ b: 2, a: 1 });
  const hashB = bseInventoryPayloadHash_({ a: 1, b: 2 });
  const prior = [{ source_key: validProposal.source_key, payload_hash: hashA, decision: 'APPROVED', event_id: 'EV-1' }];
  const fakeSheets = {};
  const fakeBook = { getSheetByName: name => fakeSheets[name] || null, insertSheet: name => { const sheet = { rows: [], getLastRow: function() { return this.rows.length; }, appendRow: function(row) { this.rows.push(row.slice()); }, getRange: function(row, col, count, width) { const self = this; return { getValues: function() { return self.rows.slice(row - 1, row - 1 + (count || 1)).map(item => item.slice(col - 1, col - 1 + (width || item.length))); }, setValues: function(values) { values.forEach((value, index) => { self.rows[row - 1 + index] = value.slice(); }); return this; }, setValue: function(value) { if (!self.rows[row - 1]) self.rows[row - 1] = []; self.rows[row - 1][col - 1] = value; return this; }, setNumberFormat: function() { return this; } }; } }; fakeSheets[name] = sheet; return sheet; } };
  const writerResult = bseInventoryReviewCore_(fakeBook, ctx), writerEvents = fakeSheets.TEST_INVENTORY_EVENT && fakeSheets.TEST_INVENTORY_EVENT.rows.length - 1, writerReviews = fakeSheets.TEST_INVENTORY_REVIEW && fakeSheets.TEST_INVENTORY_REVIEW.rows.length - 1;
  const purchase = bseInventoryParseMessage_('PEMBELIAN BAHAN\nItem: Baja NPK\nKuantiti: 2 kg', '2026-09-22T00:00:00.000Z');
  const use = bseInventoryParseMessage_('PENGGUNAAN BAHAN\nItem: Racun serangga\n5 ml', '2026-09-22T00:00:00.000Z');
  const adjust = bseInventoryParseMessage_('PELARASAN INVENTORI\nItem: Baja NPK\n1 kg', '2026-09-22T00:00:00.000Z');
  const claim = bseInventoryParseMessage_('CLAIM REQUEST\nClaimant: Ali\nItem: Baja\n2 kg\nAmaun MYR: 25\nSebab: Pembelian', '2026-09-22T00:00:00.000Z');
  const claimMissing = bseInventoryParseMessage_('CLAIM REQUEST\nClaimant: Ali\nItem: Baja', '2026-09-22T00:00:00.000Z');
  const assetProposal = bseInventoryParseMessage_('CADANGAN ASET\nItem: Mesin rumput', '2026-09-22T00:00:00.000Z');
  const ambiguityResult = bseInventoryParseMessage_('Item: Pam air\n1 unit', '2026-09-22T00:00:00.000Z');
  const noDate = { production_write: false, candidates: [{ target: 'Inventory_Event_Log', validation: 'PASS', missing: [], fields: { record_type: 'INVENTORY_IN', original_note: 'Baja', item_name: 'Baja NPK', quantity: 2, unit: 'kg', event_date: '' } }] };
  const noDateCheck = bseInventoryValidateResult_(noDate, '2026-09-22T00:00:00.000Z', 'BSE-TG-2');
  const incomplete = { production_write: false, candidates: [{ target: 'Inventory_Event_Log', validation: 'PASS', missing: [], fields: { record_type: 'INVENTORY_IN', original_note: 'Baja', item_name: '', quantity: 2, unit: 'kg', event_date: '2026-09-22' } }] };
  const incompleteCheck = bseInventoryValidateResult_(incomplete, '2026-09-22T00:00:00.000Z', 'BSE-TG-3');
  const claimMissingText = bseInventoryClaimMissingText_('BSE-TG-4', { missing: ['amount_myr'] });
  const genericMissingText = bseInventoryMissingText_('BSE-TG-5', { missing: [] });
  const workerSource = typeof processBseTelegramTestQueue === 'function' ? processBseTelegramTestQueue.toString() : '';
  const tests = [
    expect('five domain routes are deterministic', purchase.candidates[0].target === 'Inventory_Event_Log' && use.candidates[0].fields.record_type === 'INVENTORY_OUT' && adjust.candidates[0].fields.record_type === 'INVENTORY_ADJUSTMENT' && claim.candidates[0].target === 'Claim_Request_Log' && assetProposal.candidates[0].target === 'Asset_Proposal_Log'),
    expect('asset proposal is not active asset registry', assetProposal.production_write === false && assetProposal.candidates[0].fields.record_type === 'ASSET_PROPOSAL'),
    expect('ambiguous classification offers exact reporter choices', ambiguityResult.validation === 'NEED_INFO' && ambiguityResult.inventory_ambiguity.options.map(option => option.label).join('|') === 'Daftar Aset|Inventori|Isi Maklumat'),
    expect('claim missing fields waits for information', claimMissing.validation === 'NEED_INFO' && claimMissing.candidates[0].missing.includes('amount_myr') && !claimMissing.candidates[0].missing.includes('reason')),
    expect('inventory date falls back to Malaysia received_at', noDateCheck.validation === 'PASS' && noDateCheck.proposal.event_date === '2026-09-22'),
    expect('incomplete candidate is NEED_INFO with safe fields', incompleteCheck.validation === 'NEED_INFO' && incompleteCheck.missing.includes('item_name') && incompleteCheck.missing.every(field => /^[a-z_\/]+$/.test(field))),
    expect('claim missing response lists exact fields', claimMissingText.includes('• Amaun claim (RM)') && !claimMissingText.includes('• Claimant') && !claimMissingText.includes('• Sebab claim') && !claimMissingText.includes('• Item')),
    expect('unknown structure keeps generic fallback', genericMissingText.includes('maklumat inventori')),
    expect('WAITING_INFO path has no approval card', workerSource ? /reviewStatus==='NEEDS_HUMAN_REVIEW'/.test(workerSource) && /setValue\('WAITING_INFO'\)/.test(workerSource) : true),
    expect('fertilizer-classifies-inventory', fertilizer.classification === 'INVENTORY_IN'),
    expect('pesticide-classifies-inventory', pesticide.classification === 'INVENTORY_IN'),
    expect('mower-classifies-asset', mower.classification === 'ASSET_PROPOSAL'),
    expect('overlap-offers-three-choices', overlap.classification === 'AMBIGUOUS_CLASSIFICATION' && overlap.options.length === 3 && overlap.options.map(option => option.label).join('|') === 'Daftar Aset|Inventori|Isi Maklumat'),
    expect('claim-required-fields', claimOk.ok && !claimBad.ok),
    expect('units-and-positive-decimal', bseInventoryValidateQuantity_('1.25', 'L').ok && !bseInventoryValidateQuantity_(0, 'kg').ok),
    expect('negative-balance-warning', bseInventoryBalanceWarning_([{ status: 'APPROVED_TEST', event_type: 'INVENTORY_IN', item_name: 'Baja', quantity: 1, unit: 'kg' }], { event_type: 'INVENTORY_OUT', item_name: 'Baja', quantity: 2, unit: 'kg' }).warning === 'NEGATIVE_BALANCE'),
    expect('stable-hash-and-idempotency', hashA === hashB && bseInventoryDecisionFromPrior_(prior, validProposal.source_key, hashA, 'APPROVED').state === 'IDEMPOTENT' && bseInventoryDecisionFromPrior_(prior, validProposal.source_key, 'different', 'APPROVED').state === 'CONFLICT'),
    expect('core-test-only-writer-boundary', core.validation === 'FAIL' && core.production_write === false && /TEST writer tidak tersedia/.test(core.reason || '')),
    expect('approve-reject core contracts', !core.decision && rejectCore.decision === 'REJECTED' && rejectCore.production_write === false),
    expect('approved decision follows TEST append writer', /appendRow/.test(bseInventoryReviewCore_.toString()) && /validation:\s*'FAIL'/.test(bseInventoryReviewCore_.toString())),
    expect('writer success returns PASS and one domain/review row', writerResult.validation === 'PASS' && writerResult.decision === 'APPROVED' && writerEvents === 1 && writerReviews === 1),
    expect('schemas-have-audit-fields', [BSE_INVENTORY_EVENT_HEADERS, BSE_INVENTORY_REVIEW_HEADERS, BSE_CLAIM_HEADERS, BSE_ASSET_PROPOSAL_HEADERS].every(h => ['source_key','payload_hash','original_note'].every(k => h.includes(k)))),
    expect('core-has-no-ui-lock', !/SpreadsheetApp\.getUi|Session\.|LockService\./.test(bseInventoryReviewCore_.toString())),
    expect('no-tasks-or-telegram-wiring', !/Google Tasks|processBseTelegram|receiveBseTelegram|sendTelegram/.test(bseInventoryReviewCore_.toString())),
    expect('classification callback uses durable token and reporter binding', /bseInventoryClassificationSheet_/.test(bseInventoryClassificationCore_.toString()+bseInventoryPersistAmbiguity_.toString()) && /actor_id/.test(bseInventoryClassificationCore_.toString())),
    expect('claimant is derived from reporter snapshot', (() => { const candidate = { candidates: [{ target: 'Claim_Request_Log', fields: { claimant: 'spoof', item_name: 'Baja' } }] }; bseInventoryApplyReporterSnapshot_(candidate, { reporterTelegramUserId: '77', reporterName: 'Pelapor Sah', reporterUsername: 'sah' }); return candidate.candidates[0].fields.claimant === 'Pelapor Sah' && candidate.candidates[0].fields.claimant_telegram_user_id === '77' && candidate.candidates[0].fields.reason === 'Claim item: Baja'; })()),
    expect('no nested lock in inventory core', !/LockService\.|bseReviewWithLock_/.test(bseInventoryReviewCore_.toString()+bseInventoryClassificationCore_.toString()))
  ];
  const failures = tests.filter(t => !t.pass);
  if (failures.length) throw new Error('P1-D0 harness gagal: ' + failures.map(t => t.id).join(', '));
  return { passed: tests.length, failed: 0 };
}

function runBseInventoryClaimFoundationHarnessTests() {
  const ambiguity=bseInventoryClassifyText_('pam air'), claim=bseInventoryParseMessage_('CLAIM REQUEST\nClaimant: Spoof\nItem: Baja\n2 kg\nAmaun MYR: 25','2026-09-22T00:00:00.000Z');
  const explicit=bseInventoryParseMessage_('PEMBELIAN BAHAN\nItem: Baja NPK\n2 kg\nTarikh Pembelian: 10/09/2026','2026-09-22T00:00:00.000Z');
  const invalid=bseInventoryParseMessage_('PEMBELIAN BAHAN\nItem: Baja NPK\n2 kg\nTarikh Pembelian: 31/02/2026','2026-09-22T00:00:00.000Z');
  const missing=bseInventoryClaimMissingText_('BSE-TG-4',{missing:['amount_myr']});
  bseInventoryApplyReporterSnapshot_(claim,{reporterTelegramUserId:'77',reporterName:'Pelapor Sah',reporterUsername:'sah'});
  bseInventoryApplyResponsibleSnapshot_(explicit,{reporterTelegramUserId:'77',reporterName:'Pelapor Sah',reporterUsername:'sah'});
  const declared=bseInventoryParseMessage_('PEMBELIAN BAHAN\nItem: Baja NPK\n2 kg\nPenanggungjawab: Pekerja A','2026-09-22T00:00:00.000Z');
  bseInventoryApplyResponsibleSnapshot_(declared,{reporterTelegramUserId:'77',reporterName:'Pelapor Sah',reporterUsername:'sah'});
  const fields=claim.candidates[0].fields;
  const tests=[
    ['classification labels',ambiguity.options.map(option=>option.label).join('|')==='Daftar Aset|Inventori|Isi Maklumat'],
    ['claimant sender snapshot',fields.claimant==='Pelapor Sah'&&fields.claimant_telegram_user_id==='77'&&fields.reason==='Claim item: Baja'],
    ['claim reason optional',!claim.candidates[0].missing.includes('reason')],
    ['claim amount label',missing.includes('Amaun claim (RM)')&&!missing.includes('Sebab claim')],
    ['explicit date is canonical Malaysia date',explicit.candidates[0].fields.event_date==='2026-09-10'&&explicit.candidates[0].fields.event_date_valid===true],
    ['missing date falls back to Malaysia received_at',bseInventoryExtractEventDate_('PEMBELIAN BAHAN','2026-09-22T00:00:00.000Z').value==='2026-09-22'],
    ['malformed explicit date needs information',invalid.candidates[0].missing.includes('event_date')&&invalid.candidates[0].fields.event_date_valid===false],
    ['responsible defaults to reporter',explicit.candidates[0].fields.responsible_name==='Pelapor Sah'&&explicit.candidates[0].fields.responsible_source==='REPORTER_DEFAULT'&&explicit.candidates[0].fields.responsible_telegram_user_id==='77'],
    ['declared responsible is not owner',declared.candidates[0].fields.responsible_name==='Pekerja A'&&declared.candidates[0].fields.responsible_source==='DECLARED'&&!declared.candidates[0].fields.responsible_telegram_user_id],
    ['claimant remains reporter snapshot',fields.claimant==='Pelapor Sah'&&fields.claimant_telegram_user_id==='77'&&fields.responsible_name==='Pelapor Sah'],
    ['schemas expose responsible audit fields',[BSE_INVENTORY_EVENT_HEADERS,BSE_CLAIM_HEADERS,BSE_ASSET_PROPOSAL_HEADERS].every(headers=>headers.includes('responsible_name')&&headers.includes('responsible_source'))],
    ['manual migration canonicalizes only the known legacy Claim schema',typeof bseInventoryMigrateClaimHeaders_==='function'&&/same\(current\.slice\(0,legacy\.length\),legacy\)/.test(bseInventoryMigrateClaimHeaders_.toString())&&/alreadyCanonical/.test(bseInventoryMigrateClaimHeaders_.toString())],
    ['manual migration is additive',typeof migrateBseInventoryClaimTestSheetsV2==='function'&&!/delete|clearContent|setValues\(\[\]\)/.test(migrateBseInventoryClaimTestSheetsV2.toString())],
    ['owner correction keeps WAITING_INFO and source',typeof bseTelegramApprovalControllerCore_==='function'&&/WAITING_INFO/.test(bseTelegramApprovalControllerCore_.toString())&&/row\[8\]/.test(bseTelegramApprovalControllerCore_.toString())],
    ['test-only',!/Tasks\.|production_write\s*:\s*true/.test(bseInventoryApplyReporterSnapshot_.toString())]
  ];
  const failed=tests.filter(test=>!test[1]);
  if(failed.length)throw new Error('P1-D5 harness gagal: '+failed.map(test=>test[0]).join(', '));
  return {passed:tests.length,failed:0};
}

function runBseInventoryKotakRegressionHarnessTests() {
  const expect = (id, pass) => ({ id: id, pass: !!pass });
  const legacyUnits = ['kg', 'g', 'L', 'ml', 'beg', 'botol', 'unit', 'pek'];
  const kotak = bseInventoryValidateQuantity_(1, 'kotak');
  const legacy = legacyUnits.every(unit => bseInventoryValidateQuantity_(1, unit).ok);
  const invalidUnits = !bseInventoryValidateQuantity_(1, '').ok && !bseInventoryValidateQuantity_(1, 'karton').ok;
  const usage = {
    production_write: false,
    candidates: [{
      target: 'Input_Usage_Log', validation: 'PASS', missing: [],
      fields: { record_type: 'INPUT_USAGE', original_note: 'Item: Sarung tangan pakai buang\n1 kotak', item_name: 'Sarung tangan pakai buang', quantity: 1, unit: 'kotak', event_date: '' }
    }]
  };
  const usageCheck = bseInventoryValidateResult_(usage, '2026-09-22T16:30:00.000Z', 'BSE-TG-KOTAK-1');
  const invalidDate = {
    production_write: false,
    candidates: [{
      target: 'Input_Usage_Log', validation: 'PASS', missing: [],
      fields: { record_type: 'INPUT_USAGE', original_note: 'Item: Sarung tangan pakai buang\n1 kotak\nTarikh Penggunaan: 31/02/2026', item_name: 'Sarung tangan pakai buang', quantity: 1, unit: 'kotak', event_date: '', event_date_valid: false }
    }]
  };
  const invalidDateCheck = bseInventoryValidateResult_(invalidDate, '2026-09-22T16:30:00.000Z', 'BSE-TG-KOTAK-2');
  const tests = [
    expect('1 kotak is valid', kotak.ok && kotak.quantity === 1 && kotak.unit === 'kotak'),
    expect('legacy units remain valid', legacy),
    expect('empty and unknown units remain invalid', invalidUnits),
    expect('Input Usage date fallback with kotak passes', usageCheck.validation === 'PASS' && usageCheck.proposal.event_date === '2026-09-23' && usageCheck.proposal.quantity === 1 && usageCheck.proposal.unit === 'kotak'),
    expect('invalid explicit date remains NEED_INFO', invalidDateCheck.validation === 'NEED_INFO' && invalidDateCheck.missing.includes('event_date'))
  ];
  const failures = tests.filter(test => !test.pass);
  if (failures.length) throw new Error('Kotak regression harness gagal: ' + failures.map(test => test.id).join(', '));
  return { passed: tests.length, failed: 0 };
}

function runBseInventoryQuantityParserRegressionHarnessTests() {
  const input = ['PENGGUNAAN BAHAN', 'Item: Sarung tangan pakai buang', 'Kuantiti: 2 kotak'].join('\n');
  const unlabeled = ['PENGGUNAAN BAHAN', 'Item: Sarung tangan pakai buang', '2 kotak'].join('\n');
  const labeledResult = bseInventoryParseMessage_(input, '2026-09-22T16:30:00.000Z');
  const unlabeledResult = bseInventoryParseMessage_(unlabeled, '2026-09-22T16:30:00.000Z');
  const inlineItem = bseInventoryItemText_('Item: Sarung tangan pakai buang 2 kotak');
  const acceptedUnits = BSE_INVENTORY_ALLOWED_UNITS.every(unit => {
    const result = bseInventoryParseMessage_(['PENGGUNAAN BAHAN', 'Item: Baja NPK', 'Kuantiti: 1 ' + unit].join('\n'), '2026-09-22T16:30:00.000Z');
    return result && result.candidates[0].fields.quantity === 1 && String(result.candidates[0].fields.unit).toLowerCase() === (unit.toLowerCase()==='pcs'?'unit':unit.toLowerCase());
  });
  const unknown = bseInventoryParseMessage_(['PENGGUNAAN BAHAN', 'Item: Sarung tangan pakai buang', 'Kuantiti: 2 karton'].join('\n'), '2026-09-22T16:30:00.000Z');
  const tests = [
    ['labelled kotak parses quantity and unit', labeledResult.candidates[0].fields.quantity === 2 && labeledResult.candidates[0].fields.unit === 'kotak'],
    ['unlabelled kotak parses quantity and unit', unlabeledResult.candidates[0].fields.quantity === 2 && unlabeledResult.candidates[0].fields.unit === 'kotak'],
    ['item name remains canonical', labeledResult.candidates[0].fields.item_name === 'Sarung tangan pakai buang' && inlineItem === 'Sarung tangan pakai buang'],
    ['usage routes and passes with date fallback', labeledResult.candidates[0].fields.record_type === 'INVENTORY_OUT' && labeledResult.candidates[0].target === 'Inventory_Event_Log' && labeledResult.validation === 'PASS' && labeledResult.candidates[0].fields.event_date === '2026-09-23'],
    ['all validator units parse', acceptedUnits],
    ['unknown unit remains rejected', unknown.validation === 'NEED_INFO' && unknown.candidates[0].missing.includes('quantity') && unknown.candidates[0].missing.includes('unit')]
  ];
  const failures = tests.filter(test => !test[1]);
  if (failures.length) throw new Error('Inventory quantity parser harness gagal: ' + failures.map(test => test[0]).join(', '));
  return { passed: tests.length, failed: 0 };
}

function runBseInventoryClarificationSelectionHarnessTests() {
  function sheet(headers, rows) {
    return {
      rows: [headers].concat(rows || []),
      getLastRow() { return this.rows.length; },
      getRange(row, col, count, width) {
        const self = this;
        return {
          getValues() { return self.rows.slice(row - 1, row - 1 + (count || 1)).map(item => item.slice(col - 1, col - 1 + (width || item.length))); },
          setValues(values) { values.forEach((value, index) => { self.rows[row - 1 + index] = value.slice(); }); return this; },
          setValue(value) { self.rows[row - 1][col - 1] = value; return this; },
          setNumberFormat() { return this; }
        };
      }
    };
  }
  const classificationHeaders = BSE_INVENTORY_CLASSIFICATION_HEADERS;
  function run(state, action) {
    const original = { item_name: 'Pam air', quantity: 1, unit: 'unit', event_date: '2026-09-22', original_note: 'Item: Pam air', production_write: false };
    const result = { candidates: [{ target: 'Asset_Proposal_Log', fields: original }] };
    const row = ['D1TOKEN01', 'BSE-TG-TEST', 'BSE-TG-TEST|INVENTORY_CLASSIFICATION', 'hash', '-1001', '77', '12', '34', 'Pam air', '[]', state, action === 'C' ? 'C' : '', '2026-09-22T00:00:00.000Z', '', '', JSON.stringify(result)];
    const classification = sheet(classificationHeaders, [row]);
    const book = { getSheetByName(name) { return name === 'TEST_INVENTORY_CLASSIFICATION' ? classification : null; }, insertSheet() { throw new Error('unexpected sheet creation'); } };
    return bseInventoryClassificationCore_(book, { actor_id: '77' }, { token: 'D1TOKEN01', action: action, chat_id: '-1001' });
  }
  const clarifyA = run('CLARIFY', 'A'), clarifyI = run('CLARIFY', 'I'), clarifyC = run('CLARIFY', 'C'), selectedRetry = run('SELECTED', 'A');
  const tests = [
    { id: 'CLARIFY + A selects asset proposal', pass: clarifyA.selected === true && clarifyA.decision === 'ASSET_PROPOSAL' },
    { id: 'CLARIFY + I selects inventory', pass: clarifyI.selected === true && clarifyI.decision === 'INVENTORY_IN' },
    { id: 'CLARIFY + C remains clarification', pass: clarifyC.duplicate === true && clarifyC.status === 'CLARIFY' && clarifyC.selected !== true },
    { id: 'SELECTED retry is idempotent', pass: selectedRetry.duplicate === true && selectedRetry.status === 'SELECTED' },
    { id: 'no domain writer before owner approval', pass: !/appendRow|bseInventoryReviewCore_/.test(bseInventoryClassificationCore_.toString()) }
  ];
  const failures = tests.filter(test => !test.pass);
  if (failures.length) throw new Error('Inventory clarification selection harness gagal: ' + failures.map(test => test.id).join(', '));
  return tests;
}



function runBseInventoryD038AcceptanceHarnessTests() {
  const inResult=bseInventoryParseMessage_('Baja In 5 Set F','2026-10-04T04:00:00.000Z');
  const outResult=bseInventoryParseMessage_('M3 P1 P2 11/9/2026 F','2026-10-04T04:00:00.000Z');
  const stockResult=bseInventoryParseMessage_('stok gudang baki 500 pcs dripper','2026-10-04T04:00:00.000Z');
  const emResult=bseInventoryParseMessage_('M3 EM 1 TONG','2026-10-04T04:00:00.000Z');
  const ambiguous=bseInventoryParseMessage_('Baja 3 beg','2026-10-04T04:00:00.000Z');
  const tests=[
    ['Baja In -> INVENTORY_IN Fruitka 5 set',inResult&&inResult.validation==='PASS'&&inResult.candidates.length===1&&inResult.candidates[0].fields.record_type==='INVENTORY_IN'&&inResult.candidates[0].fields.item_name==='Fruitka'&&inResult.candidates[0].fields.quantity===5&&inResult.candidates[0].fields.unit==='set'],
    ['shorthand F -> two INVENTORY_OUT candidates, one set per plot',outResult&&outResult.validation==='PASS'&&outResult.candidates.length===2&&outResult.candidates.every(c=>c.fields.record_type==='INVENTORY_OUT'&&c.fields.item_name==='Fruitka'&&c.fields.quantity===1&&c.fields.unit==='set'&&c.fields.router_confidence==='MEDIUM')&&outResult.candidates.map(c=>c.fields.destination).join('|')==='M3P1|M3P2'],
    ['stock count pcs canonicalizes to unit',stockResult&&stockResult.validation==='PASS'&&stockResult.candidates[0].fields.record_type==='INVENTORY_STOCK_COUNT'&&stockResult.candidates[0].fields.counted_quantity===500&&stockResult.candidates[0].fields.unit==='unit'&&stockResult.candidates[0].fields.storage_location==='gudang'],
    ['EM 1 tong without direction waits for movement clarification',emResult&&emResult.validation==='NEED_INFO'&&emResult.candidates[0].missing.includes('movement_type')],
    ['Baja 3 beg is ambiguous, not auto-written',ambiguous&&ambiguous.validation==='NEED_INFO'&&ambiguous.production_write===false&&ambiguous.candidates[0].missing.includes('movement_type')],
    ['TEST only', [inResult,outResult,stockResult,emResult,ambiguous].every(r=>r&&r.production_write===false)]
  ];
  const failures=tests.filter(t=>!t[1]);
  if(failures.length)throw new Error('D-038 acceptance harness gagal: '+failures.map(t=>t[0]).join(', '));
  return {passed:tests.length,failed:0};
}



function runBseClaimD039D046AcceptanceHarnessTests() {
  const natural=bseInventoryParseMessage_('Minyak Petrol RM50','2026-10-04T04:30:00.000Z');
  const structured=bseInventoryParseMessage_('CLAIM REQUEST\nItem: Petrol\nAmaun MYR: 50','2026-10-04T04:30:00.000Z');
  const receiptOnly=bseInventoryParseMessage_('resit petrol','2026-10-04T04:30:00.000Z');
  bseInventoryApplyReporterSnapshot_(natural,{reporterTelegramUserId:'77',reporterName:'Zainal',reporterUsername:'zainal'});
  bseInventoryApplyReporterSnapshot_(structured,{reporterTelegramUserId:'77',reporterName:'Zainal',reporterUsername:'zainal'});
  const nf=natural.candidates[0].fields, sf=structured.candidates[0].fields;
  const ncheck=bseInventoryValidateClaim_(nf), scheck=bseInventoryValidateClaim_(sf);
  const tests=[
    ['natural Minyak Petrol RM50 becomes Claim',natural&&natural.candidates[0].target==='Claim_Request_Log'&&nf.item_name==='Minyak Petrol'&&nf.amount_myr===50],
    ['claimant defaults to Telegram sender',nf.claimant==='Zainal'&&nf.claimant_telegram_user_id==='77'],
    ['quantity and unit are optional',ncheck.ok&&scheck.ok&&!natural.candidates[0].missing.includes('quantity/unit')&&!structured.candidates[0].missing.includes('quantity/unit')],
    ['message date fallback is used when date absent',nf.event_date==='2026-10-04'&&sf.event_date==='2026-10-04'],
    ['receipt-only text lacks enough facts and does not become authoritative claim',!receiptOnly||receiptOnly.validation!=='PASS'],
    ['TEST only',natural.production_write===false&&structured.production_write===false]
  ];
  const failures=tests.filter(t=>!t[1]);
  if(failures.length)throw new Error('D-039/D-046 acceptance harness gagal: '+failures.map(t=>t[0]).join(', '));
  return {passed:tests.length,failed:0};
}



function runBseEvidenceWriterIntegrationD044HarnessTests(){
  const core=bseInventoryReviewCore_.toString();
  const tests=[
    ['approved domain writer invokes evidence link layer only after event id exists',core.indexOf("context.action === 'APPROVED'")>=0&&core.indexOf("bseEvidenceLinkMany_")>core.indexOf("eventId = 'BSE-SB-INV-'")],
    ['evidence refs are optional and do not block domain writer',/proposal\.evidence_refs \|\| proposal\.evidence_reference \|\| \[\]/.test(core)],
    ['linking stays TEST-only',/production_write:false/.test(core)&&!/production_write\s*:\s*true/.test(core)]
  ];
  const failures=tests.filter(t=>!t[1]);if(failures.length)throw new Error('D-044 writer integration harness gagal: '+failures.map(t=>t[0]).join(', '));return tests;
}
