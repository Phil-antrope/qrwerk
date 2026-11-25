(function () {
  'use strict';

  var core = window.QRWerkCore;
  var features = window.QRWerkFeatures;
  var print = window.QRWerkPrint;
  core.configureQRCode(window.qrcode); // Coding type 1 = UTF-8 bytes in the QR matrix.
  var $ = function (id) { return document.getElementById(id); };
  var rows = [];
  var built = [];
  var proMode = false;
  var printLang = 'de';
  var templates = features.emptyTemplates();
  var activeReferencePattern = '';

  var SAMPLE = [
    'IBAN;Betrag;Währung;Referenztyp;Referenz;Kunde;PLZ;Ort;Nachricht',
    'CH93 0076 2011 6238 5295 7;1250.00;CHF;SCOR;RF18539007547034;Muster AG;8000;Zürich;Rechnung 2026-001',
    'CH9300762011623852957;89.50;CHF;NON;;Beispiel GmbH;3000;Bern;Rechnung 2026-002'
  ].join('\n');

  function creditor() {
    return {
      name: $('cr-name').value,
      street: $('cr-street').value,
      buildingNo: $('cr-building').value,
      postalCode: $('cr-postal').value,
      town: $('cr-town').value,
      country: $('cr-country').value,
      iban: $('cr-iban').value
    };
  }

  function inferReferenceType(row, iban) {
    var explicit = core.compact(row.referenceType).toUpperCase();
    if (['QRR', 'SCOR', 'NON'].indexOf(explicit) >= 0) return explicit;
    var ref = features.resolveReference(row.reference, activeReferencePattern);
    if (core.isQRIBAN(iban)) return 'QRR';
    if (/^RF/i.test(ref)) return 'SCOR';
    return 'NON';
  }

  function toRecord(row) {
    var iban = core.compact(row.iban) || core.compact($('cr-iban').value);
    var hasDebtorAddress = ['debtorName', 'debtorStreet', 'debtorBuildingNo', 'debtorPostalCode', 'debtorTown']
      .some(function (key) { return core.compact(row[key]) !== ''; });
    return {
      iban: iban,
      amount: row.amount,
      currency: row.currency || 'CHF',
      referenceType: inferReferenceType(row, iban),
      reference: features.resolveReference(row.reference, activeReferencePattern),
      message: row.message,
      creditor: creditor(),
      debtor: {
        name: row.debtorName,
        street: row.debtorStreet,
        buildingNo: row.debtorBuildingNo,
        postalCode: row.debtorPostalCode,
        town: row.debtorTown,
        country: row.debtorCountry || (hasDebtorAddress ? 'CH' : '')
      }
    };
  }

  function setMode(next) {
    proMode = !!next;
    $('pro-mode').checked = proMode;
    $('mode-badge').textContent = proMode
      ? 'Demo/Pro-Modus · unbegrenzt (lokal)'
      : 'Gratis · max. ' + features.FREE_LIMIT;
    $('mode-note').textContent = proMode
      ? 'Demo/Pro-Modus aktiv: nur in diesem Browser, unbegrenzte Stapel – kein Login, kein Kauf, keine Zahlung.'
      : 'Gratislimit: ' + features.FREE_LIMIT + ' QR-Bills pro Vorgang. Der Demo/Pro-Modus ist ein lokaler Schalter – kein Login, kein Kauf, keine Zahlung.';
  }

  function readStoredTemplates() {
    try {
      if (!window.localStorage) return features.emptyTemplates();
      return features.parseTemplates(window.localStorage.getItem(features.TEMPLATE_KEY)) || features.emptyTemplates();
    } catch (e) {
      return features.emptyTemplates();
    }
  }

  function writeStoredTemplates(data) {
    try {
      if (!window.localStorage) return false;
      window.localStorage.setItem(features.TEMPLATE_KEY, features.serializeTemplates(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function setTemplateStatus(text) {
    $('tpl-status').textContent = text;
  }

  function fillCreditorFromTemplate() {
    var c = templates.creditor;
    $('cr-name').value = c.name;
    $('cr-street').value = c.street;
    $('cr-building').value = c.buildingNo;
    $('cr-postal').value = c.postalCode;
    $('cr-town').value = c.town;
    $('cr-country').value = c.country || 'CH';
    $('cr-iban').value = c.iban;
  }

  function saveCreditorTemplate() {
    templates.creditor = creditor();
    templates = features.normalizeTemplates(templates);
    setTemplateStatus(writeStoredTemplates(templates)
      ? 'Adresse auf diesem Gerät gespeichert.'
      : 'Speichern nicht möglich (localStorage blockiert).');
  }

  function loadCreditorTemplate() {
    templates = readStoredTemplates();
    var found = JSON.stringify(templates) !== JSON.stringify(features.emptyTemplates());
    renderReferencePatterns();
    if (!found) {
      setTemplateStatus('Keine gespeicherte Vorlage auf diesem Gerät.');
      return;
    }
    fillCreditorFromTemplate();
    setTemplateStatus('Adresse von diesem Gerät geladen – kein Server.');
  }

  function renderReferencePatterns() {
    var list = $('tpl-ref-list');
    list.innerHTML = '';
    templates.referencePatterns.forEach(function (pattern) {
      var option = document.createElement('option');
      option.value = pattern;
      option.textContent = pattern;
      list.appendChild(option);
    });
    var empty = templates.referencePatterns.length === 0;
    list.disabled = empty;
    $('tpl-ref-use').disabled = empty;
    $('active-ref').textContent = activeReferencePattern
      ? 'Aktives Muster (nur für Zeilen ohne Referenz): ' + activeReferencePattern
      : 'Kein aktives Muster.';
  }

  function addReferencePattern() {
    templates = features.addReferencePattern(templates, $('tpl-ref-input').value);
    var saved = writeStoredTemplates(templates);
    setTemplateStatus(saved ? 'Referenzmuster auf diesem Gerät gespeichert.' : 'Speichern nicht möglich (localStorage blockiert).');
    if (saved) $('tpl-ref-input').value = '';
    renderReferencePatterns();
  }

  function useReferencePattern() {
    var value = $('tpl-ref-list').value;
    if (!value) return;
    activeReferencePattern = value;
    renderReferencePatterns();
    if (rows.length) parse();
  }

  function clearReferencePattern() {
    activeReferencePattern = '';
    renderReferencePatterns();
    if (rows.length) parse();
  }

  function fileStamp() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  function downloadReport(type) {
    if (!rows.length) return;
    if (typeof Blob === 'undefined' || !window.URL || !window.URL.createObjectURL) {
      $('gen-note').textContent = 'Download wird von diesem Browser nicht unterstützt.';
      return;
    }
    var text = type === 'json' ? features.reportToJSON(rows) : features.reportToCSV(rows);
    var mime = type === 'json' ? 'application/json' : 'text/csv';
    var blob = new Blob(['\uFEFF' + text], { type: mime + ';charset=utf-8' });
    var url = window.URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'qrwerk-bericht-' + fileStamp() + '.' + type;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 1000);
  }

  function renderSlips() {
    $('slips').innerHTML = built.map(function (check, i) {
      return slipHtml(check.payload, check, i);
    }).join('');
  }

  function renderTable() {
    var tbody = $('rows').querySelector('tbody');
    tbody.innerHTML = '';
    var ok = 0;
    rows.forEach(function (item, index) {
      var tr = document.createElement('tr');
      var status = item.check.ok ? 'OK' : item.check.errors.join(' · ');
      var cells = [
        String(index + 1),
        core.compact(item.row.debtorName) || core.compact(item.row.message) || '–',
        core.compact(item.row.amount),
        status
      ];
      cells.forEach(function (text, i) {
        var td = document.createElement('td');
        td.textContent = text;
        if (i === 3) td.className = item.check.ok ? 'status-ok' : 'status-error';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
      if (item.check.ok) ok++;
    });
    $('summary').textContent = rows.length
      ? rows.length + ' Zeilen gelesen · ' + ok + ' gültig · ' + (rows.length - ok) + ' mit Fehlern'
      : 'Keine gültigen Datenzeilen gefunden.';
    $('result-card').hidden = false;
    $('preview-card').hidden = true;
    $('generate').disabled = ok === 0;
    $('export-csv').disabled = rows.length === 0;
    $('export-json').disabled = rows.length === 0;
  }

  function slipHtml(payload, check, index) {
    return print.slipHtml(payload, check, index, printLang, window.qrcode);
  }

  function generate() {
    var validRows = rows.filter(function (item) { return item.check.ok; });
    if (!validRows.length) return;
    var taken = features.takeValid(validRows, proMode);
    built = taken.map(function (item) { return core.buildPayload(toRecord(item.row)); });
    renderSlips();
    $('preview-card').hidden = false;
    $('gen-note').textContent = features.limitNote(validRows.length, proMode) +
      ' Bericht: CSV/JSON lokal herunterladen – kein Upload an Dritte.';
    $('preview-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function parse() {
    built = [];
    rows = core.parseCSV($('csv').value).map(function (row) {
      return { row: row, check: core.buildPayload(toRecord(row)) };
    });
    renderTable();
  }

  $('sample').addEventListener('click', function () {
    $('csv').value = SAMPLE;
    $('cr-name').value = 'Musterfirma GmbH';
    $('cr-street').value = 'Musterstrasse';
    $('cr-building').value = '12';
    $('cr-postal').value = '8000';
    $('cr-town').value = 'Zürich';
    $('cr-iban').value = 'CH9300762011623852957';
    parse();
  });

  $('parse').addEventListener('click', parse);
  $('generate').addEventListener('click', generate);
  $('export-csv').addEventListener('click', function () { downloadReport('csv'); });
  $('export-json').addEventListener('click', function () { downloadReport('json'); });
  $('pro-mode').addEventListener('change', function () {
    setMode(this.checked);
    if (built.length) generate();
  });
  $('lang').addEventListener('change', function () {
    printLang = this.value;
    if (built.length) renderSlips();
  });
  $('tpl-save').addEventListener('click', saveCreditorTemplate);
  $('tpl-load').addEventListener('click', loadCreditorTemplate);
  $('tpl-ref-add').addEventListener('click', addReferencePattern);
  $('tpl-ref-use').addEventListener('click', useReferencePattern);
  $('tpl-ref-clear').addEventListener('click', clearReferencePattern);
  $('print').addEventListener('click', function () { window.print(); });
  $('file').addEventListener('change', function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { $('csv').value = String(reader.result); parse(); };
    reader.readAsText(file);
  });

  templates = readStoredTemplates();
  renderReferencePatterns();
  if (JSON.stringify(templates) !== JSON.stringify(features.emptyTemplates())) {
    setTemplateStatus('Vorlagen von diesem Gerät bereit – lokal, kein Server.');
  }
  setMode(features.isProParam(window.location.search));
})();
