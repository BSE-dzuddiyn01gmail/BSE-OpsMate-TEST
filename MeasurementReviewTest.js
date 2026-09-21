/** @OnlyCurrentDoc */
// TEST-only human review for one complete Measurement_Log candidate per Telegram reference.

const BSE_MEASUREMENT_LOG_HEADERS = [
  'source_key',
  'queue_update_id',
  'candidate_index',
  'event_date',
  'event_time',
  'plot_id',
  'measurement_type',
  'value',
  'unit_or_scale',
  'verification_status',
  'original_note',
  'approved_at',
  'reviewer',
  'payload_hash'
];

const BSE_MEASUREMENT_REVIEW_HEADERS = [
  'review_id',
  'source_key',
  'queue_update_id',
  'candidate_index',
  'target',
  'payload_hash',
  'decision',
  'reviewer',
  'review_note',
  'reviewed_at',
  'queue_status_before',
  'candidate_json'
];

function approveTelegramMeasurementByReference() {
  const reference = bsePromptMeasurementReference_('Lulus Measurement TEST');
  if (!reference) return;
  return bseReviewTelegramMeasurementByReference_('APPROVED', reference, '');
}

function rejectTelegramMeasurementByReference() {
  const reference = bsePromptMeasurementReference_('Tolak Measurement TEST');
  if (!reference) return;

  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Tolak Measurement TEST',
    'Nyatakan sebab penolakan:',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;

  const note = response.getResponseText().trim();
  if (!note) throw new Error('Sebab penolakan wajib diisi.');
  return bseReviewTelegramMeasurementByReference_('REJECTED', reference, note);
}

function bsePromptMeasurementReference_(title) {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    title,
    'Masukkan rujukan tepat, contohnya BSE-TG-123456:',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return '';

  const reference = response.getResponseText().trim();
  if (!/^BSE-TG-\d+$/.test(reference)) {
    throw new Error('Rujukan mesti tepat dalam format BSE-TG-<update_id>.');
  }
  return reference;
}

