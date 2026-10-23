const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require('path').join(__dirname,'..','TelegramApprovalUiTest.js'),'utf8');
const context={console,Set,bseApprovalDisplayDate_:x=>x,bseTransplantRowsByName_:()=>[['key','1','event','batch','2026-10-23','TRANSPLANT','Timun','7055 CCB','M3P3|M3P4']],BSE_TRANSPLANT_EVENT_HEADERS:[],bseOperationConfirmedSummary_:()=> 'REKOD OPERASI\nRujukan : BSE-TG-2\nPlot : M3P3',bseTestOwnerRows_:()=>[],bseTestOwnerFromRow_:x=>x};
vm.createContext(context);vm.runInContext(source,context);
const transplant=context.bseCropLifecycleReceipt_({},'BSE-TG-1','Transplant_Event_Log',{}, {source_key:'key'},'dzuddiyn');
assert(transplant.includes('M3P3, M3P4'));assert(transplant.includes('Pelapor: dzuddiyn'));assert(transplant.split('\n').length>=6);
const harvest=context.bseCropLifecycleReceipt_({},'BSE-TG-2','Operation_Log',{candidates:[{fields:{operation_type:'Mula Tuai'}}]},{source_key:'x'},'dzuddiyn');
assert(harvest.includes('MULA TUAI DIREKODKAN'));assert(harvest.includes('Pelapor: dzuddiyn'));
assert(!context.bseCropLifecycleReceipt_({},'BSE-TG-3','Operation_Log',{candidates:[{fields:{operation_type:'Baja'}}]},{source_key:'x'},'dzuddiyn'));
let edits=0, sends=0;context.bseTelegramApi_=(method)=>{if(method==='editMessageText')edits++;else sends++;return {message_id:77};};
assert(context.bseTelegramApprovalCloseCard_(['BSE-TG-1',null,null,null,null,null,null,'12',null,'77'],'REPORTER_CONFIRMED','dzuddiyn','ok').edited);
assert.equal(edits,1);assert.equal(sends,0);
context.bseTelegramApi_=()=>{throw Error('network timeout')};assert(context.bseTelegramApprovalCloseCard_(['BSE-TG-1',null,null,null,null,null,null,'12',null,'77'],'REPORTER_CONFIRMED','dzuddiyn','ok').unverified);
console.log('CL_H04_TARGETED: 7 assertions PASS');

const sent=[];context.bseTestOwnerRows_=()=>[
 {owner_id:'a',is_active:true,private_chat_id:'12'},
 {owner_id:'b',is_active:true,private_chat_id:'19'},
 {owner_id:'c',is_active:true,private_chat_id:'19'}];
context.bseTestOwnerFromRow_=r=>r;
context.bseTelegramApi_=(method,payload)=>{sent.push({method,chat_id:payload.chat_id});return {message_id:9}};
const owners=context.bseCropLifecycleDistinctOwnerNotice_({},'confirmed','12');
assert.equal(sent.length,1);assert.equal(String(sent[0].chat_id),'19');
assert.equal(owners.length,1);
assert(source.includes("bseTestOwnerForTelegramUser_(book,String(row[3]||''))"));
assert(source.includes("outcome.receipt_state=delivery&&delivery.edited?'CARD_EDIT_ACKNOWLEDGED':'CARD_EDIT_UNVERIFIED'"));
console.log('CL_H04_ROUTING: 5 assertions PASS');

sent.length=0;
context.bseTestOwnerRows_=()=>[
 {owner_id:'reporter',telegram_user_id:'5',is_active:true,private_chat_id:'55'},
 {owner_id:'other',telegram_user_id:'8',is_active:true,private_chat_id:'99'}];
context.bseCropLifecycleDistinctOwnerNotice_({},'confirmed','12','5');
assert.equal(sent.length,1);assert.equal(String(sent[0].chat_id),'99');
console.log('CL_H04_SAME_REPORTER_GROUP_PM: PASS');
