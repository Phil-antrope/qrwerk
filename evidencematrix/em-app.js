'use strict';
(function () {
  var core = window.EvidenceMatrixCore;
  var features = window.EvidenceMatrixFeatures;
  var $ = function (id) { return document.getElementById(id); };
  var lastAnalysis = null;
  var lastMeta = { title: 'Belegmatrix' };

  function setStatus(message) { $('status').textContent = message || ''; }

  function isPro() {
    return $('pro').checked || /(?:\?|&)pro=1(?:&|$)/.test(window.location.search);
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  function fillList(id, items, empty) {
    var list = $(id);
    list.textContent = '';
    if (!items.length) {
      var li = document.createElement('li');
      li.textContent = empty;
      list.appendChild(li);
      return;
    }
    items.forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
  }

  function render(analysis, locked) {
    lastAnalysis = analysis;
    var body = $('matrix').querySelector('tbody');
    body.textContent = '';
    analysis.rows.forEach(function (r) {
      var tr = document.createElement('tr');
      if (r.issues.length) tr.className = 'flag';
      [r.line, r.id, r.file, r.date || r.rawDate, r.rawStatus || r.status, r.owner,
        r.due || r.rawDue, r.notes].forEach(function (value) {
        var td = document.createElement('td');
        td.textContent = value == null ? '' : String(value);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    $('summary').textContent = analysis.summary.rows + ' Zeilen · ' + analysis.summary.ok +
      ' ok · ' + analysis.summary.gaps + ' Lücken · ' + analysis.summary.due +
      ' Reviews · ' + analysis.summary.errors + ' Eingabefehler' + (locked ? ' · ' + locked + ' Zeilen gesperrt (Gratislimit 5)' : '');
    fillList('gaps', analysis.gaps.map(function (g) {
      return 'Zeile ' + g.line + ' · ' + (g.id || 'ohne ID') + ' · ' + g.reason + ' · ' + g.detail;
    }), 'Keine Lücken gefunden.');
    fillList('due', analysis.due.map(function (d) {
      return d.due + ' · ' + (d.id || 'ohne ID') + (d.owner ? ' · ' + d.owner : '');
    }), 'Keine fälligen Reviews im Fenster.');
  }

  function analyze() {
    var parsed = core.parseCSV($('csv').value);
    if (!parsed.headers.length) {
      lastAnalysis = null;
      render(core.analyze([], { referenceDate: $('reference').value, upcomingDays: +$('window').value }), 0);
      setStatus('Keine Daten. Bitte CSV mit Kopfzeile eingeben.');
      return;
    }
    var missing = ['id', 'file'].filter(function (f) { return parsed.headers.indexOf(f) === -1; });
    if (missing.length) {
      setStatus('Kopfzeile fehlt: ' + missing.join(', ') + '. Siehe Musterdaten.');
      return;
    }
    var analysis = core.analyze(parsed.records, {
      referenceDate: $('reference').value,
      upcomingDays: +$('window').value
    });
    var limited = core.applyLimit(parsed.records, isPro(), 5);
    analysis.rows = analysis.rows.slice(0, limited.allowed.length);
    analysis.gaps = analysis.gaps.filter(function (g) { return g.line <= (limited.allowed.slice(-1)[0] || {}).line; });
    analysis.due = analysis.due.filter(function (d) { return d.line <= (limited.allowed.slice(-1)[0] || {}).line; });
    analysis.summary = {
      rows: analysis.rows.length,
      ok: analysis.rows.filter(function (r) { return r.status === 'ok'; }).length,
      gaps: analysis.gaps.length,
      due: analysis.due.length,
      errors: analysis.errors.filter(function (e) { return e.line <= (limited.allowed.slice(-1)[0] || {}).line; }).length
    };
    render(analysis, limited.locked);
    setStatus('Analysiert: ' + analysis.summary.rows + ' Zeilen angezeigt' +
      (limited.locked ? ', ' + limited.locked + ' weitere im Gratismodus gesperrt.' : '.'));
  }

  function reportHTML() {
    return features.reportHTML(lastAnalysis || core.analyze([], {}), lastMeta);
  }

  function printReport() {
    if (!lastAnalysis) { setStatus('Bitte zuerst analysieren.'); return; }
    var html = reportHTML();
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    var win = null;
    try { win = window.open(url, '_blank'); } catch (e) { win = null; }
    if (win) {
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      return;
    }
    var frame = $('report-frame');
    frame.onload = function () {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); }
      catch (e) { setStatus('Drucken wurde vom Browser blockiert. Bitte „Bericht als HTML“ nutzen.'); }
    };
    frame.srcdoc = html;
  }

  $('reference').value = new Date().toISOString().slice(0, 10);
  if (/(?:\?|&)pro=1(?:&|$)/.test(window.location.search)) $('pro').checked = true;

  $('sample').addEventListener('click', function () {
    $('csv').value = features.SAMPLE_CSV;
    setStatus('Musterdaten geladen – keine echten Belege, keine Kontodaten.');
    analyze();
  });
  $('save-template').addEventListener('click', function () {
    setStatus(features.saveTemplate(localStorage, $('csv').value)
      ? 'Vorlage lokal auf diesem Gerät gespeichert.' : 'Lokales Speichern nicht verfügbar.');
  });
  $('load-template').addEventListener('click', function () {
    var text = features.loadTemplate(localStorage);
    if (!text) { setStatus('Keine lokale Vorlage vorhanden.'); return; }
    $('csv').value = text;
    setStatus('Lokale Vorlage geladen.');
    analyze();
  });
  $('analyze').addEventListener('click', analyze);
  $('pro').addEventListener('change', function () { if ($('csv').value.trim()) analyze(); });
  $('print').addEventListener('click', printReport);
  $('dl-report').addEventListener('click', function () {
    if (!lastAnalysis) { setStatus('Bitte zuerst analysieren.'); return; }
    download('evidencematrix-bericht.html', reportHTML(), 'text/html;charset=utf-8');
  });
  $('dl-matrix').addEventListener('click', function () {
    if (!lastAnalysis) { setStatus('Bitte zuerst analysieren.'); return; }
    download('evidencematrix-matrix.csv', features.matrixCSV(lastAnalysis), 'text/csv;charset=utf-8');
  });
  $('dl-gaps').addEventListener('click', function () {
    if (!lastAnalysis) { setStatus('Bitte zuerst analysieren.'); return; }
    download('evidencematrix-luecken.csv', features.gapsCSV(lastAnalysis), 'text/csv;charset=utf-8');
  });
  $('dl-due').addEventListener('click', function () {
    if (!lastAnalysis) { setStatus('Bitte zuerst analysieren.'); return; }
    download('evidencematrix-reviews.csv', features.dueCSV(lastAnalysis), 'text/csv;charset=utf-8');
  });
}());
