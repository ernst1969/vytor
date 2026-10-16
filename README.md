# Vytor

Vytor ist eine mobile Trainings-App für iOS und Android mit zusätzlichem Web-Ziel. Sie verbindet Workout-Tracking mit Trainingshistorie und Freundschaftsfunktionen. Dieses Dokument beschreibt den untersuchten Repository-Stand vom 16. Oktober 2026 und dient als Einstieg für zukünftige Entwicklungsarbeit. Verbindliche Arbeitsregeln stehen in [AGENTS.md](AGENTS.md).

Die priorisierten nächsten Arbeitsschritte stehen in [TODO.md](TODO.md); abgeschlossene Änderungen werden im [CHANGELOG.md](CHANGELOG.md) dokumentiert.

## Funktionsumfang

- Registrierung und Anmeldung mit Benutzername und Passwort; lokale Speicherung der Benutzer-ID.
- Workouts aus einer Vorlage oder einer eigenen Übungsauswahl starten.
- Übungen und Sätze bearbeiten, Sätze abschließen, Pausentimer nutzen und frühere Übungswerte anzeigen.
- Trainingshistorie, Workout-Details und Profilansichten.
- Benutzersuche, Freundschaftsanfragen, Freundesliste und Trainingsfeed.
- Einstellungen mit Abmeldung.

Die Funktionen sind im Code angelegt. Der aktuelle Stand hat bekannte Integrations- und Typfehler; die Aufzählung ist keine Zusicherung, dass alle Abläufe fehlerfrei funktionieren.

## Technik und Aufbau

| Bereich | Umsetzung |
| --- | --- |
| App | Expo SDK 57 (`expo: ~57.0.30`), React 19.2.3, React Native 0.86.3, TypeScript 6 |
| Navigation | Expo Router, Einstieg über `expo-router/entry`, Routen in `src/app/` |
| Zustand | React Context für aktive Workouts; AsyncStorage für `vytor_user_id` |
| Darstellung | React-Native-Komponenten und StyleSheet, Farben in `src/constants/theme.ts` |
| Backend | Express 5, TypeScript, Entwicklung mit `tsx watch` |
| Datenbank | PostgreSQL, Prisma 7 mit `@prisma/adapter-pg` |
| Passwörter | Hashing mit `bcryptjs` |
| Paketverwaltung | npm; getrennte `package-lock.json` im Root und in `server/`, kein Bun-Lockfile |

```text
src/
  app/                      Screens und Router-Layouts
    _layout.tsx             WorkoutProvider, Benutzerprüfung, Stack und Navigationstheme
    index.tsx               Einstieg in die Tabs
    (tabs)/                 Home, Friends, Profile, Settings; Workout-Header
    create-user.tsx         Registrierung
    login.tsx               Anmeldung
    workout-setup.tsx       Vorlagen und Trainingsstart
    exercise-picker.tsx     Übungsauswahl und Austausch
    workout-detail.tsx      Details eines Trainings
    user-profile.tsx        Profil eines anderen Benutzers
    explore.tsx             Zusätzliche Route aus dem Starter-Kontext
  context/workout-context.tsx  Aktives Training, Sätze, Einheiten und Pausen
  services/api.ts           HTTP-Aufrufe und API-Typen; aktuell feste Backend-Adresse
  components/               UI-Bausteine, teilweise mit .web.tsx-Varianten
  constants/theme.ts        Farben, Schriften und Abstände
  hooks/                    Theme- und Farbschema-Hooks
  global.css                Web-Stile
server/
  src/index.ts              Sämtliche Express-Endpunkte und Geschäftslogik
  prisma/schema.prisma      Deklaratives Datenmodell
  prisma/migrations/        SQL-Migrationshistorie
  prisma/seed.ts            Übungskatalog und „Starter Workout“
  prisma.config.ts          Schema-/Migrationspfade und DATABASE_URL
assets/                     Icons, Bilder und Expo-Assets
app.json                    Expo-Konfiguration
scripts/reset-project.js    Setzt den App-Code auf einen leeren Starter zurück
```

Es gibt keine npm-Workspace-Konfiguration: App und Server werden separat installiert und gestartet. Native Verzeichnisse `ios/` und `android/` sind nicht eingecheckt. Eine `eas.json` und CI-Konfiguration sind nicht vorhanden. Serverseitige Tests laufen mit `npm test`.

## Lokal einrichten

Voraussetzungen: Node.js mit npm, eine zur eingesetzten Expo-Version passende Node-Version, eine erreichbare PostgreSQL-Instanz und ein Mobilgerät bzw. Simulator/Emulator oder Browser. Im Repository ist keine Node-Version festgeschrieben.

