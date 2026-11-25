/*
 * QRWerk core – Swiss QR-bill (SPC 0200) payload building and validation.
 * Runs in browser and Node. No network calls, no dependencies.
 *
 * Reference: Swiss Implementation Guidelines QR-bill v2.4 (SIX),
 * field order per SPC v2.x. Not a substitute for the official specification.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QRWerkCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Recursive modulo-10 carry-over table (Swiss QRR/ESR check digit, Annex B).
  var P10 = [
    [0, 9, 4, 6, 8, 2, 7, 1, 3, 5],
    [9, 4, 6, 8, 2, 7, 1, 3, 5, 0],
    [4, 6, 8, 2, 7, 1, 3, 5, 0, 9],
    [6, 8, 2, 7, 1, 3, 5, 0, 9, 4],
    [8, 2, 7, 1, 3, 5, 0, 9, 4, 6],
    [2, 7, 1, 3, 5, 0, 9, 4, 6, 8],
    [7, 1, 3, 5, 0, 9, 4, 6, 8, 2],
    [1, 3, 5, 0, 9, 4, 6, 8, 2, 7],
    [3, 5, 0, 9, 4, 6, 8, 2, 7, 1],
    [5, 0, 9, 4, 6, 8, 2, 7, 1, 3]
  ];

  var LIMITS = {
    name: 70, street: 70, buildingNo: 16, postalCode: 16, town: 35,
    country: 2, message: 140, billInformation: 140, altScheme: 100
  };

  // SIX IG v2.4, 4.1.1: U+0020-007E, U+00A0-00FF, U+0100-017F,
  // U+0218-021B (ș/ț) and the euro sign U+20AC. Disallowed characters are removed.
  var ALLOWED = /[\u0020-\u007E\u00A0-\u00FF\u0100-\u017F\u0218-\u021B\u20AC]/;

  function compact(value) {
    return value === undefined || value === null ? '' : String(value).trim();
  }

  function sanitize(value) {
    var input = compact(value);
    var out = '';
    for (var i = 0; i < input.length; i++) {
      var ch = input.charAt(i);
      if (ALLOWED.test(ch)) out += ch;
    }
    return out.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function normalizeIBAN(value) {
    return compact(value).replace(/[\s-]/g, '').toUpperCase();
  }

  function ibanCheck(iban) {
    var s = normalizeIBAN(iban);
    if (!/^(CH|LI)[0-9]{19}$/.test(s)) {
      return { valid: false, iban: s, reason: 'IBAN muss 21 Zeichen (CH/LI + 19 Ziffern) haben' };
    }
    var rotated = s.slice(4) + s.slice(0, 4);
    var numeric = '';
    for (var i = 0; i < rotated.length; i++) {
      var c = rotated.charAt(i);
      numeric += /[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c;
    }
    var remainder = 0;
    for (var j = 0; j < numeric.length; j++) {
      remainder = (remainder * 10 + Number(numeric.charAt(j))) % 97;
    }
    if (remainder !== 1) return { valid: false, iban: s, reason: 'IBAN-Prüfziffer ungültig (mod 97)' };
    return { valid: true, iban: s, reason: '' };
  }

  function isQRIBAN(iban) {
    var s = normalizeIBAN(iban);
    if (!/^(CH|LI)[0-9]{19}$/.test(s)) return false;
    var iid = Number(s.slice(4, 9));
    return iid >= 30000 && iid <= 31999;
  }

  function qrrCheckDigit(base26) {
    var carry = 0;
    for (var i = 0; i < base26.length; i++) {
      carry = P10[carry][Number(base26.charAt(i))];
    }
    return (10 - carry) % 10;
  }

  function qrrCheck(ref) {
    var s = compact(ref).replace(/[\s-]/g, '');
    if (!/^[0-9]{27}$/.test(s)) {
      return { valid: false, reference: s, reason: 'QRR-Referenz muss 27 Ziffern haben' };
    }
    if (/^0{27}$/.test(s)) {
      return { valid: false, reference: s, reason: 'QRR-Referenz darf nicht nur aus Nullen bestehen' };
    }
    var expected = qrrCheckDigit(s.slice(0, 26));
    if (Number(s.charAt(26)) !== expected) {
      return { valid: false, reference: s, reason: 'QRR-Prüfziffer ungültig (erwartet ' + expected + ')' };
    }
    return { valid: true, reference: s, reason: '' };
  }

  function buildQRRFromBase(base26) {
    var s = compact(base26).replace(/[\s-]/g, '');
    if (!/^[0-9]{26}$/.test(s) || /^0{26}$/.test(s)) return null;
    return s + String(qrrCheckDigit(s));
  }

  function scorCheck(ref) {
    var s = normalizeIBAN(ref);
    if (!/^RF[0-9]{2}[A-Z0-9]{1,21}$/.test(s)) {
      return { valid: false, reference: s, reason: 'SCOR-Referenz: RF + 2 Prüfziffern + 1–21 alphanumerisch' };
    }
    var rotated = s.slice(4) + s.slice(0, 4);
    var numeric = '';
    for (var i = 0; i < rotated.length; i++) {
      var c = rotated.charAt(i);
      numeric += /[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c;
    }
    var remainder = 0;
    for (var j = 0; j < numeric.length; j++) {
      remainder = (remainder * 10 + Number(numeric.charAt(j))) % 97;
    }
    if (remainder !== 1) return { valid: false, reference: s, reason: 'SCOR-Prüfziffer ungültig (mod 97)' };
    return { valid: true, reference: s, reason: '' };
  }

  function normalizeAmount(value) {
    if (value === undefined || value === null || compact(value) === '') return '';
    var s = compact(value).replace(/'/g, '').replace(/\s/g, '');
    if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) {
      // Both present: dot is the decimal separator, comma is a thousands separator.
      s = s.replace(/,/g, '');
    } else if (s.indexOf(',') >= 0) {
      var parts = s.split(',');
      if (parts.length === 2 && /^[0-9]{1,2}$/.test(parts[1])) {
        s = parts[0] + '.' + parts[1]; // comma as decimal separator (CH/DE)
      } else {
        s = s.replace(/,/g, ''); // comma as thousands separator
      }
    }
    if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(s)) return null;
    return Number(s).toFixed(2);
  }

  function limit(field, value, errors) {
    var v = sanitize(value);
    if (v.length > LIMITS[field]) {
      errors.push(field + ': maximal ' + LIMITS[field] + ' Zeichen (gekürzt)');
      v = v.slice(0, LIMITS[field]);
    }
    return v;
  }

  /**
   * Build the positional SPC payload (34 fields, empty fields retained).
   * record: {
   *   iban, amount, currency, referenceType ('QRR'|'SCOR'|'NON'), reference,
   *   creditor: {name, street, buildingNo, postalCode, town, country},
   *   debtor: {name, street, buildingNo, postalCode, town, country},
   *   message, billInformation, altScheme1, altScheme2
   * }
   */
  function buildPayload(record) {
    var errors = [];
    var warnings = [];
    var r = record || {};

    var ibanResult = ibanCheck(r.iban);
    if (!ibanResult.valid) errors.push('IBAN: ' + ibanResult.reason);

    var refType = compact(r.referenceType || 'NON').toUpperCase();
    if (['QRR', 'SCOR', 'NON'].indexOf(refType) < 0) errors.push('Referenztyp muss QRR, SCOR oder NON sein');

    var reference = compact(r.reference);
    if (refType === 'QRR') {
      var qrr = qrrCheck(reference);
      if (!qrr.valid) errors.push('Referenz: ' + qrr.reason);
      else reference = qrr.reference;
      if (ibanResult.valid && !isQRIBAN(ibanResult.iban)) {
        errors.push('QRR verlangt eine QR-IBAN (IID 30000–31999)');
      }
      // SIX IG v2.4, 2.10/4.3.2: QR-IBAN and QRR are CHF-only.
      if (compact(r.currency || 'CHF').toUpperCase() === 'EUR') {
        errors.push('QRR ist nur mit CHF erlaubt');
      }
    } else if (refType === 'SCOR') {
      var scor = scorCheck(reference);
      if (!scor.valid) errors.push('Referenz: ' + scor.reason);
      else reference = scor.reference;
      if (ibanResult.valid && isQRIBAN(ibanResult.iban)) {
        errors.push('SCOR ist mit QR-IBAN nicht erlaubt');
      }
    } else {
      if (reference !== '') errors.push('Bei NON muss die Referenz leer sein');
      if (ibanResult.valid && isQRIBAN(ibanResult.iban)) {
        errors.push('QR-IBAN verlangt zwingend QRR');
      }
      reference = '';
    }

    var amount = normalizeAmount(r.amount);
    if (amount === null) errors.push('Betrag muss eine positive Zahl mit maximal 2 Dezimalstellen sein');
    if (amount !== '' && Number(amount) > 999999999.99) errors.push('Betrag über dem Maximum');

    var currency = compact(r.currency || 'CHF').toUpperCase();
    if (['CHF', 'EUR'].indexOf(currency) < 0) errors.push('Währung muss CHF oder EUR sein');

    var creditor = r.creditor || {};
    var creditorName = limit('name', creditor.name, errors);
    if (creditorName === '') errors.push('Gläubiger-Name fehlt');
    var creditorCountry = limit('country', creditor.country || 'CH', errors).toUpperCase();
    if (creditorCountry.length !== 2) errors.push('Gläubiger-Land muss 2 Buchstaben haben');
    var creditorStreet = limit('street', creditor.street, errors);
    var creditorBuilding = limit('buildingNo', creditor.buildingNo, errors);
    var creditorPostal = limit('postalCode', creditor.postalCode, errors);
    var creditorTown = limit('town', creditor.town, errors);
    if (creditorPostal === '' || creditorTown === '') {
      errors.push('Strukturierte Adresse (Typ S) verlangt PLZ und Ort – K-Adressen sind seit v2.3 nicht mehr erlaubt');
    }

    var debtor = r.debtor || {};
    var debtorName = limit('name', debtor.name, errors);
    var debtorStreet = limit('street', debtor.street, errors);
    var debtorBuilding = limit('buildingNo', debtor.buildingNo, errors);
    var debtorPostal = limit('postalCode', debtor.postalCode, errors);
    var debtorTown = limit('town', debtor.town, errors);
    var debtorCountry = limit('country', debtor.country, errors).toUpperCase();
    var debtorType = '';
    if (debtorCountry && !debtorName && !debtorStreet && !debtorBuilding && !debtorPostal && !debtorTown) {
      debtorCountry = ''; // No phantom address group when only a default country is supplied.
    }
    if (debtorName || debtorStreet || debtorBuilding || debtorPostal || debtorTown || debtorCountry) {
      debtorType = 'S';
      if (debtorCountry.length !== 2) errors.push('Debitor-Land muss 2 Buchstaben haben');
      if (debtorName === '' || debtorPostal === '' || debtorTown === '') {
        errors.push('Debitor-Adresse (Typ S) verlangt Name, PLZ und Ort');
      }
    }

    var message = limit('message', r.message, errors);
    var billInfo = limit('billInformation', r.billInformation, errors);
    // SIX IG v2.4, 4.3.3: unstructured message + billing info together max. 140.
    if (message.length + billInfo.length > 140) {
      errors.push('Nachricht + Billing information: maximal 140 Zeichen zusammen');
      billInfo = billInfo.slice(0, Math.max(0, 140 - message.length));
    }
    var alt1 = limit('altScheme', r.altScheme1, errors);
    var alt2 = limit('altScheme', r.altScheme2, errors);

    var fields = [
      'SPC',                       // 01 QRType
      '0200',                      // 02 Version
      '1',                         // 03 Coding type UTF-8
      ibanResult.iban,             // 04 IBAN
      'S',                         // 05 Creditor address type (structured only)
      creditorName,                // 06
      creditorStreet,              // 07
      creditorBuilding,            // 08
      creditorPostal,              // 09
      creditorTown,                // 10
      creditorCountry,             // 11
      '', '', '', '', '', '', '',  // 12–18 Ultimate creditor (reserved)
      amount,                      // 19
      currency,                    // 20
      debtorType,                  // 21 Debtor address type
      debtorName,                  // 22
      debtorStreet,                // 23
      debtorBuilding,              // 24
      debtorPostal,                // 25
      debtorTown,                  // 26
      debtorCountry,               // 27
      refType,                     // 28
      reference,                   // 29
      message,                     // 30
      'EPD'                        // 31 Trailer
    ];

    if (billInfo !== '') fields.push(billInfo);       // 32
    if (alt1 !== '') fields.push(alt1);               // 33
    if (alt2 !== '') fields.push(alt2);               // 34

    var originalMessage = compact(r.message);
    if (sanitize(originalMessage) !== originalMessage) {
      warnings.push('Nachricht enthielt nicht erlaubte Zeichen und wurde bereinigt');
    }
    if (amount === '') warnings.push('Offener Betrag: QR-Bill ohne festen Betrag');

    var payload = fields.join('\n');
    // SIX IG v2.4, 6.2: 997 characters including separators.
    if (payload.length > 997) errors.push('Payload zu lang: maximal 997 Zeichen');

    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      fields: fields,
      payload: payload
    };
  }

  // The vendored QR generator defaults to charCodeAt() & 0xff (Latin-1-ish).
  // SIX IG v2.4, 4.1.1 requires UTF-8 bytes for coding type "1".
  function configureQRCode(qrcodeLib) {
    if (!qrcodeLib || !qrcodeLib.stringToBytesFuncs || !qrcodeLib.stringToBytesFuncs['UTF-8']) return false;
    qrcodeLib.stringToBytes = qrcodeLib.stringToBytesFuncs['UTF-8'];
    return true;
  }

  // --- CSV import -----------------------------------------------------------

  var HEADERS = {
    iban: ['iban', 'qriban', 'qr-iban', 'empfängeriban', 'konto'],
    amount: ['betrag', 'amount', 'total', 'summe'],
    currency: ['währung', 'waehrung', 'currency', 'curr'],
    referenceType: ['referenztyp', 'refType', 'referencetype'],
    reference: ['referenz', 'reference', 'ref', 'qrr', 'rechnungsnr', 'invoice'],
    message: ['nachricht', 'message', 'verwendungszweck', 'text'],
    debtorName: ['debitor', 'kunde', 'kundename', 'customername', 'name'],
    debtorStreet: ['kundenstrasse', 'debitorstrasse', 'customerstreet'],
    debtorBuildingNo: ['kundenhausnr', 'hausnummer', 'buildingno'],
    debtorPostalCode: ['kundenplz', 'plz', 'postalcode'],
    debtorTown: ['kundenort', 'ort', 'town', 'city'],
    debtorCountry: ['kundenland', 'land', 'country']
  };

  function parseCSV(text) {
    var input = String(text || '').replace(/^\uFEFF/, '');
    if (!input.trim()) return [];
    var delimiter = ';';
    var firstLine = input.split(/\r?\n/)[0];
    var counts = [',', ';', '\t'].map(function (d) {
      return { d: d, n: firstLine.split(d).length - 1 };
    });
    counts.sort(function (a, b) { return b.n - a.n; });
    delimiter = counts[0].n > 0 ? counts[0].d : ',';

    var rows = [];
    var row = [];
    var field = '';
    var quoted = false;
    for (var i = 0; i < input.length; i++) {
      var c = input.charAt(i);
      if (quoted) {
        if (c === '"') {
          if (input.charAt(i + 1) === '"') { field += '"'; i++; }
          else quoted = false;
        } else field += c;
      } else if (c === '"') {
        quoted = true;
      } else if (c === delimiter) {
        row.push(field); field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && input.charAt(i + 1) === '\n') i++;
        row.push(field); field = '';
        if (row.some(function (v) { return v.trim() !== ''; })) rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
    row.push(field);
    if (row.some(function (v) { return v.trim() !== ''; })) rows.push(row);
    if (rows.length < 2) return [];

    var header = rows[0].map(function (h) { return compact(h).toLowerCase(); });
    return rows.slice(1).map(function (cells) {
      var obj = {};
      header.forEach(function (h, index) {
        var value = cells[index] === undefined ? '' : compact(cells[index]);
        if (!h) return;
        var mapped = null;
        Object.keys(HEADERS).forEach(function (key) {
          if (HEADERS[key].indexOf(h) >= 0) mapped = key;
        });
        obj[mapped || h] = value;
      });
      return obj;
    });
  }

  return {
    ALLOWED_CHARACTERS: ALLOWED.source,
    LIMITS: LIMITS,
    compact: compact,
    sanitize: sanitize,
    normalizeIBAN: normalizeIBAN,
    ibanCheck: ibanCheck,
    isQRIBAN: isQRIBAN,
    qrrCheck: qrrCheck,
    qrrCheckDigit: qrrCheckDigit,
    buildQRRFromBase: buildQRRFromBase,
    scorCheck: scorCheck,
    normalizeAmount: normalizeAmount,
    buildPayload: buildPayload,
    configureQRCode: configureQRCode,
    parseCSV: parseCSV
  };
});
