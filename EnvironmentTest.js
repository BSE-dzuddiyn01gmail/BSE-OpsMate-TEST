/**
 * Environment adapter for OpsMate TEST / PILOT_TEST.
 *
 * TEST remains the default so existing regression/runtime behavior is unchanged.
 * PILOT_TEST must be explicitly selected in Script Properties and bound to a
 * separate spreadsheet / Telegram configuration / Drive evidence folder.
 * No environment may enable production writes.
 */

const BSE_PILOT_TEST_BINDING = Object.freeze({
  spreadsheetId: '1wGty1mg-KwCD0RvfC7YkkyiVV8BOF1L0YUM_NnlKnEs',
  evidenceFolderId: '1G7fkLlXJyu35ZIV67LGVrduQ-8uHNnqG'
});

const BSE_RUNTIME_ENV_CONFIG = Object.freeze({
  TEST: Object.freeze({
    name: 'TEST',
    label: 'TEST',
    startToken: 'BSE_TEST',
    spreadsheetProperty: '',
    approvalGroupsProperty: 'BSE_TEST_APPROVAL_GROUP_CHAT_IDS',
    legacyChatProperty: 'TELEGRAM_TEST_CHAT_ID',
    legacyUserProperty: 'TELEGRAM_TEST_USER_ID',
    evidenceFolderProperty: 'BSE_TEST_EVIDENCE_DRIVE_FOLDER_ID',
    botUsernameDefault: 'bse_kerani_test_bot'
  }),
  PILOT_TEST: Object.freeze({
    name: 'PILOT_TEST',
    label: 'PILOT TEST',
    startToken: 'BSE_PILOT_TEST',
    spreadsheetProperty: 'BSE_PILOT_TEST_SPREADSHEET_ID',
    approvalGroupsProperty: 'BSE_PILOT_TEST_APPROVAL_GROUP_CHAT_IDS',
    legacyChatProperty: 'PILOT_TEST_TELEGRAM_CHAT_ID',
    legacyUserProperty: 'PILOT_TEST_TELEGRAM_USER_ID',
    evidenceFolderProperty: 'BSE_PILOT_TEST_EVIDENCE_DRIVE_FOLDER_ID',
    botUsernameDefault: ''
  })
});

function bseRuntimeEnvironmentName_() {
  const props = PropertiesService.getScriptProperties();
  const configured = String(props.getProperty('BSE_RUNTIME_ENV') || '').trim().toUpperCase();
  if (configured) {
    if (!Object.prototype.hasOwnProperty.call(BSE_RUNTIME_ENV_CONFIG, configured)) throw new Error('BSE_RUNTIME_ENV mesti TEST atau PILOT_TEST.');
    return configured;
  }
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active && active.getId && active.getId() === BSE_PILOT_TEST_BINDING.spreadsheetId) return 'PILOT_TEST';
  } catch (_) { }
  return 'TEST';
}

function bseRuntimeEnvironmentConfig_() {
  return BSE_RUNTIME_ENV_CONFIG[bseRuntimeEnvironmentName_()];
}

function bseRuntimeEnvironmentLabel_() {
  return bseRuntimeEnvironmentConfig_().label;
}

function bseRuntimeSpreadsheetId_() {
  const cfg = bseRuntimeEnvironmentConfig_();
  if (cfg.name === 'TEST') return BSE_TEST.spreadsheetId;
  const configured = String(PropertiesService.getScriptProperties().getProperty(cfg.spreadsheetProperty) || '').trim();
  const id = configured || (cfg.name === 'PILOT_TEST' ? BSE_PILOT_TEST_BINDING.spreadsheetId : '');
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) {
    throw new Error(cfg.spreadsheetProperty + ' belum disimpan atau tidak sah.');
  }
  if (cfg.name === 'PILOT_TEST' && id !== BSE_PILOT_TEST_BINDING.spreadsheetId) {
    throw new Error('SOURCE_MISMATCH: PILOT_TEST spreadsheet ID tidak sepadan dengan binding terkunci.');
  }
  return id;
}

function bseRuntimeAssertWorkbookId_(actualId) {
  const expected = bseRuntimeSpreadsheetId_();
  if (String(actualId || '') !== expected) {
    throw new Error('CROSS_ENVIRONMENT_WRITE_REJECTED: workbook runtime tidak sepadan dengan ' + bseRuntimeEnvironmentLabel_() + '.');
  }
  return true;
}

