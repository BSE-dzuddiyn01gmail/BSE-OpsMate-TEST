/** @OnlyCurrentDoc */
// Google Tasks TEST-only. One review task per new BSE-TG reference.

const BSE_TEST_TASKS_AUDIT_HEADERS = [
  'telegram_reference',
  'queue_update_id',
  'task_list_id',
  'task_id',
  'state',
  'created_at',
  'last_error'
];

const BSE_TEST_TASKS_LIST_TITLE = 'BSE TEST Review';

function authorizeBseTestGoogleTasks() {
  const lists = Tasks.Tasklists.list({maxResults: 1});
  console.log('GOOGLE_TASKS_TEST_AUTHORIZED: ' + JSON.stringify({
    task_lists_visible: (lists.items || []).length,
    production_write: false
  }));
}

// Jalankan sekali selepas patch dipush.
// Hanya laporan Telegram yang diterima selepas masa ini boleh mencipta task.
function enableBseTestGoogleTasks() {
  Tasks.Tasklists.list({maxResults: 1});

  const enabledAt = new Date().toISOString();
  PropertiesService.getScriptProperties()
    .setProperty('BSE_TEST_TASKS_ENABLED_AT', enabledAt);

  console.log('GOOGLE_TASKS_TEST_ENABLED_FROM: ' + enabledAt);
}

function syncBseTelegramTestReviewTasks_(book) {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(1000)) {
    console.log('GOOGLE_TASKS_TEST_SYNC_PENDING: barisan sibuk.');
    return;
  }

  try {
    const enabledAt = PropertiesService.getScriptProperties()
      .getProperty('BSE_TEST_TASKS_ENABLED_AT');

    if (!enabledAt) {
      console.log('GOOGLE_TASKS_TEST_DISABLED: menunggu enable manual.');
      return;
    }

    const cutoff = Date.parse(enabledAt);
    if (!Number.isFinite(cutoff)) {
      throw new Error('Masa cutover Google Tasks TEST tidak sah.');
    }

    const queue = bseTelegramQueue_(book);
    const rows = queue.getLastRow() > 1
      ? queue.getRange(
          2,
          1,
          queue.getLastRow() - 1,
          BSE_TG_QUEUE_HEADERS.length
        ).getValues()
      : [];

    // Scan semua baris layak; dedup dalam ensure mengelak task berganda.
    for (const row of rows) {
      const receivedAt = Date.parse(String(row[5] || ''));

      if (
        row[6] !== 'NEEDS_HUMAN_REVIEW' ||
        !Number.isFinite(receivedAt) ||
        receivedAt < cutoff
      ) {
        continue;
      }

      bseEnsureTelegramTestReviewTask_(book, row);
    }
  } catch (err) {
    console.log('GOOGLE_TASKS_TEST_SYNC_ERROR: ' + String(err.message || err));
  } finally {
    lock.releaseLock();
  }
}

function bseEnsureTelegramTestReviewTask_(book, row) {
  if (typeof Tasks === 'undefined') {
    throw new Error('Google Tasks Advanced Service belum diaktifkan.');
  }

  const updateId = String(row[0]);
  const reference = 'BSE-TG-' + updateId;
  const audit = bseTelegramTasksAudit_(book);

  const auditRows = audit.getLastRow() > 1
    ? audit.getRange(
        2,
        1,
        audit.getLastRow() - 1,
        BSE_TEST_TASKS_AUDIT_HEADERS.length
      ).getValues()
    : [];

  // Jika audit sudah mempunyai task ID, jangan cipta yang kedua.
  const logged = auditRows.find(
    r => String(r[0]) === reference && String(r[3])
  );
  if (logged) return;

  const listId = bseTestTaskListId_();
  const existing = bseFindTelegramTestTask_(listId, reference);

  try {
    const task = existing || Tasks.Tasks.insert({
      title: '[TEST] Semak ' + reference,
      notes: bseTelegramTestTaskNotes_(reference, row)
    }, listId);

    bseUpsertTelegramTasksAudit_(
      audit,
      reference,
      updateId,
      listId,
      task.id,
      'CREATED',
      ''
    );

    console.log(
      'GOOGLE_TASK_TEST_READY: ' +
      reference +
      '; production_write:false'
    );
  } catch (err) {
    bseUpsertTelegramTasksAudit_(
      audit,
      reference,
      updateId,
      listId,
      '',
      'ERROR',
      String(err.message || err).slice(0, 500)
    );
    throw err;
  }
}

