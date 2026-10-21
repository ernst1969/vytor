# Sicherheitsprüfung und Hardening für privaten Internetbetrieb

Stand: 21.10.2026. Express 5 / Prisma 7.10.1 / PostgreSQL; eine Backend-Instanz.
Aktueller Gate-Status und Nachweise: [DEPLOYMENT_READINESS.md](DEPLOYMENT_READINESS.md).
5–15 bekannte Nutzer. Kein Deployment, keine produktiven Secrets/Daten geändert,
keine UI-, Schema- oder Client-Session-Migration. Statische Prüfung plus echte HTTP-
und PostgreSQL-Integrationstests auf separatem temporärem Testcluster; kein Penetrationstest.

## Status aller ursprünglichen Befunde

| Ursprüngliche Schwere | Befund | Status | Umsetzung / verbleibender Punkt |
| --- | --- | --- | --- |
| Hoch | Fehlendes Rate Limiting für Login, Registrierung, Passwortprüfungen | **Behoben** | IP-/Account-Budgets, HTTP 429 + Retry-After, IPv6-/64-Buckets, exakter Caddy-Trust. Grenzen der Einzelinstanz unten. |
| Hoch | Eigene XP durch beliebige Sätze/Abschlussmassen manipulierbar | **Teilweise behoben** | Begrenzte Sätze/Messwerte, transaktionales Minuten-/Stundenlimit, einmalige Vergabe auch bei Parallelaufrufen. Erfundenes Training innerhalb der Grenzen bleibt möglich. |
| Mittel | Unvollständige Eingabe-/Mengenvalidierung | **Behoben** für Workout-Schreibwege | Gemeinsame Validierung für Erstellen, Draft, Finish, Hinzufügen, Ersetzen, Settings, Sortieren; Template-Mengen begrenzt. Keine Aussage, dass alle übrigen API-Validierungen vollständig vereinheitlicht sind. |
| Mittel | Öffentliche Profile inklusive Trainingszeitpunkten | **Offen** | Derzeit für alle angemeldeten Nutzer sichtbar; konkrete Vorschläge unten. Keine unautorisierte Änderung der Produktsichtbarkeit. |
| Mittel | Token in AsyncStorage | **Code behoben / Gerätetest offen** | Native SecureStore-Migration umgesetzt; Web tabgebunden. Neuer nativer Build und Reinstall-/Logout-Race-Test fehlen. |
| Mittel | Rohe Datenbank-/Prisma-Fehler im Log | **Behoben** | Alle API-Fehlerlogs verwenden Allowlist-JSON: statischer Ereignisname, Fehlercode, optional generierte Request-ID. Keine message/stack/meta/SQL/URL/Request-Bodies. |
| Mittel | API nutzt PostgreSQL-Initialbenutzer/Superuser | **Behoben** | Admin/Migrator/API getrennt; Migration und DML/DDL-Denials auf PostgreSQL 18.6 getestet. Compose-Test auf Docker bleibt offen. |
| Mittel | Account-Löschung: archivierte Übungen und SetNull-Referenzen | **Teilweise behoben** | Normale Löschung samt Sessions/Friends/XP/Feedback auf Test-DB verifiziert, Passwortprüfung limitiert. Datenschutz-/Anonymisierungsentscheidung und Sonderfälle mit fremden Template-Referenzen offen. |
| Niedrig/Mittel | Gleichzeitige Freundschaftsaktionen | **Offen** | Teilnehmerprüfungen bleiben erhalten und werden getestet; Annahme/Ablehnung noch nicht als bedingtes atomisches Update implementiert. |
| Niedrig | Case-insensitive Username-Prüfung, case-sensitive DB-Unique | **Offen** | Account-Limits normalisieren Schreibweise. DB-Eindeutigkeit benötigt Kollisionsanalyse und separate Datenmigration. |