function bseRuntimeStartToken_() {
  return bseRuntimeEnvironmentConfig_().startToken;
}

function bseRuntimeRegexEscape_(value) {
  return String(value || '').replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
}

function bseRuntimeStartCommandMatches_(text, botUsernameOverride) {
  const username=String(botUsernameOverride || bseRuntimeBotUsername_()).replace(/^@/, '');
  const pattern=new RegExp('^/start(?:@'+bseRuntimeRegexEscape_(username)+')?\\s+'+bseRuntimeRegexEscape_(bseRuntimeStartToken_())+'\\s*$','i');
  return pattern.test(String(text || ''));
}

function bseRuntimeBotUsername_() {
  const cfg = bseRuntimeEnvironmentConfig_();
  const configured = String(PropertiesService.getScriptProperties().getProperty('BSE_TELEGRAM_BOT_USERNAME') || '').trim().replace(/^@/, '');
  const username = configured || cfg.botUsernameDefault;
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) {
    throw new Error('BSE_TELEGRAM_BOT_USERNAME belum disimpan atau tidak sah untuk ' + cfg.label + '.');
  }
  return username;
}

function bseRuntimeApprovalGroupsRaw_() {
  const cfg = bseRuntimeEnvironmentConfig_();
  return PropertiesService.getScriptProperties().getProperty(cfg.approvalGroupsProperty) || '';
}

function bseRuntimeLegacyChatId_() {
  const cfg = bseRuntimeEnvironmentConfig_();
  return String(PropertiesService.getScriptProperties().getProperty(cfg.legacyChatProperty) || '').trim();
}

function bseRuntimeLegacyUserId_() {
  const cfg = bseRuntimeEnvironmentConfig_();
  return String(PropertiesService.getScriptProperties().getProperty(cfg.legacyUserProperty) || '').trim();
}

function bseRuntimeEvidenceFolderId_() {
  const cfg = bseRuntimeEnvironmentConfig_();
  const configured = String(PropertiesService.getScriptProperties().getProperty(cfg.evidenceFolderProperty) || '').trim();
  const id = configured || (cfg.name === 'PILOT_TEST' ? BSE_PILOT_TEST_BINDING.evidenceFolderId : '');
  if (cfg.name === 'PILOT_TEST' && id && id !== BSE_PILOT_TEST_BINDING.evidenceFolderId) {
    throw new Error('SOURCE_MISMATCH: PILOT_TEST evidence folder ID tidak sepadan dengan binding terkunci.');
  }
  return id;
}

function bseRuntimeEvidenceFolderProperty_() {
  return bseRuntimeEnvironmentConfig_().evidenceFolderProperty;
}

function bseRuntimeSheetName_(legacyName) {
  const name = String(legacyName || '');
  if (bseRuntimeEnvironmentName_() === 'TEST') return name;
  if (/^TEST_/.test(name)) return name.replace(/^TEST_/, 'PILOT_TEST_');
  if (/^TELEGRAM_TEST_/.test(name)) return name.replace(/^TELEGRAM_TEST_/, 'PILOT_TEST_TELEGRAM_');
  if (/^GOOGLE_TASKS_TEST_/.test(name)) return name.replace(/^GOOGLE_TASKS_TEST_/, 'PILOT_TEST_GOOGLE_TASKS_');
  if (name === 'GEMINI_TEST_RESULTS') return 'PILOT_TEST_GEMINI_RESULTS';
  if (name === 'SCRIPT_TEST_RESULTS') return 'PILOT_TEST_SCRIPT_RESULTS';
  return name;
}

function bseRuntimeBook_(book) {
  if (!book) throw new Error('Workbook runtime tidak tersedia.');
  return {
    getId: function(){ return book.getId(); },
    getSheetByName: function(name){ return book.getSheetByName(bseRuntimeSheetName_(name)); },
    insertSheet: function(name){ return book.insertSheet(bseRuntimeSheetName_(name)); },
    getActiveRange: function(){ return book.getActiveRange(); },
    toast: function(){ return book.toast.apply(book, arguments); }
  };
}

