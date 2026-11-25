/*
 * QRWerk countries – vendored ISO 3166-1 alpha-2 code list.
 * Pure data + lookup, no network, no dependency. Runs in browser and Node.
 *
 * The 249 officially assigned alpha-2 codes are stored as one compact string.
 * Source: ISO 3166-1 alpha-2 (officially assigned codes); copied offline into
 * this file. No external API, no runtime lookup, no licence-restricted code.
 * Exceptionally reserved / user-assigned codes (EU, EZ, UN, XK, ZZ, ...) are
 * deliberately NOT part of this list.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QRWerkCountries = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var COUNTRY_CODES = [
    'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ',
    'BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ',
    'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ',
    'DE DJ DK DM DO DZ',
    'EC EE EG EH ER ES ET',
    'FI FJ FK FM FO FR',
    'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY',
    'HK HM HN HR HT HU',
    'ID IE IL IM IN IO IQ IR IS IT',
    'JE JM JO JP',
    'KE KG KH KI KM KN KP KR KW KY KZ',
    'LA LB LC LI LK LR LS LT LU LV LY',
    'MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ',
    'NA NC NE NF NG NI NL NO NP NR NU NZ',
    'OM',
    'PA PE PF PG PH PK PL PM PN PR PS PT PW PY',
    'QA',
    'RE RO RS RU RW',
    'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ',
    'TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ',
    'UA UG UM US UY UZ',
    'VA VC VE VG VI VN VU',
    'WF WS',
    'YE YT',
    'ZA ZM ZW'
  ].join(' ');

  var index = {};
  COUNTRY_CODES.split(' ').forEach(function (code) { index[code] = true; });

  function normalizeCountry(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim().toUpperCase();
  }

  function isValidCountry(value) {
    var code = normalizeCountry(value);
    return code.length === 2 && index[code] === true;
  }

  return {
    COUNTRY_CODES: COUNTRY_CODES,
    COUNTRY_COUNT: Object.keys(index).length,
    normalizeCountry: normalizeCountry,
    isValidCountry: isValidCountry
  };
});
