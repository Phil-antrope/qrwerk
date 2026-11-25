# QRWerk – MVP (Pro-Funktionen vorbereitet)

Lokaler, kostenloser Generator für Schweizer QR-Rechnungen (Swiss Payments Code `SPC`, Version `0200`).

## Start

Keine Installation, kein Server, kein Build:

```
open index.html
```

Oder im lokalen Browser `index.html` öffnen. Alles läuft clientseitig; es werden keine Daten gesendet.

## Funktionen

- CSV-Import mit Trennzeichen-Erkennung (`;`, `,`, Tab), BOM und zitierten Feldern
- IBAN-/QR-IBAN-Prüfung (mod 97, IID 30000–31999)
- QRR-Prüfziffer (rekursiv modulo 10, Annex-B-Testvektor) und SCOR-Prüfung (ISO 11649)
- Erzeugung der 31-Feld-SPC-Payload (optional 32–34) mit strukturierten Adressen (Typ S)
- QR-Code mit Schweizer Kreuz, lokal gerendert (MIT-Bibliothek, vendored)
- Drucklayout als Zahlteil + Empfangsschein; Drucken als PDF über den Browser
- Harte Fairness-Grenze: 5 QR-Bills pro Vorgang im kostenlosen Modus
- Kein Tracking, keine Cookies, keine externen Ressourcen

## Pro-Funktionen (vorbereitet, nicht verkauft)

Diese Funktionen sind im lokalen MVP enthalten, aber **nicht verkauft, nicht veröffentlicht und nicht abgerechnet**:
es gibt keinen Preis, keinen Zahlungsbeleg, kein Konto und keinen Lizenzserver.

- **Demo/Pro-Modus:** Checkbox im Oberbereich oder `index.html?pro=1` erlaubt unbegrenzte Stapel.
  Standard bleibt das Gratislimit von 5 QR-Bills pro Vorgang. Der Schalter ist rein lokal; kein Login, kein Kauf, keine Zahlung.
- **Validierungsbericht:** CSV oder JSON wird über einen clientseitigen Blob direkt heruntergeladen.
  Kein Upload, keine Daten an Dritte. CSV-Werte werden gegen Tabellen-Formeln abgesichert.
- **Vorlagen:** Rechnungsadresse und Referenzmuster werden in `localStorage` nur auf diesem Gerät gespeichert/geladen.
  Ein aktives Referenzmuster wird nur für CSV-Zeilen ohne eigene Referenz verwendet. Keine Cloud-Synchronisierung.
- **Drucklabels:** DE/FR/IT für Empfangsschein, Zahlteil, Annahmestelle, Betrag, Währung, Referenz,
  Konto/IBAN und Zahlbar durch. `[P]` Die genaue Annex-C-Platzierung und Typografie wurden nicht gegen
  die bildbasierten Anhänge der SIX IG v2.4 verifiziert; das Layout bleibt ausdrücklich **nicht SIX-konform**.

## Tests

```
node tests/run.js
```

27 Prüfungen: IBAN, QR-IBAN, QRR-Annex-B-Vektor, SCOR, Beträge, Payload-Reihenfolge,
K-Adress-Ablehnung, QR-IBAN-/QRR-Kombinationen (inkl. CHF-only), CSV-Parsing,
Zeichensatz nach SIX 4.1.1, kombinierte 140-Zeichen-Grenze, UTF-8-QR-Kodierung,
Gratis-/Demo-Modus, CSV-/JSON-Bericht, lokale Vorlagen und dreisprachige Drucklabels.

## Bekannte Grenzen (MVP)

- Das Drucklayout ist funktional, aber **nicht** vollständig SIX-konform: echte Perforation,
  Registriermarks und die vorgeschriebenen Arial/Frutiger/Helvetica/Liberation-Sans-Schriftgrade
  fehlen; Labels sind jetzt DE/FR/IT, aber vereinfacht und mit leerer Annahmestellen-Zeile. `[P]`
  Exakte Annex-C-Wortlaute/Platzierung wurden nicht bildhaft verifiziert. Die Ruhezone beträgt
  4 Module (Minimum nach 6.4.1), nicht die empfohlenen 5 mm; der Code wird als SVG auf 46 mm inkl.
  Ruhezone skaliert, die Modulfläche ist daher kleiner als 46 mm.
- Keine XLSX-Unterstützung (nur CSV; XLSX ist für Pro geplant).
- Vorlagen liegen nur im lokalen `localStorage`; keine Synchronisierung, kein Login, kein Upload.
- Keine Rechts-/Steuerberatung; keine Garantie für Bankannahme.
- Die SIX IG v2.4-PDF wurde geprüft (siehe `SIX_v2.4_pruefung.md`); offen bleiben
  primär Layout-Fragen und die Prüfung gegen echte Bank-Scanner.

## Lizenz und Herkunft

- Eigener Code: PROJECT 10 MILLION (`core.js`, `features.js`, `app.js`).
- `qrcode.js`: Kazuhiko Arase, MIT-Lizenz, siehe `vendor/LICENSE-qrcode-generator.txt`.
- Keine weiteren Drittanbieter-Abhängigkeiten.

## Status

Prototyp, **nicht veröffentlicht**. Pro-Funktionen sind vorbereitet, nicht verkauft.
Keine echten Nutzer, kein Umsatz, kein Zahlungsbeleg, keine Marktvalidierung.
