# Vytor

Mobile Trainings-App für iOS und Android mit Web-Ziel. Stand: 16. Oktober 2026. Arbeitsregeln: [AGENTS.md](AGENTS.md), Aufgaben: [TODO.md](TODO.md), Änderungen: [CHANGELOG.md](CHANGELOG.md).

## Funktionen

- Sessions mit Login, Registrierung und Abmeldung; bearbeitbare Profile mit Bild, Anzeigename und eindeutigem `@username`.
- Freestyle-Workouts und persönliche Vorlagen als wiederverwendbare Presets. Presets speichern Zielwiederholungen, Satztypen, Einheiten, Pausen und Form-Cues. Die alte globale Starter-Vorlage wird nicht mehr angeboten.
- Feste Start-/Finish-/Verwerfen-Aktionen, Bestätigungen und eine Liste unfertiger Sätze vor dem Abschluss.
- Regular-, Warm-up- und Drop-Sätze; Satz direkt einfügen oder löschen, Ziele und Ghost-Werte aus dem letzten Training. Drop-Sätze stehen direkt unter ihrem Ursprung und zählen nicht als zusätzliche reguläre Satznummer.
- Fünf Messarten, Einheiten pro Übung, freie Pausendauer, direkte Timer-Eingabe und Zeitdarstellung `hh:mm:ss`. Zifferneingabe `123` bedeutet `00:01:23`; Minuten und Sekunden müssen kleiner als 60 sein.
- Workout-Notizen und dauerhafte persönliche Form-Cues; eigene Übungen erstellen, bearbeiten und archivieren. Messarten eigener Übungen bleiben nach Erstellung fest, damit Historie interpretierbar bleibt.
- Workout-Historie und gezielte Detailabfrage, Ergebnisansicht mit Gesamt-/Satz-XP, Levelbalken, geschätztem 1RM und Verbesserungen gegenüber früheren Trainings.
- Freundschaftsanfragen, Freundesfeed und Profilbilder mit Initialen-Fallback. Vollständige Workout-Details sehen der Besitzer und bestätigte Freunde. Andere Profile verlinken die eigene Trainingsübersicht.
- Globale Rangliste im Friends-Tab, eigener globaler Rang im Profil und XP-Ränge: Bronze ab 0, Silver ab 1.000, Gold ab 5.000, Platinum ab 15.000, Diamond ab 40.000 XP.
- Recent Workouts zeigen in zwei Reihen mit je sieben Tageskacheln (letzte 14 Tage inklusive heute), ohne Namen pro Training eine anatomische Muscle-Load-Vorschau mit Vorder-/Rückansicht: direkte Belastung kupferfarben, indirekte heller. Je Kalendertag wird das zuletzt abgeschlossene Workout angezeigt; ohne Filter oder Muskel-Chips; Antippen öffnet die Workout-Details. Die über OpenGym bereitgestellten MuscleMap-Konturen stehen unter MIT; vollständige Hinweise in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Helles, dunkles und systemabhängiges Theme; Feedback, Passwortänderung und bestätigte Kontolöschung in Settings.

## Technik

Expo SDK 57, React 19, React Native 0.86, TypeScript 6, Expo Router; Express 5, Prisma 7 und PostgreSQL. npm installiert App und Server getrennt. Native Verzeichnisse werden durch Expo generiert und nicht von Hand gepflegt.

```text
src/app/                  Screens und Router-Layouts
src/context/              Workout-Zustand, Sessionsignale und Theme
src/components/           Dialoge, Avatar-Fallback, Muskelübersicht und UI
src/services/api.ts       Bearer-Client mit Request-Timeout
src/utils/                Dauer, Muskelzuordnung und Offline-Abgleich
server/src/               API, Fortschrittsregeln, Validierung und Unit-Tests
server/prisma/            Schema, Migrationen und Übungskatalog
server/scripts/           Isolierter PostgreSQL-/HTTP-Integrationstest
.github/workflows/        Lint, Typechecks, Tests und Plattformexport
```

## Lokal starten

Node.js 24, npm und PostgreSQL werden benötigt. Es gibt keine npm-Workspaces und kein Bun-Lockfile.

```bash
npm ci
cd server
npm ci
```

`.env.example` nach `.env` und `server/.env.example` nach `server/.env` kopieren und lokal anpassen. Keine Zugangsdaten committen.