Die früheren Konfigurationskorrekturen bleiben bestehen: HTTPS-API für Release-Client,
Produktions-CORS standardmäßig ohne Browser-Origin oder optional exakt ein HTTPS-`WEB_ORIGIN`, keine Express-Kennung, verpflichtende Produktions-DB,
Readiness ohne DB-Details. Kein ungeschützter fremder XP-Schreibweg gefunden; Details privater
Workouts verlangen Eigentümer oder akzeptierte Freundschaft. Passwörter bcrypt (Faktor 12),
Session-Tokens zufällig (32 Bytes), in DB nur SHA-256-Hash, 30 Tage Ablauf, Logout/Passwortwechsel
widerrufen Sessions. ORM/getaggte Raw-Abfragen parametrisieren Werte. Keine lokalen Upload-Dateien;
Profilbilder als begrenzte Data-URLs in PostgreSQL. `.env` bleibt unversioniert; vollständiger
Git-History-/Dependency-Schwachstellenscan ist weiterhin kein Bestandteil dieser Prüfung.

## Rate Limits, Proxy und Grenzen

| Vorgang | IP-Budget | Account-Budget | Zeitraum |
| --- | --- | --- | --- |
| Login | 60 Versuche | 10 Versuche je normalisiertem Username | 15 Minuten |
| Registrierung | 20 Versuche | — | 1 Stunde |
| Passwortwechsel + Account-Löschung gemeinsam | 10 Versuche | 10 Versuche je Session-User-ID | 15 Minuten |

Alle Versuche, auch erfolgreiche und fachlich ungültige, zählen. Das verhindert billiges
Zurücksetzen eines Angriffslimits. Login-Buckets verwenden einen Hash des normalisierten Namens,
keine geloggten Namen/Passwörter. Unbekannte und bekannte Accounts bekommen bei falschem Passwort
dieselbe 401-Antwort; Dummy-bcrypt-Vergleich reduziert den auffälligen Laufzeitunterschied.
429-Antworten sind immer identisch und enthalten `Retry-After` in Sekunden. Die Registrierung
meldet bei Konflikt nur einen generischen Fehler; Erfolg versus belegter Name bleibt durch
den bestehenden direkten Registrierungsablauf erkennbar. Vollständige Nicht-Erkennbarkeit
würde einen anderen Registrierungs-/Einladungsablauf verlangen. Profile/Usersuche erlauben
bereits das Finden von Usernames; Passwörter oder Accountzustände werden dabei nicht offengelegt.

IPv4-mapped IPv6 und alternative IPv6-Schreibweisen werden kanonisiert. IPv6-Adressen
aus demselben /64 teilen ein IP-Budget; IPv4-Adressen teilen es pro Adresse. Damit können
NAT-Nutzer gegenseitig Limits erreichen; 20 Registrierungen/Stunde decken den privaten Start
mit 15 Nutzern ab. Ein Angreifer kann das Account-Budget gezielt ausschöpfen (temporäre
Zugangssperre); verteilte Angriffe und viele unterschiedliche /64 sind weiterhin Grenzen.

Speicherbegrenzter Fixed-Window-Limiter (10.000 aktive Schlüssel je Store), abgelaufene
Einträge werden entfernt, bei Sättigung wird geschlossen abgewiesen statt aktive Sperren zu
verdrängen. Keine Timer/externen Dienste. Neustart löscht Auth-Budgets, mehrere API-Instanzen
würden separate Budgets besitzen. Vor Skalierung einen gemeinsamen Store und ein präziseres
Abuse-Konzept einführen. Fixed Windows erlauben Bursts an Fenstergrenzen. Kein umfassender
DDoS-Schutz oder globaler Ressourcenlimiter; VPS/Firewall und Monitoring bleiben erforderlich.

