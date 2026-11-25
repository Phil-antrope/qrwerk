# QRWerk – technische Konformitätsprüfung gegen SIX IG QR-bill v2.4

Datum: 25.11.2026 (Nachprüfung nach Layout-/Validierungsupdate) · Geprüfter Stand: MVP mit vorbereiteten Pro-Funktionen in `10M/05_Produkt/qrwerk/` · Methode: statische Code-/CSS-Prüfung, specs-seitige Verifikation und Ausführen von `node tests/run.js` (42/42 grün).

Diese Nachprüfung schliesst die Punkte „Hoch/Mittel" soweit ohne externe Abhängigkeiten möglich. Nicht geschlossen werden können: echte Perforation im Browser-PDF, die bildbasierten Annex-Details (Registriermarks, offizielles Kreuz-Logo, exakte Annex-C-Platzierung) und der Nachweis der Bankannahme. Diese bleiben ausdrücklich als Grenze oder `[P]` markiert.

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
| Optionale Felder 32/33/34 (Status A, §4.1.4/4.2.2) | Bewusst deaktiviert | `src/core.js` (`OPTIONAL_FIELDS_ENABLED = false`, Validierungsfehler), `tests/run.js` | Die Zeilen 32–34 verlangen eine mit SIX abgestimmte Syntax und den Annex-D-Freigabeprozess. Statt erfundener Inhalte erzeugt ein entsprechender Wert jetzt einen Fehler; die Payload bleibt bei 31 Feldern. | Mittel → deaktiviert |
| Maximale Payload-Länge 997 Zeichen inkl. Separatoren (§6.2) | Ja (behoben) | `src/core.js:292-293` | Prüfung neu ergänzt; mit den übrigen Limits rechnerisch kaum erreichbar. | Niedrig |
| Zeichensatz: U+0020–007E, U+00A0–00FF, U+0100–017F, U+0218–021B, € (§4.1.1) | Ja (behoben) | `src/core.js:34-36`, `src/core.js:47`, `tests/run.js:138-142` | Vorher wurden € und Latin-Extended-A-Zeichen still entfernt; jetzt konform, non-ASCII wird bereinigt statt abgelehnt (Warnung nur für Nachricht, `src/core.js:285-288`). | Hoch → behoben |
| UTF-8-Kodierung der QR-Bytes bei Coding `1` (§4.1.1) | Ja (behoben) | `src/core.js:304-309`, `src/core.js:398`, `app.js:5`, `tests/run.js:190-197` | Vendored `qrcode.js` nutzte `charCodeAt & 0xff` (Latin-1); `ü` wurde als 0xFC statt 0xC3 0xBC kodiert. Jetzt explizit `stringToBytesFuncs['UTF-8']`; per VM-Test verifiziert. | Kritisch → behoben |
| Längen: Name 70, Strasse 70, Hausnr. 16, PLZ 16, Ort 35, Land 2 (§4.2.2) | Ja | `src/core.js:29-32`, `src/core.js:144-150`, `src/core.js:212-219`, `src/core.js:225-230` | Kürzung erfolgt still mit Fehlermeldung; akzeptabel. | – |
| Nachricht 140 (§4.1.5); Nachricht + Billing information zusammen 140 (§4.3.3) | Ja (teilweise hinfällig) | `src/core.js` (`limit('message')`), `tests/run.js` | Nachricht bleibt auf 140 Zeichen begrenzt. Die kombinierte Grenze entfällt, weil Zeile 32 (Billing information) deaktiviert ist; es wird nie ein Feld 32 erzeugt. | Hoch → behoben/deaktiviert |
| Alternative procedures: max. 2, max. 100 Zeichen je Zeile (§4.2.2, Zeilen 33/34) | Deaktiviert | `src/core.js`, `tests/run.js` | Ohne SIX-Freigabe werden keine Alternativverfahren erzeugt. Die ehemalige Längenprüfung ist damit hinfällig; ein ADA-Wert führt zum Fehler. `[P]` Der Freigabeprozess selbst ist nicht abgebildet. | Mittel → deaktiviert |
| Adressen nur Typ `S` seit v2.3; Gläubiger PLZ/Ort/Country zwingend (§4.2.2/4.3.1) | Ja | `src/core.js:214-222`, `src/core.js:258` | K-Adressen werden abgelehnt (`tests/run.js:98-106`). | – |
| Debitor: Typ `S` nur wenn Gruppe genutzt; dann Name/PLZ/Ort/Land (§4.2.2/4.3.1) | Ja (behoben) | `src/core.js:230-241`, `app.js:37-39`, `tests/run.js:159-172` | Vorher erzeugte der Default `CH` eine unvollständige S-Adresse; jetzt Only-Default wird verworfen, unvollständige Gruppen werden abgelehnt. | Hoch → behoben |
| Country code ISO 3166-1, 2 Stellen (§4.2.2) | Ja | `src/countries.js` (249 Codes, offline), `src/core.js` (`checkCountry`), `tests/run.js` | `ZZ`, `XK`, `EU` und weitere Sondercodes werden abgelehnt, Kleinbuchstaben normalisiert. Keine externe API. | Mittel → behoben |
| IBAN CH/LI, 21 Stellen, mod 97 (§4.2.2) | Ja | `src/core.js:51-72`, `tests/run.js:31-37` | – | – |
| QR-IBAN IID 30000–31999; nur mit QRR (§2.8/2.10/4.3.2) | Ja | `src/core.js:74-79`, `src/core.js:182-184`, `src/core.js:196-201`, `tests/run.js:40-45,108-126` | – | – |
| QR-IBAN/QRR nur für CHF (v2.4-Änderung, §2.8/2.10/4.3.2) | Ja (behoben) | `src/core.js:185-188`, `tests/run.js:152-157` | Vorher war EUR mit QRR erlaubt. | Hoch → behoben |
| QRR: 26 Ziffern + Prüfziffer, rekursiv mod 10, nicht nur Nullen (§2.12.1/Annex B) | Ja (behoben) | `src/core.js:15-27`, `src/core.js:82-99`, `src/core.js:106-108`, `tests/run.js:47-57,144-147` | Testvektor `21000000000313947143000901` → `7` stimmt mit Annex B Example überein. Nullen-Referenz jetzt abgelehnt. `[P]` Die 10×10-Matrix selbst konnte nur als Bild (Figure 21) nicht textlich verifiziert werden; der Example-Wert ist korrekt. | Hoch → behoben |
| SCOR RF-Format, 5–25 Zeichen, mod 97-10, nur mit IBAN (§2.12.2/4.3.2) | Ja | `src/core.js:107-124`, `src/core.js:189-195`, `tests/run.js:59-62` | – | – |
| `NON`: Referenz leer, keine QR-IBAN (§4.2.2) | Ja | `src/core.js:196-201`, `tests/run.js:115-123` | – | – |
| Betrag 0.01–999999999.99, 2 Dezimalstellen, Punkt als Separator (§4.2.2/3.5.3) | Ja (mit `[P]`) | `src/core.js` (`normalizeAmount`), `src/print.js` (`amountFields`) | Leerer Betrag = offenes Feld mit Linie in Zahlteil und Empfangsschein; 0.00 nur mit §4.4-Nachricht. Maximum/Dezimalstellen geprüft. `[P]` Figur 5/9 (Handfeld-Platzierung) nur textlich. | Mittel → behoben |
| Fehlerkorrekturstufe M und kleinstmögliche QR-Version (§6.1/6.2) | Ja | `app.js:89-91`, `vendor/qrcode.js:424-450` | – | – |
| QR-Code 46×46 mm, Vektorgrafik (§6.4) | Ja (mit `[P]`) | `src/print.js` (`qrSvg`, `qrGeometry`), `style.css` (`.qr svg`) | Die SVG-Modulfläche ist exakt 46 mm (`width="46mm"`, viewBox = Modulanzahl); die Ruhezone liegt aussen. `[P]` Browser-/Drucker-Scaling und physische Messung nicht verifiziert. | Hoch → behoben |
| Ruhezone mind. 4 Module (empfohlen 5 mm) (§6.4.1) | Ja (mit `[P]`) | `src/print.js` (`Math.max(5 mm, 4 Module)`, kaufmännisch aufgerundet), CSS-Padding | Bei grossen Modulgrössen (kleine QR-Version) wird > 5 mm verwendet, damit 4 Module nie unterschritten werden. `[P]` Druck-Scaling nicht getestet. | Mittel → behoben |
| Erkennungszeichen: schwarz/weisses Kreuz, 7×7 mm (§6.4.2) | Teilweise | `src/print.js` (`crossOuterMm`/`crossInnerMm`, SVG-Rechtecke) | Weisses Kreuz auf schwarzem Quadrat mit weissem Rand, nominal 7 mm / 6 mm in mm gerechnet. `[P]` Exakte Figur 14 und offizielle Logo-Datei nicht verifiziert. | Mittel → Geometrie verbessert |
| Zahlteil 148×105 mm + Empfangsschein 62×105 mm = 210×105 mm (§2.2/3.3) | Ja (behoben) | `style.css:125-131` | Vorher 148+52+10 mm Abstand+10 mm Padding = 220 mm; jetzt exakt 210 mm. | Hoch → behoben |
| Perforation zwischen Zahlteil und Empfangsschein sowie zum Brief (§3.1/3.3) | Nein (dokumentiert) | `style.css` (gestrichelte Linien, Eckmarken), `src/print.js` (`cut-marks`), `README.md` | Echte Perforation ist im Browser-PDF nicht erzeugbar. Gestrichelte Trennlinie + Schnittmarken sind die Annäherung; kein SIX-konformer Papierdruck. | Hoch → technisch begrenzt, ehrlich dokumentiert |
| Registriermarks / Schnittmarken | Teilweise | `src/print.js` (`cut-marks`), `style.css` | Vier Eckmarken und gestrichelte Trennung vorhanden. `[P]` Offizielle Registriermarks/Style-Guide-Details nicht verifiziert. | Mittel → Annäherung |
| Titel "Zahlteil"/"Empfangsschein", mehrsprachige Annex-C-Labels, Annahmestelle | Ja (mit `[P]`) | `src/features.js` (LABELS DE/FR/IT/EN/RM), `src/print.js` (`slipHtml`), `index.html` (`#lang`) | Titel, Annahmestelle und Leerfeld, Empfangsschein jetzt links (§2.2), 5-mm-Sektionen. `[P]` DE/FR/IT/EN-Wortlaute aus der Textfassung, Romansh ungeprüft; Platzierung nicht gegen Bildanhang verifiziert. | Hoch → überwiegend behoben |
| Schriften Arial/Helvetica/Liberation Sans, 6–11 pt, keine Kursiv/Unterstrichen (§3.4) | Ja (mit `[P]`) | `style.css` (`.slip`), `src/print.js` (`LAYOUT.fontPt`) | Font-Stack auf erlaubte lizenzfreie Familien, 6/8/10/11 pt, kein italic/underline. Frutiger ist nicht frei lizenzierbar und wird nicht vendored. `[P]` Font-Substitution im Browser nicht kontrollierbar. | Mittel → behoben |
| 5 mm Abstand zwischen Sektionen, unbedruckt (§3.5) | Ja | `style.css` (`row-gap: 5mm`), `src/print.js` (Sektionen) | Zahlteil und Empfangsschein haben 5 mm Sektionsabstand; offene Beträge erhalten handschriftliche Linien. `[P]` Exakte Sektionsreihenfolge aus Figuren nicht bildhaft geprüft. | Mittel → behoben |
| Billing information nur bei Personendaten drucken; Syntax mit SIX vereinbart (§4.3.3/Annex D) | Deaktiviert | `src/core.js` (Fehler bei Zeile 32), `README.md`, `index.html` | Kein erfundener Syntax und kein Druck einer ungeprüften Regel. `[P]` Freigabeprozess nicht abgebildet. | Mittel → deaktiviert, dokumentiert |
| "DO NOT USE FOR PAYMENT"-Konvention (§4.4) | Ja (mit `[P]`) | `src/core.js` (`NO_PAYMENT_MESSAGE`, Prüfung), `src/print.js` (`no-payment` Klasse) | 0.00 verlangt exakt `DO NOT USE FOR PAYMENT`; umgekehrt verlangt die Nachricht 0.00. `[P]` Platzierung/Hervorhebung gemäss Figur 12 nicht bildhaft verifiziert. | Mittel → behoben |
| 100 % lokal, keine Externals, vendored MIT-Lizenz | Ja | `index.html` (nur lokale `<script>`), `src/countries.js`, `vendor/LICENSE-qrcode-generator.txt` | Zusätzlich ISO-Liste offline vendored; keine API, kein Upload. | – |
| Testabdeckung bei Logikänderung | Ja | `tests/run.js` | 42 Tests, `node tests/run.js` grün (vorher 27). | – |

