# QRWerk – technische Konformitätsprüfung gegen SIX IG QR-bill v2.4

Datum: 25.11.2026 · Geprüfter Stand: MVP mit vorbereiteten Pro-Funktionen in `10M/05_Produkt/qrwerk/` · Methode: statische Code-/CSS-Prüfung, specs-seitige Verifikation und Ausführen von `node tests/run.js` (27/27 grün).

## Quellen und Vorgehen

- Primär: offizielle PDF `ig-qr-bill-v2.4-en.pdf` (Version 2.4, 24.02.2026, gültig ab 14.11.2026). Der direkte `webfetch` lieferte nur `application/pdf`; der Text wurde über einen öffentlichen Text-Mirror (`r.jina.ai`, derselbe URL) extrahiert und abschnittweise gelesen. Kapitel-/Seitenangaben unten beziehen sich auf die offizielle PDF.
- SIX-Übersichtsseite (Bestätigung von Zweck/Downloads) und Gardinova (nur als Signal, nicht als Normquelle).
- Bekannte Grenze der Prüfung: Abbildungen (Annex B Figure 21/22, QR-Kreuz, Layout-Schemata) sind im extrahierten Text nicht als Bildwerte enthalten. Aussagen dazu sind mit `[P]` markiert. Es wurde kein physischer Druck-/Scanner-Test durchgeführt.
- Die Belegspalten mit `Datei:Zeile` beziehen sich auf den Stand der Erstprüfung; durch die Pro-Vorbereitung haben sich einzelne Zeilennummern verschoben.

## Ergebnistabelle

