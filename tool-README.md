# QRWerk – MVP v0.1

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

## Tests

```
node tests/run.js
```

20 Prüfungen: IBAN, QR-IBAN, QRR-Annex-B-Vektor, SCOR, Beträge, Payload-Reihenfolge,
K-Adress-Ablehnung, QR-IBAN-/QRR-Kombinationen (inkl. CHF-only), CSV-Parsing,
Zeichensatz nach SIX 4.1.1, kombinierte 140-Zeichen-Grenze, UTF-8-QR-Kodierung.

## Bekannte Grenzen (MVP)

- Das Drucklayout ist funktional, aber **nicht** vollständig SIX-konform: echte Perforation,
  Registriermarks, die vorgeschriebenen Arial/Frutiger/Helvetica/Liberation-Sans-Schriftgrade,
  Annahmestelle und mehrsprachige Annex-C-Labels fehlen; die Ruhezone beträgt 4 Module
  (Minimum nach 6.4.1), nicht die empfohlenen 5 mm; der Code wird als SVG auf 46 mm inkl.
  Ruhezone skaliert, die Modulfläche ist daher kleiner als 46 mm.
- Keine XLSX-Unterstützung (nur CSV; XLSX ist für Pro geplant).
- Keine Vorlagen, kein Speichern von Kundendaten, kein Login.
- Keine Rechts-/Steuerberatung; keine Garantie für Bankannahme.
- Die SIX IG v2.4-PDF wurde geprüft (siehe `SIX_v2.4_pruefung.md`); offen bleiben
  primär Layout-Fragen und die Prüfung gegen echte Bank-Scanner.

## Lizenz und Herkunft

- Eigener Code: PROJECT 10 MILLION.
- `qrcode.js`: Kazuhiko Arase, MIT-Lizenz, siehe `vendor/LICENSE-qrcode-generator.txt`.
- Keine weiteren Drittanbieter-Abhängigkeiten.

## Status

Prototyp, **nicht veröffentlicht**. Keine echten Nutzer, kein Umsatz, keine Validierung.
