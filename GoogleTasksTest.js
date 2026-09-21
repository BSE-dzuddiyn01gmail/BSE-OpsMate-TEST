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

const BSE_TEST_REMINDER_DELAY_MS = 4 * 60 * 60 * 1000;
const BSE_TEST_REMINDER_MAX_PER_DAY = 2;

// Jalankan sekali selepas kod ini dipush.
// Task yang dicipta sebelum masa enable tidak akan menerima peringatan.
function enableBseTestTelegramReminders() {
  Tasks.Tasklists.list({maxResults: 1});

  const enabledAt = new Date().toISOString();
  PropertiesService.getScriptProperties()
    .setProperty('BSE_TEST_REMINDERS_ENABLED_AT', enabledAt);

  console.log('TELEGRAM_TEST_REMINDERS_ENABLED_FROM: ' + enabledAt);
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

// Fungsi ini akan berjalan melalui trigger.
// Ia menghantar maksimum SATU mesej bagi setiap run, dan maksimum DUA kali sehari
// untuk setiap task yang masih belum selesai.
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

    const taskRows = taskAudit.getLastRow() > 1
      ? taskAudit.getRange(
          2,
          1,
          taskAudit.getLastRow() - 1,
          BSE_TEST_TASKS_AUDIT_HEADERS.length
        ).getValues()
      : [];

    const now = Date.now();
    const today = Utilities.formatDate(
      new Date(now),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );

    for (const row of taskRows) {
      const reference = String(row[0] || '');
      const listId = String(row[2] || '');
      const taskId = String(row[3] || '');
      const taskCreatedAt = Date.parse(String(row[5] || ''));

      if (
        !reference ||
        !listId ||
        !taskId ||
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
          today,
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
          today,
          0,
          '',
          'COMPLETED',
          ''
        );
        continue;
      }

      const reminder = bseGetTelegramReminderAudit_(reminderAudit, reference);
      const lastDate = reminder ? String(reminder[2] || '') : '';
      const countToday = reminder && lastDate === today
        ? Number(reminder[3] || 0)
        : 0;
      const lastReminderAt = reminder
        ? Date.parse(String(reminder[4] || ''))
        : NaN;

      if (countToday >= BSE_TEST_REMINDER_MAX_PER_DAY) {
        continue;
      }

      // Peringatan pertama: 4 jam selepas task dicipta.
      // Peringatan berikutnya: sekurang-kurangnya 4 jam selepas mesej terakhir.
      const timeAnchor = Number.isFinite(lastReminderAt)
        ? lastReminderAt
        : taskCreatedAt;

      if (now - timeAnchor < BSE_TEST_REMINDER_DELAY_MS) {
        continue;
      }

      const nextCount = countToday + 1;

      try {
        bseTelegramApi_('sendMessage', {
          chat_id: chat,
          text:
            'Peringatan TEST ' + nextCount + '/2 hari ini: ' +
            reference +
            ' masih belum selesai dalam Google Tasks. ' +
            'Sila semak atau tanda task sebagai selesai.'
        });

        bseUpsertTelegramReminderAudit_(
          reminderAudit,
          reference,
          taskId,
          today,
          nextCount,
          new Date(now).toISOString(),
          'REMINDER_SENT',
          ''
        );

        console.log(
          'TELEGRAM_TEST_REMINDER_SENT: ' +
          reference +
          '; count_today:' +
          nextCount
        );

        return;
      } catch (err) {
        bseUpsertTelegramReminderAudit_(
          reminderAudit,
          reference,
          taskId,
          today,
          countToday,
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

function debugBseTestTask146694136() {
  const book = boundTestBook_();
  const queue = bseTelegramQueue_(book);
  const rows = queue.getLastRow() > 1
    ? queue.getRange(2, 1, queue.getLastRow() - 1, BSE_TG_QUEUE_HEADERS.length).getValues()
    : [];

  const updateId = '146694136';
  const reference = 'BSE-TG-' + updateId;
  const rowIndex = rows.findIndex(r => String(r[0]) === updateId);
  const row = rowIndex >= 0 ? rows[rowIndex] : null;
  const enabledAt = PropertiesService.getScriptProperties()
    .getProperty('BSE_TEST_TASKS_ENABLED_AT');
  const cutoff = Date.parse(enabledAt || '');
  const receivedAt = row ? Date.parse(String(row[5] || '')) : NaN;
  const status = row ? row[6] : null;
  const eligible = Boolean(
    enabledAt &&
    Number.isFinite(cutoff) &&
    row &&
    status === 'NEEDS_HUMAN_REVIEW' &&
    Number.isFinite(receivedAt) &&
    receivedAt >= cutoff
  );

  const audit = bseTelegramTasksAudit_(book);
  const auditRows = audit.getLastRow() > 1
    ? audit.getRange(
        2,
        1,
        audit.getLastRow() - 1,
        BSE_TEST_TASKS_AUDIT_HEADERS.length
      ).getValues()
    : [];

  const eligibleBefore = [];
  for (let i = 0; i < rows.length; i++) {
    if (rowIndex >= 0 && i >= rowIndex) break;
    const candidate = rows[i];
    const candidateReceivedAt = Date.parse(String(candidate[5] || ''));
    if (
      enabledAt &&
      Number.isFinite(cutoff) &&
      candidate[6] === 'NEEDS_HUMAN_REVIEW' &&
      Number.isFinite(candidateReceivedAt) &&
      candidateReceivedAt >= cutoff
    ) {
      eligibleBefore.push({
        update_id: String(candidate[0]),
        received_at: candidate[5],
        received_at_ms: candidateReceivedAt,
        status: candidate[6]
      });
    }
  }

  console.log(JSON.stringify({
    enabled_at: enabledAt,
    cutoff_ms: cutoff,
    sync_disabled: !enabledAt,
    row: row,
    received_at: row ? row[5] : null,
    received_at_ms: Number.isFinite(receivedAt) ? receivedAt : null,
    status: status,
    eligible: eligible,
    audit_rows: auditRows.filter(r => String(r[0]) === reference),
    eligible_needs_human_review_before: eligibleBefore
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