| Anforderung (SIX IG v2.4) | Implementiert? | Beleg (Datei:Zeile) | Abweichung | Schwere |
|---|---|---|---|---|
| QRType `SPC`, Version `0200`, Coding `1`, Trailer `EPD` (§4.2.2, Zeilen 1–3/31) | Ja | `src/core.js:254-256`, `src/core.js:278` | – | – |
| Feldreihenfolge 1–31 und leere Zeilen 12–18 (Ultimate creditor, Status X) (§4.2.2, Table 8) | Ja | `src/core.js:253-279`, `src/core.js:265` | – | – |
| Alle Felder müssen geliefert werden; LF als Separator; kein Trailer nach EPD (§4.1.4) | Ja | `src/core.js:291` (`fields.join('\n')`) | – | – |
| Optionale Felder 32/33/34 werden nur bei Verwendung übermittelt (Status A, §4.1.4/4.2.2) | Ja (behoben) | `src/core.js:281-283` | Vorher wurde bei nur einem AltPmt eine leere 34. Zeile erzeugt; behoben und getestet (`tests/run.js:183-188`). `[P]` Die Nummerierung 33/34 bei fehlender Zeile 32 ist im Text nicht eindeutig formuliert. | Mittel |
| Maximale Payload-Länge 997 Zeichen inkl. Separatoren (§6.2) | Ja (behoben) | `src/core.js:292-293` | Prüfung neu ergänzt; mit den übrigen Limits rechnerisch kaum erreichbar. | Niedrig |
| Zeichensatz: U+0020–007E, U+00A0–00FF, U+0100–017F, U+0218–021B, € (§4.1.1) | Ja (behoben) | `src/core.js:34-36`, `src/core.js:47`, `tests/run.js:138-142` | Vorher wurden € und Latin-Extended-A-Zeichen still entfernt; jetzt konform, non-ASCII wird bereinigt statt abgelehnt (Warnung nur für Nachricht, `src/core.js:285-288`). | Hoch → behoben |
| UTF-8-Kodierung der QR-Bytes bei Coding `1` (§4.1.1) | Ja (behoben) | `src/core.js:304-309`, `src/core.js:398`, `app.js:5`, `tests/run.js:190-197` | Vendored `qrcode.js` nutzte `charCodeAt & 0xff` (Latin-1); `ü` wurde als 0xFC statt 0xC3 0xBC kodiert. Jetzt explizit `stringToBytesFuncs['UTF-8']`; per VM-Test verifiziert. | Kritisch → behoben |
| Längen: Name 70, Strasse 70, Hausnr. 16, PLZ 16, Ort 35, Land 2 (§4.2.2) | Ja | `src/core.js:29-32`, `src/core.js:144-150`, `src/core.js:212-219`, `src/core.js:225-230` | Kürzung erfolgt still mit Fehlermeldung; akzeptabel. | – |
| Nachricht 140 und Nachricht + Billing information zusammen 140 (§4.1.5/4.3.3) | Ja (behoben) | `src/core.js:243-249`, `tests/run.js:174-178` | Vorher wurden 140 + 140 einzeln erlaubt; jetzt kombinierte Grenze mit Kürzung und Fehler. | Hoch → behoben |
| Alternative procedures: max. 2, max. 100 Zeichen je Zeile (§4.2.2, Zeilen 33/34) | Teilweise | `src/core.js:250-251`, `src/core.js:282-283`, `src/core.js:31` | Länge geprüft; keine Prüfung der durch SIX zu vereinbarenden Syntax (§General notes/Annex D). `[P]` Freigabeprozess nicht abgebildet. | Mittel |
| Adressen nur Typ `S` seit v2.3; Gläubiger PLZ/Ort/Country zwingend (§4.2.2/4.3.1) | Ja | `src/core.js:214-222`, `src/core.js:258` | K-Adressen werden abgelehnt (`tests/run.js:98-106`). | – |
| Debitor: Typ `S` nur wenn Gruppe genutzt; dann Name/PLZ/Ort/Land (§4.2.2/4.3.1) | Ja (behoben) | `src/core.js:230-241`, `app.js:37-39`, `tests/run.js:159-172` | Vorher erzeugte der Default `CH` eine unvollständige S-Adresse; jetzt Only-Default wird verworfen, unvollständige Gruppen werden abgelehnt. | Hoch → behoben |
| Country code ISO 3166-1, 2 Stellen (§4.2.2) | Teilweise | `src/core.js:215`, `src/core.js:237` | Nur Längenprüfung; `ZZ` wird akzeptiert. Keine Länderliste vendored. | Mittel |
| IBAN CH/LI, 21 Stellen, mod 97 (§4.2.2) | Ja | `src/core.js:51-72`, `tests/run.js:31-37` | – | – |
| QR-IBAN IID 30000–31999; nur mit QRR (§2.8/2.10/4.3.2) | Ja | `src/core.js:74-79`, `src/core.js:182-184`, `src/core.js:196-201`, `tests/run.js:40-45,108-126` | – | – |
| QR-IBAN/QRR nur für CHF (v2.4-Änderung, §2.8/2.10/4.3.2) | Ja (behoben) | `src/core.js:185-188`, `tests/run.js:152-157` | Vorher war EUR mit QRR erlaubt. | Hoch → behoben |
| QRR: 26 Ziffern + Prüfziffer, rekursiv mod 10, nicht nur Nullen (§2.12.1/Annex B) | Ja (behoben) | `src/core.js:15-27`, `src/core.js:82-99`, `src/core.js:106-108`, `tests/run.js:47-57,144-147` | Testvektor `21000000000313947143000901` → `7` stimmt mit Annex B Example überein. Nullen-Referenz jetzt abgelehnt. `[P]` Die 10×10-Matrix selbst konnte nur als Bild (Figure 21) nicht textlich verifiziert werden; der Example-Wert ist korrekt. | Hoch → behoben |
| SCOR RF-Format, 5–25 Zeichen, mod 97-10, nur mit IBAN (§2.12.2/4.3.2) | Ja | `src/core.js:107-124`, `src/core.js:189-195`, `tests/run.js:59-62` | – | – |
| `NON`: Referenz leer, keine QR-IBAN (§4.2.2) | Ja | `src/core.js:196-201`, `tests/run.js:115-123` | – | – |
| Betrag 0.01–999999999.99, 2 Dezimalstellen, Punkt als Separator (§4.2.2/3.5.3) | Teilweise | `src/core.js:126-142`, `src/core.js:204-206`, `tests/run.js:64-69` | 0.00 wird (zulässig für "DO NOT USE FOR PAYMENT") akzeptiert, aber ohne Pflicht-Message gemäss §4.4; open amount ohne Eingabefeld im Layout. | Mittel |
| Fehlerkorrekturstufe M und kleinstmögliche QR-Version (§6.1/6.2) | Ja | `app.js:89-91`, `vendor/qrcode.js:424-450` | – | – |
| QR-Code 46×46 mm, Vektorgrafik (§6.4) | Teilweise | `app.js:93-98`, `style.css:136` | SVG ist Vektor, aber die 46 mm schliessen die Ruhezone ein; die Modulfläche ist kleiner als 46 mm. `[P]` Exakter mm-Wert hängt vom Drucker-Browser-Scaling ab. | Hoch |
| Ruhezone mind. 4 Module (empfohlen 5 mm) (§6.4.1) | Teilweise | `app.js:93-95`, `README.md:38-42` | 4 Module erfüllen das Minimum; empfohlene 5 mm nicht erreicht. | Mittel |
| Erkennungszeichen: schwarz/weisses Kreuz, 7×7 mm (§6.4.2) | Teilweise | `app.js:97`, `app.js:109-112` | Farbe jetzt schwarz (behoben); Grösse relativ zur Modulfläche korrekt, aber geometrisch eine Näherung, nicht die offizielle Logo-Datei. `[P]` | Mittel → Farbe behoben |
| Zahlteil 148×105 mm + Empfangsschein 62×105 mm = 210×105 mm (§2.2/3.3) | Ja (behoben) | `style.css:125-131` | Vorher 148+52+10 mm Abstand+10 mm Padding = 220 mm; jetzt exakt 210 mm. | Hoch → behoben |
| Perforation zwischen Zahlteil und Empfangsschein sowie zum Brief (§3.1/3.3) | Nein | `style.css:140` (nur gestrichelte CSS-Linie), `README.md:38` | Keine echte Perforation; Browser-PDF kann sie nicht erzeugen. | Hoch |
| Registriermarks / Schnittmarken | Nein | `README.md:38-42` | Nicht Teil der extrahierten IG, aber Style-Guide-Anforderung. `[P]` | Mittel |
| Titel "Zahlteil"/"Empfangsschein", mehrsprachige Annex-C-Labels, Annahmestelle | Teilweise | `src/features.js` (LABELS DE/FR/IT), `app.js` (`slipHtml`), `index.html` (`#lang`) | DE/FR/IT-Labels und leere Annahmestellen-Zeile vorhanden; Platzierung/Typografie und Romansh fehlen. `[P]` Genaue Annex-C-Wortlaute nicht gegen Bildanhang verifiziert; Layout weiterhin nicht SIX-konform. | Hoch |
| Schriften Arial/Frutiger/Helvetica/Liberation Sans, 6–11 pt, keine Kursiv/Unterstrichen (§3.4) | Nein | `style.css:19`, `style.css:132-143` | System-Font-Stack, 9 pt/7 pt/14 pt; nicht normkonform. | Mittel |
| 5 mm Abstand zwischen Sektionen, unbedruckt (§3.5) | Teilweise | `style.css:134-136`, `app.js:127-137` | NR-Zelle mit 5 mm Gap vorhanden; keine Sektions-trennung nach Modell. | Mittel |
| Billing information nur bei Personendaten drucken; Syntax mit SIX vereinbart (§4.3.3/Annex D) | Nein | `app.js:117-146` (Kein Feld 32 im Layout) | API-Feld vorhanden, Druckregel und Freigabeprozess fehlen. `[P]` | Mittel |
| "DO NOT USE FOR PAYMENT"-Konvention (§4.4) | Nein | `src/core.js:204-206`, `app.js:131-135` | Betrag 0.00 möglich, aber keine Pflicht-/Grossbuchstaben-Message. | Mittel |
| 100 % lokal, keine Externals, vendored MIT-Lizenz | Ja | `index.html:91-93`, `README.md:45-49`, `vendor/LICENSE-qrcode-generator.txt` | – | – |
| Testabdeckung bei Logikänderung | Ja | `tests/run.js` | 27 Tests, `node tests/run.js` grün. | – |