`TRUSTED_PROXY_IP` ist eine einzelne literale IP, nie `true`, Hop-Anzahl, privates Gesamtnetz
oder durch den Client gelieferter Name. Nur Socket-Peer an Hop 0 wird vertraut.
Compose setzt Caddy auf `172.30.50.2` im eigenen Netz `172.30.50.0/24`; API hat weiter keinen
öffentlichen Port. Caddy überschreibt X-Forwarded-For/-Host/-Proto und entfernt Forwarded.
Ohne Proxy-Konfiguration vertraut Development ausschließlich dem Socket-Peer. Produktion
verweigert Start ohne explizite Proxy-IP. Bei Netzkonflikt `PROXY_SUBNET` und `CADDY_PROXY_IP`
gemeinsam anpassen; keine CDN-/Load-Balancer-Kette ungeprüft davorsetzen.
Groß-/Kleinschreibung und abschließende Slashes dürfen die Middleware nicht umgehen.

## Workout-Grenzen und XP

| Wert | Grenze |
| --- | --- |
| Übungen je Workout / Template | 30 |
| Sets je Übung / insgesamt | 30 / 200 einschließlich Warm-up |
| Reps / Zielreps | Ganzzahl 0–999 |
| Gewicht | 0–1000 kg bzw. umgerechnete LBS-Grenze |
| Distanz | 0–1000 km bzw. umgerechnete MI-Grenze |
| Dauer je Satz | Ganze Sekunden 0–86400 (24 Stunden) |
| Pause | Ganze Sekunden 0–3600 |
| Workout-/Übungsnotizen | 5000 / 2000 Zeichen |
| Workout-Schreibpayload | 256.000 Bytes JSON |
| Globale JSON-Grenze | 3 MB, maximal 10 Ebenen / 15.000 Knoten |
| IDs / Revisionen | Sichere Ganzzahlen im PostgreSQL-Int-Bereich, IDs positiv |

Typen, Enum-Werte, doppelte Setnummern/Übungs-IDs und null statt Objekten werden geprüft.
Finish akzeptiert numerische Messwerte; Draft akzeptiert außerdem unvollständige numerische
Texte wie leere Eingabefelder. Der bestehende Pflichtfeldcheck je Übungstyp bleibt erhalten.
Unbekannte fremde WorkoutExercise-IDs werden nicht mehr still ignoriert. Hinzufügen von Übungen
prüft die Anzahl unter transaktionaler Zeilensperre, damit Parallelaufrufe die Grenze nicht umgehen.
Unfertige Draft-Sätze bleiben möglich; neue Grenzverletzungen liefern 400 statt 500.
Große oder tief verschachtelte Bodies ebenfalls 400 (am Caddy-Body-Limit kann davor 413 entstehen).

Kraft, Reps, TIME (Boxing/Muay Thai), Distanz+Zeit und Gewicht+Distanz bleiben unterstützt.
Keine Mindestdauer für eine Trainingseinheit eingeführt. Ungewöhnlich große echte Workouts
(über 30 Übungen, 30 Sätze je Übung oder 200 insgesamt) müssen geteilt oder die Grenzen
nach bewusster Prüfung angepasst werden. Vorhandene historische Daten werden nicht verändert;
bereits gespeicherte übergroße aktive Entwürfe können beim nächsten Schreiben abgewiesen werden.

XP bleibt **100 + 10 pro regulärem/Drop-Satz**, Warm-up zählt nicht zu den Satzpunkten.
Unique-XpEvent, Revision und Transaktion bleiben erhalten. Zusätzlich werden Vergaben je User
mit PostgreSQL-Advisory-Lock serialisiert und nach dem Lock erneut auf Abschluss geprüft:
mindestens 60 Sekunden zwischen Abschlüssen, höchstens 12 in rollierenden 60 Minuten.
Die Prüfung nutzt persistierte XP-Events und überlebt API-Neustarts. Bei Überschreitung 429
mit Retry-After; keine Sets/XP/endedAt werden geschrieben, Workout bleibt abschließbar.
Wer zwei echte getrennte Einheiten unmittelbar nacheinander abschließt, muss ggf. kurz warten.
Die Grenzen sind ein privater Abuse-Schutz, kein Beweis für tatsächlich geleistetes Training.

## Fehlerbehandlung