function bseTestTaskListId_() {
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty('BSE_TEST_TASKLIST_ID');

  if (saved) return saved;

  const lists = Tasks.Tasklists.list({maxResults: 100}).items || [];
  const found = lists.find(
    list => list.title === BSE_TEST_TASKS_LIST_TITLE
  );

  const list = found || Tasks.Tasklists.insert({
    title: BSE_TEST_TASKS_LIST_TITLE
  });

  props.setProperty('BSE_TEST_TASKLIST_ID', list.id);
  return list.id;
}

function bseFindTelegramTestTask_(listId, reference) {
  let pageToken = '';

  for (let page = 0; page < 20; page++) {
    const response = Tasks.Tasks.list(listId, {
      maxResults: 100,
      pageToken: pageToken || undefined,
      showCompleted: true,
      showHidden: true
    });

    const found = (response.items || []).find(
      task => String(task.notes || '')
        .indexOf('source_reference=' + reference) !== -1
    );

    if (found) return found;

    pageToken = response.nextPageToken || '';
    if (!pageToken) break;
  }

  return null;
}

function bseTelegramTestTaskNotes_(reference, row) {
  let result = {};

  try {
    result = JSON.parse(String(row[9] || '{}'));
  } catch (_) {}

  const original = String(row[4] || '').slice(0, 6000);
  const summary = JSON.stringify({
    validation: result.validation || '',
    production_write: result.production_write === false
  });

  return [
    'TEST-only review task. Do not write production data.',
    'source_reference=' + reference,
    'queue_update_id=' + String(row[0]),
    'status=NEEDS_HUMAN_REVIEW',
    'result_summary=' + summary,
    '',
    'Original report:',
    original
  ].join('\n').slice(0, 7800);
}

function bseTelegramTasksAudit_(book) {
  let sheet = book.getSheetByName('GOOGLE_TASKS_TEST_AUDIT');

  if (!sheet) {
    sheet = book.insertSheet('GOOGLE_TASKS_TEST_AUDIT');
  }

  if (!sheet.getLastRow()) {
    if (sheet.getMaxColumns() < BSE_TEST_TASKS_AUDIT_HEADERS.length) {
      sheet.insertColumnsAfter(
        sheet.getMaxColumns(),
        BSE_TEST_TASKS_AUDIT_HEADERS.length - sheet.getMaxColumns()
      );
    }

    sheet.getRange(
      1,
      1,
      1,
      BSE_TEST_TASKS_AUDIT_HEADERS.length
    )
      .setValues([BSE_TEST_TASKS_AUDIT_HEADERS])
      .setFontWeight('bold');

    sheet.setFrozenRows(1);
  }

  return sheet;
}

function bseUpsertTelegramTasksAudit_(
  sheet,
  reference,
  updateId,
  listId,
  taskId,
  state,
  error
) {
  const rows = sheet.getLastRow() > 1
    ? sheet.getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        BSE_TEST_TASKS_AUDIT_HEADERS.length
      ).getValues()
    : [];

  const index = rows.findIndex(
    r => String(r[0]) === reference
  );

  const values = [[
    reference,
    updateId,
    listId,
    taskId,
    state,
    new Date().toISOString(),
    error
  ]];

  if (index >= 0) {
    sheet.getRange(
      index + 2,
      1,
      1,
      values[0].length
    ).setValues(values);
  } else {
    sheet.appendRow(values[0]);
  }
}

// ===== Telegram reminder TEST-only for unresolved Google Tasks =====

const BSE_TEST_REMINDER_AUDIT_HEADERS = [
  'telegram_reference',
  'task_id',
  'reminder_date',
  'reminder_count_today',
  'last_reminded_at',
  'state',
  'last_error'
];

const BSE_TEST_REMINDER_DEDUP_AUDIT_HEADERS = [
  'dedup_key',
  'telegram_reference',
  'task_id',
  'reminder_date_myt',
  'state',
  'attempted_at',
  'sent_at',
  'last_error'
];
const BSE_TEST_REMINDER_MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const BSE_TEST_REMINDER_MAX_PER_DAY = 1;
const BSE_TEST_REMINDER_TIME_MYT_PROPERTY = 'BSE_TEST_REMINDER_TIME_MYT';
const BSE_TEST_REMINDER_TIME_MYT_DEFAULT = '12:00';