## In dieser Prüfung behobene Fehler

1. UTF-8-Byte-Kodierung im QR-Code (falsche Umlaute bei Coding `1`) – `core.configureQRCode()` + Aufruf in `app.js`, Test mit VM-geladenem Vendor.
2. Zeichensatz um €, Latin Extended A und ș/ț erweitert.
3. Kombinierte 140-Zeichen-Grenze für Nachricht + Billing information.
4. QRR nur mit CHF; Nullen-QRR abgelehnt.
5. Unvollständige Debitor-Adresse und "Phantom-CH" aus CSV-Default abgelehnt.
6. Leere Zusatzzeile bei nur einer alternative procedure entfernt; Payload-Länge geprüft.
7. Schweizer Kreuz schwarz statt rot; Slip-Breite von 220 mm auf 210 mm korrigiert.
8. ISO-3166-1-Prüfung mit 249 lokal vendored Codes statt reiner Längenprüfung.
9. `0.00` nur mit exakt `DO NOT USE FOR PAYMENT` (§4.4); umgekehrter Fall ebenfalls geprüft.
10. Zeilen 32–34 (Billing information / alternative procedures) deaktiviert und dokumentiert.
11. QR-Modulfläche auf 46 mm korrigiert, Ruhezone als CSS-Padding `max(5 mm, 4 Module)`.
12. Empfangsschein links des Zahlteils, Titel/Labels DE/FR/IT/EN/RM, Annahmestellen- und
    offene Betragsfelder, 5-mm-Sektionsabstände, erlaubte Schriftfamilien und -grade.