## In dieser Prüfung behobene Fehler

1. UTF-8-Byte-Kodierung im QR-Code (falsche Umlaute bei Coding `1`) – `core.configureQRCode()` + Aufruf in `app.js`, Test mit VM-geladenem Vendor.
2. Zeichensatz um €, Latin Extended A und ș/ț erweitert.
3. Kombinierte 140-Zeichen-Grenze für Nachricht + Billing information.
4. QRR nur mit CHF; Nullen-QRR abgelehnt.
5. Unvollständige Debitor-Adresse und "Phantom-CH" aus CSV-Default abgelehnt.
6. Leere Zusatzzeile bei nur einer alternative procedure entfernt; Payload-Länge geprüft.
7. Schweizer Kreuz schwarz statt rot; Slip-Breite von 220 mm auf 210 mm korrigiert.

## Priorisierte Liste

### Vor einem öffentlichen Launch zwingend

1. **Drucklayout nachbilden**: echte Perforation, A6-Zahlteil + 62-mm-Empfangsschein, Titel/Labels in gewählter Korrespondenzsprache (Annex C), Annahmestelle, Sektionsabstände, erlaubte Schriften/Grade, Feld für offenen Betrag. Alternativ das Produkt klar als "nicht druckreif" positionieren (im UI wurde "druckreife" bereits entfernt).
2. **QR-Masse verifizieren**: 46×46 mm Modulfläche (nicht inkl. Ruhezone), 5 mm Ruhezone empfohlen, offizielle Logo-Datei; danach Scan-Test mit Banking-App und physischem Druck. `[P]` Browser-/Drucker-Scaling nicht verifiziert.
3. **ISO-3166-1-Länderprüfung** ergänzen (oder auf CH/LI einschränken), sonst werden ungültige Ländercodes erzeugt.
4. **Alternative procedures / Billing information** entweder deaktivieren oder den SIX-Freigabeprozess (Annex D) und die Druckpflicht bei Personendaten umsetzen.
5. **"DO NOT USE FOR PAYMENT"-Fall** gemäss §4.4 abschliessen (0.00 + exakte Grossbuchstaben-Message) oder 0.00-Beträge explizit ausschliessen.
6. **Bank-Rücklauf/Abnahme** mit Testdaten: Diese Prüfung ist statisch; keine Garantie für Annahme.

### Akzeptable MVP-Grenze (bei ehrlicher Dokumentation)

- Reines CSV (kein XLSX), Gratislimit 5 QR-Bills pro Vorgang; Demo/Pro-Modus und Vorlagen sind rein lokal ohne Login – dokumentiert in `README.md`.
- Dreisprachige Labels und funktionaler Zahlteil, solange die Layout-Lücke sichtbar bleibt (`index.html`, `README.md`).
- Keine echte Perforation im Browser-PDF; kein physischer Papier-/Drucktest im MVP.
- Keine Rechts-/Steuerberatung, keine Garantie für Bankannahme.
- `[P]` Details der Annex-B-Matrix, des offiziellen Kreuz-Logos und der Registriermarks wurden aus Bildabbildungen nicht textuell verifiziert; hier ist eine manuelle Sichtprüfung der Original-PDF/Style-Guide nötig.