### 1. Abhängigkeiten installieren

Im Projektverzeichnis:

```bash
npm ci
cd server
npm ci
```

### 2. Datenbank konfigurieren

In `server/.env` eine eigene Verbindungsadresse hinterlegen, beispielsweise:

```dotenv
DATABASE_URL="postgresql://vytor:password@localhost:5432/vytor?schema=public"
```

Dies ist ein Beispiel, kein vorhandener Zugang. PostgreSQL, Datenbank und Benutzer müssen zuvor eingerichtet sein. Zugangsdaten gehören nicht ins Repository; `.env` ist ignoriert. Der Server und Prisma laden die Variable über `dotenv/config`, daher Server-Kommandos aus `server/` ausführen.

Danach sind aus `server/` die vorgesehenen Schritte:

```bash
npx prisma migrate deploy
npx prisma generate
npx tsx prisma/seed.ts
npm run dev
```

Der Seed legt Übungen per Name an oder aktualisiert sie und baut die Übungszuordnung der Vorlage „Starter Workout“ neu auf. Ein Seed-Kommando ist in `prisma.config.ts` derzeit nicht registriert.

Für neue, beabsichtigte Schemaänderungen auf einer Entwicklungsdatenbank `npx prisma migrate dev --name <name>` verwenden. Bestehende Migrationen und Datenbankzustand zuvor prüfen; `prisma generate` generiert aus dem aktuellen Schema und behebt dessen Abweichungen zu SQL und Anwendungscode nicht.

### 3. Backend-Adresse und App starten

Die App liest die öffentliche Expo-Variable:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

Die Beispiele stehen in `.env.example` und `server/.env.example`. Die Adresse an den Entwicklungsrechner anpassen. Ein echtes Smartphone muss den Rechner erreichen können, typischerweise im selben WLAN; `localhost` auf dem Smartphone bezeichnet das Smartphone selbst. Der Server hört an `0.0.0.0` und verwendet `PORT`, standardmäßig `3000`.

In einem zweiten Terminal im Projektverzeichnis:

```bash
npm start
```

Weitere vorhandene Startskripte:

```bash
npm run android
npm run ios
npm run web
```

Backend prüfen:

```bash
curl http://localhost:3000/api/health
```

Der Health-Endpunkt bestätigt nur, dass Express antwortet; er prüft keine Datenbankverbindung. Ein vollständiger Lauf mit Datenbank und Endgerät wurde für diese Analyse nicht durchgeführt.

## Datenfluss und wichtige Verträge

1. Registrierung oder Login erstellen eine 30 Tage gültige serverseitige Session. Die App speichert Benutzer-ID und Bearer-Token lokal.
2. Das Root-Layout prüft die Session über `getUser`. Nur eine ungültige/abgelaufene Session entfernt die lokale Anmeldung; ein vorübergehender Netzwerkfehler tut dies nicht.
3. `WorkoutProvider` erstellt beim Trainingsstart ein Backend-Workout und hält aktive Übungen, Satzwerte, Startzeit und Pausenende im React-Zustand.
4. Vorherige Sätze werden über den Endpunkt für das letzte abgeschlossene Training der jeweiligen Übung geladen.
5. Beim Trainingsabschluss sendet der Context nur als abgeschlossen markierte Sätze. Das Backend speichert Satzdaten und setzt `endedAt`; die Historie enthält abgeschlossene Workouts.

Aktive Trainingsdaten werden lokal gesichert und mit dem noch offenen Backend-Workout abgeglichen. Hinzufügen, Entfernen, Ersetzen und Umordnen werden im Backend synchronisiert; ein Workout kann ausdrücklich verworfen werden.

Die Anwendung verwendet `WEIGHT_REPS`, `REPS`, `DISTANCE_TIME`, `TIME` und `WEIGHT_DISTANCE`. Gewichte werden beim Abschluss nach Kilogramm, Distanzen nach Kilometern normalisiert; Zeiten werden als Sekunden gespeichert. Änderungen an Einheiten müssen Eingabe, Speicherung und Historienanzeige gemeinsam berücksichtigen.

Das relationale Modell umfasst Benutzer, Übungen, Workout-Vorlagen mit geordneten Übungen, Workouts mit geordneten Übungen und Sätzen sowie Freundschaftsanfragen. `endedAt = null` kennzeichnet ein noch nicht abgeschlossenes Workout. Übungszuordnungen und Satznummern besitzen zusammengesetzte Eindeutigkeitsregeln.

### API-Übersicht

