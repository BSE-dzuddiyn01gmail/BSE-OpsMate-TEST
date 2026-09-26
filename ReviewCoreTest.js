/** @OnlyCurrentDoc */
// Shared TEST-only review transaction boundary. Domain cores must remain UI/lock free.
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