function bseRuntimeTelegramPayload_(method, payload) {
  const body = Object.assign({}, payload || {});
  if (bseRuntimeEnvironmentName_() !== 'PILOT_TEST') return body;
  const prefix = '[PILOT TEST]';
  if (['sendMessage','editMessageText'].includes(method) && typeof body.text === 'string' && !body.text.startsWith(prefix)) {
    body.text = prefix + '\n' + body.text;
  }
  if (['sendPhoto','sendDocument','sendVideo'].includes(method) && typeof body.caption === 'string' && !body.caption.startsWith(prefix)) {
    body.caption = prefix + '\n' + body.caption;
  }
  return body;
}

function BSE_PILOT_RUNTIME_ISOLATION_PROBE() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active || !active.getId) return JSON.stringify({status:'FAILED',reason:'ACTIVE_WORKBOOK_UNAVAILABLE',production_write:false});
  const actual = active.getId();
  const environment = bseRuntimeEnvironmentName_();
  bseRuntimeAssertWorkbookId_(actual);
  let crossRejected = false;
  try { bseRuntimeAssertWorkbookId_(BSE_TEST.spreadsheetId); }
  catch (error) { crossRejected = /^CROSS_ENVIRONMENT_WRITE_REJECTED:/.test(String(error&&error.message||error)); }
  return JSON.stringify({
    status: crossRejected ? 'PASS' : 'FAILED',
    environment: environment,
    workbook_match: actual === BSE_PILOT_TEST_BINDING.spreadsheetId,
    domain_sheet: bseRuntimeSheetName_('TEST_TREATMENT_EVENT'),
    queue_sheet: bseRuntimeSheetName_('TELEGRAM_TEST_QUEUE'),
    evidence_folder_match: bseRuntimeEvidenceFolderId_() === BSE_PILOT_TEST_BINDING.evidenceFolderId,
    cross_environment_rejected: crossRejected,
    production_write: false,
    official_bse_write: false
  });
}

function BSE_PILOT_RUNTIME_REGRESSION_PROBE() {
  if (bseRuntimeEnvironmentName_() !== 'PILOT_TEST') return JSON.stringify({status:'FAILED',reason:'NOT_PILOT_TEST',production_write:false});
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active || !active.getId) return JSON.stringify({status:'FAILED',reason:'ACTIVE_WORKBOOK_UNAVAILABLE',production_write:false});
  bseRuntimeAssertWorkbookId_(active.getId());
  const result = runBseI011FullRegression();
  return JSON.stringify({
    status: result.failed === 0 ? 'PASS' : 'FAILED',
    environment: 'PILOT_TEST',
    total: result.total,
    passed: result.passed,
    failed: result.failed,
    production_write: false,
    official_bse_write: false
  });
}

function configureBsePilotTestRuntimeBinding() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('BSE_RUNTIME_ENV','PILOT_TEST');
  props.setProperty('BSE_PILOT_TEST_SPREADSHEET_ID',BSE_PILOT_TEST_BINDING.spreadsheetId);
  props.setProperty('BSE_PILOT_TEST_EVIDENCE_DRIVE_FOLDER_ID',BSE_PILOT_TEST_BINDING.evidenceFolderId);
  props.setProperty('BSE_TELEGRAM_AUTOMATION','OFF');
  return getBsePilotTestRuntimeBindingStatus();
}

function getBsePilotTestRuntimeBindingStatus() {
  const props = PropertiesService.getScriptProperties();
  const env = String(props.getProperty('BSE_RUNTIME_ENV') || '').trim().toUpperCase();
  const sheet = String(props.getProperty('BSE_PILOT_TEST_SPREADSHEET_ID') || '').trim();
  const evidence = String(props.getProperty('BSE_PILOT_TEST_EVIDENCE_DRIVE_FOLDER_ID') || '').trim();
  const automation = String(props.getProperty('BSE_TELEGRAM_AUTOMATION') || 'OFF').trim().toUpperCase();
  return {
    environment: env,
    spreadsheet_bound: sheet === BSE_PILOT_TEST_BINDING.spreadsheetId,
    evidence_folder_bound: evidence === BSE_PILOT_TEST_BINDING.evidenceFolderId,
    automation: automation,
    production_write: false,
    official_bse_write: false
  };
}

