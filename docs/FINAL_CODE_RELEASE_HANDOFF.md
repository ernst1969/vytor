# Vytor – Final Code Release Handoff

> Historischer R4-Stand. Die maßgebliche letzte Code-Übergabe ist `docs/CODE_FREEZE_HANDOFF.md`.

Stand: 22.10.2026. Diese Datei dokumentiert die damalige R4-Übergabe des Code-Release-Kandidaten. Es wurde kein Commit, Push, Deploy, EAS- oder sonstiger Cloud-Vorgang ausgeführt.

## A. Projektstand

- Basiscommit: `68999e91837e4e2b33d23607d9698f0610aa01ee`.
- Aktueller `HEAD`: `68999e91837e4e2b33d23607d9698f0610aa01ee`.
- Arbeitsbaum: absichtlich dirty; der Release-Kandidat besteht aus `HEAD` plus 47 geänderten beziehungsweise neuen Pfaden einschließlich dieser Übergabe. Vorhandene Änderungen aus den vorherigen Hardening-Runden wurden erhalten.
- Versionen: Node.js 24.21.0, npm 12.2.0, Expo 57.0.31, React Native 0.86.3, Prisma Client/CLI 7.10.1, PostgreSQL-Testserver 18.6.
- Geänderte Bereiche: `.github/workflows/checks.yml`, Root-Konfiguration/Lockfile, `src/app/`, `src/context/`, `src/services/`, `src/utils/`, `scripts/*.test.ts`, Server-Paket/Validierung/Tests/Integrationsharness, Prisma-/Deployment-Skripte sowie README, CHANGELOG, TODO und Release-/Deployment-Dokumente. Die exakte maschinenlesbare Liste liefert `git status --short`.
- R4-spezifisch: `src/services/session-store-core.ts`, `src/services/session-store.ts`, `src/services/api.ts`, `src/services/account-local-data.ts`, `src/context/workout-context.tsx`, `src/app/(tabs)/index.tsx`, `src/app/(tabs)/settings.tsx`, `scripts/session-store.test.ts`, `scripts/api-session-races.test.ts`, `scripts/account-local-data.test.ts`, `scripts/account-deletion.integration.test.ts` und `scripts/workout-provider.integration.test.ts` sowie die aktualisierte Dokumentation.

Der Zustand ist eindeutig, aber noch nicht versioniert. Für Staging muss nach unabhängiger Diff-Prüfung ein freigegebener Commit erzeugt und dessen Hash als `VYTOR_RELEASE` verwendet werden.

## B. Letzte Findings

### R4-01 – Save-Preset Session Race (HIGH)

**Ursache:** Der dynamische Import in `savePreset()` bildete eine Await-Grenze vor dem mutierenden Request. Danach bezog `createWorkoutTemplate()` den aktuellen globalen Token. A-Payload konnte so nach A→B unter B gesendet werden; reine Account-ID-Prüfung hätte A→B→A nicht erkannt.

**Fix:** `savePreset()` erfasst `WorkoutOperationIdentity`, Session-Generation und den vollständigen Template-Payload synchron vor dem ersten Await. `captureSessionRequestBinding()` liest Account-ID und Token atomar aus der Session-Queue. Der Fetch-Wrapper prüft Account und – falls erfasst – Token nochmals vor Versand und verwendet für Header und Cleanup ausschließlich dieses Snapshot. Wechsel vor Versand brechen ohne Request ab; ein laufender A-Request behält den A-Bearer. `savePreset()` liefert nur in derselben Provider-Generation Erfolg, und der Home-Screen zeigt andernfalls keine alte Meldung.

**Funktionen:** `savePreset`, `captureSessionRequestBinding`, `createWorkoutTemplate`, interner API-`fetch`.

**Tests/Ergebnis:** Normalfall genau einmal, Wechsel während Identity-Capture, Wechsel nach Requeststart, A→B→A, aktueller und staler Fehler sowie Header-Bindung: PASS in der 79/79-Suite.

### R4-02 – Tokenless Logout Race (MEDIUM/HIGH)

