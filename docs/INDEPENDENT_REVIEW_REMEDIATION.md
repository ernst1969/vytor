# Vytor – Independent Review Remediation

Stand: 21.10.2026. Dieses Dokument belegt die acht Findings des vorherigen Reviews. Die nachfolgend entdeckten Findings N-01 bis N-03 und der aktuelle Gate-Status stehen maßgeblich in [Final Production Review](FINAL_PRODUCTION_REVIEW.md). Operative Befehle stehen ausschließlich im [Deployment-Runbook](DEPLOYMENT_RUNBOOK.md); Gate-Status in [Deployment Readiness](DEPLOYMENT_READINESS.md). Der frühere `CODEX_REVIEW_HANDOFF.md` ist historisch.

## A. Übersicht

| Finding | Schwere | Status | Kurzbegründung |
| --- | --- | --- | --- |
| VY-01 | HIGH | **FIXED** | Gemeinsame Draft-Sync-Promise, Folgeflush und Identitätsbindung; acht geforderte Race-Klassen automatisiert |
| VY-02 | HIGH | **FIXED** | Atomare bedingte Session-Löschung; verspäteter 401 kann neue Session nicht löschen |
| VY-03 | HIGH | **FIXED** | Gezielter Restore-Ownership-Transfer; echter PostgreSQL-18-Altstand-Restore mit Pending-Migrationen |
| VY-04 | MEDIUM/HIGH | **FIXED** | CI: PostgreSQL 18, HTTPS-Testadresse, erwarteter HTTP-Exportfehler |
| VY-05 | MEDIUM | **FIXED** | Serverseitig validierte, offline aufschiebbare, crash-sichere Legacy-Migration; native Abnahme bleibt Gate |
| VY-06 | MEDIUM | **FIXED** | Vollständiger lokaler Snapshot-Guard passend zum Clientmodell |
| VY-07 | MEDIUM | **FIXED** | Atomarer Parent-Revisions-CAS für Exercise-Settings |
| VY-08 | MEDIUM | **FIXED** | Dokumente abgeglichen und klare Autoritätshierarchie definiert |

`FIXED` bezeichnet hier Code plus lokal ausführbare automatisierte Evidenz, nicht Produktionsfreigabe. `INFRA_READY`, `DEPLOYED` und `RELEASE_APPROVED` bleiben **nein**.

## B. Implementierung

### VY-01 – Workout-Synchronisation

- Dateien/Funktionen: `src/services/workout-draft-sync.ts:1-97` (`WorkoutDraftSyncCoordinator`), `src/context/workout-context.tsx:350-452` (`flushWorkoutDraft`, Identitäts-/Statusrefs), außerdem Flush-Aufrufe vor Finish/Add/Delete/Reorder/Replace.
- Lösung: Genau eine laufende Promise wird geteilt. Nach jedem Save wird der neueste Draft erneut signiert; bei Änderung folgt der nächste Save mit der bestätigten Revision. Accept und lokale Metadatenpersistenz erfolgen nur bei identischem Account, Workout und Generation. 409, Netzwerk- und lokale Speicherfehler werden nicht als Erfolg zurückgegeben; maximal 50 Folgezyklen verhindern Endlosschleifen.
- Wirkung: Workout-Wechsel wartet auf Serverbestätigung; lokale Daten bleiben bei Fehler/Konflikt bestehen. Status unterscheidet lokal ausstehend, Sync, Server-save, Konflikt, Sync- und Local-Backup-Fehler.

### VY-02 und VY-05 – Session-Races und Legacy-Migration

- Dateien/Funktionen: `src/services/session-store-core.ts:1-123` (`SessionCredentialStore`), `src/services/session-store.ts` (Expo-/Web-Adapter), `src/services/api.ts:19-67` (Legacy-Validator und 401 Compare-and-clear), `server/src/index.ts:328-347` (`GET /api/session`).
- Lösung: Sämtliche Credential-Operationen teilen eine Queue. `clearIfCurrent` liest und vergleicht innerhalb derselben Operation. Legacy-Tokens werden mit eigenem Bearer-Request und gespeicherter User-ID validiert; offline/Timeout liefert `deferred`. Erst verifizierter SecureStore-Write erlaubt Klartext-Cleanup. Ein bereits sicherer Token bereinigt eine zusätzliche Legacy-Kopie. Session-Store-Fehler propagieren; der vorherige Login wird soweit möglich zurückgerollt.
- Wirkung: Keine neue Klartextkopie, keine Tokenlogs, kein rekursiver API-Client. Der Expo-SDK-57-SecureStore-Vertrag (`getItemAsync`, `setItemAsync`, `deleteItemAsync`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) wurde gegen die versionierte Expo-Dokumentation geprüft.

### VY-03 – PostgreSQL-Ownership