// Jalankan sekali selepas kod ini dipush.
// Task yang dicipta sebelum masa enable tidak akan menerima peringatan.
function enableBseTestTelegramReminders() {
  Tasks.Tasklists.list({maxResults: 1});

  const enabledAt = new Date().toISOString();
  PropertiesService.getScriptProperties()
    .setProperty('BSE_TEST_REMINDERS_ENABLED_AT', enabledAt);

  console.log('TELEGRAM_TEST_REMINDERS_ENABLED_FROM: ' + enabledAt);
}

function setBseTestTelegramReminderTimeMyt() {
  const ui = SpreadsheetApp.getUi();
  const current = bseTestReminderConfiguredTimeMyt_();
  const response = ui.prompt('Tetapkan Masa Peringatan TEST', 'Masukkan masa Asia/Kuala_Lumpur dalam format HH:mm (24-jam). Semasa: ' + current.value, ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const parsed = bseParseTestReminderTimeMyt_(response.getResponseText());
  if (!parsed.ok) {
    ui.alert('Masa tidak sah. Gunakan format HH:mm 24-jam, contohnya 08:30 atau 12:00. Nilai sedia ada tidak diubah.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty(BSE_TEST_REMINDER_TIME_MYT_PROPERTY, parsed.value);
  ui.alert('Masa peringatan TEST ditetapkan kepada ' + parsed.value + ' Asia/Kuala_Lumpur.');
}

function showBseTestTelegramReminderTimeMyt() {
  const configured = bseTestReminderConfiguredTimeMyt_();
  const suffix = configured.source === 'PROPERTY' ? '' : ' (fallback default)';
  SpreadsheetApp.getUi().alert('Masa peringatan TEST: ' + configured.value + ' Asia/Kuala_Lumpur' + suffix + '.');
}

// Jalankan sekali untuk memasang semakan automatik setiap 15 minit.
// Jika trigger sedia ada untuk fungsi ini wujud, ia diganti dengan satu trigger sahaja.
function installBseTestTelegramReminderTrigger() {
  const handler = 'processBseTelegramTestReminders';

  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === handler)
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyMinutes(15)
    .create();

  console.log('TELEGRAM_TEST_REMINDER_TRIGGER_READY: every 15 minutes');
}

// Fungsi ini akan berjalan melalui trigger. Ia menghantar maksimum satu mesej
// bagi setiap run dan satu sahaja bagi setiap rujukan untuk satu tarikh MYT.
function processBseTelegramTestReminders() {
  const book = boundTestBook_();
  const props = PropertiesService.getScriptProperties();

  const chat = (props.getProperty('TELEGRAM_TEST_CHAT_ID') || '').trim();
  const user = (props.getProperty('TELEGRAM_TEST_USER_ID') || '').trim();
  const enabledAt = props.getProperty('BSE_TEST_REMINDERS_ENABLED_AT');

  if (!chat || chat !== user) {
    throw new Error('Chat/user TEST tidak sepadan.');
  }

  if (!enabledAt) {
    console.log('TELEGRAM_TEST_REMINDERS_DISABLED: menunggu enable manual.');
    return;
  }

  const cutoff = Date.parse(enabledAt);
  if (!Number.isFinite(cutoff)) {
    throw new Error('Masa enable reminder TEST tidak sah.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    console.log('TELEGRAM_TEST_REMINDER_PENDING: barisan sedang digunakan.');
    return;
  }

  try {
    const taskAudit = bseTelegramTasksAudit_(book);
    const reminderAudit = bseTelegramReminderAudit_(book);
    const dedupAudit = bseTelegramReminderDedupAudit_(book);

    const taskRows = taskAudit.getLastRow() > 1
      ? taskAudit.getRange(
          2,
          1,
          taskAudit.getLastRow() - 1,
          BSE_TEST_TASKS_AUDIT_HEADERS.length
        ).getValues()
      : [];

    const now = Date.now();
    const myt = bseTestReminderMyt_(now);
    const reminderTime = bseTestReminderConfiguredTimeMyt_();
    if (!bseTestReminderDueMyt_(myt, reminderTime.value)) {
      console.log('TELEGRAM_TEST_REMINDER_IDLE: sebelum ' + reminderTime.value + ' MYT.');
      return;
    }

    const queue = bseTelegramQueue_(book);
    const queueRows = queue.getLastRow() > 1
      ? queue.getRange(2, 1, queue.getLastRow() - 1, BSE_TG_QUEUE_HEADERS.length).getValues()
      : [];
    const reviewReferences = new Set(queueRows
      .filter(row => String(row[6] || '') === 'NEEDS_HUMAN_REVIEW')
      .map(row => 'BSE-TG-' + String(row[0])));

    for (const row of taskRows) {
      const reference = String(row[0] || '');
      const listId = String(row[2] || '');
      const taskId = String(row[3] || '');
      const taskCreatedAt = Date.parse(String(row[5] || ''));

      if (
        !reference ||
        !listId ||
        !taskId ||
        !reviewReferences.has(reference) ||
        !Number.isFinite(taskCreatedAt) ||
        taskCreatedAt < cutoff
      ) {
        continue;
      }

      let task;
      try {
        task = Tasks.Tasks.get(listId, taskId);
      } catch (err) {
        bseUpsertTelegramReminderAudit_(
          reminderAudit,
          reference,
          taskId,
          myt.date,
          0,
          '',
          'TASK_NOT_FOUND',
          String(err.message || err).slice(0, 500)
        );
        continue;
      }

      if (task.status === 'completed') {
        bseUpsertTelegramReminderAudit_(
          reminderAudit,
          reference,
          taskId,
          myt.date,
          0,
          '',
          'COMPLETED',
          ''
        );
        continue;
      }

      const dedupKey = reference + '|' + myt.date;
      const marker = bseGetTelegramReminderDedupAudit_(dedupAudit, dedupKey);
      const legacyReminder = bseGetTelegramReminderAudit_(reminderAudit, reference);
      const legacySentToday = legacyReminder &&
        String(legacyReminder[2] || '') === myt.date &&
        Number(legacyReminder[3] || 0) >= BSE_TEST_REMINDER_MAX_PER_DAY &&
        !!String(legacyReminder[4] || '');

      if (!bseTestReminderEligibility_(now, 'NEEDS_HUMAN_REVIEW', marker, legacySentToday, reminderTime.value).eligible) {
        continue;
      }

      const attemptedAt = new Date(now).toISOString();
      bseUpsertTelegramReminderDedupAudit_(
        dedupAudit,
        dedupKey,
        reference,
        taskId,
        myt.date,
        'ATTEMPTING',
        attemptedAt,
        '',
        ''
      );

      try {
        bseTelegramApi_('sendMessage', {
          chat_id: chat,
          text:
            'Peringatan TEST: ' +
            reference +
            ' masih belum selesai dalam Google Tasks. ' +
            'Sila semak atau tanda task sebagai selesai.'
        });

        bseUpsertTelegramReminderDedupAudit_(
          dedupAudit,
          dedupKey,
          reference,
          taskId,
          myt.date,
          'SENT',
          attemptedAt,
          attemptedAt,
          ''
        );

        bseUpsertTelegramReminderAudit_(
          reminderAudit,
          reference,
          taskId,
          myt.date,
          BSE_TEST_REMINDER_MAX_PER_DAY,
          attemptedAt,
          'REMINDER_SENT',
          ''
        );

        console.log(
          'TELEGRAM_TEST_REMINDER_SENT: ' +
          reference +
          '; date_myt:' + myt.date
        );

        return;
      } catch (err) {
        bseUpsertTelegramReminderDedupAudit_(
          dedupAudit,
          dedupKey,
          reference,
          taskId,
          myt.date,
          'ERROR',
          attemptedAt,
          '',
          String(err.message || err).slice(0, 500)
        );
        bseUpsertTelegramReminderAudit_(
          reminderAudit,
          reference,
          taskId,
          myt.date,
          0,
          '',
          'ERROR',
          String(err.message || err).slice(0, 500)
        );

        console.log(
          'TELEGRAM_TEST_REMINDER_ERROR: ' +
          reference +
          '; ' +
          String(err.message || err)
        );
        return;
      }
    }

    console.log('TELEGRAM_TEST_REMINDER_IDLE: tiada task layak diingatkan.');
  } finally {
    lock.releaseLock();
  }
}

function bseTelegramReminderAudit_(book) {
  let sheet = book.getSheetByName('TELEGRAM_TEST_REMINDER_AUDIT');

  if (!sheet) {
    sheet = book.insertSheet('TELEGRAM_TEST_REMINDER_AUDIT');
  }

  if (!sheet.getLastRow()) {
    if (sheet.getMaxColumns() < BSE_TEST_REMINDER_AUDIT_HEADERS.length) {
      sheet.insertColumnsAfter(
        sheet.getMaxColumns(),
        BSE_TEST_REMINDER_AUDIT_HEADERS.length - sheet.getMaxColumns()
      );
    }

    sheet.getRange(
      1,
      1,
      1,
      BSE_TEST_REMINDER_AUDIT_HEADERS.length
    )
      .setValues([BSE_TEST_REMINDER_AUDIT_HEADERS])
      .setFontWeight('bold');

    sheet.setFrozenRows(1);
  }

  return sheet;
}

function bseGetTelegramReminderAudit_(sheet, reference) {
  const rows = sheet.getLastRow() > 1
    ? sheet.getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        BSE_TEST_REMINDER_AUDIT_HEADERS.length
      ).getValues()
    : [];

  return rows.find(row => String(row[0]) === reference) || null;
}

function bseUpsertTelegramReminderAudit_(
  sheet,
  reference,
  taskId,
  reminderDate,
  countToday,
  lastRemindedAt,
  state,
  error
) {
  const rows = sheet.getLastRow() > 1
    ? sheet.getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        BSE_TEST_REMINDER_AUDIT_HEADERS.length
      ).getValues()
    : [];

  const index = rows.findIndex(row => String(row[0]) === reference);

  const values = [[
    reference,
    taskId,
    reminderDate,
    countToday,
    lastRemindedAt,
    state,
    error
  ]];

  if (index >= 0) {
    sheet.getRange(
      index + 2,
      1,
      1,
      BSE_TEST_REMINDER_AUDIT_HEADERS.length
    ).setValues(values);
  } else {
    sheet.appendRow(values[0]);
  }
}

function bseTelegramReminderDedupAudit_(book) {
  let sheet = book.getSheetByName('TELEGRAM_TEST_REMINDER_DEDUP_AUDIT');
  if (!sheet) sheet = book.insertSheet('TELEGRAM_TEST_REMINDER_DEDUP_AUDIT');
  if (!sheet.getLastRow()) {
    if (sheet.getMaxColumns() < BSE_TEST_REMINDER_DEDUP_AUDIT_HEADERS.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), BSE_TEST_REMINDER_DEDUP_AUDIT_HEADERS.length - sheet.getMaxColumns());
    }
    sheet.getRange(1, 1, 1, BSE_TEST_REMINDER_DEDUP_AUDIT_HEADERS.length)
      .setValues([BSE_TEST_REMINDER_DEDUP_AUDIT_HEADERS])
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function bseGetTelegramReminderDedupAudit_(sheet, dedupKey) {
  const rows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, BSE_TEST_REMINDER_DEDUP_AUDIT_HEADERS.length).getValues()
    : [];
  return rows.find(row => String(row[0]) === dedupKey) || null;
}

