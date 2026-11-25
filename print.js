/*
 * QRWerk print – simplified Swiss QR-bill slip markup and QR geometry.
 * Runs in browser and Node. No network, no external templates, no dependencies.
 *
 * SIX IG v2.4 references: 2.2/3.1/3.3 (210 x 105 mm, receipt left),
 * 3.4 (fonts), 3.5/3.6 (sections, 5 mm gaps, handwritten amount fields),
 * 6.4/6.4.1 (46 mm module area, 4 modules minimum / 5 mm recommended quiet
 * zone). [P] The figure-based Annex C placement, the official recognition
 * symbol and printer scaling are not verified here; this is not a claim of
 * SIX-conform printing.
 */
(function (root, factory) {
  var core = (typeof module === 'object' && module.exports)
    ? require('./core.js')
    : root.QRWerkCore;
  var features = (typeof module === 'object' && module.exports)
    ? require('./features.js')
    : root.QRWerkFeatures;
  var api = factory(core, features);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QRWerkPrint = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core, features) {
  'use strict';

  var LAYOUT = {
    totalWidthMm: 210,
    receiptWidthMm: 62,
    paymentWidthMm: 148,
    heightMm: 105,
    sectionGapMm: 5,
    moduleAreaMm: 46,
    quietMinModules: 4,
    quietRecommendedMm: 5,
    crossOuterMm: 7,
    crossInnerMm: 6,
    fontFamilies: ['Arial', 'Helvetica', 'Liberation Sans'],
    fontMinPt: 6,
    fontMaxPt: 11,
    fontPt: {
      paymentHeading: 8,
      paymentValue: 10,
      paymentTitle: 11,
      receiptHeading: 6,
      receiptValue: 8,
      receiptTitle: 11,
      alternativeProcedure: 7
    }
  };

  function qrGeometry(moduleCount) {
    var n = Number(moduleCount);
    if (!isFinite(n) || n < 21 || n > 177 || (n - 17) % 4 !== 0) return null;
    var moduleSizeMm = LAYOUT.moduleAreaMm / n;
    var minQuietMm = LAYOUT.quietMinModules * moduleSizeMm;
    // Round up: never claim less than 4 modules or 5 mm of quiet zone.
    var quietMm = Math.ceil(Math.max(LAYOUT.quietRecommendedMm, minQuietMm) * 100) / 100;
    return {
      moduleCount: n,
      moduleAreaMm: LAYOUT.moduleAreaMm,
      moduleSizeMm: moduleSizeMm,
      quietModules: LAYOUT.quietMinModules,
      quietRecommendedMm: LAYOUT.quietRecommendedMm,
      quietMm: quietMm,
      totalMm: LAYOUT.moduleAreaMm + 2 * quietMm
    };
  }

  function qrSvg(payload, qrFactory) {
    if (typeof qrFactory !== 'function') throw new Error('qrFactory fehlt');
    var qr = qrFactory(0, 'M');
    qr.addData(payload);
    qr.make();
    var n = qr.getModuleCount();
    var geometry = qrGeometry(n);
    if (!geometry) throw new Error('Ungültige QR-Modulanzahl: ' + n);
    var unitsPerMm = n / LAYOUT.moduleAreaMm;
    var mid = n / 2;
    var outer = LAYOUT.crossOuterMm * unitsPerMm; // [P] nominal recognition symbol
    var inner = LAYOUT.crossInnerMm * unitsPerMm;
    var barThick = 1.2 * unitsPerMm;
    var barLong = 4.2 * unitsPerMm;
    var quiet = geometry.quietMm.toFixed(2);
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '"' +
      ' width="' + LAYOUT.moduleAreaMm + 'mm" height="' + LAYOUT.moduleAreaMm + 'mm"' +
      ' shape-rendering="crispEdges" data-module-count="' + n + '"' +
      ' data-module-area-mm="' + LAYOUT.moduleAreaMm + '" data-quiet-mm="' + quiet + '">'];
    out.push('<rect x="0" y="0" width="' + n + '" height="' + n + '" fill="#fff"/>');
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) {
          out.push('<rect x="' + c + '" y="' + r + '" width="1" height="1" fill="#000"/>');
        }
      }
    }
    // White cross on a black square with a white border (SIX general notes).
    out.push('<rect x="' + (mid - outer / 2).toFixed(3) + '" y="' + (mid - outer / 2).toFixed(3) +
      '" width="' + outer.toFixed(3) + '" height="' + outer.toFixed(3) + '" fill="#fff"/>');
    out.push('<rect x="' + (mid - inner / 2).toFixed(3) + '" y="' + (mid - inner / 2).toFixed(3) +
      '" width="' + inner.toFixed(3) + '" height="' + inner.toFixed(3) + '" fill="#000"/>');
    out.push('<rect x="' + (mid - barThick / 2).toFixed(3) + '" y="' + (mid - barLong / 2).toFixed(3) +
      '" width="' + barThick.toFixed(3) + '" height="' + barLong.toFixed(3) + '" fill="#fff"/>');
    out.push('<rect x="' + (mid - barLong / 2).toFixed(3) + '" y="' + (mid - barThick / 2).toFixed(3) +
      '" width="' + barLong.toFixed(3) + '" height="' + barThick.toFixed(3) + '" fill="#fff"/>');
    out.push('</svg>');
    return {
      svg: out.join(''),
      geometry: geometry,
      quietMm: geometry.quietMm,
      wrapperStyle: '--qr-quiet-mm:' + quiet + 'mm'
    };
  }

  function esc(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function field(label, value, className) {
    return '<dt class="section-head">' + esc(label) + '</dt>' +
      '<dd' + (className ? ' class="' + esc(className) + '"' : '') + '>' + esc(value || '–') + '</dd>';
  }

  // SIX Annex C: "Konto / Zahlbar an" is one heading with IBAN and creditor
  // address underneath. Fields array is zero-based (SPC lines are 1-based).
  function accountField(L, iban, payTo) {
    var body = esc(iban || '–') + (payTo ? '<br><span class="payable-to">' + esc(payTo) + '</span>' : '');
    return '<dt class="section-head">' + esc(L.account) + '</dt>' +
      '<dd class="value">' + body + '</dd>';
  }

  function amountFields(L, amount, currency) {
    var hasAmount = amount !== '';
    var shown = hasAmount ? amount : '';
    var currencyLabel = esc(L.currency);
    var amountLabel = esc(L.amount);
    return '<dt class="section-head">' + amountLabel + '</dt>' +
      '<dd class="value' + (hasAmount ? '' : ' blank-field') + '"' +
      (hasAmount ? '' : ' data-open-amount="true"') + '>' + esc(shown) + '</dd>' +
      '<dt class="section-head">' + currencyLabel + '</dt>' +
      '<dd class="value">' + esc(currency || '–') + '</dd>';
  }

  function slipHtml(payload, check, index, lang, qrFactory) {
    var f = (check && check.fields) || [];
    var L = features.labels(lang || 'de');
    var code = qrSvg(payload, qrFactory);
    var amount = f[18] || '';                 // SPC line 19
    var currency = f[19] || '';               // SPC line 20
    var noPayment = amount === '0.00' && core.compact(f[29]) === core.NO_PAYMENT_MESSAGE;
    var payTo = [f[5], [f[6], f[7]].filter(Boolean).join(' '), [f[8], f[9]].filter(Boolean).join(' '), f[10]]
      .filter(Boolean).join(', ');
    var payableBy = [f[21], [f[22], f[23]].filter(Boolean).join(' '), [f[24], f[25]].filter(Boolean).join(' '), f[26]]
      .filter(Boolean).join(', ');
    var refType = f[27] || 'NON';             // SPC line 28
    var reference = refType === 'NON' ? '–' : (f[28] || '–');
    var message = f[29] || '–';               // SPC line 30 (f[30] is the EPD trailer)

    var receiptInfo = accountField(L, f[3], payTo) +
      field(L.reference, reference) +
      field(L.payableBy, payableBy);
    var paymentInfo = accountField(L, f[3], payTo) +
      field(L.reference, reference) +
      field(L.payableBy, payableBy) +
      field(L.additionalInformation, message, noPayment ? 'no-payment' : '');

    return '<article class="slip" lang="' + esc(lang || 'de') + '"' +
      (noPayment ? ' data-do-not-use="true"' : '') + '>' +
      '<div class="cut-marks" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
      // Receipt is on the LEFT of the payment part (SIX IG v2.4, 2.2).
      '<div class="receipt">' +
        '<h4 class="slip-title receipt-title">' + esc(L.receipt) + '</h4>' +
        '<div class="section info-section"><dl class="fields">' + receiptInfo + '</dl></div>' +
        '<div class="section amount-section"><dl class="fields">' +
          amountFields(L, amount, currency) + '</dl></div>' +
        '<div class="section acceptance-section">' +
          '<div class="section-head">' + esc(L.acceptancePoint) + '</div>' +
          '<div class="blank-field"></div>' +
        '</div>' +
      '</div>' +
      '<div class="payment">' +
        '<h4 class="slip-title payment-title">' + esc(L.paymentPart) + '</h4>' +
        '<div class="section qr-section" style="' + esc(code.wrapperStyle) + '">' +
          '<span class="qr">' + code.svg + '</span></div>' +
        '<div class="section amount-section"><dl class="fields">' +
          amountFields(L, amount, currency) + '</dl></div>' +
        '<div class="section info-section"><dl class="fields">' + paymentInfo + '</dl></div>' +
      '</div>' +
    '</article>';
  }

  return {
    LAYOUT: LAYOUT,
    qrGeometry: qrGeometry,
    qrSvg: qrSvg,
    slipHtml: slipHtml,
    esc: esc
  };
});
