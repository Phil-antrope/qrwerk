'use strict';

// EvidenceMatrix – Berichts- und Vorlagenfunktionen. Keine externen Ressourcen.

var core = (typeof module !== 'undefined' && module.exports)
  ? require('./core.js')
  : window.EvidenceMatrixCore;

var SAMPLE_CSV = [
  'Kontroll-ID;Belegdatei;Datum;Status;Verantwortlich;Review;Notiz',
  'AC-01;zugriff_team.png;2026-10-04;ok;IT;2026-12-01;Monatliche Sichtprüfung',
  'AC-02; backup_protokoll.pdf;04.11.2026;offen;IT;2026-11-20;Beleg fehlt im Ordner',
  'AC-03;schulung.png;2026-09-12;ok;;2026-11-30;',
  'AC-02;backup_protokoll.pdf;2026-11-04;ok;IT;2026-12-15;Dublette'
].join('\r\n');

function gapsCSV(analysis) {
  return core.toCSV(
    ['Zeile', 'Kontroll-ID', 'Grund', 'Detail'],
    (analysis.gaps || []).map(function (g) { return [g.line, g.id, g.reason, g.detail]; })
  );
}

function dueCSV(analysis) {
  return core.toCSV(
    ['Zeile', 'Kontroll-ID', 'Review', 'Verantwortlich'],
    (analysis.due || []).map(function (d) { return [d.line, d.id, d.due, d.owner]; })
  );
}

function matrixCSV(analysis) {
  return core.toCSV(
    ['Zeile', 'Kontroll-ID', 'Belegdatei', 'Datum', 'Status', 'Verantwortlich', 'Review', 'Notiz'],
    (analysis.rows || []).map(function (r) {
      return [r.line, r.id, r.file, r.date || r.rawDate, r.rawStatus || r.status, r.owner, r.due || r.rawDue, r.notes];
    })
  );
}

function reportHTML(analysis, meta) {
  var m = meta || {};
  var esc = core.escapeHTML;
  var rows = (analysis.rows || []).map(function (r) {
    var flag = r.issues.length ? ' class="flag"' : '';
    return '<tr' + flag + '><td>' + r.line + '</td><td>' + esc(r.id) + '</td><td>' + esc(r.file) +
      '</td><td>' + esc(r.date || r.rawDate) + '</td><td>' + esc(r.rawStatus || r.status) +
      '</td><td>' + esc(r.owner) + '</td><td>' + esc(r.due || r.rawDue) + '</td><td>' + esc(r.notes) + '</td></tr>';
  }).join('\n');

  var gaps = (analysis.gaps || []).map(function (g) {
    return '<li>Zeile ' + g.line + ' · ' + esc(g.id) + ' · <strong>' + esc(g.reason) + '</strong> · ' + esc(g.detail) + '</li>';
  }).join('\n') || '<li>Keine Lücken gefunden.</li>';

  var due = (analysis.due || []).map(function (d) {
    return '<li>' + esc(d.due) + ' · ' + esc(d.id) + (d.owner ? ' · ' + esc(d.owner) : '') + '</li>';
  }).join('\n') || '<li>Keine fälligen Reviews im Fenster.</li>';

  return '<!doctype html><html lang="de-CH"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Belegmatrix – ' + esc(m.title || 'Bericht') + '</title>' +
    '<style>' +
    '@page{size:A4;margin:14mm}body{font:10pt Arial,Helvetica,"Liberation Sans",sans-serif;color:#111}' +
    'h1{font-size:16pt;margin:0 0 4mm}h2{font-size:12pt;margin:6mm 0 2mm}' +
    'table{width:100%;border-collapse:collapse;font-size:8pt}th,td{border:0.3pt solid #888;padding:1.5mm;text-align:left;vertical-align:top}' +
    'th{background:#eee}.flag{background:#fff3cd}ul{margin:0;padding-left:5mm;font-size:9pt}' +
    'footer{margin-top:6mm;font-size:8pt;color:#555}' +
    '</style></head><body>' +
    '<h1>Belegmatrix · ' + esc(m.title || 'Bericht') + '</h1>' +
    '<p>Stichtag ' + esc(analysis.referenceDate) + ' · Fenster bis ' + esc(analysis.upcomingLimit) +
    ' · ' + analysis.summary.rows + ' Zeilen · ' + analysis.summary.gaps + ' Lücken · ' + analysis.summary.due + ' Reviews</p>' +
    '<h2>Matrix</h2><table><thead><tr><th>Zeile</th><th>Kontroll-ID</th><th>Belegdatei</th><th>Datum</th>' +
    '<th>Status</th><th>Verantwortlich</th><th>Review</th><th>Notiz</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<h2>Lückenliste</h2><ul>' + gaps + '</ul>' +
    '<h2>Fällige Reviews</h2><ul>' + due + '</ul>' +
    '<footer>Erstellt lokal im Browser mit EvidenceMatrix. Kein ISO-Produkt, keine Zertifizierung, keine Beratung, keine Garantie für Auditannahme. Keine Daten übertragen.</footer>' +
    '</body></html>';
}

var STORAGE_KEY = 'evidencematrix.v1';

function saveTemplate(storage, text) {
  if (!storage) return false;
  try { storage.setItem(STORAGE_KEY, String(text)); return true; }
  catch (e) { return false; }
}

function loadTemplate(storage) {
  if (!storage) return '';
  try { return storage.getItem(STORAGE_KEY) || ''; }
  catch (e) { return ''; }
}

var api = {
  SAMPLE_CSV: SAMPLE_CSV,
  gapsCSV: gapsCSV,
  dueCSV: dueCSV,
  matrixCSV: matrixCSV,
  reportHTML: reportHTML,
  saveTemplate: saveTemplate,
  loadTemplate: loadTemplate,
  STORAGE_KEY: STORAGE_KEY
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.EvidenceMatrixFeatures = api;
