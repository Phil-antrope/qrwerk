(function () {
  'use strict';

  var core = window.QRWerkCore;
  core.configureQRCode(window.qrcode); // Coding type 1 = UTF-8 bytes in the QR matrix.
  var $ = function (id) { return document.getElementById(id); };
  var FREE_LIMIT = 5;
  var rows = [];
  var built = [];

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
      country: $('cr-country').value
    };
  }

  function inferReferenceType(row, iban) {
    var explicit = core.compact(row.referenceType).toUpperCase();
    if (['QRR', 'SCOR', 'NON'].indexOf(explicit) >= 0) return explicit;
    var ref = core.compact(row.reference);
    if (core.isQRIBAN(iban)) return 'QRR';
    if (/^RF/i.test(ref)) return 'SCOR';
    return 'NON';
  }

  function toRecord(row) {
    var iban = core.compact(row.iban);
    var hasDebtorAddress = ['debtorName', 'debtorStreet', 'debtorBuildingNo', 'debtorPostalCode', 'debtorTown']
      .some(function (key) { return core.compact(row[key]) !== ''; });
    return {
      iban: iban,
      amount: row.amount,
      currency: row.currency || 'CHF',
      referenceType: inferReferenceType(row, iban),
      reference: row.reference,
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
    $('summary').textContent = rows.length + ' Zeilen gelesen · ' + ok + ' gültig · ' + (rows.length - ok) + ' mit Fehlern';
    $('result-card').hidden = false;
    $('preview-card').hidden = true;
    $('generate').disabled = ok === 0;
  }

  function qrSvg(payload) {
    var qr = window.qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    var count = qr.getModuleCount();
    var quiet = 4;
    var total = count + quiet * 2;
    var size = 190;
    var scale = size / total;
    var unit = (count * scale) / 46; // Swiss-cross dimensions are relative to a 46 mm symbol
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges">'];
    out.push('<rect width="' + size + '" height="' + size + '" fill="#fff"/>');
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          out.push('<rect x="' + ((c + quiet) * scale).toFixed(2) + '" y="' + ((r + quiet) * scale).toFixed(2) +
            '" width="' + scale.toFixed(2) + '" height="' + scale.toFixed(2) + '" fill="#000"/>');
        }
      }
    }
    var mid = size / 2;
    out.push('<rect x="' + (mid - 3.5 * unit) + '" y="' + (mid - 3.5 * unit) + '" width="' + (7 * unit) + '" height="' + (7 * unit) + '" fill="#fff"/>');
    out.push('<rect x="' + (mid - 3 * unit) + '" y="' + (mid - 3 * unit) + '" width="' + (6 * unit) + '" height="' + (6 * unit) + '" fill="#000000"/>');
    out.push('<rect x="' + (mid - 0.6 * unit) + '" y="' + (mid - 2.1 * unit) + '" width="' + (1.2 * unit) + '" height="' + (4.2 * unit) + '" fill="#fff"/>');
    out.push('<rect x="' + (mid - 2.1 * unit) + '" y="' + (mid - 0.6 * unit) + '" width="' + (4.2 * unit) + '" height="' + (1.2 * unit) + '" fill="#fff"/>');
    out.push('</svg>');
    return out.join('');
  }

  function slipHtml(payload, check, index) {
    var f = check.fields;
    var esc = function (s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    };
    var amount = (f[18] || '–') + ' ' + f[19];
    var payTo = [f[5], f[6], (f[7] ? f[6] + ' ' + f[7] : f[6]), f[8] + ' ' + f[9], f[10]].filter(Boolean).join(', ');
    var reference = f[28] === 'NON' ? '' : (f[28] + ' ' + f[29]);
    return '<article class="slip">' +
      '<div class="payment">' +
        '<div class="qr">' + qrSvg(payload) + '</div>' +
        '<div class="payinfo"><dl>' +
          '<dt>Zahlbar an</dt><dd>' + esc(payTo) + '</dd>' +
          '<dt>IBAN</dt><dd>' + esc(f[3]) + '</dd>' +
          '<dt>Referenz</dt><dd>' + esc(reference) + '</dd>' +
          '<dt>Nachricht</dt><dd>' + esc(f[30]) + '</dd>' +
          '<dt>Betrag</dt><dd class="amount">' + esc(amount) + '</dd>' +
        '</dl></div>' +
      '</div>' +
      '<div class="receipt">' +
        '<h4>Empfangsschein · ' + (index + 1) + '</h4>' +
        '<div class="line">' + esc(payTo) + '</div>' +
        '<div class="line">' + esc(f[3]) + '</div>' +
        '<div class="line">' + esc(reference) + '</div>' +
        '<div class="line">' + esc(f[30]) + '</div>' +
        '<div class="line amount">' + esc(amount) + '</div>' +
      '</div>' +
    '</article>';
  }

  function generate() {
    var validRows = rows.filter(function (item) { return item.check.ok; });
    if (!validRows.length) return;
    var taken = validRows.slice(0, FREE_LIMIT);
    built = taken.map(function (item) { return core.buildPayload(toRecord(item.row)); });
    $('slips').innerHTML = built.map(function (check, i) {
      return slipHtml(check.payload, check, i);
    }).join('');
    $('preview-card').hidden = false;
    $('gen-note').textContent = taken.length + ' von ' + validRows.length + ' gültigen Zeilen erzeugt. ' +
      (validRows.length > FREE_LIMIT ? 'Kostenloses Limit: ' + FREE_LIMIT + ' QR-Bills pro Vorgang.' : '');
    $('preview-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function parse() {
    rows = core.parseCSV($('csv').value).map(function (row) {
      return { row: row, check: core.buildPayload(toRecord(row)) };
    });
    if (!rows.length) {
      $('summary').textContent = 'Keine gültigen Datenzeilen gefunden.';
      $('result-card').hidden = false;
      return;
    }
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
  $('print').addEventListener('click', function () { window.print(); });
  $('file').addEventListener('change', function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { $('csv').value = String(reader.result); parse(); };
    reader.readAsText(file);
  });
})();