```dotenv
# Root .env: auf echten Geräten eine erreichbare LAN-Adresse verwenden
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

```dotenv
# server/.env
DATABASE_URL=postgresql://vytor:password@localhost:5432/vytor?schema=public
PORT=3000
```

Aus `server/`:

```bash
npx prisma migrate deploy
npx prisma generate
npx tsx prisma/seed.ts
npm run dev
```

Aus dem Root in einem zweiten Terminal:

```bash
npm start
# Alternativ: npm run android / npm run ios / npm run web
```

`GET /api/health` prüft Express-Erreichbarkeit. Private API-Routen benötigen eine 30 Tage gültige Bearer-Session. `EXPO_PUBLIC_*` enthält ausschließlich öffentliche Konfiguration, keine Geheimnisse.

## Speicherung und Gerätewechsel

Ein partieller PostgreSQL-Unique-Index erlaubt nur ein aktives, nicht pausiertes Workout je Konto. Home setzt nach Login ein vorhandenes Server-Workout fort; konkurrierende Starts erhalten HTTP 409. Übungen können hinzugefügt, entfernt, atomar ersetzt und umgeordnet werden.

Sätze, Notizen, Einheiten, Form-Cues und das absolute Timer-Ende werden lokal pro Konto gespeichert. Änderungen werden nach 800 ms als versionierter Entwurf synchronisiert; fehlgeschlagene Übertragungen werden alle 15 Sekunden erneut versucht. Ein Timeout beendet hängende Requests nach 15 Sekunden.

Der Server akzeptiert nur die erwartete Entwurfsversion und die aktuelle Übungsliste. Bei konkurrierenden Änderungen bleiben lokale Daten erhalten und die App zeigt einen Konflikt. „Reload server workout“ ersetzt lokale Änderungen nach ausdrücklicher Bestätigung. Bereits bestätigte lokale Daten werden beim Neustart durch den aktuellen Serverstand ersetzt; ungesendete Daten mit passender Basisversion werden weiter synchronisiert.

Bei schlechter Verbindung können Sätze eines bereits gestarteten Workouts lokal weiter bearbeitet werden. Trainingsstart, strukturelle Übungsänderungen, Abschluss und Verwerfen benötigen eine Verbindung; dafür gibt es keine vollständige Offline-Warteschlange. Andere Geräte sehen den zuletzt bestätigten Serverentwurf. Passwortänderung beendet alle Sessions; Logout entfernt den Entwurf dieses Geräts und beendet dessen Session.

Gewichte werden als kg, Distanzen als km und Zeiten als Sekunden gespeichert. Anzeige und Einheitenwechsel rechnen um. Abschluss, Satzdaten und XP sind transaktional; 100 Basis-XP plus 10 XP pro abgeschlossenem Nicht-Warm-up-Satz werden einmalig vergeben. 1RM nutzt die Epley-Schätzung und ist entsprechend gekennzeichnet.

## Datenbankänderungen

Die Migration `20261016190000_complete_training_features` ergänzt Entwürfe, Versionen, Notizen, persönliche Übungseinstellungen, eigene Übungen und Feedback. Sie repariert auch das bisher im Modell fehlende Pflichtfeld `FriendRequest.updatedAt`, das neue Freundschaftsanfragen verhinderte.

Die historische Messartenmigration wurde für eine saubere Wiederholung korrigiert: kein festes `public`-Schema, `MILES` → `MI`, Erhalt vorhandener Messarten. Bereits angewendete Installationen benötigen dafür keinen Reset. Bei Entwicklungsdatenbanken kann Prisma die geänderte historische Prüfsumme melden; keinen automatischen Reset einer Datenbank mit Nutzerdaten bestätigen. Die neue additive Migration ist der Upgrade-Pfad; ein Baseline-Abgleich bestehender Installationen bleibt eine bewusste Wartungsaktion.

Wenn bereits mehrere offene Workouts für ein Konto existieren, bleibt das neueste aktiv. Ältere werden ohne Datenverlust als pausierte Workouts erhalten. „PAUSED WORKOUTS“ in der Vorlagenauswahl bietet sie zur bestätigten Wiederaufnahme an; dabei wird das bisher aktive Training ebenfalls erhalten und pausiert. Die Migration schreibt keine erfundenen Abschlüsse in die Historie.

Feedback wird mit Konto-ID und Zeitpunkt in der Tabelle `Feedback` an den internen Teameingang zugestellt. Es gibt keinen externen E-Mail-Versand. Betreiber können den Eingang über die Datenbank auswerten:

```sql
SELECT "id", "userId", "message", "createdAt"
FROM "Feedback" ORDER BY "createdAt" DESC;
```

Kontolöschung entfernt Workouts, Vorlagen, Sessions, XP-Ereignisse, persönliche Einstellungen, Feedback und Freundschaften. Eigene Übungen werden archiviert; vorhandene Referenzen und ihre historischen Messarten bleiben erhalten.

## Prüfungen

Aus dem Root:

```bash
npm run lint
npx tsc --noEmit
npx tsc --noEmit -p server/tsconfig.json
npx expo-doctor
npx expo export --platform all --output-dir /tmp/vytor-export
```

Aus `server/`:

```bash
npm test
npm run test:integration
npx prisma validate
```

Die additive Migration wurde auf der lokalen Entwicklungsdatenbank erfolgreich angewendet.

Der Integrationstest benötigt eine erreichbare `DATABASE_URL` sowie Rechte zum Erstellen/Löschen eines Schemas. Er legt ein eindeutig benanntes Testschema an, spielt sämtliche Migrationen und den Seed ein, startet einen separaten API-Prozess und prüft echte HTTP-Aufrufe. Danach entfernt er ausschließlich das Testschema. `DATABASE_SCHEMA` steuert dabei das Prisma-Adapter-Schema; im normalen Betrieb ist es `public`.

Abgedeckt sind Authentifizierung, Profile/Bilder, Freundschaftsberechtigungen, Vorlagen, Gerätewechsel, Versionskonflikte, parallele Starts, Übungsersatz/-löschung, Warm-up-/Drop-Sätze, Einheiten, XP, Historie, Settings, Feedback und Account-Bereinigung. Unit-Tests prüfen außerdem Dauer, XP-Ränge, Muskelzuordnung und Offline-Konfliktentscheidungen.

Ein erfolgreicher Plattformexport ersetzt keine Interaktionsprüfung auf Geräten. Die noch ausstehende manuelle Matrix steht in [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).

## EAS und Release

`eas.json` enthält Profile für interne Preview-Builds und Production sowie ein Submit-Profil. Projektzuordnung, eigene Bundle-/Package-Identifier, Store-Konten, Signierungsdaten und öffentliche HTTPS-API-Adresse müssen vor dem ersten Release eingerichtet werden. Es wurden keine Cloud-Builds oder Store-Veröffentlichungen gestartet.

```bash
npx eas-cli@latest build:configure
npx eas-cli@latest build --profile preview --platform all
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform all
```

Ein Development-Client-Profil setzt die zusätzliche Installation von `expo-dev-client` über `npx expo install expo-dev-client` voraus. OTA-Updates benötigen zunächst die Einrichtung von EAS Update. Fotos werden ausschließlich als bewusst ausgewähltes Profilbild übertragen; Kamera- und Mikrofonberechtigungen sind deaktiviert. Die abschließende Store-/Datenschutzprüfung ist vor Veröffentlichung durchzuführen.

Expo-Dokumentation: [SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Router](https://docs.expo.dev/router/introduction/), [EAS-Konfiguration](https://docs.expo.dev/build/eas-json/). `npm run reset-project` ist ein destruktives Starter-Skript und kein Wartungsbefehl.

## Android, Expo-Tunnel und lokales Backend

`npx expo start --tunnel` leitet den Expo-Entwicklungsserver weiter, nicht automatisch den API-Port. `EXPO_PUBLIC_API_URL` muss auf eine Adresse zeigen, die das Handy selbst erreichen kann. Prüfe im Handy-Browser `http://<Windows-LAN-IP>:3000/api/health`; erwartet wird `"status": "ok"`.

