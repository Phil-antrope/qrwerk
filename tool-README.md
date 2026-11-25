# QRWerk v0.3.0 – lokale Schweizer QR-Rechnungen (Pro-Funktionen enthalten)

Lokaler, kostenloser Generator für Schweizer QR-Rechnungen (Swiss Payments Code `SPC`, Version `0200`).

## Start

Keine Installation, kein Server, kein Build:

```
open index.html
```

Oder im lokalen Browser `index.html` öffnen. Das Tool liegt vollständig in dieser Datei plus den lokalen `src/`- und `vendor/`-Dateien. Alles läuft clientseitig; es werden keine Daten gesendet.

## Funktionen

- CSV-Import mit Trennzeichen-Erkennung (`;`, `,`, Tab), BOM und zitierten Feldern
- IBAN-/QR-IBAN-Prüfung (mod 97, IID 30000–31999)
- QRR-Prüfziffer (rekursiv modulo 10, Annex-B-Testvektor) und SCOR-Prüfung (ISO 11649)
- Länderprüfung gegen lokal vendored ISO-3166-1-alpha-2-Liste (249 Codes, keine API)
- Erzeugung der 31-Feld-SPC-Payload mit strukturierten Adressen (Typ S); Zeilen 32–34
  (Billing information / alternative procedures) sind bewusst deaktiviert
- Betrag 0.00 nur gemäss §4.4 mit der exakten Nachricht `DO NOT USE FOR PAYMENT`
- QR-Code mit Schweizer Kreuz, lokal gerendert (MIT-Bibliothek, vendored):
  46 × 46 mm Modulfläche, Ruhezone mindestens 5 mm bzw. 4 Module
- Drucklayout: Empfangsschein links (62 mm), Zahlteil rechts (148 mm), 5 mm
  Sektionsabstände, offene Betragsfelder, Titel und Labels DE/FR/IT/EN/RM,
  erlaubte Schriften 6–11 pt; Drucken als PDF über den Browser
- Harte Fairness-Grenze: 5 QR-Bills pro Vorgang im kostenlosen Modus
- Kein Tracking, keine Cookies, keine externen Ressourcen

## Pro-Funktionen (lokaler Schalter in `index.html`)

Diese Funktionen sind im selben lokalen Tool enthalten und werden über einen lokalen Schalter
aktiviert. Es gibt im Tool kein Konto, keine Abrechnung und keinen Lizenzserver. Preis,
Zahlungsbeleg und Veröffentlichung liegen ausschliesslich beim Owner; dieses Paket enthält
weder Vertriebs- noch Zahlungslogik.

- **Demo/Pro-Modus:** Checkbox im Oberbereich oder `index.html?pro=1` erlaubt unbegrenzte Stapel.
  Standard bleibt das Gratislimit von 5 QR-Bills pro Vorgang. Der Schalter ist rein lokal; kein Login, kein Kauf, keine Zahlung.
- **Validierungsbericht:** CSV oder JSON wird über einen clientseitigen Blob direkt heruntergeladen.
  Kein Upload, keine Daten an Dritte. CSV-Werte werden gegen Tabellen-Formeln abgesichert.
- **Vorlagen:** Rechnungsadresse und Referenzmuster werden in `localStorage` nur auf diesem Gerät gespeichert/geladen.
  Ein aktives Referenzmuster wird nur für CSV-Zeilen ohne eigene Referenz verwendet. Keine Cloud-Synchronisierung.
- **Drucklabels:** DE/FR/IT/EN sowie Rumantsch (als Auswahl, `[P]` Wortlaut nicht gegen Annex C
  verifiziert) für Empfangsschein, Zahlteil, Annahmestelle, Betrag, Währung, Referenz, Konto /
  Zahlbar an und Zahlbar durch. `[P]` Die genaue Annex-C-Platzierung und Typografie wurden nicht
  gegen die bildbasierten Anhänge der SIX IG v2.4 verifiziert; das Layout bleibt ausdrücklich
  **nicht SIX-konform**.

## Tests

```
node tests/run.js
```