13. Schnittmarken und gestrichelte Linien als Annäherung an die geforderte Perforation
    (echte Perforation weiterhin nicht möglich).
14. Drucklogik in `src/print.js` ausgelagert und in Node-Tests über eine QR-Stub-Factory
    geprüft; `tests/run.js` von 27 auf 42 Prüfungen erweitert.
15. Slip-Feldzuordnung korrigiert: 0-basierte Indizes für Referenztyp/Referenz/Nachricht
    (SPC-Zeilen 28–30), „Zahlbar an" unter „Konto / Zahlbar an" und kein EPD-Trailer als
    Anzeigewert; mit Test gegen die tatsächliche Payload.

## Priorisierte Liste – Stand nach Nachprüfung

### Technisch geschlossen

1. **Drucklayout (Grundstruktur)**: 210 × 105 mm, Empfangsschein links, 62/148 mm, Titel
   „Empfangsschein"/„Zahlteil", Labels DE/FR/IT/EN/RM, Annahmestelle, 5-mm-Sektionen,
   offene Betragsfelder, erlaubte Schriften 6–11 pt ohne Kursiv/Unterstreichung.
2. **QR-Masse im Browser**: SVG-Modulfläche 46 mm, Ruhezone `max(5 mm, 4 Module)` als
   CSS-Padding; Tests prüfen Geometrie und Markup.
