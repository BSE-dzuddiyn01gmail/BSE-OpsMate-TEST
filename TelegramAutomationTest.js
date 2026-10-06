/** @NotOnlyCurrentDoc */
// Opens only the fixed BSE TEST spreadsheet for unattended triggers.
// Install manually after reviewing the TEST receiver and worker.
function bseTelegramAutomationBook_() {
  const id=bseRuntimeSpreadsheetId_();
  const book=SpreadsheetApp.openById(id);
  SpreadsheetApp.setActiveSpreadsheet(book);
  boundTestBook_();
}
function installBseTelegramTestAutomation() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw new Error('Barisan sibuk; cuba pemasangan kemudian.');
  try {
    if(bseRuntimeEnvironmentName_()==='PILOT_TEST')throw new Error('PILOT_TEST automation kekal OFF semasa environment setup; controlled replay mesti dijalankan secara manual.');
    bseTelegramAutomationBook_();
    const props=PropertiesService.getScriptProperties();
    const chat=props.getProperty('TELEGRAM_TEST_CHAT_ID'),user=props.getProperty('TELEGRAM_TEST_USER_ID');
    if(!chat||chat!==user||!props.getProperty('GEMINI_API_KEY')||props.getProperty('GEMINI_MODEL')!=='gemini-3.1-flash-lite')throw new Error('Konfigurasi TEST belum lengkap.');
    const connection=testBseTelegramConnection();
    if(connection.webhook_active)throw new Error('Webhook aktif; automasi polling tidak dipasang.');
    const handler='bseTelegramTick',legacy=['bseTelegramReceiveTick','bseTelegramWorkerTick'];
    // Disable until the single TEST trigger exists. Unrelated project triggers are untouched.
    props.setProperty('BSE_TELEGRAM_AUTOMATION','OFF');
    const triggers=ScriptApp.getProjectTriggers();
    triggers.filter(t=>legacy.includes(t.getHandlerFunction())).forEach(t=>ScriptApp.deleteTrigger(t));
    const matches=triggers.filter(t=>t.getHandlerFunction()===handler);
    if(!matches.length)ScriptApp.newTrigger(handler).timeBased().everyMinutes(1).create();
    matches.slice(1).forEach(t=>ScriptApp.deleteTrigger(t));
    props.setProperty('BSE_TELEGRAM_AUTOMATION','ON');
    console.log('TELEGRAM_AUTOMATION_ON: receiver kemudian worker dalam satu tick kira-kira setiap minit; TEST sahaja.');
  } finally {lock.releaseLock();}
}
function stopBseTelegramTestAutomation() {
  PropertiesService.getScriptProperties().setProperty('BSE_TELEGRAM_AUTOMATION','OFF');
  ScriptApp.getProjectTriggers().filter(t=>['bseTelegramTick','bseTelegramReceiveTick','bseTelegramWorkerTick'].includes(t.getHandlerFunction())).forEach(t=>ScriptApp.deleteTrigger(t));
  console.log('TELEGRAM_AUTOMATION_OFF: trigger dihentikan; run yang sudah berjalan mungkin akan selesai. Data dikekalkan.');
}
function bseTelegramTick() {
  if(PropertiesService.getScriptProperties().getProperty('BSE_TELEGRAM_AUTOMATION')!=='ON')return;
  bseTelegramAutomationBook_();
  receiveBseTelegramTest();
  processBseTelegramTestQueue();
}
function bseTelegramReceiveTick() {
  if(PropertiesService.getScriptProperties().getProperty('BSE_TELEGRAM_AUTOMATION')!=='ON')return;
  bseTelegramAutomationBook_();receiveBseTelegramTest();
}
function bseTelegramWorkerTick() {
  if(PropertiesService.getScriptProperties().getProperty('BSE_TELEGRAM_AUTOMATION')!=='ON')return;
  bseTelegramAutomationBook_();processBseTelegramTestQueue();
}

