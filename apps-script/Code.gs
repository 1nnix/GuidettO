/**
 * Guidelines for the Orient: receives survey answers and serves them to the admin page.
 * Paste into a Google Sheet: Extensions > Apps Script. Setup steps are in README.md.
 *
 * Tabs it writes to (created automatically): answers, participants, contacts.
 * Script property ADMIN_PIN (Project Settings > Script properties) unlocks reading.
 */
const TABS = { answers: 'answers', participants: 'participants', contacts: 'contacts' };
const MAX_KEYS = 80, MAX_LEN = 600;

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  const name = TABS[d && d.kind];
  const row = d && d.row;
  if (!name || !row || typeof row !== 'object' || Object.keys(row).length > MAX_KEYS) return out({ ok: false, error: 'rejected' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    row.received_at = new Date().toISOString();
    let head = sh.getLastRow() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].filter(String) : [];
    const extra = Object.keys(row).filter(k => head.indexOf(k) < 0);
    if (extra.length) {
      head = head.concat(extra);
      sh.getRange(1, 1, 1, head.length).setValues([head]);
      sh.setFrozenRows(1);
    }
    sh.appendRow(head.map(h => clean(row[h])));
    return out({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const pin = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  const p = (e && e.parameter) || {};
  if (!pin || p.key !== pin) { Utilities.sleep(800); return out({ ok: false, error: 'pin' }); }
  if ((p.what || 'ping') === 'ping') return out({ ok: true });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return out({ ok: true, answers: read(ss, 'answers'), participants: read(ss, 'participants'), contacts: read(ss, 'contacts') });
}

// Stop typed text being read as a formula; cap length.
function clean(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  let s = String(v).slice(0, MAX_LEN);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function read(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getDisplayValues();
  const h = v.shift();
  return v.map(r => { const o = {}; h.forEach((k, i) => { o[k] = r[i]; }); return o; });
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