42 Prüfungen: IBAN, QR-IBAN, QRR-Annex-B-Vektor, SCOR, Beträge, Payload-Reihenfolge,
K-Adress-Ablehnung, QR-IBAN-/QRR-Kombinationen (inkl. CHF-only), CSV-Parsing,
Zeichensatz nach SIX 4.1.1, 140-Zeichen-Grenze, UTF-8-QR-Kodierung, ISO-3166-1-Liste,
§4.4-0.00-Konvention, deaktivierte Zeilen 32–34, QR-Masse/Ruhezone, Slip-Markup
inklusive Feldzuordnung Referenz/Nachricht, Schriftregeln, Gratis-/Demo-Modus,
CSV-/JSON-Bericht, lokale Vorlagen und mehrsprachige Drucklabels.

## Bekannte Grenzen (MVP)

- Das Drucklayout ist funktional, aber **nicht** vollständig SIX-konform. Browser-PDF kann keine
  echte Perforation erzeugen; es gibt nur eine gestrichelte Trennlinie und Schnittmarken.
  Frutiger ist nicht lizenzfrei und wird nicht mitgeliefert; verwendet werden Arial /
  Helvetica / Liberation Sans in 6–11 pt ohne Kursiv/Unterstreichung. `[P]` Die exakten
  Annex-C-Wortlaute/Platzierungen, die offizielle Kreuz-Grafik und das Druck-Scaling wurden
  nicht gegen die bildbasierten SIX-Anhänge bzw. einen physischen Druck verifiziert.
- QR-Masse: Die Modulfläche ist im SVG exakt 46 mm; die Ruhezone wird als CSS-Padding auf
  `max(5 mm, 4 Module)` gesetzt (bei kleinen QR-Versionen > 5 mm). `[P]` Browser-/Drucker-Scaling,
  Rasterung und Scanbarkeit mit Banking-Apps sind nicht getestet; die 46 mm sind CSS-mm,
  keine garantierte Papierposition nach dem Drucken.
- Billing information und alternative procedures sind deaktiviert: Sie verlangen eine mit SIX
  abgestimmte Syntax und den Freigabeprozess nach Annex D. Angegebene Werte führen zu einem
  Validierungsfehler statt zu erfundenen Feldern 32–34.
- Der Fall `0.00` ist nur mit exakt `DO NOT USE FOR PAYMENT` erlaubt. `[P]` Die genaue
  Platzierung/Hervorhebung gemäss Figur 12 wurde nicht bildhaft verifiziert.
- Sehr lange Adressen können die 105-mm-Sektion überschreiten; das Layout kürzt nicht automatisch.
- Keine XLSX-Unterstützung (nur CSV; auch in der Pro-Version kein XLSX-Import).
- Vorlagen liegen nur im lokalen `localStorage`; keine Synchronisierung, kein Login, kein Upload.
- Keine Rechts-/Steuerberatung; keine Garantie für Bankannahme.
- Die SIX IG v2.4-PDF wurde geprüft (siehe `SIX_v2.4_pruefung.md`); offen bleiben
  primär Layout-Fragen und die Prüfung gegen echte Bank-Scanner.

## Lizenz und Herkunft

- Eigener Code: PROJECT 10 MILLION (`core.js`, `countries.js`, `features.js`,
  `print.js`, `app.js`, `style.css`, `index.html`).
- `countries.js` enthält eine offline kopierte Liste der 249 offiziell zugewiesenen
  ISO-3166-1-alpha-2-Codes; keine API, kein Abruf zur Laufzeit.
- `qrcode.js`: Kazuhiko Arase, MIT-Lizenz, siehe `vendor/LICENSE-qrcode-generator.txt`.
- Keine weiteren Drittanbieter-Abhängigkeiten.

## Status

v0.3.0 ist lokal implementiert und mit 42/42 Prüfungen getestet; die auf vereinfachtem
Layout basierende Version ist unter https://phil-antrope.github.io/qrwerk/ live. Diese
Arbeitskopie enthält **keine Nutzerdaten und keine Zahlungsabwicklung**; es gibt keinen
Umsatz, keinen Zahlungsbeleg und keine Marktvalidierung. Bekannte Grenzen siehe oben.