function bseUpsertTelegramReminderDedupAudit_(sheet, dedupKey, reference, taskId, reminderDate, state, attemptedAt, sentAt, error) {
  const rows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, BSE_TEST_REMINDER_DEDUP_AUDIT_HEADERS.length).getValues()
    : [];
  const index = rows.findIndex(row => String(row[0]) === dedupKey);
  const values = [[dedupKey, reference, taskId, reminderDate, state, attemptedAt, sentAt, error]];
  if (index >= 0) {
    sheet.getRange(index + 2, 1, 1, BSE_TEST_REMINDER_DEDUP_AUDIT_HEADERS.length).setValues(values);
  } else {
    sheet.appendRow(values[0]);
  }
}

function bseTestReminderMyt_(nowMs) {
  const myt = new Date(Number(nowMs) + BSE_TEST_REMINDER_MYT_OFFSET_MS);
  return {date: myt.toISOString().slice(0, 10), hour: myt.getUTCHours(), minute: myt.getUTCMinutes()};
}

function bseParseTestReminderTimeMyt_(value) {
  const match = String(value == null ? '' : value).trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return {ok:false, value:'', hour:0, minute:0};
  return {ok:true, value:match[0], hour:Number(match[1]), minute:Number(match[2])};
}

function bseTestReminderConfiguredTimeMyt_() {
  const raw = PropertiesService.getScriptProperties().getProperty(BSE_TEST_REMINDER_TIME_MYT_PROPERTY);
  return bseTestReminderEffectiveTimeMyt_(raw);
}

