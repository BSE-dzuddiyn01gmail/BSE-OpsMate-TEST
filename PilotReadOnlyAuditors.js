// Global PILOT_TEST read-only auditors.
// These functions intentionally use getSheetByName/getRange/getValues only and never call
// additive header helpers, sheet creators, formatting/writer APIs, Telegram or external services.

function bsePilotAuditRegistry_(){
  return [
    ['TELEGRAM_TEST_QUEUE',BSE_TG_QUEUE_HEADERS],
    ['TEST_TELEGRAM_APPROVAL_UI',BSE_APPROVAL_UI_HEADERS],
    ['TEST_TELEGRAM_APPROVAL_CALLBACK_PENDING',BSE_APPROVAL_CALLBACK_HEADERS],
    ['TEST_INVENTORY_REVIEW',BSE_INVENTORY_REVIEW_HEADERS],
    ['TEST_INVENTORY_EVENT',BSE_INVENTORY_EVENT_HEADERS],
    ['TEST_INVENTORY_CLASSIFICATION',BSE_INVENTORY_CLASSIFICATION_HEADERS],
    ['TEST_CLAIM_LOG',BSE_CLAIM_HEADERS],
    ['TEST_ASSET_PROPOSAL',BSE_ASSET_PROPOSAL_HEADERS],
    ['TEST_ASSET_EVENT',BSE_ASSET_EVENT_HEADERS],
    ['TEST_LEAVE_RECORD',BSE_LEAVE_HEADERS],
    ['TEST_MAINTENANCE_EVENT',BSE_MAINTENANCE_HEADERS],
    ['TEST_MEASUREMENT_LOG',BSE_MEASUREMENT_LOG_HEADERS],
    ['TEST_MEASUREMENT_REVIEW',BSE_MEASUREMENT_REVIEW_HEADERS],
    ['TEST_OBSERVATION_LOG',BSE_OBSERVATION_LOG_HEADERS],
    ['TEST_OBSERVATION_REVIEW',BSE_OBSERVATION_REVIEW_HEADERS],
    ['TEST_PLANT_CONDITION',BSE_PLANT_CONDITION_HEADERS],
    ['TEST_CROP_BATCH',BSE_CROP_BATCH_HEADERS],
    ['TEST_PLANTING_EVENT',BSE_PLANTING_EVENT_HEADERS],
    ['TEST_PLOT_ALLOCATION',BSE_PLOT_ALLOCATION_HEADERS],
    ['TEST_CROP_BATCH_REVIEW',BSE_CROP_BATCH_REVIEW_HEADERS],
    ['TEST_TRANSPLANT_EVENT',BSE_TRANSPLANT_EVENT_HEADERS],
    ['TEST_ALLOCATION_STATUS_EVENT',BSE_ALLOCATION_STATUS_EVENT_HEADERS],
    ['TEST_TRANSPLANT_REVIEW',BSE_TRANSPLANT_REVIEW_HEADERS],
    ['TEST_PLANT_CENSUS',BSE_PLANT_CENSUS_HEADERS],
    ['TEST_PLANT_CENSUS_REVIEW',BSE_PLANT_CENSUS_REVIEW_HEADERS],
    ['TEST_TREATMENT_EVENT',BSE_TREATMENT_EVENT_HEADERS],
    ['TEST_TREATMENT_ALLOCATION_LINK',BSE_TREATMENT_ALLOCATION_LINK_HEADERS],
    ['TEST_TREATMENT_REVIEW',BSE_TREATMENT_REVIEW_HEADERS],
    ['TEST_FILE_EVIDENCE',BSE_TG_EVIDENCE_HEADERS],
    ['TEST_FILE_EVIDENCE_CALLBACK_PENDING',BSE_TG_EVIDENCE_CALLBACK_HEADERS],
    ['TEST_EVIDENCE_DOMAIN_LINK',BSE_EVIDENCE_DOMAIN_LINK_HEADERS],
    ['TEST_OWNER_REGISTRY',BSE_TEST_OWNER_REGISTRY_HEADERS],
    ['TEST_TELEGRAM_USER_REGISTRY',BSE_TG_REGISTRATION_HEADERS],
    ['TEST_TELEGRAM_REGISTRATION_CARD',BSE_TG_REGISTRATION_CARD_HEADERS],
    ['TEST_TELEGRAM_REGISTRATION_CALLBACK_PENDING',BSE_TG_REGISTRATION_CALLBACK_HEADERS],
    ['TEST_TELEGRAM_PRIVATE_OPT_IN',BSE_TELEGRAM_PRIVATE_OPT_IN_HEADERS],
    ['TEST_TELEGRAM_PRIVATE_OPT_IN_NUDGE',BSE_TELEGRAM_PRIVATE_OPT_IN_NUDGE_HEADERS],
    ['TEST_TELEGRAM_HISTORY_AUDIT',BSE_TG_HISTORY_AUDIT_HEADERS],
    ['TEST_TELEGRAM_PLOT_STATUS_AUDIT',BSE_TG_PLOT_STATUS_AUDIT_HEADERS],
    ['TEST_TELEGRAM_RECORD_RETRIEVAL_AUDIT',BSE_TG_RECORD_RETRIEVAL_AUDIT_HEADERS],
    ['TEST_TELEGRAM_REPORT_AUDIT',BSE_TG_REPORT_AUDIT_HEADERS],
    ['TEST_TELEGRAM_RETRIEVAL_AUDIT',BSE_TG_RETRIEVAL_AUDIT_HEADERS]
  ];
}
function bsePilotAuditSafety_(){
  const status=getBsePilotTestRuntimeBindingStatus();
  return {
    ok:!!status&&status.environment==='PILOT_TEST'&&status.automation==='OFF'&&
      status.production_write===false&&status.official_bse_write===false&&
      status.spreadsheet_bound===true&&status.evidence_folder_bound===true,
    status:status
  };
}
function bsePilotAuditHeaderDelta_(expected,actual){
  const e=(expected||[]).map(String),a=(actual||[]).map(String);
  const missing=e.filter(x=>!a.includes(x)),extra=a.filter(x=>x&&!e.includes(x));
  const sameLength=e.length===a.length,exact=sameLength&&e.every((x,i)=>x===a[i]);
  const orderMismatch=!exact&&missing.length===0&&extra.length===0&&sameLength;
  return {exact:exact,missing:missing,extra:extra,order_mismatch:orderMismatch};
}
function bsePilotAuditSheetSnapshot_(book,legacyName,headers){
  const mapped=bseRuntimeSheetName_(legacyName),sheet=book.getSheetByName(mapped);
  if(!sheet)return {legacy_name:legacyName,sheet:mapped,status:'MISSING',row_count:0,headers:[],delta:{exact:false,missing:(headers||[]).slice(),extra:[],order_mismatch:false}};
  const width=Math.max(1,sheet.getLastColumn()),actual=sheet.getLastRow()?sheet.getRange(1,1,1,width).getValues()[0].map(v=>String(v==null?'':v)):[];
  while(actual.length&&actual[actual.length-1]==='')actual.pop();
  const delta=bsePilotAuditHeaderDelta_(headers,actual);
  const status=delta.exact?'CURRENT':(delta.order_mismatch?'SOURCE_MISMATCH':'STALE');
  return {legacy_name:legacyName,sheet:mapped,status:status,row_count:Math.max(0,sheet.getLastRow()-1),headers:actual,delta:delta};
}
function runBsePilotTestSchemaHeaderAudit(){
  const safety=bsePilotAuditSafety_();
  if(!safety.ok)return {status:'UNVERIFIED',safety:safety.status,production_write:false,sheets:[]};
  const book=boundTestBook_(),sheets=bsePilotAuditRegistry_().map(entry=>bsePilotAuditSheetSnapshot_(book,entry[0],entry[1]));
  const counts=sheets.reduce((a,s)=>(a[s.status]=(a[s.status]||0)+1,a),{});
  return {status:sheets.every(s=>s.status==='CURRENT')?'CURRENT':'SOURCE_MISMATCH',safety:safety.status,counts:counts,production_write:false,sheets:sheets};
}