- Dateien/Funktionen: `deployment/postgres/init-roles.sh:17-91`, `deployment/restore.sh`, `server/scripts/test-database.mjs`.
- Lösung: Nach dem Admin-`--no-owner`-Restore werden nur Objekte im `public`-App-Schema und nur dann übertragen, wenn ihr Owner der ausführende Administrator ist. Erfasst werden Tabellen/Partitionen, unabhängige Sequenzen, Views/Materialized Views/Foreign Tables, Funktionen sowie Enum-/Domain-Typen. Tabellengebundene Sequenzen folgen dem Table-Owner. Andere Schemas und fremde Owner bleiben unberührt. Default- und Bestandsgrants werden danach gesetzt.
- Wirkung: `_prisma_migrations` und App-Tabellen gehören dem Migrator; `vytor_api` bleibt DML-only und ohne Adminflags.

### VY-04 – CI

- Datei: `.github/workflows/checks.yml`.
- Lösung: PostgreSQL-Service `postgres:18`; Release-Export mit reservierter `https://api.invalid`; eigener Schritt schlägt fehl, falls ein HTTP-Release-Export unerwartet erfolgreich ist. Development-HTTP bleibt durch `__DEV__` möglich.

### VY-06 – Recovery

- Datei/Funktion: `src/utils/recovery.ts:5-65`, `isLocalWorkoutSnapshot`.
- Lösung: Validiert Top-Level, Übungen, eindeutige IDs, Units/Enums, Setnummern, alle Messwertstrings, booleschen Abschluss, Previous Sets, Bounds und Drop-Ursprung. Leere Strings bleiben für unvollständige aktive Eingaben zulässig. Ungültige Snapshots werden nicht in State übernommen und nicht automatisch gelöscht.

### VY-07 – Settings-Revision

- Dateien/Funktionen: `server/src/index.ts:1481-1597`, `server/src/workout-validation.ts`, `src/services/api.ts:updateWorkoutExerciseSettings`.
- Lösung: Request verlangt `revision`. Innerhalb einer Transaktion erhöht ein Parent-`updateMany` nur bei Owner + aktiv + nicht suspendiert + erwarteter Revision. Erst danach wird das Child geändert. Null Treffer ergibt 409. Damit serialisieren Settings, Finish, Suspend und parallele Settings über dieselbe Workout-Zeile.

### VY-08 – Dokumentation

- Operative Autorität: `DEPLOYMENT_RUNBOOK.md`.
- Gate-/Freigabestatus: `DEPLOYMENT_READINESS.md` und `RELEASE_CHECKLIST.md`.
- Technische Remediation-Evidenz: dieses Dokument.
- Architektur: `README.md` und `TECH_STACK.md`.
- Historie: `CHANGELOG.md`, `CODEX_REVIEW_HANDOFF.md` und `HETZNER_SECURITY_REVIEW.md`; historische Dokumente sind ausdrücklich gekennzeichnet.

## C. Tests

| Testdatei/Fall | Befehl | Exit | Ergebnis / geprüfte Eigenschaft |
| --- | --- | ---: | --- |
| `scripts/workout-sync.test.ts` | `npm run test:ui` | 0 | laufender Save + Wechsel, verspätetes altes Ergebnis, Änderungen während Save, 409, Netzwerk, zwei Wechsel, Accountwechsel, Background |
| `scripts/session-store.test.ts` | `npm run test:ui` | 0 | alter/aktueller 401, parallele Requests, Logout, Accountwechsel, sämtliche Legacy-/Fehler-/Crash-Fälle |
| `scripts/recovery.test.ts` | `npm run test:ui` | 0 | falsche Messwerttypen, null/nested, Duration, Drop-Link, gültiger unvollständiger/gespeicherter Draft |
| alle Root-Tests | `npm run test:ui` | 0 | **45/45 PASS** im finalen Stand, jetzt einschließlich Provider- und Startup-Integration |
| Backend-Unit | `npm --prefix server test` | 0 | **17/17 PASS**, Validierung einschließlich Settings-Revision |
| Backend-Integration/Races | Teil von `npm --prefix server run test:isolated` | 0 | gültig/stale/fremd/beendet, parallele Settings, Finish-/Suspend-Races; API/Auth/Social Regression |
| Frontend-Typecheck | `npx tsc --noEmit` | 0 | PASS |
| Backend-Typecheck | `npx tsc --noEmit -p server/tsconfig.json` | 0 | PASS |
| Backend-Build | `npm --prefix server run build` | 0 | PASS |
| Lint | `npm run lint` | 0 | PASS |
| Expo-Kompatibilität | `npx expo-doctor` | 0 | **21/21 PASS** |
| Release-Export HTTPS | `EXPO_PUBLIC_API_URL=https://api.invalid npx expo export --platform all ...` | 0 | Android, iOS und Web PASS |
| Release-Export HTTP | `EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo export --platform all ...` | 1 erwartet | Guard verweigert unsichere Release-URL |
| Backend Production Audit | `npm --prefix server audit --omit=dev --json` | 0 | 0 Advisories |
| Root Dependency Audit | `npm audit --json` | 1 | final 21 Expo/Metro-Transitivbefunde: 3 moderate, 18 high, 0 critical; Klassifizierung im Final Production Review |
| Docker-Verfügbarkeit | `docker version` | 127 | BLOCKED: Docker nicht installiert |
| Diff-Whitespace | `git diff --check` | 0 | PASS |

