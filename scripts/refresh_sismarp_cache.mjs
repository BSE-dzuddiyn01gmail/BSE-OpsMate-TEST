#!/usr/bin/env node
/**
 * Refresh the derived SISMARP transport cache from the public DOA service.
 * Authority remains SISMARP / Jabatan Pertanian Malaysia.
 * This cache is derived transport state only and must fail closed when stale.
 */
import fs from 'node:fs';
import path from 'node:path';

const SOURCE = 'http://www.portal.doa.gov.my/sismarp/';
const WILDCARD_URL = SOURCE + 'welcome/searchtanaman?search=%25';
const USER_AGENT = 'OpsMate-BSE-SISMARP-Cache/1.1 (+public DOA data; weekly refresh)';
const MIN_ROWS = 20000;

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : '';
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function cleanCell(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

async function fetchSource() {
  const started = Date.now();
  const response = await fetch(WILDCARD_URL, {
    redirect: 'follow',
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`SISMARP HTTP ${response.status}`);
  const text = await response.text();
  return { text, elapsed_ms: Date.now() - started };
}

function parseRows(text) {
  const byId = new Map();
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(text))) {
    const rowHtml = rowMatch[1];
    const cells = [];
    const tdRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRe.exec(rowHtml))) cells.push(cleanCell(tdMatch[1]));
    if (cells.length < 6 || !/^\d+$/.test(cells[0])) continue;
    const detail = rowHtml.match(/\/detail\/(\d+)/i);
    if (!detail) continue;
    const id = detail[1];
    byId.set(id, { i: id, c: cells[1], s: cells[2], p: cells[3], t: cells[4], a: cells[5] });
  }
  return [...byId.values()].sort((x, y) => Number(x.i) - Number(y.i));
}

function validate(rows) {
  if (rows.length < MIN_ROWS) throw new Error(`Unexpectedly small SISMARP cache: ${rows.length} records`);
  const peria = rows.filter(r => /peria/i.test(r.c));
  const deltamethrinPeria = peria.filter(r => /deltamethrin/i.test(r.a));
  if (!peria.length) throw new Error('SISMARP validation failed: no Peria rows');
  if (!deltamethrinPeria.length) throw new Error('SISMARP validation failed: no Deltamethrin + Peria control rows');
  return { peria_rows: peria.length, deltamethrin_peria_rows: deltamethrinPeria.length };
}

async function main() {
  const output = argValue('--output');
  if (!output) throw new Error('Usage: node refresh_sismarp_cache.mjs --output <path>');
  const { text, elapsed_ms } = await fetchSource();
  const rows = parseRows(text);
  const controls = validate(rows);
  const refreshed_at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const data = {
    v: 1,
    authority: 'SISMARP - Jabatan Pertanian Malaysia',
    source: SOURCE,
    refreshed_at,
    freshness_days: 14,
    record_count: rows.length,
    fields: { i: 'detail_id', c: 'crop', s: 'pest_scientific', p: 'pest_common', t: 'trade_name', a: 'active_ingredient' },
    rows,
  };
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(data) + '\n', 'utf8');
  console.log(JSON.stringify({ refreshed_at, record_count: rows.length, fetch_elapsed_ms: elapsed_ms, ...controls, output: path.resolve(output) }));
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