Alle Routen stehen in `server/src/index.ts`; der App-Client liegt in `src/services/api.ts`.

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/api/health` | Erreichbarkeit |
| POST | `/api/users`, `/api/login` | Registrierung und Anmeldung |
| GET | `/api/users/search` | Suche mit `query` und `userId` |
| GET | `/api/users/:id`, `/api/users/:id/public` | Benutzer und öffentliches Profil |
| GET | `/api/exercises`, `/api/templates` | Übungskatalog und Vorlagen |
| POST | `/api/workouts` | Training mit `userId`, optionaler Vorlage und Übungen erstellen |
| POST | `/api/workouts/:id/exercises` | Übung hinzufügen |
| PATCH | `/api/workout-exercises/:id/settings` | Einheiten einer Übungszuordnung ändern |
| POST | `/api/workouts/:id/finish` | Sätze speichern und Training beenden |
| GET | `/api/workouts/:userId` | Abgeschlossene Trainings |
| GET | `/api/exercises/:exerciseId/last-workout` | Vorherige Übungswerte, mit `userId` |
| GET | `/api/friends/:userId` | Freunde |
| GET | `/api/friends/:userId/requests` | Offene Anfragen |
| POST | `/api/friends/request` | Anfrage mit `requesterId` und `recipientId` |
| POST | `/api/friends/requests/:id/accept`, `/api/friends/requests/:id/reject` | Anfrage beantworten, mit `userId` |
| GET | `/api/friends/:userId/feed` | Trainingsfeed |

Private API-Routen verlangen eine serverseitig gespeicherte Bearer-Session. Ressourcen werden gegen den angemeldeten Benutzer geprüft.

## Prüfstand

Bei der Analyse ausgeführte Prüfungen:

```bash
npx expo lint
npx tsc --noEmit
npx tsc --noEmit -p server/tsconfig.json
cd server && npm test
npx prisma validate
```

Diese Prüfungen bestehen im aktuellen Stand. Das Migrationsschema wurde zusätzlich offline aus einem leeren Schema erzeugt. Eine echte PostgreSQL-Migration und Endgeräteprüfung benötigen eine konfigurierte Datenbank beziehungsweise Geräte und bleiben Teil der Release-Prüfung.

## Regeln für zukünftige Arbeit

- Zu Beginn `AGENTS.md`, diese README, `package.json` und den Git-Status lesen. Versionsangaben und bekannte Probleme bei relevanten Änderungen aktualisieren.
- Vor Änderungen an Expo-, React-Native- oder EAS-APIs die installierte Expo-Hauptversion bestimmen und die [passenden SDK-57-Dokumente](https://docs.expo.dev/versions/v57.0.0/) abrufen. Für weitere Expo-Themen zuerst den [Dokumentationsindex](https://docs.expo.dev/llms.txt) lesen und dessen Links folgen.
- Screens und Layouts in `src/app/` halten; wiederverwendbare Komponenten, Hooks und Hilfsfunktionen außerhalb des Routenverzeichnisses ablegen. Navigation über Expo Router umsetzen.
- Mobile Bedienung, Tastatur, Safe Areas, Leistung und plattformübergreifendes Verhalten berücksichtigen. Vorhandene Web-Varianten beachten.
- App-Abhängigkeiten mit `npx expo install <package>` ergänzen, damit SDK-kompatible Versionen aufgelöst werden. Bei einem späteren Wechsel zu Bun mit `bun.lock` gemäß `AGENTS.md` `bunx` verwenden.
- Native Konfiguration in `app.json` und Config-Plugins vornehmen; generierte native Verzeichnisse nicht von Hand anlegen oder ändern. Neue native Bibliotheken können einen Development Build erfordern.
- Datenmodelländerungen einschließlich Migrationen, Seed, API-Typen und Einheitenkonvertierung prüfen. Keine Datenbankänderungen allein zur Dokumentationsprüfung ausführen.
- Vor Abschluss Lint und Typecheck ausführen; bestehende Fehler und Einschränkungen ausdrücklich melden. Für Funktionsänderungen zusätzlich Registrierung/Login, Trainingsstart, Satzabschluss, Trainingsende und relevante Profil-/Freundesansichten auf dem Zielgerät prüfen.
- Builds, Signierung, Submission und OTA-Updates gemäß `AGENTS.md` über EAS abwickeln. Eine EAS-Konfiguration muss hierfür noch eingerichtet werden.
- `npm run reset-project` nicht als Wartungsbefehl verwenden: Das Skript verschiebt oder löscht `src/` und `scripts/` und erzeugt einen leeren App-Starter.