Ein früher Backend-Unit-Zwischenlauf hatte Exit 1, weil das alte Recovery-Test-Fixture die nun verpflichtenden Clientfelder nicht enthielt. Das Fixture wurde auf das echte Modell aktualisiert; der finale Lauf bestand 17/17. Ein erster erweiterter Restore-Zwischenlauf hatte Exit 1: Er zeigte, dass eine an eine Tabelle gebundene Sequenz nicht separat umgeowned werden darf. Das Skript überträgt solche Sequenzen nun über den Table-Owner; der vollständige Wiederholungslauf bestand. Diese Zwischenfehler sind keine PASS-Nachweise.

## D. Datenbank

- Keine neue Schema-Migration. Vorhanden bleiben zwölf Migrationen, zuletzt `20261021120000_stable_drop_sets` und `20261021121000_case_insensitive_usernames`.
- Frische Installation: alle zwölf Migrationen als `vytor_migrator`; API-DML erlaubt, `CREATE TABLE` und `CREATE DATABASE` verweigert.
- Restore: PostgreSQL Custom Dump aus echtem Stand mit zehn Migrationen und Benutzer-/Workout-/Set-Daten; neue leere DB und Produktionsrollen; Restore als Administrator mit `--no-owner --no-acl`; gezielter Owner-Transfer; zwei Pending-Migrationen als Migrator.
- Nachweise: Migrator kann `ALTER TABLE "User" ADD/DROP COLUMN`; API kann Benutzer lesen/schreiben, aber keine DDL/Adminoperation; Daten, Sequenzfortschritt, Foreign Keys und zwölf abgeschlossene `_prisma_migrations` geprüft.
- Version: PostgreSQL **18.6** für frische Installation, HTTP-Integration, Dump und Restore. CI ist auf Major 18 umgestellt.

## E. Grenzen und Restrisiken

- Docker ist in dieser Umgebung nicht installiert; reale Images, Compose, Caddy, Container-Health/Read-only-FS und Shutdown sind **BLOCKED**.
- Kein VPS/Domain: TLS, DNS, Firewall, Ports, Proxyheader, SSH und Monitoring sind **BLOCKED**.
- Kein externes Restic-Repository: Offsite-Transport, Retention, Alarm und vollständige Wiederherstellung sind **BLOCKED**.
- Keine Android-/iOS-Geräte: SecureStore-Backup/Reinstall, Keychain-Verhalten, native Offline-/Background-/Zweigeräte-Races, Safe Areas und Accessibility sind **NOT RUN**.
- Keine EAS-/Store-Konten, Identifier, Signierung oder Builds; keine Cloud-/Produktionsänderung vorgenommen.
- Root-Dependency-Audit enthält weiterhin dokumentierte Expo/Metro-Transitivrisiken; kein `audit fix --force` und kein Major-Upgrade.
- In-Memory-Rate-Limits passen zur geplanten Einzelinstanz, nicht zu horizontaler Skalierung.

## F. Repository-Zustand

- Git-Basiscommit und aktueller Commit: `68999e91837e4e2b33d23607d9698f0610aa01ee` (`Harden security and deployment readiness`).
- Änderungen: CI; Deployment-Rollen/Restore; Serverroute/-validierung/-Integration; Client-Sync/Session/Recovery; drei neue Root-Testdateien; README, Changelog, TODO und Deployment-/Review-Dokumente.
- Arbeitsbaum: absichtlich **nicht sauber**; sämtliche Remediation-Änderungen einschließlich dieses Dokuments sind uncommittet. Kein Commit und kein Push wurden ausgeführt.

## Release-Gates

| Gate | Status |
| --- | --- |
| `CODE_READY` | **YES**, vorbehaltlich unabhängiger Diff-Abnahme und dokumentiertem Expo-Dependency-Risiko |
| `INFRA_READY` | **NO** |
| `DEPLOYED` | **NO** |
| `RELEASE_APPROVED` | **NO** |

Der Stand ist für die nächste Docker-Staging-Phase geeignet, nicht für ein echtes Hetzner-Produktionsdeployment.