**Ursache:** Bei fehlendem Request-Token nutzte Logout ein unbedingtes Credential-Cleanup. Ein nachträglich fertig werdender Logout konnte deshalb eine nach seinem Start gespeicherte Session entfernen.

**Fix:** `SessionCredentialStore.getIdentity()` und `clearIfIdentity()` serialisieren Lesen und exakten Vergleich von Token plus User-ID. `logoutUser()` erfasst diese Identität vor dem Netzwerkzugriff, bindet den Request daran und löscht im `finally` ausschließlich dieselbe Identität. Netzwerkfehler verhindern das lokale Logout der erfassten Session nicht. Wurde inzwischen B oder eine neue A-Session gespeichert, bleiben Credentials, Listener und Navigation unverändert. Settings navigiert nur, wenn die erfasste lokale Session tatsächlich beendet ist.

**Funktionen:** `getSessionIdentity`, `clearSessionCredentialsIfIdentityCurrent`, `SessionCredentialStore.clearIfIdentity`, `logoutUser`.

**Tests/Ergebnis:** Logout mit/ohne Token, B-Login, erneuter A-Login mit neuem Token, mehrfacher Logout, Netzwerkfehler, Login parallel zu Logout und verspäteter 401: PASS in Service- und API-Race-Tests.

### R4-03 – Tombstone Fail-closed (MEDIUM)

**Ursache:** `deletedAccounts()` fing Lesen und Parsen gemeinsam ab und gab `[]` zurück. Ein unbekannter Barrierezustand wurde dadurch mit „kein Account gelöscht“ gleichgesetzt.

**Fix:** Nur ein verifiziert fehlender Storage-Eintrag bedeutet leere Liste. GetItem-Fehler, ungültiges JSON, Nicht-Array und Nicht-String-Einträge erzeugen `AccountDeletionBarrierError`. Provider-Writes propagieren diese Barriere und persistieren nichts; beschädigte Marker werden nicht überschrieben. Die serialisierte Write-Queue markiert die Rejection als behandelt, bewahrt sie aber für Flush/Diagnose und kann nach einem späteren erfolgreichen Read wieder arbeiten. Tombstone-vor-Cleanup, maximale 20 IDs und idempotenter Startup-Purge bleiben bestehen.

**Funktionen:** `deletedAccounts`, `isAccountDeleted`, `markAccountDeleted`, `purgeDeletedAccountLocalData`, Provider-`queueLocalWrite`.

**Tests/Ergebnis:** Kein/gültiger Marker, Storage-Read-Fehler, beschädigtes JSON/Schema, Tombstone-Write-Fehler, verifizierter Retry, offene Write-Queue, Restart, B-Isolation und mehrfacher Purge: PASS.

## C. Cross-Account-Invarianten

- **A-Daten werden nicht unter B gespeichert:** Jeder Preset-Payload und jede Workout-Mutation erfasst Account und Session-Generation vor Await. Preset-Fetch prüft zusätzlich das exakte Account-/Token-Snapshot vor Versand. Bereits begonnene Requests besitzen einen unveränderlichen Header. Provider-Ergebnisse schreiben nur bei unveränderter Session-/Workout-Generation.
- **Alte Logouts löschen keine neuen Sessions:** Credential-Lesen, Login, 401-Cleanup und Logout-Cleanup laufen in einer Queue. `clearIfIdentity()` verlangt Übereinstimmung beider Startfelder. Tokenlos bedeutet `token:null`, nicht globale Löschberechtigung.
- **Gelöschte Accounts werden nicht lokal wiederhergestellt:** Der Tombstone wird nach Serverbestätigung vor dem Cleanup geschrieben. Jeder Draft-Write prüft ihn innerhalb der serialisierten Storage-Kette. Unlesbarer oder korrupter Zustand ist fail-closed. Ein Restart wiederholt den kontospezifischen Purge; andere Accounts bleiben unberührt.
- **Alte Workout-Antworten überschreiben keinen neuen State:** Operationen erfassen Account-ID, Workout-ID, Session- und Workout-Generation. Guards nach Await und Mutation-Owner verhindern State-, Revision-, Syncstatus- und Cleanup-Schreibvorgänge in eine neuere Lifecycle-Generation. A→B→A bleibt wegen der Generation eindeutig stale.