3. **ISO-3166-1**: 249 Codes lokal vendored, Validierung für Gläubiger und Debitor.
4. **Billing information / alternative procedures**: deaktiviert, mit klarer Fehlermeldung
   statt nicht abgestimmter Syntax; Auswirkung auf die 31-Feld-Payload getestet.
5. **§4.4**: Betrag 0.00 und exakte Grossbuchstaben-Nachricht sind gekoppelt und geprüft.

### Verbleibende, ehrlich dokumentierte Grenzen

- **Keine echte Perforation** im Browser-PDF; Schnittmarken/gestrichelte Linien sind eine
  Annäherung, kein SIX-konformer Papierdruck. Weitere Style-Guide-Details (Registriermarks,
  Papier 80–100 g/m²) liegen ausserhalb des MVP.
- **`[P]` Drucker-Scaling**: 46 mm und Ruhezone sind CSS-mm; physischer Druck, Rasterung und
  das Scannen mit einer Banking-App wurden nicht getestet. Keine Zertifizierung, keine
  Garantie für Bankannahme.
- **`[P]` Bildbasierte Annex-Details**: Annex-B-Matrix, offizielles Kreuz-Logo, exakte
  Annex-C-Wortlaute/Platzierung und Figur 12 („DO NOT USE FOR PAYMENT") wurden nicht gegen
  die Originalabbildungen verifiziert. Romansh ist eine ungeprüfte Näherung.
- **Billing information / alternative procedures** bleiben deaktiviert, bis Syntax und
  Annex-D-Freigabe durch SIX vorliegen; das Produkt erfindet keine Syntax.
- Reines CSV (kein XLSX), Gratislimit 5 QR-Bills pro Vorgang; Demo/Pro-Modus und Vorlagen
  rein lokal ohne Login – dokumentiert in `README.md`.
- Keine Rechts-/Steuerberatung. Ein Bank-Rücklauf mit Testdaten steht weiterhin aus.
