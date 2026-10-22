# Vytor – Code Freeze Handoff

Stand: 22.10.2026. Dies ist die letzte Code-Übergabe vor der praktischen Docker-/Hetzner-Staging-Abnahme. Kein Commit, Push, Deploy, DNS-, EAS- oder anderer Cloud-Vorgang wurde ausgeführt.

## A. Repository-Zustand

- Basiscommit und aktueller `HEAD`: `68999e91837e4e2b33d23607d9698f0610aa01ee`.
- Git-Status: absichtlich dirty; nach Erstellung dieses Dokuments 49 geänderte oder neue Pfade. Der geprüfte Release Candidate ist `HEAD` plus genau dieser Arbeitsbaum und noch kein unveränderlicher Release-Commit.
- R5-geändert: `src/app/(tabs)/settings.tsx`, `src/services/api.ts`, `src/context/workout-context.tsx`, `scripts/account-deletion.integration.test.ts`, `scripts/api-session-races.test.ts`, `scripts/workout-provider.integration.test.ts`, neu `scripts/settings-account-actions.test.ts` sowie README, CHANGELOG, TODO, Tech Stack, Release Checklist, Deployment Readiness und dieses Dokument.
- Weitere uncommittete Pfade gehören zu den erhaltenen Hardening-Runden R1–R4. Die vollständige Liste ist mit `git status --short` reproduzierbar; keine vorhandene Änderung wurde zurückgesetzt.
- Lockfiles: `package-lock.json` und `server/package-lock.json` bestimmen die Clean-Installationen; `npm ci` für Root und Server war erfolgreich. In R5 wurde keine Abhängigkeit ergänzt und kein Lockfile bewusst geändert.
- Migrationen: unverändert zwölf Migrationen. Relevant zuletzt `20261021120000_stable_drop_sets` und `20261021121000_case_insensitive_usernames`; R5 fügt keine Schemaänderung hinzu.
- Versionen: Node.js 24.21.0, npm 12.2.0, Expo 57.0.31, React Native 0.86.3, Prisma Client/CLI 7.10.1, PostgreSQL 18.6.
- Testumgebung: lokales Linux, temporärer isolierter PostgreSQL-18.6-Cluster unter `/tmp`; kein Docker/Caddy/VPS, keine Domain, kein EAS-Konto und keine realen Mobilgeräte.

### Release-Commit nach Freigabe festhalten

Der folgende Ablauf ist erst nach unabhängiger Prüfung aller 49 Pfade auszuführen:

```bash
git status --short
git diff --check
git diff --stat
git add -A
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "fix: freeze account-isolated release candidate"
git rev-parse HEAD
git status --short
```

Vor dem Commit muss der vollständige staged Diff mit dieser Übergabe übereinstimmen. Der neue Hash wird anschließend als `VYTOR_RELEASE` für Staging verwendet. Es wurde in dieser Runde absichtlich keiner dieser schreibenden Git-Schritte ausgeführt.

## B. R5-01 – Account Deletion Session Race

### Root Cause

`accountAction()` führte zwischen Nutzerbestätigung und `deleteAccount()` einen dynamischen Import aus. `deleteAccount()` ermittelte danach Account-ID und Token neu aus der global aktuellen Session. Damit konnte eine unter A bestätigte Löschung nach A→B als B-Request versendet werden. Passwortänderung nutzte denselben ungebundenen generischen Requestpfad. Die UI navigierte nach jeder erfolgreichen Promise zu Login, unabhängig davon, welche Session inzwischen aktuell war.

### Fix und geänderte Funktionen

- `SettingsScreen.load()` erfasst mit `captureCurrentSessionRequestBinding()` Account und Token und lädt Settings unter genau dieser Bindung. Ein Resultat wird nur übernommen, wenn sie noch aktuell ist.
- `openAccountDialog()` erfasst beim Öffnen der sichtbaren Bestätigung erneut die Identität und vergleicht Account und Token mit dem Screen-Snapshot. Ein Wechsel während dieses Captures bricht ab; A→B→A mit neuem Token bleibt stale.
- Der Dialog speichert das unveränderliche Binding. `accountAction()` übergibt es verpflichtend an `deleteAccount`, `changePassword` oder `logoutUser` und besitzt eine synchrone In-Flight-Sperre gegen doppelte Callbacks.
- Der interne Fetch-Wrapper prüft unmittelbar vor Versand gespeicherte Account-ID und erworbenen Token gegen das Binding. Nach erfolgreicher Prüfung wird der Header aus dem gebundenen Token gebildet; ein bereits gesendeter A-Request kann nicht auf B wechseln.
- `deleteAccount()` setzt nach bestätigtem Servererfolg ausschließlich A's Tombstone, bereinigt A und compare-cleart Credentials nur bei Übereinstimmung von A-Token und A-ID. `changePassword()` verwendet denselben vollständigen Identity-Compare.
- Beide Funktionen liefern `sessionCleared`. Settings navigiert nur bei `true`; eine verspätete A-Antwort kann B nicht auf `/login` schicken. Stale Fehler werden in B nicht angezeigt, sensitive Eingaben und alte Settings werden bei Sessionereignissen verworfen.
- Das bestätigte Delete-Ereignis enthält immer A's ID. Ist B bereits aktiv, reiht der `WorkoutProvider` ausschließlich einen A-Purge hinter offene Storage-Writes ein und lässt B-State, B-Draft, B-Revision und B-Session unverändert.