function runBsePilotTestIsolationWriteProof() {
  if (bseRuntimeEnvironmentName_() !== 'PILOT_TEST') throw new Error('PILOT_TEST runtime belum dipilih.');
  if (bseRuntimeSpreadsheetId_() !== BSE_PILOT_TEST_BINDING.spreadsheetId) throw new Error('PILOT_TEST spreadsheet binding tidak sepadan.');
  if (bseRuntimeEvidenceFolderId_() !== BSE_PILOT_TEST_BINDING.evidenceFolderId) throw new Error('PILOT_TEST evidence folder binding tidak sepadan.');

  const raw = SpreadsheetApp.openById(BSE_PILOT_TEST_BINDING.spreadsheetId);
  bseRuntimeAssertWorkbookId_(raw.getId());
  const book = bseRuntimeBook_(raw);
  const legacyName = 'TEST_ENVIRONMENT_ISOLATION_PROBE';
  const mappedName = bseRuntimeSheetName_(legacyName);
  if (mappedName !== 'PILOT_TEST_ENVIRONMENT_ISOLATION_PROBE') throw new Error('Probe sheet mapping tidak selamat.');
  if (raw.getSheetByName(legacyName)) throw new Error('SOURCE_MISMATCH: TEST probe sheet wujud dalam PILOT_TEST workbook.');

  let sheet = book.getSheetByName(legacyName);
  if (!sheet) sheet = book.insertSheet(legacyName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,6).setValues([['probe_id','environment','workbook_id','mapped_sheet','cross_environment_rejected','production_write']]);
  }
  const probeId = Utilities.getUuid();
  let crossRejected = false;
  try {
    bseRuntimeAssertWorkbookId_(BSE_TEST.spreadsheetId);
  } catch (error) {
    crossRejected = /^CROSS_ENVIRONMENT_WRITE_REJECTED:/.test(String(error && error.message || error));
  }
  if (!crossRejected) throw new Error('Cross-environment workbook guard tidak menolak TEST workbook.');

  sheet.appendRow([probeId,'PILOT_TEST',raw.getId(),mappedName,true,false]);
  SpreadsheetApp.flush();
  return {
    probe_id: probeId,
    environment: 'PILOT_TEST',
    workbook_id: raw.getId(),
    sheet: mappedName,
    cross_environment_rejected: true,
    production_write: false,
    official_bse_write: false
  };
}

function cleanupBsePilotTestIsolationWriteProof(probeId) {
  if (bseRuntimeEnvironmentName_() !== 'PILOT_TEST') throw new Error('PILOT_TEST runtime belum dipilih.');
  const raw = SpreadsheetApp.openById(BSE_PILOT_TEST_BINDING.spreadsheetId);
  bseRuntimeAssertWorkbookId_(raw.getId());
  const name = bseRuntimeSheetName_('TEST_ENVIRONMENT_ISOLATION_PROBE');
  const sheet = raw.getSheetByName(name);
  if (!sheet) return {removed:false,reason:'PROBE_SHEET_NOT_FOUND',production_write:false};
  const rows = sheet.getLastRow()>1 ? sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues() : [];
  const index = rows.findIndex(function(row){return String(row[0])===String(probeId||'');});
  if (index < 0) return {removed:false,reason:'PROBE_ID_NOT_FOUND',production_write:false};
  sheet.deleteRow(index+2);
  if (sheet.getLastRow() <= 1) raw.deleteSheet(sheet);
  SpreadsheetApp.flush();
  return {removed:true,probe_id:String(probeId),production_write:false};
}