function bseReviewTelegramMeasurementByReference_(decision, reference, note) {
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    throw new Error('Keputusan semakan tidak sah.');
  }
  if (!/^BSE-TG-\d+$/.test(reference)) {
    throw new Error('Rujukan mesti tepat dalam format BSE-TG-<update_id>.');
  }
  if (decision === 'REJECTED' && !String(note || '').trim()) {
    throw new Error('Sebab penolakan wajib diisi.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Barisan sedang dikemas kini. Cuba semula.');
  }

  try {
    const book = boundTestBook_();
    const queue = bseTelegramQueue_(book);
    const updateId = reference.slice('BSE-TG-'.length);
    const rows = queue.getLastRow() > 1
      ? queue.getRange(
          2,
          1,
          queue.getLastRow() - 1,
          BSE_TG_QUEUE_HEADERS.length
        ).getValues()
      : [];
    const matches = rows
      .map((row, index) => ({row: row, sheetRow: index + 2}))
      .filter(item => String(item.row[0]) === updateId);

    if (matches.length !== 1) {
      throw new Error('Rujukan mesti sepadan dengan tepat satu baris TELEGRAM_TEST_QUEUE.');
    }

    const selected = matches[0];
    const queueRow = selected.row;
    const status = String(queueRow[6] || '');
    const original = bseMeasurementRootOriginal_(rows, queueRow);
    const candidate = bseMeasurementCandidate_(queueRow[9], original);
    const sourceKey = updateId + '|' + candidate.index + '|Measurement_Log';
    const payloadHash = bseMeasurementHash_(candidate.candidate);
    const reviewer = bseMeasurementReviewer_();
    const stamp = new Date().toISOString();
    const existingReviewSheet = book.getSheetByName('TEST_MEASUREMENT_REVIEW')
      ? bseMeasurementSheet_(
          book,
          'TEST_MEASUREMENT_REVIEW',
          BSE_MEASUREMENT_REVIEW_HEADERS
        )
      : null;
    const reviews = existingReviewSheet
      ? bseMeasurementRows_(
          existingReviewSheet,
          BSE_MEASUREMENT_REVIEW_HEADERS.length
        )
      : [];
    const existingLogSheet = book.getSheetByName('TEST_MEASUREMENT_LOG')
      ? bseMeasurementSheet_(
          book,
          'TEST_MEASUREMENT_LOG',
          BSE_MEASUREMENT_LOG_HEADERS
        )
      : null;
    const logs = existingLogSheet
      ? bseMeasurementRows_(
          existingLogSheet,
          BSE_MEASUREMENT_LOG_HEADERS.length
        )
      : [];
    const priorReview = reviews.find(row => String(row[1]) === sourceKey);
    const priorLog = logs.find(row => String(row[0]) === sourceKey);
    const expectedStatus = decision === 'APPROVED'
      ? 'MEASUREMENT_APPROVED_TEST'
      : 'MEASUREMENT_REJECTED_TEST';

    if (priorReview) {
      if (
        String(priorReview[5]) !== payloadHash ||
        String(priorReview[6]) !== decision
      ) {
        throw new Error('Konflik semakan sedia ada untuk source_key ini.');
      }
      if (decision === 'APPROVED') {
        if (!priorLog || String(priorLog[13]) !== payloadHash) {
          throw new Error('Audit APPROVED tidak sepadan dengan rekod Measurement TEST.');
        }
      } else if (priorLog) {
        throw new Error('Measurement sudah diluluskan; penolakan tidak dibenarkan.');
      }

      if (status === expectedStatus) {
        return {
          source_key: sourceKey,
          decision: decision,
          duplicate: true,
          production_write: false
        };
      }
      if (status !== 'NEEDS_HUMAN_REVIEW') {
        throw new Error('Status queue tidak konsisten dengan audit Measurement sedia ada.');
      }

      queue.getRange(selected.sheetRow, 7).setValue(expectedStatus);
      SpreadsheetApp.flush();
      return {
        source_key: sourceKey,
        decision: decision,
        duplicate: true,
        production_write: false
      };
    }

    if (status !== 'NEEDS_HUMAN_REVIEW') {
      throw new Error('Baris queue bukan NEEDS_HUMAN_REVIEW.');
    }
    if (priorLog && String(priorLog[13]) !== payloadHash) {
      throw new Error('Konflik rekod Measurement TEST sedia ada.');
    }
    if (decision === 'REJECTED' && priorLog) {
      throw new Error('Measurement sudah diluluskan; penolakan tidak dibenarkan.');
    }

    if (decision === 'APPROVED' && !priorLog) {
      const logSheet = existingLogSheet || bseMeasurementSheet_(
        book,
        'TEST_MEASUREMENT_LOG',
        BSE_MEASUREMENT_LOG_HEADERS
      );
      const fields = candidate.candidate.fields;
      bseMeasurementAppend_(logSheet, [
        sourceKey,
        updateId,
        candidate.index,
        fields.event_date,
        fields.event_time,
        fields.plot_id,
        fields.measurement_type,
        fields.value,
        fields.unit_or_scale,
        fields.verification_status,
        original,
        stamp,
        reviewer,
        payloadHash
      ]);
      SpreadsheetApp.flush();
    }

    const reviewSheet = existingReviewSheet || bseMeasurementSheet_(
      book,
      'TEST_MEASUREMENT_REVIEW',
      BSE_MEASUREMENT_REVIEW_HEADERS
    );
    bseMeasurementAppend_(reviewSheet, [
      Utilities.getUuid(),
      sourceKey,
      updateId,
      candidate.index,
      'Measurement_Log',
      payloadHash,
      decision,
      reviewer,
      String(note || '').trim(),
      stamp,
      status,
      JSON.stringify(candidate.candidate)
    ]);
    SpreadsheetApp.flush();

    queue.getRange(selected.sheetRow, 7).setValue(expectedStatus);
    SpreadsheetApp.flush();

    console.log('MEASUREMENT_REVIEW_SAVED: ' + JSON.stringify({
      source_key: sourceKey,
      decision: decision,
      production_write: false
    }));
    return {
      source_key: sourceKey,
      decision: decision,
      duplicate: false,
      production_write: false
    };
  } finally {
    lock.releaseLock();
  }
}