## C. Regressionstests und tatsächliche Ergebnisse

| Datei/Szenario | Ausgeführter Befehl | Exit | Ergebnis |
| --- | --- | ---: | --- |
| `settings-account-actions.test.ts`: normaler A-Delete, genau ein Request trotz doppeltem Confirm, Login-Navigation nur nach A-Clear | `npm run test:ui` | 0 | PASS |
| dieselbe Datei: A-Dialog → B mit gleichem Passwort vor Versand | `npm run test:ui` | 0 | PASS; kein DELETE-Netzwerkaufruf, keine Navigation |
| dieselbe Datei: Wechsel während Identity-Capture | `npm run test:ui` | 0 | PASS; Dialog/Mutation nicht aktiviert |
| dieselbe Datei: A-DELETE in flight → B → A-Erfolg | `npm run test:ui` | 0 | PASS; A-Binding bleibt, B wird nicht navigiert |
| `account-deletion.integration.test.ts`: Erfolg, 403, A→B, A→B→A, Capture-Race, gleicher Passwortwert, Netzwerkfehler, wiederholter stale Callback | `npm run test:ui` | 0 | PASS |
| `api-session-races.test.ts`: Logout/401/Preset sowie Passwortwechsel vor und nach Versand | `npm run test:ui` | 0 | PASS |
| `workout-provider.integration.test.ts`: Delete/Purge mit offenem A-Write vor und nach aktivem B | `npm run test:ui` | 0 | PASS; A nicht wiederhergestellt, B unverändert |
| vollständige App-/Settings-/Provider-/Race-Suite | `npm run test:ui` | 0 | 90/90 PASS, 0 FAIL |
| Backend-Unit-/Security-/Validation-Suite | `npm --prefix server test` | 0 | 17/17 PASS, 0 FAIL |
| isolierte DB-/HTTP-/Restore-Suite | `npm --prefix server run test:isolated` | 0 | PASS: PostgreSQL 18.6, zwölf Migrationen, Rollen, DML/DDL-Grenzen und 10→12-Restore |
| Root Clean Install | `npm ci` | 0 | PASS; 837 Pakete, ein von npm blockiertes optionales `unrs-resolver`-Installskript, nachfolgende Gates grün |
| Server Clean Install | `npm --prefix server ci` | 0 | PASS; 241 Pakete, Prisma generiert, 0 Advisories |
| Lint | `npm run lint` | 0 | PASS, keine Warnungen im finalen Lauf |
| App-Typecheck | `npx tsc --noEmit` | 0 | PASS |
| Server-Typecheck | `npx tsc -p server/tsconfig.json --noEmit` | 0 | PASS |
| Server-Build | `npm --prefix server run build` | 0 | PASS |
| Expo-Projektprüfung | `npx expo-doctor` | 0 | 21/21 PASS |
| HTTPS-Release-Export | `env NODE_ENV=production EXPO_PUBLIC_API_URL=https://api.vytor.example npx expo export --platform all --output-dir /tmp/vytor-r5-export` | 0 | Android/iOS/Web PASS |
| HTTP-Negativexport | `env NODE_ENV=production EXPO_PUBLIC_API_URL=http://api.vytor.example npx expo export --platform all --output-dir /tmp/vytor-r5-http-negative` | 1 erwartet | PASS; explizite HTTPS-Guard-Meldung |
| Deployment-Shellsyntax | `bash -n deployment/compose.sh deployment/backup.sh deployment/restore.sh deployment/postgres/init-roles.sh` | 0 | PASS |
| Compose-YAML-/Policy-Prüfung | lokales Node/YAML-Prüfskript | 0 | PASS; db/api/migrate/caddy, internes DB-Netz, nur Caddy veröffentlicht Ports |
| CI-Testaufnahme | `rg -n "test:ui\|test:isolated\|expo export" .github/workflows/checks.yml` | 0 | PASS; `scripts/*.test.ts` einschließlich R5 wird durch `test:ui` erfasst; Hosted-CI selbst NOT RUN |
| Docker-/Caddy-Runtime | `command -v docker` | – | BLOCKED; Docker ist nicht installiert |