Parser-/Größenfehler und eigene Validatoren liefern 400, fehlende/ungültige Session 401,
fremde Zugriffe 403/404, Zustandskonflikte 409 (bereits beendet sequenziell weiterhin 400),
Limits 429, unerwartete Fehler 500 mit generischer Meldung. Clients bekommen keine SQL-/Prisma-
Details. Jeder Request erhält eine servergenerierte `X-Request-ID`; zentrale interne Fehler
liefern zusätzlich `code` und `requestId`. Bestehende fachliche Fehlertexte bleiben überwiegend
kompatibel. Interne Logs enthalten Ereignis und allowlist-geprüften Fehlercode; globale Fehler
zusätzlich Request-ID. Kein komplettes Error-Objekt, Token, Passwort, Header oder DB-URL.

## Verbleibende Datenschutz- und Betreiberentscheidungen

1. **Profile:** Basisdaten (Username, Anzeigename, Bild, XP/Rang) bewusst als im privaten
   Teilnehmerkreis sichtbar beschreiben. Exakte fremde Trainingszeitpunkte nur Eigentümer
   und akzeptierten Freunden liefern; optional für andere nur aggregierte Aktivität.
   Das verändert die vorhandene Recent-Workouts-Ansicht und benötigt deshalb Produktfreigabe.
   Ohne Schemaänderung zuerst serverseitige Freundschaftsprüfung; später explizite Sichtbarkeitseinstellung.
2. **Account-Löschung:** eigene personenbezogene Daten/Session-/Friend-/XP-/Feedback-Datensätze
   weiterhin löschen. Eigene Custom Exercises, die fremde Trainings referenzieren, vor SetNull
   anonymisieren (Name neutral, Beschreibung/Kategorie entfernen, archived beibehalten).
   Fremde Workouts mit eigener Template-Referenz vor Template-Löschung auf `templateId=null`
   setzen, um FK-Fehler zu vermeiden. Dies verändert fremde Historienanzeige und wird separat
   umgesetzt und adversarisch getestet. Keine Schemaänderung notwendig, aber bewusste Datenänderung.
3. **Backups:** gelöschte Daten können bis zum Ablauf der 14-Tage-Retention im verschlüsselten
   Backup verbleiben. Wiederherstellung darf keine dauerhafte Reaktivierung gelöschter Konten
   bewirken; Löschjournal/Abgleich und Informationspflichten separat festlegen. Backup-Kopien
   nicht ad hoc verändern. Private Teilnehmer über die aktuelle Sichtbarkeit informieren.

## SecureStore-Migration für Expo SDK 57 – implementiert, native Abnahme offen

Versionierte [Expo-Dokumentation](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/)
geprüft (SDK 57, Paketempfehlung dort ~57.0.4). Bei Umsetzung `npx expo install expo-secure-store`
verwenden, Config-Plugin und Android-Backup-Ausschluss prüfen; native Änderung benötigt neuen
Build. Android nutzt Keystore-gestützte Verschlüsselung; iOS Keychain hat andere
Reinstallations-/Persistenzeigenschaften. Web benötigt ein getrenntes Konzept.

- Einen zentralen asynchronen Token-Store außerhalb der Routen einführen; alle API-Aufrufe,
  Login, Logout und Accountwechsel verwenden ihn. SecureStore-Key neu versionieren.
- Beim ersten Start zuerst SecureStore lesen. Falls leer, genau einmal Legacy-AsyncStorage-Token
  lesen; Format prüfen und mit geschütztem Self-Endpunkt serverseitig validieren.
  401: beide Stores und zugehörige Account-Caches bereinigen; Offline/Timeout: Migration
  verschieben, ohne Token zu löschen oder als erfolgreich zu markieren.
- Gültigen Legacy-Token mit `setItemAsync` speichern, mit `getItemAsync` zurücklesen/prüfen,
  erst dann Legacy-Schlüssel löschen. Keine dauerhafte Doppelablage und keine neuen Tokens
  nach AsyncStorage schreiben. Crash zwischen Schritten muss wiederholbar sein.