## D. Frisch ausgeführte Testnachweise

| Testkommando | Exitcode | Testanzahl/Status | Aussagekraft und Grenze |
| --- | ---: | --- | --- |
| `npm ci` | 0 | PASS | Reproduzierbare Root-Installation; npm blockierte ein nicht freigegebenes optionales `unrs-resolver`-Installskript, Build/Tests blieben grün |
| `npm --prefix server ci` | 0 | PASS | Reproduzierbare Serverinstallation; Prisma Client 7.10.1 generiert, Audit dieser Installation 0 Advisories |
| `npm run lint` | 0 | PASS | Expo/ESLint für `src`; keine native Laufzeitprüfung |
| `npx tsc --noEmit` | 0 | PASS | App-Typecheck |
| `npx tsc -p server/tsconfig.json --noEmit` | 0 | PASS | Server-Typecheck |
| `npm --prefix server run build` | 0 | PASS | Production-TypeScript-Build |
| `npm --prefix server test` | 0 | 17/17 PASS, 0 FAIL | Backend-Regeln, Security, Validatoren; isoliert ohne externen Proxy |
| `npm run test:ui` | 0 | 79/79 PASS, 0 FAIL | Echte Provider-/Service-Pfade, kontrollierte Session-/Storage-/API-Races; React-Test-Renderer statt reales Gerät |
| `npm --prefix server run test:isolated` | 0 | Gesamtharness PASS | PostgreSQL 18.6, 12 Migrationen, HTTP-Funktionen, Least Privilege sowie 10→12 Altstand-Dump/Restore; temporärer lokaler Cluster, kein VPS |
| `npx expo-doctor` | 0 | 21/21 PASS | Expo-Projekt-/Dependency-Konsistenz; kein nativer Build |
| `env NODE_ENV=production EXPO_PUBLIC_API_URL=https://api.vytor.example npx expo export --platform all --output-dir /tmp/vytor-r4-export` | 0 | Android/iOS/Web PASS | Release-Bundling und HTTPS-Konfiguration; keine Geräteinteraktion |
| `env NODE_ENV=production EXPO_PUBLIC_API_URL=http://api.vytor.example npx expo export --platform all --output-dir /tmp/vytor-r4-http-negative` | 1 erwartet | PASS (Negativtest) | Release-Guard verweigert HTTP mit der erwarteten Fehlermeldung |
| `bash -n deployment/compose.sh deployment/backup.sh deployment/restore.sh deployment/postgres/init-roles.sh` | 0 | PASS | Shellsyntax; keine externe Runtime |
| lokales YAML-/Policy-Prüfskript für `compose.production.yml` | 0 | PASS | Dienste db/api/migrate/caddy, internes DB-Netz und ausschließlich Caddy-Ports statisch bestätigt |
| `git diff --check` | 0 | PASS | Finaler Arbeitsbaum einschließlich Übergabedokumentation ohne Whitespace-Fehler |
| Docker-/Compose-/Caddy-Runtime | – | BLOCKED | `docker` ist nicht installiert; kein Container-, Proxy-, TLS- oder Shutdown-Nachweis |

Die GitHub-Workflowdatei führt `npm run test:ui` aus und erfasst damit automatisch alle neuen `scripts/*.test.ts`. Sie enthält außerdem Backend-/DB-Gates sowie positiven HTTPS- und erwarteten negativen HTTP-Export. Der Hosted-CI-Lauf selbst wurde in dieser lokalen Runde nicht ausgelöst.

## E. Infrastrukturstatus