function bseMeasurementRootOriginal_(rows, current) {
  let cursor = current;
  const seen = new Set();

  while (cursor[14]) {
    const id = String(cursor[0]);
    if (seen.has(id)) {
      throw new Error('Rantaian penjelasan Measurement tidak sah.');
    }
    seen.add(id);

    const parent = rows.find(row =>
      String(row[0]) === String(cursor[14]) &&
      String(row[1]) === String(current[1]) &&
      String(row[2]) === String(current[2])
    );
    if (!parent) {
      throw new Error('Laporan asal Measurement tidak ditemui.');
    }
    cursor = parent;
  }

  return String(cursor[4] || '');
}

function bseMeasurementCandidate_(encoded, original) {
  let result;
  try {
    result = JSON.parse(String(encoded || ''));
  } catch (_) {
    throw new Error('candidate_json tidak sah.');
  }

  if (
    !result ||
    result.production_write !== false ||
    !Array.isArray(result.candidates) ||
    result.candidates.length !== 1
  ) {
    throw new Error('Hasil mesti mengandungi tepat satu calon Measurement TEST.');
  }

  const found = result.candidates
    .map((candidate, index) => ({candidate: candidate, index: index}))
    .filter(item => item.candidate && item.candidate.target === 'Measurement_Log');

  if (found.length !== 1) {
    throw new Error('Mesti ada tepat satu calon Measurement_Log.');
  }

  const picked = found[0];
  const candidate = picked.candidate;
  const fields = candidate.fields;
  if (
    candidate.validation !== 'PASS' ||
    !Array.isArray(candidate.missing) ||
    candidate.missing.length ||
    !fields ||
    typeof fields !== 'object' ||
    Array.isArray(fields) ||
    fields.record_type !== 'MEASUREMENT' ||
    fields.verification_status !== 'PROVISIONAL' ||
    fields.original_note !== original
  ) {
    throw new Error('Calon Measurement gagal semakan kontrak TEST.');
  }

  ['event_date', 'plot_id', 'measurement_type'].forEach(field => {
    if (typeof fields[field] !== 'string' || !fields[field].trim()) {
      throw new Error('Medan wajib Measurement tidak lengkap: ' + field);
    }
  });
  if (typeof fields.value !== 'number' || !Number.isFinite(fields.value)) {
    throw new Error('Medan wajib Measurement tidak sah: value.');
  }
  if (
    typeof fields.event_time !== 'string' ||
    typeof fields.unit_or_scale !== 'string'
  ) {
    throw new Error('Medan pilihan Measurement tidak sah.');
  }

  return picked;
}

function bseMeasurementSheet_(book, name, headers) {
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);

  if (!sheet.getLastRow()) {
    if (sheet.getMaxColumns() < headers.length) {
      sheet.insertColumnsAfter(
        sheet.getMaxColumns(),
        headers.length - sheet.getMaxColumns()
      );
    }
    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  if (
    sheet.getRange(1, 1, 1, headers.length).getValues()[0].join('|') !==
    headers.join('|')
  ) {
    throw new Error('Header ' + name + ' tidak sepadan.');
  }
  return sheet;
}

function bseMeasurementRows_(sheet, width) {
  return sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues()
    : [];
}

function bseMeasurementAppend_(sheet, values) {
  const row = sheet.getLastRow() + 1;
  if (row > sheet.getMaxRows()) {
    sheet.insertRowsAfter(sheet.getMaxRows(), row - sheet.getMaxRows());
  }
  sheet.getRange(row, 1, 1, values.length)
    .setNumberFormat('@')
    .setValues([values.map(bseMeasurementCell_)])
    .setWrap(true);
}

function bseMeasurementCell_(value) {
  return typeof value === 'string' && /^\s*[=+@-]/.test(value)
    ? "'" + value
    : value;
}

function bseMeasurementStableJson_(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(bseMeasurementStableJson_).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ':' + bseMeasurementStableJson_(value[key])
    ).join(',') + '}';
  }
  return JSON.stringify(value);
}

function bseMeasurementHash_(candidate) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    bseMeasurementStableJson_(candidate),
    Utilities.Charset.UTF_8
  ).map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
}

function bseMeasurementReviewer_() {
  try {
    return Session.getActiveUser().getEmail() || 'TEST_OPERATOR';
  } catch (_) {
    return 'TEST_OPERATOR';
  }
}