Bei WSL 2 müssen die Windows-LAN-Adresse, die Weiterleitung auf die aktuelle WSL-IP und die Windows-Firewall zusammenpassen. Der API-Server lauscht bereits auf `0.0.0.0`. Firewall-Freigaben sollten auf API-Port, WLAN-Schnittstelle und lokales Subnetz begrenzt bleiben. Nach Änderungen an der API-Adresse Expo neu starten und die App neu laden. Lokale Windows-Firewall-Regeln werden nicht durch einen Git-Checkout übernommen.

Dokumentation: [Expo-Tunnel](https://docs.expo.dev/more/expo-cli/#tunneling), [WSL-LAN-Zugriff](https://learn.microsoft.com/en-us/windows/wsl/networking#accessing-a-wsl-2-distribution-from-your-local-area-network-lan).

## UI und Designsystem

Die vier Tabs verwenden das bestehende App-Theme mit Anthrazit, grauen Karten und dem orangefarbenen Akzent der verbindlichen Datei `vytor_home_design_variante_2.png`. Gemeinsame Layout-Tokens in `src/constants/theme.ts` definieren Seitenabstände, Kartenradius und maximal 720 Punkte Inhaltsbreite für die Übersichten. Die Appearance-Auswahl bleibt erhalten.

Home zeigt einen zufälligen, pro Mount stabilen Motivationsspruch, den vorhandenen Workout-Einstieg, echte Level-/XP-/Rangdaten und abgeschlossene Workouts ohne Icons. Die Workout-Anzahl zählt abgeschlossene Workouts im aktuellen lokalen Kalendermonat. Die Day Streak zählt eindeutige lokale Abschlusstage: Bis zu zwei Ruhetage zwischen Trainings sind erlaubt, bei mehr als drei Kalendertagen Abstand beginnt eine neue Serie. Ohne weiteres Training bleibt die Serie bis zum Ende des dritten Tages nach dem letzten Workout gültig und wird am folgenden Tageswechsel zu 0. `ProgressBar` wird von Home und Profil geteilt. Friends zeigt das unverändert vom Server gelieferte Ranking in ausgerichteten Zeilen; das Profil behält sein 14-Tage-Raster. Settings bleiben aufklappbar, mit separat abgegrenzter Danger Zone.

## Workout-Layout und Muskelkarte

Header und Eingabezeilen nutzen dieselben Flex-Spalten in `WorkoutSetTable`. Einheiten besitzen einen reservierten Bereich innerhalb des Eingaberahmens. `SESSION` hat eine eigene Mindestbreite; alle Eingabezeilen und Bestätigungsbuttons sind 48 Punkte hoch. Die Karten nutzen auf Mobilgeräten die verfügbare Breite, auf großen Bildschirmen einen bis zu 1.100 Punkte breiten Inhaltsbereich. Der Footer steht außerhalb des Scrollbereichs; die Tab-Leiste wird während der Tastatureingabe ausgeblendet.

`npm run test:ui` prüft Messarten, Session-Bezeichnungen, Platz auf 320-Punkte-Displays, anatomische Konturen, Muskelzuordnung, Farbskala, das 14-Tage-Raster und die Rest-Day-Streak einschließlich Zeitzonen, Sommerzeit und mehrfacher Workouts am selben Tag. Die Server-Abhängigkeiten müssen dafür installiert sein.

Für die reproduzierbare Browserprüfung (API-Antworten simuliert, keine Nutzerdaten):

```bash
npx expo export --platform web --output-dir /tmp/vytor-layout-export
npm install --prefix /tmp/vytor-ui-verification @playwright/test
PLAYWRIGHT_BROWSERS_PATH=/tmp/vytor-ui-browsers node /tmp/vytor-ui-verification/node_modules/playwright/cli.js install chromium
PLAYWRIGHT_BROWSERS_PATH=/tmp/vytor-ui-browsers PLAYWRIGHT_MODULE=/tmp/vytor-ui-verification/node_modules/playwright/index.mjs node scripts/workout-layout.browser.mjs
```

Der Browserlauf prüft 320, 344 (Referenzbreite), 360, 390, 768 und 1.440 Pixel, ausgerichtete Spalten, Einheiten, Overflow, Eingaben, Satzaktionen, Entwurfsspeicherung, Abschluss/Verwerfen, Footer, Muskelkarte, alle vier Tabs, stabile Home-Sprüche, echte Progress-Darstellung aus API-Antworten, Start-/Detailnavigation, Leaderboard-Gleichstände, lange Namen sowie Hell-/Dunkel-Auswahl und den Streak-Verfall am lokalen Tageswechsel ohne Polling. Screenshots liegen unter `/tmp/vytor-layout-screenshots`. Native Tastatur-/Safe-Area-Prüfungen benötigen weiterhin reale iOS-/Android-Geräte. Der vorherige TODO-Audit hat außerdem noch offene Synchronisations- und Drop-Set-Randfälle festgestellt; diese Layoutänderung ändert keine Backend- oder Persistenzverträge.

Die Settings öffnen Eingaben über einzelne Buttons; der Standard-Pausentimer wird in getrennten Minuten-/Sekundenfeldern eingestellt.

Die Streak wird ausschließlich aus der vorhandenen Workout-Historie berechnet. Home lädt sie beim Öffnen bzw. nach dem Abschluss erneut. Ein einzelner Timeout bis zur nächsten lokalen Mitternacht und die Rückkehr aus dem Hintergrund aktualisieren die Tagesanzeige; beim Verlassen des Screens wird der Timeout entfernt. Es gibt keine separate Streak-Persistenz, Rewards oder zusätzlichen Hintergrundabfragen.

## Späteres Hetzner-Hosting

Die ausschließlich vorbereitete Docker-/HTTPS-/Backup-Konfiguration und alle manuellen
Umzugsschritte stehen in [docs/HETZNER_DEPLOYMENT.md](docs/HETZNER_DEPLOYMENT.md).
Vor Internetfreigabe die offenen Befunde in
[docs/HETZNER_SECURITY_REVIEW.md](docs/HETZNER_SECURITY_REVIEW.md) bearbeiten.
Der lokale Entwicklungsworkflow verwendet weiterhin die bestehenden `.env`-Dateien.
