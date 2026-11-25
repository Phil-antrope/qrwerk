'use strict';

// EvidenceMatrix – lokale, deterministische Logik. Keine IO, keine APIs, keine Normtexte.
// Läuft identisch in Node (require) und im Browser (window.EvidenceMatrixCore).

var HEADER_SYNONYMS = {
  id: ['id', 'kontrollid', 'kontrollenummer', 'kontrolle', 'control', 'controlid', 'requirement'],
  file: ['belegdatei', 'beleg', 'datei', 'dateiname', 'evidence', 'evidencefile', 'file', 'filename'],
  date: ['datum', 'belegdatum', 'date', 'evidence date', 'belegdatumiso'],
  status: ['status', 'zustand'],
  owner: ['verantwortlich', 'owner', 'zustaendig', 'person'],
  due: ['review', 'reviewdue', 'fällig', 'faellig', 'reviewdatum', 'naechstepruefung', 'due', 'duedate'],
  notes: ['notiz', 'notizen', 'notes', 'kommentar', 'comment']
};

var STATUS_GROUPS = {
  ok: ['ok', 'vorhanden', 'geprueft', 'geprüft', 'erledigt', 'done', 'valid', 'current'],
  offen: ['offen', 'open', 'missing', 'fehlt', 'pending'],
  faellig: ['fällig', 'faellig', 'due', 'bald', 'review'],
  abgelaufen: ['abgelaufen', 'expired', 'outdated', 'alt']
};

function normalizeKey(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

function normalizeHeader(header) {
  var key = normalizeKey(header);
  var found = null;
  Object.keys(HEADER_SYNONYMS).forEach(function (field) {
    if (found) return;
    if (HEADER_SYNONYMS[field].some(function (s) { return normalizeKey(s) === key; })) found = field;
  });
  return found;
}

function parseCSV(text, forcedDelimiter) {
  var input = String(text == null ? '' : text).replace(/^\uFEFF/, '');
  var delimiters = forcedDelimiter ? [forcedDelimiter] : [';', ',', '\t'];
  var delimiter = forcedDelimiter;
  if (!delimiter) {
    var counts = delimiters.map(function (d) { return { d: d, n: input.split(d).length - 1 }; });
    counts.sort(function (a, b) { return b.n - a.n; });
    delimiter = counts[0].n > 0 ? counts[0].d : ';';
  }

  var rows = [];
  var row = [];
  var cell = '';
  var quoted = false;
  for (var i = 0; i < input.length; i++) {
    var ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }

  rows = rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); })
    .map(function (r) { return r.map(function (c) { return String(c).trim(); }); });
  if (!rows.length) return { delimiter: delimiter, headers: [], records: [] };

  var headers = rows[0].map(normalizeHeader);
  var records = rows.slice(1).map(function (r, idx) {
    var record = { line: idx + 2, unknown: [] };
    headers.forEach(function (field, col) {
      if (!field) return;
      record[field] = r[col] == null ? '' : String(r[col]).trim();
    });
    for (var c = 0; c < r.length; c++) {
      if (c >= headers.length || !headers[c]) {
        if (r[c] && r[c].trim()) record.unknown.push({ column: c + 1, value: r[c].trim() });
      }
    }
    return record;
  });
  return { delimiter: delimiter, headers: headers, records: records };
}

