const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const src=fs.readFileSync(__dirname+'/InventoryReviewTest.js','utf8');
function load(name){const start=src.indexOf('function '+name+'(');if(start<0)throw Error('missing '+name);let i=src.indexOf('{',start),depth=0,end=-1;for(;i<src.length;i++){if(src[i]==='{')depth++;if(src[i]==='}'&&!--depth){end=i+1;break}}vm.runInThisContext(src.slice(start,end));}
for(const n of ['bseInventoryAssetRecoveryDecision_','bseInventoryDecisionFromPrior_','bseInventoryReviewCore_'])load(n);
const headers=Array(30).fill('x'),assets=[],reviews=[],queue=[['123',null,null,null,null,null,'NEEDS_HUMAN_REVIEW']];
const sheet=(rows)=>({getLastRow:()=>rows.length+1,getRange:(r,c,n,w)=>({getValues:()=>rows.slice(r-2,r-2+n),setValue:(v)=>{rows[r-2][c-1]=v}}),appendRow:(r)=>rows.push(r)});
const book={getSheetByName:(name)=>name==='TEST_ASSET_EVENT'?sheet(assets):name==='TEST_INVENTORY_REVIEW'?sheet(reviews):name==='TELEGRAM_TEST_QUEUE'?sheet(queue):null};
global.bseReviewContextValidate_=x=>x;global.bseInventoryValidateProposal_=()=>({ok:true});global.bseInventoryPayloadHash_=()=>('a'.repeat(64));global.bseInventorySourceKey_=(r,d)=>r+'|'+d;global.bseInventoryEnsureSheet_=(b,n)=>b.getSheetByName(n);
global.BSE_ASSET_EVENT_HEADERS=headers;global.BSE_INVENTORY_REVIEW_HEADERS=Array(14);global.BSE_TG_QUEUE_HEADERS=Array(18);
global.Utilities={getUuid:()=>'uuid'};global.SpreadsheetApp={flush:()=>{}};global.bseEvidenceRefs_=(x)=>Array.isArray(x)?x: [x].filter(Boolean);
let fail=true,linked=0;global.bseEvidenceLinkMany_=()=>{if(fail){fail=false;throw Error('FAULT_INJECTED_LINK_FAIL')} linked++;return {links:[]}};
const proposal={domain:'ASSET_ACQUISITION',source_key:'BSE-TG-123|ASSET_ACQUISITION',asset_name:'mesin rumput',original_note:'beli mesin rumput baru',evidence_refs:['BSE-EV-X'],production_write:false};
const ctx={reference:'BSE-TG-123',action:'APPROVED',actor_name:'TEST',actor_id:'TEST',reporter_name:'TEST',proposal};
let firstFailed=false;try{bseInventoryReviewCore_(book,{...ctx,proposal:{...proposal}})}catch(e){firstFailed=/FAULT_INJECTED/.test(e.message)}
assert(firstFailed,'first run must inject link failure');assert.equal(assets.length,1);assert.equal(reviews.length,0);assert.equal(linked,0);
const second=bseInventoryReviewCore_(book,{...ctx,proposal:{...proposal}});assert.equal(second.validation,'PASS');assert.equal(assets.length,1);assert.equal(reviews.length,1);assert.equal(linked,1);
const third=bseInventoryReviewCore_(book,{...ctx,proposal:{...proposal}});assert.equal(third.duplicate,true);assert.equal(assets.length,1);
let row=assets[0];assert.equal(bseInventoryAssetRecoveryDecision_([row],row[0],row[1],row[19],row[2]).state,'RECOVER_EXISTING');
assert.equal(bseInventoryAssetRecoveryDecision_([row],row[0],row[1],'different',row[2]).state,'CONFLICT');
assert.equal(bseInventoryAssetRecoveryDecision_([row,row],row[0],row[1],row[19],row[2]).state,'CONFLICT');
assert.equal(bseInventoryAssetRecoveryDecision_([],row[0],row[1],row[19],row[2]).state,'NEW');
console.log('RM001_RECOVERY_FAULT_TEST PASS cases=7 asset_rows=1 reviews=1 links=1');