function bseTestReminderEffectiveTimeMyt_(raw) {
  if (!String(raw || '').trim()) return Object.assign(bseParseTestReminderTimeMyt_(BSE_TEST_REMINDER_TIME_MYT_DEFAULT), {source:'DEFAULT'});
  const parsed = bseParseTestReminderTimeMyt_(raw);
  return parsed.ok ? Object.assign(parsed, {source:'PROPERTY'}) : Object.assign(bseParseTestReminderTimeMyt_(BSE_TEST_REMINDER_TIME_MYT_DEFAULT), {source:'INVALID_FALLBACK'});
}

function bseTestReminderDueMyt_(myt, reminderTimeMyt) {
  const parsed = bseParseTestReminderTimeMyt_(reminderTimeMyt || BSE_TEST_REMINDER_TIME_MYT_DEFAULT);
  if (!parsed.ok) throw new Error('Masa peringatan TEST tidak sah.');
  return myt.hour > parsed.hour || (myt.hour === parsed.hour && myt.minute >= parsed.minute);
}

function bseTestReminderEligibility_(nowMs, queueStatus, marker, legacySentToday, reminderTimeMyt) {
  const myt = bseTestReminderMyt_(nowMs);
  if (!bseTestReminderDueMyt_(myt, reminderTimeMyt || BSE_TEST_REMINDER_TIME_MYT_DEFAULT)) return {eligible:false, reason:'BEFORE_REMINDER_TIME_MYT', myt:myt};
  if (queueStatus !== 'NEEDS_HUMAN_REVIEW') return {eligible:false, reason:'QUEUE_STATUS', myt:myt};
  if (marker) return {eligible:false, reason:'DAILY_MARKER_EXISTS', myt:myt};
  if (legacySentToday) return {eligible:false, reason:'LEGACY_SENT_TODAY', myt:myt};
  return {eligible:true, reason:'', myt:myt};
}