| Bereich | Status | Nachweis/Grenze |
| --- | --- | --- |
| Docker | BLOCKED | Engine nicht installiert; Konfiguration nur statisch geprüft |
| Caddy | BLOCKED | Caddyfile/Proxyziel statisch konsistent; keine Adapt-/Live-TLS-Prüfung |
| PostgreSQL | PASS (isoliert) | 18.6, Neuinstallation, Rollen, Migrationen und Restore real ausgeführt |
| TLS | NOT RUN | Release-Client erzwingt HTTPS; keine Domain/Zertifikatsausstellung vorhanden |
| Firewall | NOT RUN | Compose veröffentlicht nur 80/443; Hetzner-/UFW-/IPv6-Regeln nicht ausgeführt |
| Offsite-Backups | BLOCKED | Skript/Runbook vorhanden; kein Restic-Repository oder Credential |
| Restore | PASS (lokale DB), NOT RUN (offsite) | Echter Custom-Dump/Restore lokal; kein externer Transport/Desaster-Host |
| EAS | BLOCKED | Profile dokumentiert; Projekt-ID, Identifier, Signierung und Konten fehlen |
| Native Geräte | NOT RUN | Keine Android-/iOS-Hardwareabnahme; Export ist kein Gerätetest |

Der statische Preflight bestätigt dokumentierte Pflichtvariablen, getrennte Admin-/Migrator-/API-Rollen, Restore-Reihenfolge, internes PostgreSQL-Netz, ausschließlich öffentliche Ports 80/443, konsistente feste Caddy-Proxy-IP, HTTPS-Guard, keine Client-Secrets, Backup-/Restore-Abläufe und die offenen EAS-Anforderungen.

## F. Offene Entscheidungen und manuelle Abnahmen

- Release-Kandidat unabhängig diff-prüfen, committen und unveränderlichen Hash/Image-Digest festlegen.
- Isolierten Docker-Compose-Stagingstack mit Testdaten bauen; Migration-Job, Health/Ready, Caddy-Headerbereinigung, Shutdown und Ressourcenlimits prüfen.
- Hetzner-VPS, Domain, DNS, TLS-Erneuerung, UFW/Cloud-Firewall, IPv6 und externe Portsicht freigeben und testen.
- Restic-Ziel, Retention, Alarmdienst, RPO/RTO und vollständigen Restore auf separater Infrastruktur abnehmen.
- EAS-Projekt, Bundle-/Package-Identifier, Signierung, Preview-/Production-Builds und Store-Metadaten einrichten.
- Automatisierte Account-/Session-/Workout-Races auf zwei realen Geräten einschließlich Offline, Background, Prozessende, Backup/Reinstall und Accessibility wiederholen.
- Betreiber-/Datenschutztexte, Retention, Private-Beta-Einladung und Support-/Incident-Verantwortung freigeben.
- Expo/Metro-/Router-Advisories vor Storefreigabe erneut gegen kompatible SDK-Patches bewerten.

Es gibt nach den definierten R4-Tests keinen bekannten kritischen oder hohen konkret reproduzierbaren Code-Blocker. Die Punkte oben sind Infrastruktur-, Geräte-, Betriebs- oder Freigabegates.

## G. Release-Empfehlung

| Zustand | Ergebnis | Bedeutung |
| --- | --- | --- |
| `CODE_READY` | **PASS** | R4-01/02/03 behoben; 79 App-/Race- und 17 Backend-Tests, Datenbank, Typechecks, Lint, Build, Doctor und Exporte erfolgreich |
| `STAGING_READY` | **NO – nächster freizugebender Schritt** | Konfiguration ist statisch vorbereitet, aber noch kein kontrollierter Docker-/Caddy-Betrieb mit Testdaten ausgeführt |
| `INFRA_READY` | **NO** | Ziel-VPS, DNS, TLS, Firewall, Monitoring und Offsite-Restore nicht real geprüft |
| `DEPLOYED` | **NO** | Kein Deployment ausgeführt |
| `PRODUCTION_APPROVED` | **NO** | Infrastruktur-, native Geräte-, EAS-, Backup- und Betreiberabnahmen fehlen |

**Abschlussbewertung: CODE READY – PROCEED TO STAGING.**

Der nächste Meilenstein ist ausschließlich echtes Docker-/Hetzner-Staging mit isolierten Testdaten nach `docs/DEPLOYMENT_RUNBOOK.md`; kein weiterer allgemeiner Code-Audit ist als Zwischenschritt vorgesehen.