function runBseEnvironmentIsolationHarnessTests() {
  const props = PropertiesService.getScriptProperties();
  const oldEnv = props.getProperty('BSE_RUNTIME_ENV');
  const oldSheet = props.getProperty('BSE_PILOT_TEST_SPREADSHEET_ID');
  const oldUser = props.getProperty('BSE_TELEGRAM_BOT_USERNAME');
  const oldGroups = props.getProperty('BSE_PILOT_TEST_APPROVAL_GROUP_CHAT_IDS');
  const oldEvidence = props.getProperty('BSE_PILOT_TEST_EVIDENCE_DRIVE_FOLDER_ID');
  const tests = [];
  const pass = function(id, fn) {
    try { fn(); tests.push({id:id,pass:true}); }
    catch (error) { tests.push({id:id,pass:false,error:String(error.message||error)}); }
  };
  try {
    props.setProperty('BSE_RUNTIME_ENV','PILOT_TEST');
    props.setProperty('BSE_PILOT_TEST_SPREADSHEET_ID','1wGty1mg-KwCD0RvfC7YkkyiVV8BOF1L0YUM_NnlKnEs');
    props.setProperty('BSE_TELEGRAM_BOT_USERNAME','pilot_test_bot');
    props.setProperty('BSE_PILOT_TEST_APPROVAL_GROUP_CHAT_IDS','-1001234567890');
    props.setProperty('BSE_PILOT_TEST_EVIDENCE_DRIVE_FOLDER_ID',BSE_PILOT_TEST_BINDING.evidenceFolderId);

    pass('PILOT_TEST maps domain sheets', function(){
      if (bseRuntimeSheetName_('TEST_TREATMENT_EVENT') !== 'PILOT_TEST_TREATMENT_EVENT') throw new Error('sheet mapping gagal');
    });
    pass('PILOT_TEST maps queue separately', function(){
      if (bseRuntimeSheetName_('TELEGRAM_TEST_QUEUE') !== 'PILOT_TEST_TELEGRAM_QUEUE') throw new Error('queue mapping gagal');
    });
    pass('PILOT_TEST maps result sheets', function(){
      if (bseRuntimeSheetName_('GEMINI_TEST_RESULTS') !== 'PILOT_TEST_GEMINI_RESULTS' || bseRuntimeSheetName_('SCRIPT_TEST_RESULTS') !== 'PILOT_TEST_SCRIPT_RESULTS') throw new Error('result mapping gagal');
    });
    pass('PILOT_TEST start token isolated', function(){
      if (bseRuntimeStartToken_() !== 'BSE_PILOT_TEST') throw new Error('start token salah');
    });
    pass('PILOT_TEST outgoing text labeled', function(){
      const body=bseRuntimeTelegramPayload_('sendMessage',{text:'Semakan',chat_id:'-1001'});
      if (body.text !== '[PILOT TEST]\nSemakan') throw new Error('label hilang');
    });
    pass('PILOT_TEST requires separate spreadsheet binding', function(){
      if (bseRuntimeSpreadsheetId_() !== '1wGty1mg-KwCD0RvfC7YkkyiVV8BOF1L0YUM_NnlKnEs') throw new Error('binding salah');
    });
    pass('PILOT_TEST group property isolated', function(){
      if (bseRuntimeApprovalGroupsRaw_() !== '-1001234567890') throw new Error('group property salah');
    });
    pass('PILOT_TEST evidence folder isolated', function(){
      if (bseRuntimeEvidenceFolderId_() !== BSE_PILOT_TEST_BINDING.evidenceFolderId) throw new Error('evidence folder binding salah');
    });
    pass('PILOT_TEST rejects TEST workbook id', function(){
      let rejected=false;
      try { bseRuntimeAssertWorkbookId_(BSE_TEST.spreadsheetId); }
      catch (error) { rejected=/^CROSS_ENVIRONMENT_WRITE_REJECTED:/.test(String(error&&error.message||error)); }
      if (!rejected) throw new Error('cross-environment guard gagal');
    });
    pass('production boundary remains false by design', function(){
      const source=[bseRuntimeEnvironmentName_,bseRuntimeSheetName_,bseRuntimeTelegramPayload_].map(function(fn){return fn.toString();}).join('\n');
      if (/production_write\s*:\s*true/.test(source)) throw new Error('production write ditemukan');
    });
  } finally {
    if (oldEnv == null) props.deleteProperty('BSE_RUNTIME_ENV'); else props.setProperty('BSE_RUNTIME_ENV',oldEnv);
    if (oldSheet == null) props.deleteProperty('BSE_PILOT_TEST_SPREADSHEET_ID'); else props.setProperty('BSE_PILOT_TEST_SPREADSHEET_ID',oldSheet);
    if (oldUser == null) props.deleteProperty('BSE_TELEGRAM_BOT_USERNAME'); else props.setProperty('BSE_TELEGRAM_BOT_USERNAME',oldUser);
    if (oldGroups == null) props.deleteProperty('BSE_PILOT_TEST_APPROVAL_GROUP_CHAT_IDS'); else props.setProperty('BSE_PILOT_TEST_APPROVAL_GROUP_CHAT_IDS',oldGroups);
    if (oldEvidence == null) props.deleteProperty('BSE_PILOT_TEST_EVIDENCE_DRIVE_FOLDER_ID'); else props.setProperty('BSE_PILOT_TEST_EVIDENCE_DRIVE_FOLDER_ID',oldEvidence);
  }
  const failures=tests.filter(function(t){return !t.pass;});
  if (failures.length) throw new Error('Environment isolation harness gagal: '+failures.map(function(t){return t.id;}).join(', '));
  return tests;
}