- Scheitert SecureStore, keinen stillen Fallback auf neue Klartextspeicherung verwenden.
  Sichere Wiederanmeldung oder explizites Wiederholen ermöglichen; keine neue UI ungefragt einführen.
- Parallelzugriffe über eine gemeinsame Initialisierungs-Promise sperren. Logout/Accountwechsel
  serialisieren, damit ein laufender Migrationsvorgang gelöschte Sessions nicht wieder speichert.
  Logout entfernt beide Speicher auch bei Netzwerkfehler; serverseitiger Widerruf bleibt erhalten.
- Keine Biometriepflicht im ersten Schritt, um Hintergrund-/Offline-Workflows nicht zu verändern.
  Gerätegebundene Keychain-Optionen prüfen; Android Auto Backup schließt SecureStore-Daten aus.
- Tests: bestehende Session, Ablauf/Widerruf, Offline, Schreib-/Lesefehler, Crash nach Write,
  Logout während Migration, Accountwechsel, Neustart, Android Backup/Reinstall und iOS Reinstall.
  Für stärkere Absicherung danach Legacy-Session gezielt serverseitig rotieren (separate API-Änderung).

## Tests und Betriebsfreigabe

Automatisiert: 16 Backend-Unit-/HTTP-Tests, 16 UI-/Streak-Logiktests, erweiterte API-Integration
mit Migration/Seed auf eigenem temporärem PostgreSQL-18-Cluster. Dieser wird danach gestoppt
und gelöscht. Die vorhandene Entwicklungsdatenbank wird nicht verwendet.
Integration verweigert normalen DATABASE_URL-Fallback: `TEST_DATABASE_URL` muss ausdrücklich
auf eine dedizierte `vytor_*test`-DB zeigen. CI nutzt bereits `vytor_test` und setzt die Testvariable.

```bash
npm --prefix server test
npm run test:ui
npm run lint
npx tsc --noEmit
npx tsc --noEmit -p server/tsconfig.json
npm --prefix server run build
# Linux mit PostgreSQL-18-Binaries; PG_TEST_BIN bei anderer Installation setzen:
npm --prefix server run test:isolated
# Alternativ dedizierte Test-DB, niemals Entwicklungs-/Produktions-URL:
# cd server; TEST_DATABASE_URL=... npm run test:integration
```

Geprüft: Fehl-Logins, Registrierungs-/Passwortlimits, Retry-After, Proxy-IP und spoofed Header,
IPv4-mapped/IPv6-/64, alternative Routen-Schreibweise, kaputte/zu große JSON-Daten,
Workout-Grenzen, fachliche Typen, Boxing-Zeit, Parallel-/Doppelabschluss und einmalige XP,
XP-Frequenzlimit ohne Teilwrites, fremde User/Workouts/Friend-Aktionen, Settings und Account-Löschung.
Lint, beide Typechecks, Backend-Build und alle genannten Tests bestanden.
Docker/Caddy sind hier nicht installiert: Compose-Netz-/Port-/IP-Zuordnung statisch geprüft,
reale Container-/TLS-/Caddy-Header-Kette muss auf Testinstallation vor Freigabe geprüft werden.
Echte Android-/Mehrbenutzertests sowie externe Backups/Alarmierung bleiben Betriebsabnahme.

Für privaten Betrieb sind die unmittelbaren Auth-/Workout-Angriffsmöglichkeiten deutlich
reduziert. Verbleibende Risiken oben bewusst abnehmen; insbesondere öffentliche Profilzeiten,
native SecureStore-Geräteabnahme, externe Infrastruktur und erfundene gültige Trainingsdaten. Keine öffentliche
Launch-Freigabe und keine Zusage vollständigen Schutzes.

Quellen: [Express Proxy-Trust](https://expressjs.com/en/guide/behind-proxies/),
[Caddy Forwarded-Header](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy),
[Expo SecureStore SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/).
