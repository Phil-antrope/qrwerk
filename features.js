/*
 * QRWerk features – local-only helpers for the prepared Pro functions.
 * Runs in browser and Node. No network calls, no accounts, no dependencies.
 *
 * Payload validation stays in src/core.js (SIX IG QR-bill v2.4). Print labels
 * use the terminology of Annex C as far as text sources allow; exact wording,
 * placement, typography and the figure-based annex details are [P] and are not
 * claimed to be SIX-conform. This module never sends or receives data.
 */
(function (root, factory) {
  var core = (typeof module === 'object' && module.exports)
    ? require('./core.js')
    : root.QRWerkCore;
  var api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QRWerkFeatures = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';

  var FREE_LIMIT = 5;
  var TEMPLATE_KEY = 'qrwerk.templates.v1';
  var MAX_PATTERNS = 20;
  var CREDITOR_KEYS = ['name', 'street', 'buildingNo', 'postalCode', 'town', 'country', 'iban'];
  var REPORT_FIELDS = ['Zeile', 'Empfänger', 'Betrag', 'Status', 'Fehler', 'Warnungen'];

  // --- Demo/Pro-Modus (local switch only) -----------------------------------

  function isProParam(search) {
    return /(?:^|[?&])pro=1(?:&|$)/.test(String(search || ''));
  }

  function effectiveLimit(proMode) {
    return proMode ? Infinity : FREE_LIMIT;
  }

  function takeValid(items, proMode) {
    var list = items || [];
    return proMode ? list.slice() : list.slice(0, FREE_LIMIT);
  }

  function limitNote(total, proMode) {
    var used = Math.min(Number(total) || 0, effectiveLimit(proMode));
    if (proMode) {
      return used + ' von ' + total + ' gültigen Zeilen erzeugt. ' +
        'Demo/Pro-Modus (nur lokal): kein Stapellimit, kein Login, keine Zahlung.';
    }
    return used + ' von ' + total + ' gültigen Zeilen erzeugt. ' +
      (Number(total) > FREE_LIMIT
        ? 'Kostenloses Limit: ' + FREE_LIMIT + ' QR-Bills pro Vorgang.'
        : 'Gratislimit: ' + FREE_LIMIT + ' QR-Bills pro Vorgang.');
  }

  // --- Validation report (client-side download) -----------------------------

  function reportRows(items) {
    return (items || []).map(function (item, index) {
      var row = (item && item.row) || {};
      var check = (item && item.check) || {};
      return {
        Zeile: index + 1,
        Empfänger: core.compact(row.debtorName) || core.compact(row.message) || '',
        Betrag: core.compact(row.amount),
        Status: check.ok ? 'OK' : 'FEHLER',
        Fehler: (check.errors || []).join(' | '),
        Warnungen: (check.warnings || []).join(' | ')
      };
    });
  }

  function csvCell(value, delimiter) {
    var s = value === undefined || value === null ? '' : String(value);
    // A locally saved report may later be opened in a spreadsheet: neutralise
    // leading formula characters without changing validation semantics.
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    if (s.indexOf('"') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0 ||
        (delimiter && s.indexOf(delimiter) >= 0)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function reportToCSV(items, delimiter) {
    var d = delimiter || ';';
    var header = REPORT_FIELDS.map(function (name) { return csvCell(name, d); }).join(d);
    var body = reportRows(items).map(function (entry) {
      return REPORT_FIELDS.map(function (name) { return csvCell(entry[name], d); }).join(d);
    });
    return [header].concat(body).join('\r\n') + '\r\n';
  }

  function reportToJSON(items) {
    return JSON.stringify(reportRows(items), null, 2) + '\n';
  }

  // --- Local templates (localStorage only) ----------------------------------

  function emptyTemplates() {
    return {
      version: 1,
      creditor: {
        name: '', street: '', buildingNo: '', postalCode: '', town: '', country: 'CH', iban: ''
      },
      referencePatterns: []
    };
  }

  function normalizeTemplates(raw) {
    var out = emptyTemplates();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    var source = raw.creditor && typeof raw.creditor === 'object' ? raw.creditor : {};
    CREDITOR_KEYS.forEach(function (key) {
      var cap = key === 'iban' ? 32 : (core.LIMITS[key] || 70);
      var value = core.compact(source[key]).slice(0, cap);
      if (key === 'country') value = value.toUpperCase().slice(0, 2);
      out.creditor[key] = value;
    });
    if (!out.creditor.country) out.creditor.country = 'CH';

    var patterns = Array.isArray(raw.referencePatterns) ? raw.referencePatterns : [];
    var seen = {};
    for (var i = 0; i < patterns.length && out.referencePatterns.length < MAX_PATTERNS; i++) {
      var value = core.compact(patterns[i]).slice(0, 100);
      var key = value.toUpperCase();
      if (!value || seen[key]) continue;
      seen[key] = true;
      out.referencePatterns.push(value);
    }
    return out;
  }

  function serializeTemplates(data) {
    return JSON.stringify(normalizeTemplates(data));
  }

  function parseTemplates(text) {
    if (core.compact(text) === '') return null;
    try {
      var parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return normalizeTemplates(parsed);
    } catch (e) {
      return null;
    }
  }

  function addReferencePattern(data, pattern) {
    var out = normalizeTemplates(data);
    var value = core.compact(pattern).slice(0, 100);
    if (!value) return out;
    var key = value.toUpperCase();
    out.referencePatterns = out.referencePatterns.filter(function (p) {
      return p.toUpperCase() !== key;
    });
    out.referencePatterns.unshift(value);
    if (out.referencePatterns.length > MAX_PATTERNS) out.referencePatterns.length = MAX_PATTERNS;
    return out;
  }

  function resolveReference(rowReference, activePattern) {
    var direct = core.compact(rowReference);
    return direct !== '' ? direct : core.compact(activePattern);
  }

  // --- Multilingual print labels --------------------------------------------

  // Terms follow the multilingual glossary of SIX IG v2.4 (DE/FR/IT/EN).
  // [P] Romansh terms are supplied as an unverified approximation; the exact
  // Annex C wording was not checked against the figure-based original.
  // Placement and typography remain a simplified MVP layout (see src/print.js).
  var LABELS = {
    de: {
      receipt: 'Empfangsschein', paymentPart: 'Zahlteil', acceptancePoint: 'Annahmestelle',
      amount: 'Betrag', currency: 'Währung', reference: 'Referenz',
      account: 'Konto / Zahlbar an', payableBy: 'Zahlbar durch', payableTo: 'Zahlbar an',
      additionalInformation: 'Zusätzliche Informationen', message: 'Nachricht'
    },
    fr: {
      receipt: 'Récépissé', paymentPart: 'Partie paiement', acceptancePoint: 'Point d’acceptation',
      amount: 'Montant', currency: 'Devise', reference: 'Référence',
      account: 'Compte / Payable à', payableBy: 'Payable par', payableTo: 'Payable à',
      additionalInformation: 'Informations supplémentaires', message: 'Message'
    },
    it: {
      receipt: 'Ricevuta', paymentPart: 'Parte di pagamento', acceptancePoint: 'Punto di accettazione',
      amount: 'Importo', currency: 'Valuta', reference: 'Riferimento',
      account: 'Conto / Pagabile a', payableBy: 'Pagabile da', payableTo: 'Pagabile a',
      additionalInformation: 'Informazioni supplementari', message: 'Messaggio'
    },
    en: {
      receipt: 'Receipt', paymentPart: 'Payment part', acceptancePoint: 'Acceptance point',
      amount: 'Amount', currency: 'Currency', reference: 'Reference',
      account: 'Account / Payable to', payableBy: 'Payable by', payableTo: 'Payable to',
      additionalInformation: 'Additional information', message: 'Message'
    },
    // [P] Unverified Romansh wording – do not rely on it without checking Annex C.
    rm: {
      receipt: 'Quittanza', paymentPart: 'Partida da pajament', acceptancePoint: 'Post da accettaziun',
      amount: 'Import', currency: 'Valuta', reference: 'Referenza',
      account: 'Conto / Pajabel a', payableBy: 'Pajabel da', payableTo: 'Pajabel a',
      additionalInformation: 'Infurzias supplementaras', message: 'Messagi'
    }
  };

  function labels(lang) {
    var key = String(lang || 'de').toLowerCase().slice(0, 2);
    return LABELS[key] || LABELS.de;
  }

  return {
    PRINT_LANGUAGES: Object.keys(LABELS),
    FREE_LIMIT: FREE_LIMIT,
    TEMPLATE_KEY: TEMPLATE_KEY,
    MAX_PATTERNS: MAX_PATTERNS,
    isProParam: isProParam,
    effectiveLimit: effectiveLimit,
    takeValid: takeValid,
    limitNote: limitNote,
    reportRows: reportRows,
    reportToCSV: reportToCSV,
    reportToJSON: reportToJSON,
    emptyTemplates: emptyTemplates,
    normalizeTemplates: normalizeTemplates,
    serializeTemplates: serializeTemplates,
    parseTemplates: parseTemplates,
    addReferencePattern: addReferencePattern,
    resolveReference: resolveReference,
    labels: labels
  };
});