function bsePilotAuditRows_(book,legacyName,headers){
  const mapped=bseRuntimeSheetName_(legacyName),sheet=book.getSheetByName(mapped);
  if(!sheet||sheet.getLastRow()<2)return {sheet:mapped,headers:(headers||[]).slice(),rows:[]};
  const width=(headers||[]).length;
  return {sheet:mapped,headers:(headers||[]).slice(),rows:sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues()};
}
function bsePilotAuditIndex_(headers){const out={};(headers||[]).forEach((h,i)=>out[String(h)]=i);return out;}
function bsePilotAuditCell_(row,index,name){return Object.prototype.hasOwnProperty.call(index,name)?String(row[index[name]]==null?'':row[index[name]]):'';}
function bsePilotAuditSourceEntries_(snapshot){
  const idx=bsePilotAuditIndex_(snapshot.headers),keyName=['source_key','reference','evidence_id','update_id'].find(h=>Object.prototype.hasOwnProperty.call(idx,h));
  if(!keyName)return [];
  return snapshot.rows.map((row,i)=>({sheet:snapshot.sheet,row:i+2,key:bsePilotAuditCell_(row,idx,keyName),hash:bsePilotAuditCell_(row,idx,'payload_hash'),status:bsePilotAuditCell_(row,idx,'status')||bsePilotAuditCell_(row,idx,'decision_status')||bsePilotAuditCell_(row,idx,'verification_status'),production:bsePilotAuditCell_(row,idx,'production_write'),official:bsePilotAuditCell_(row,idx,'official_bse_write')})).filter(x=>x.key);
}
function bsePilotAuditDuplicateIssues_(entries,allowDuplicateSheets){
  const issues=[],by={};
  entries.forEach(e=>{const k=e.sheet+'|'+e.key;(by[k]||(by[k]=[])).push(e);});
  Object.keys(by).forEach(k=>{const rows=by[k];if(rows.length<2||allowDuplicateSheets.has(rows[0].sheet))return;
    const hashes=Array.from(new Set(rows.map(x=>x.hash).filter(Boolean)));
    issues.push({type:hashes.length>1?'CONFLICTING_HASH':'DUPLICATE_SOURCE_KEY',sheet:rows[0].sheet,key:rows[0].key,rows:rows.map(x=>x.row),hashes:hashes});
  });
  return issues;
}
function runBsePilotTestSourceKeyAudit(){
  const safety=bsePilotAuditSafety_();
  if(!safety.ok)return {status:'UNVERIFIED',safety:safety.status,production_write:false,issues:[]};
  const book=boundTestBook_(),registry=bsePilotAuditRegistry_(),snapshots=registry.map(r=>bsePilotAuditRows_(book,r[0],r[1]));
  const entries=snapshots.flatMap(bsePilotAuditSourceEntries_);
  const allow=new Set(['PILOT_TEST_PLOT_ALLOCATION','PILOT_TEST_PLANT_CENSUS','PILOT_TEST_TREATMENT_ALLOCATION_LINK','PILOT_TEST_ALLOCATION_STATUS_EVENT']);
  const issues=bsePilotAuditDuplicateIssues_(entries,allow);
  entries.forEach(e=>{
    if(/^(true|yes|1)$/i.test(e.production))issues.push({type:'PRODUCTION_WRITE_TRUE',sheet:e.sheet,row:e.row,key:e.key});
    if(/^(true|yes|1)$/i.test(e.official))issues.push({type:'OFFICIAL_BSE_WRITE_TRUE',sheet:e.sheet,row:e.row,key:e.key});
  });
  const queue=snapshots.find(s=>s.sheet==='PILOT_TEST_TELEGRAM_QUEUE'),qidx=queue?bsePilotAuditIndex_(queue.headers):{},queueIds=new Set(queue?queue.rows.map(r=>bsePilotAuditCell_(r,qidx,'update_id')).filter(Boolean):[]);
  entries.filter(e=>e.sheet!=='PILOT_TEST_TELEGRAM_QUEUE'&&/^BSE-TG-\d+/.test(e.key)).forEach(e=>{
    const m=e.key.match(/^BSE-TG-(\d+)/);if(m&&!queueIds.has(m[1]))issues.push({type:'ORPHAN_SOURCE_KEY',sheet:e.sheet,row:e.row,key:e.key});
  });
  const approvals=snapshots.find(s=>s.sheet==='PILOT_TEST_TELEGRAM_APPROVAL_UI');
  if(approvals){const i=bsePilotAuditIndex_(approvals.headers);approvals.rows.forEach((r,n)=>{const state=bsePilotAuditCell_(r,i,'decision_status');if(state==='OPEN'||state==='CARD_SEND_PENDING'||state==='CARD_SEND_UNCERTAIN')issues.push({type:'UNRESOLVED_APPROVAL',sheet:approvals.sheet,row:n+2,key:bsePilotAuditCell_(r,i,'reference'),status:state});});}
  const callbacks=snapshots.find(s=>s.sheet==='PILOT_TEST_TELEGRAM_APPROVAL_CALLBACK_PENDING');
  if(callbacks){const i=bsePilotAuditIndex_(callbacks.headers);callbacks.rows.forEach((r,n)=>{const state=bsePilotAuditCell_(r,i,'status');if(state==='PENDING'||state==='FAILED')issues.push({type:'UNRESOLVED_CALLBACK',sheet:callbacks.sheet,row:n+2,key:bsePilotAuditCell_(r,i,'update_id'),status:state});});}
  return {status:issues.some(x=>/PRODUCTION_WRITE_TRUE|OFFICIAL_BSE_WRITE_TRUE|CONFLICTING_HASH/.test(x.type))?'FAIL_SAFETY':issues.length?'ANOMALIES':'CURRENT',production_write:false,safety:safety.status,snapshot_count:snapshots.length,entry_count:entries.length,issues:issues};
}
function runBsePilotReadOnlyAuditorHarnessTests(){
  const src=[runBsePilotTestSchemaHeaderAudit,bsePilotAuditSheetSnapshot_,runBsePilotTestSourceKeyAudit,bsePilotAuditRows_].map(f=>f.toString()).join('\n');
  const forbidden=/\b(?:insertSheet|appendRow|setValue|setValues|setFontWeight|setFrozenRows|deleteSheet|deleteRow|clear|bseEnsureAdditiveHeaders_)\b/;
  const tests=[
    {id:'auditors contain no write/repair API',pass:!forbidden.test(src)},
    {id:'header delta detects exact',pass:bsePilotAuditHeaderDelta_(['a','b'],['a','b']).exact===true},
    {id:'header delta detects reorder',pass:bsePilotAuditHeaderDelta_(['a','b'],['b','a']).order_mismatch===true},
    {id:'header delta detects missing/extra',pass:bsePilotAuditHeaderDelta_(['a','b'],['a','c']).missing[0]==='b'&&bsePilotAuditHeaderDelta_(['a','b'],['a','c']).extra[0]==='c'},
    {id:'duplicate detector flags conflict',pass:bsePilotAuditDuplicateIssues_([{sheet:'S',key:'K',row:2,hash:'A'},{sheet:'S',key:'K',row:3,hash:'B'}],new Set()).some(x=>x.type==='CONFLICTING_HASH')},
    {id:'allowed one-to-many not duplicate',pass:bsePilotAuditDuplicateIssues_([{sheet:'PILOT_TEST_PLANT_CENSUS',key:'K',row:2,hash:'A'},{sheet:'PILOT_TEST_PLANT_CENSUS',key:'K',row:3,hash:'A'}],new Set(['PILOT_TEST_PLANT_CENSUS'])).length===0}
  ];
  const failed=tests.filter(t=>!t.pass);if(failed.length)throw new Error('Read-only auditor harness gagal: '+failed.map(t=>t.id).join(', '));
  return {total:tests.length,passed:tests.length,failed:0,production_write:false,tests:tests};
}