function bseTestReminderDedupValues_(dedupKey, reference, taskId, reminderDate, state, attemptedAt, sentAt, error) {
  return [dedupKey, reference, taskId, reminderDate, state, attemptedAt, sentAt, error];
}

function runBseTestTelegramReminderRegressionTests() {
  const beforeNoon = Date.parse('2026-09-22T03:59:00.000Z');
  const afterNoon = Date.parse('2026-09-22T04:01:00.000Z');
  const nextDay = Date.parse('2026-09-23T04:01:00.000Z');
  const before0830 = Date.parse('2026-09-22T00:29:00.000Z');
  const at0830 = Date.parse('2026-09-22T00:30:00.000Z');
  const referenceA = 'BSE-TG-2001', referenceB = 'BSE-TG-2002';
  const keyA = referenceA + '|2026-09-22', keyB = referenceB + '|2026-09-22';
  const sentA = bseTestReminderDedupValues_(keyA, referenceA, 'task-a', '2026-09-22', 'SENT', '2026-09-22T04:01:00.000Z', '2026-09-22T04:01:00.000Z', '');
  const errorA = bseTestReminderDedupValues_(keyA, referenceA, 'task-a', '2026-09-22', 'ERROR', '2026-09-22T04:01:00.000Z', '', 'send failed');
  const existingReminderTime = '08:30';
  const invalidReminderTime = bseParseTestReminderTimeMyt_('8:30');
  const terminalStatuses = ['WAITING_INFO', 'MEASUREMENT_APPROVED_TEST', 'CROP_BATCH_REJECTED_TEST', 'NEEDS_ATTENTION'];
  const tests = [
    {id:'fallback 12:00 MYT does not send before noon', pass:bseTestReminderEffectiveTimeMyt_('').value === '12:00' && bseTestReminderEffectiveTimeMyt_('').source === 'DEFAULT' && !bseTestReminderEligibility_(beforeNoon, 'NEEDS_HUMAN_REVIEW', null, false).eligible},
    {id:'08:30 is idle at 08:29 and eligible at 08:30', pass:!bseTestReminderEligibility_(before0830, 'NEEDS_HUMAN_REVIEW', null, false, '08:30').eligible && bseTestReminderEligibility_(at0830, 'NEEDS_HUMAN_REVIEW', null, false, '08:30').eligible},
    {id:'invalid time is rejected without replacing configured value', pass:!invalidReminderTime.ok && !bseParseTestReminderTimeMyt_('24:00').ok && (invalidReminderTime.ok ? invalidReminderTime.value : existingReminderTime) === existingReminderTime},
    {id:'after 12:00 repeated runs send once', pass:bseTestReminderEligibility_(afterNoon, 'NEEDS_HUMAN_REVIEW', null, false).eligible && !bseTestReminderEligibility_(afterNoon, 'NEEDS_HUMAN_REVIEW', sentA, false).eligible},
    {id:'next MYT date is eligible again', pass:bseTestReminderEligibility_(nextDay, 'NEEDS_HUMAN_REVIEW', null, false).eligible && bseTestReminderMyt_(nextDay).date === '2026-09-23'},
    {id:'two references deduplicate independently', pass:bseTestReminderEligibility_(afterNoon, 'NEEDS_HUMAN_REVIEW', sentA, false).reason === 'DAILY_MARKER_EXISTS' && bseTestReminderEligibility_(afterNoon, 'NEEDS_HUMAN_REVIEW', null, false).eligible && keyA !== keyB},
    {id:'waiting and terminal statuses do not send', pass:terminalStatuses.every(status => !bseTestReminderEligibility_(afterNoon, status, null, false).eligible)},
    {id:'failed send is not falsely SENT and is not retried today', pass:errorA[4] === 'ERROR' && errorA[6] === '' && !bseTestReminderEligibility_(afterNoon, 'NEEDS_HUMAN_REVIEW', errorA, false).eligible}
  ];
  console.log('TELEGRAM_TEST_REMINDER_REGRESSION: ' + JSON.stringify(tests));
  const failures = tests.filter(test => !test.pass);
  if (failures.length) throw new Error('Telegram reminder regression gagal: ' + failures.map(test => test.id).join(', '));
  return tests;
}

