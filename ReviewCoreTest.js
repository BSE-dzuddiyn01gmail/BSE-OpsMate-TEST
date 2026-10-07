/** @OnlyCurrentDoc */
// Shared TEST-only review transaction boundary. Domain cores must remain UI/lock free.

function bseEnsureAdditiveHeaders_(sheet,headers) {
  if(!sheet||!Array.isArray(headers)||!headers.length)throw new Error('Kontrak header TEST tidak sah.');
  if(sheet.getMaxColumns()<headers.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),headers.length-sheet.getMaxColumns());
  if(!sheet.getLastRow()){
    sheet.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
  const width=Math.min(sheet.getLastColumn(),headers.length);
  const existing=width?sheet.getRange(1,1,1,width).getValues()[0]:[];
  if(existing.join('|')!==headers.slice(0,width).join('|'))throw new Error('Header TEST sedia ada tidak sepadan.');
  if(width<headers.length)sheet.getRange(1,width+1,1,headers.length-width).setValues([headers.slice(width)]);
  const actual=sheet.getRange(1,1,1,headers.length).getValues()[0];
  if(actual.join('|')!==headers.join('|'))throw new Error('Header TEST gagal dilengkapkan.');
  sheet.setFrozenRows(1);
  return sheet;
}

function runBseAdditiveHeaderHarnessTests() {
  const fake=function(initial,maxColumns){
    const state={row:(initial||[]).slice(),max:maxColumns||Math.max((initial||[]).length,1),frozen:0};
    return {
      state:state,
      getMaxColumns:function(){return state.max;},
      insertColumnsAfter:function(_after,count){state.max+=count;},
      getLastRow:function(){return state.row.some(v=>String(v||'')!=='')?1:0;},
      getLastColumn:function(){let i=state.row.length;while(i&&String(state.row[i-1]||'')==='')i--;return i;},
      getRange:function(_row,col,_rows,width){return {
        setValues:function(values){for(let i=0;i<width;i++)state.row[col-1+i]=values[0][i];return this;},
        setFontWeight:function(){return this;},
        getValues:function(){return [state.row.slice(col-1,col-1+width).concat(Array(Math.max(0,width-state.row.slice(col-1,col-1+width).length)).fill(''))];}
      };},
      setFrozenRows:function(n){state.frozen=n;}
    };
  };
  const headers=['a','b','c'];
  const empty=fake([],1);bseEnsureAdditiveHeaders_(empty,headers);
  const prefix=fake(['a','b'],2);bseEnsureAdditiveHeaders_(prefix,headers);
  let drift=false;try{bseEnsureAdditiveHeaders_(fake(['a','WRONG'],3),headers);}catch(_){drift=true;}
  const tests=[
    {id:'empty sheet initializes exact headers',pass:empty.state.row.join('|')===headers.join('|')&&empty.state.max===3&&empty.state.frozen===1},
    {id:'matching prefix extends additively',pass:prefix.state.row.join('|')===headers.join('|')&&prefix.state.max===3&&prefix.state.frozen===1},
    {id:'header drift is rejected',pass:drift}
  ];
  const failures=tests.filter(test=>!test.pass);if(failures.length)throw new Error('Additive header harness gagal: '+failures.map(test=>test.id).join(', '));return tests;
}
function bseReviewContextValidate_(context) {
  if (!context || typeof context !== 'object' || !/^BSE-TG-\d+$/.test(String(context.reference || '')) || !['APPROVED','REJECTED'].includes(context.action) || !String(context.actor_type || '') || !String(context.actor_id || '') || !String(context.actor_name || '') || !String(context.source_channel || '')) throw new Error('reviewContext tidak sah.');
  if (context.action === 'REJECTED' && !String(context.reason || '').trim()) throw new Error('Sebab penolakan wajib diisi.');
  return context;
}
function bseReviewContextActorLabel_(context) { return String(bseReviewContextValidate_(context).actor_name).trim(); }
function bseReviewFormatTelegramTime_(value) {
  const date=new Date(value);
  if(isNaN(date.getTime())) return '';
  return Utilities.formatDate(date,'Asia/Kuala_Lumpur','dd/MM/yyyy HH:mm')+' MYT';
}
function bseReviewWithLock_(context, core) {
  bseReviewContextValidate_(context);
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw new Error('Barisan sedang dikemas kini. Cuba semula.');
  try { return core(boundTestBook_(), context); } finally { lock.releaseLock(); }
}

function runBseReviewTimezoneHarnessTests() {
  const early=bseReviewFormatTelegramTime_('2026-09-22T15:50:17.750Z'),cross=bseReviewFormatTelegramTime_('2026-09-22T23:50:00.000Z');
  const tests=[
    {id:'UTC converts to MYT',pass:early==='22/09/2026 23:50 MYT'},
    {id:'midnight crossing remains Malaysia date',pass:cross==='23/09/2026 07:50 MYT'},
    {id:'invalid timestamp is safe',pass:bseReviewFormatTelegramTime_('not-a-date')===''}
  ];
  const failures=tests.filter(test=>!test.pass);if(failures.length)throw new Error('Timezone harness gagal: '+failures.map(test=>test.id).join(', '));return tests;
}