Nicht als finale Gates gewertete Zwischenläufe: Ein `test:ui`-Versuch endete mit Exit 1, weil die Sandbox den `tsx`-IPC-Socket unter `/tmp` verweigerte; derselbe Befehl lief anschließend freigegeben erfolgreich. Der erste neue Settings-Harness-Lauf hatte 86 PASS/4 FAIL, weil das Testskript das eingeklappte Delete-Panel nicht öffnete; nach Korrektur der realen Interaktionsreihenfolge bestanden 90/90. Ein früher Lint-Lauf meldete den initialen Effect-Aufbau; die Implementierung wurde angepasst, der finale Lint-Lauf ist sauber.

## D. Sicherheitsinvarianten

- **A kann keine destruktive Aktion unter B ausführen:** Bestätigungsdialog und API verlangen dasselbe Account-/Token-Snapshot. Ein anderer Account oder eine neue Session wird vor Netzwerkzugriff abgewiesen. Gleiches Passwort ändert diese Autorisierungsgrenze nicht.
- **Verspätete Antworten löschen keine neue Session:** Cleanup verwendet `clearSessionCredentialsIfIdentityCurrent({userId, token})`. B oder eine neue A-Session stimmt nicht überein. Navigation hängt ausschließlich am zurückgegebenen `sessionCleared`.
- **Alte Accounts verändern keine neuen Account-Daten:** Serverantwort und lokaler Cleanup beziehen sich auf die im Binding gespeicherte A-ID. Provider-Ereignisse für ein nicht aktuelles A führen nur A-Purge aus und verändern B-State nicht.
- **Bestätigte Löschung stellt keine A-Daten wieder her:** Tombstone wird vor Cleanup geschrieben. Provider-Writes prüfen ihn fail-closed; ein bereits laufender Write wird durch den hinter ihm eingereihten accountbezogenen Purge entfernt. Startup wiederholt abgebrochene Purges.
- **Offline-Drafts bleiben zuverlässig erhalten:** Logout, Netzwerkfehler und abgewiesener Delete löschen keinen accountgebundenen Draft. Nur bestätigter Save, Finish, bewusstes Discard oder serverbestätigte Account-Löschung bereinigen den dokumentierten Zielaccount.

## E. Release-Gates

| Gate | Status | Begründung |
| --- | --- | --- |
| `CODE_READY` | **PASS** | R5-01 und angrenzender Passwortpfad behoben; 90 App-/Race- und 17 Backend-Tests, DB, Lint, Typechecks, Build, Doctor und Exporte bestanden; kein bekannter kritischer/hoher konkreter Code-Blocker |
| `STAGING_READY` | **NO – nächster Schritt** | Runbook und Konfiguration statisch vorbereitet, aber kein realer Docker-/Caddy-Stack mit Testdaten ausgeführt |
| `INFRA_READY` | **NO** | Hetzner-VPS, DNS, TLS, Firewall, Monitoring und Offsite-Restore nicht geprüft |
| `DEPLOYED` | **NO** | Kein Deployment ausgeführt |
| `PRODUCTION_APPROVED` | **NO** | Infrastruktur-, Backup-, Geräte-, EAS- und Betreiberfreigaben fehlen |

**Code-Freeze-Bewertung: CODE READY – PROCEED TO DOCKER STAGING.**

## F. Verbleibende manuelle Abnahmen

- Docker-/Caddy-Staging mit isolierten Testdaten gemäß `DEPLOYMENT_RUNBOOK.md`.
- Hetzner-VPS, DNS, HTTPS-Zertifikat/-Erneuerung, UFW/Cloud-Firewall, IPv6 und externe Portprüfung.
- Verschlüsseltes Restic-Offsite-Backup, Alarmierung und vollständiger Restore auf separater Infrastruktur mit gemessenem RPO/RTO.
- Externes Uptime-, Zertifikats-, Ressourcen-, Container- und Backup-Monitoring.
- Reale Android-/iOS-Gerätetests für SecureStore, Accountaktionen, Offline-Drafts, Background, Prozessende, Backup/Reinstall, Zweigeräte-Konflikte und Accessibility.
- EAS-Projekt, Identifier, Signierung, Preview-/Production-Builds und Store-Metadaten.
- Datenschutz-/Retention-/Private-Beta-/Incident-Verantwortung durch Betreiber beziehungsweise Rechtsprüfung.
- Root-Dependency-Risiko: die bereits dokumentierten Expo/Metro-/Router-Transitiv-Advisories vor Storefreigabe gegen kompatible SDK-Patches neu bewerten; kein ungeprüfter Major-Wechsel im Freeze.

Das Runbook beschreibt den isolierten Ablauf bereits vollständig: Testsecrets, `compose config`, getrennte API-/Migration-Images, DB-Start, Migration, API/Caddy, Health/Ready, Header-Spoofing, Restart/Shutdown, Portprüfung, Persistenz und Reconnect. Docker bleibt bis zur tatsächlichen Ausführung `BLOCKED`.