function debugBseTestTask146694133() {
  const book = boundTestBook_();
  const queue = bseTelegramQueue_(book);
  const rows = queue.getLastRow() > 1
    ? queue.getRange(2, 1, queue.getLastRow() - 1, BSE_TG_QUEUE_HEADERS.length).getValues()
    : [];

  const row = rows.find(r => String(r[0]) === '146694133');
  const enabledAt = PropertiesService.getScriptProperties()
    .getProperty('BSE_TEST_TASKS_ENABLED_AT');

  console.log(JSON.stringify({
    enabled_at: enabledAt,
    cutoff_ms: Date.parse(enabledAt || ''),
    row: row,
    row_5: row ? row[5] : null,
    row_5_ms: row ? Date.parse(String(row[5] || '')) : null,
    status: row ? row[6] : null
  }));
}

function retryBseTestTask146694133() {
  const book = boundTestBook_();
  const queue = bseTelegramQueue_(book);

  const rows = queue.getLastRow() > 1
    ? queue.getRange(2, 1, queue.getLastRow() - 1, BSE_TG_QUEUE_HEADERS.length).getValues()
    : [];

  const row = rows.find(r => String(r[0]) === '146694133');

  if (!row) {
    throw new Error('Rekod BSE-TG-146694133 tidak dijumpai.');
  }

  if (row[6] !== 'NEEDS_HUMAN_REVIEW') {
    throw new Error('Status bukan NEEDS_HUMAN_REVIEW: ' + row[6]);
  }

  bseEnsureTelegramTestReviewTask_(book, row);

  console.log('GOOGLE_TASK_TEST_RETRY_DONE: BSE-TG-146694133');
}