function parseDate(value) {
  var s = String(value == null ? '' : value).trim();
  if (!s) return null;
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) || /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (!m) return null;
  var y, mo, d;
  if (m[1].length === 4) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else { d = +m[1]; mo = +m[2]; y = +m[3]; }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  var iso = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  var check = new Date(iso + 'T00:00:00Z');
  if (isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

function statusGroup(value) {
  var key = normalizeKey(value);
  if (!key) return 'unbekannt';
  var found = 'unbekannt';
  Object.keys(STATUS_GROUPS).forEach(function (group) {
    if (STATUS_GROUPS[group].some(function (s) { return normalizeKey(s) === key; })) found = group;
  });
  return found;
}

function analyze(records, options) {
  var opts = options || {};
  var reference = parseDate(opts.referenceDate) || new Date().toISOString().slice(0, 10);
  var upcomingDays = typeof opts.upcomingDays === 'number' ? opts.upcomingDays : 14;
  var limit = new Date(reference + 'T00:00:00Z');
  limit.setUTCDate(limit.getUTCDate() + upcomingDays);
  var limitISO = limit.toISOString().slice(0, 10);

  var seen = Object.create(null);
  var result = { referenceDate: reference, upcomingLimit: limitISO, rows: [], gaps: [], due: [], errors: [] };

  (records || []).forEach(function (raw) {
    var row = {
      line: raw.line,
      id: String(raw.id || '').trim(),
      file: String(raw.file || '').trim(),
      date: parseDate(raw.date),
      rawDate: String(raw.date || '').trim(),
      status: statusGroup(raw.status),
      rawStatus: String(raw.status || '').trim(),
      owner: String(raw.owner || '').trim(),
      due: parseDate(raw.due),
      rawDue: String(raw.due || '').trim(),
      notes: String(raw.notes || '').trim(),
      issues: []
    };

    if (!row.id) result.errors.push({ line: row.line, field: 'id', message: 'Kontroll-ID fehlt' });
    if (!row.file) result.errors.push({ line: row.line, field: 'file', message: 'Belegdatei fehlt' });
    if (row.rawDate && !row.date) result.errors.push({ line: row.line, field: 'date', message: 'Datum ungültig (YYYY-MM-DD oder TT.MM.JJJJ)' });
    if (row.rawDue && !row.due) result.errors.push({ line: row.line, field: 'due', message: 'Reviewdatum ungültig' });

    var key = row.id.toLowerCase() + '|' + row.file.toLowerCase();
    if (row.id && row.file) {
      if (seen[key]) {
        row.issues.push('Dublette zu Zeile ' + seen[key]);
        result.gaps.push({ line: row.line, id: row.id, reason: 'Dublette', detail: 'gleiche ID + Belegdatei wie Zeile ' + seen[key] });
      } else seen[key] = row.line;
    }
    if (!row.file) result.gaps.push({ line: row.line, id: row.id, reason: 'Beleg fehlt', detail: 'keine Belegdatei angegeben' });
    if (row.status === 'offen') result.gaps.push({ line: row.line, id: row.id, reason: 'Status offen', detail: row.rawStatus });
    if (row.status === 'faellig' || row.status === 'abgelaufen') result.gaps.push({ line: row.line, id: row.id, reason: 'Status ' + row.status, detail: row.rawStatus });
    if (row.due && row.due <= limitISO) {
      result.due.push({ line: row.line, id: row.id, due: row.due, owner: row.owner });
      result.gaps.push({ line: row.line, id: row.id, reason: row.due < reference ? 'Review überfällig' : 'Review fällig', detail: row.due });
    }
    result.rows.push(row);
  });

  result.summary = {
    rows: result.rows.length,
    ok: result.rows.filter(function (r) { return r.status === 'ok'; }).length,
    gaps: result.gaps.length,
    due: result.due.length,
    errors: result.errors.length
  };
  return result;
}

function applyLimit(records, isPro, freeLimit) {
  var max = isPro ? Infinity : (typeof freeLimit === 'number' ? freeLimit : 5);
  return { allowed: records.slice(0, max), locked: Math.max(0, records.length - max) };
}

function csvCell(value) {
  var s = String(value == null ? '' : value);
  // Tabellenformeln neutralisieren (CSV-Injection), auch bei lokalem Export.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[";\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCSV(headers, rows, delimiter) {
  var d = delimiter || ';';
  var out = [headers.map(csvCell).join(d)];
  rows.forEach(function (row) { out.push(row.map(csvCell).join(d)); });
  return out.join('\r\n') + '\r\n';
}

function escapeHTML(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

var api = {
  HEADER_SYNONYMS: HEADER_SYNONYMS,
  STATUS_GROUPS: STATUS_GROUPS,
  normalizeKey: normalizeKey,
  normalizeHeader: normalizeHeader,
  parseCSV: parseCSV,
  parseDate: parseDate,
  statusGroup: statusGroup,
  analyze: analyze,
  applyLimit: applyLimit,
  csvCell: csvCell,
  toCSV: toCSV,
  escapeHTML: escapeHTML
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.EvidenceMatrixCore = api;
