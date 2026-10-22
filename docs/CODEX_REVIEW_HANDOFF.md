# Vytor – unabhängige Review-Übergabe

> Historischer Stand des ersten Audits. Die nachgelagerte Remediation und aktuelle Testevidenz stehen in [INDEPENDENT_REVIEW_REMEDIATION.md](INDEPENDENT_REVIEW_REMEDIATION.md). Bei Widersprüchen ist dieses neue Dokument maßgeblich; operative Befehle stehen im [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md).

## 1. Scope und Referenz

Vollständiger Code-/Konfigurations-/Dokumentationsaudit am 21.10.2026. Basiscommit: `cf4e9a257c5b670c0600bc35a844edd254bb97a9` (`Prepare Hetzner deployment and harden API security`). Der Arbeitsbaum war zu Beginn sauber; alle unten genannten Änderungen sind uncommittet. Kein Push, Deployment, DNS-, Cloud-, Firewall-, Secret- oder EAS-Kontoeingriff.

Geprüft: Expo/Router/App-State/Persistenz, sämtliche Express-Routen und Middleware, Prisma-Schema/12 Migrationen, Auth/IDOR/Rate Limits/Privacy, Workout-Draft/Revision/Finish/XP/Drop-Sets, Social-Races, Account-Löschung, Docker/Compose/Caddy statisch, PostgreSQL-Rollen, Dump/Restore, Backupskripte, CI/EAS und Dokumentationswidersprüche.

## 2. Wesentliche Findings und Fixes

1. Stale Add/Delete/Reorder konnten neuere Workout-Struktur überschreiben. Atomare Revision für alle Strukturwrites; 409-Regressionsfälle.
2. AsyncStorage-Draftwrites waren ungeordnet und Draft-Switch flushte nicht. Write-Queue, Generation gegen Session-Races, Background-/Switch-Flush und sichere Cache-Prüfung.
3. Drop-Sets hatten keine persistente Ursprungskante. Self-FK, Datenmigration, Clientlink und Finish-Persistenz.
4. Native Tokens lagen in AsyncStorage. Zentraler SecureStore mit verifizierter Legacy-Migration; Web getrennt in Session Storage.
5. API sollte DB-Adminrolle nutzen. Feste Admin/Migrator/API-Trennung, Default-/Bestandsgrants und echte Denial-Tests.
6. Öffentliche Beta-Registrierung. Produktion fail-closed; optional timing-safe geprüfter SHA-256-Invite.
7. Nicht-Freunde bekamen Workout-Zeitpunkte; Social-Statuswechsel waren race-anfällig. Datenminimierung und atomare Pending-Updates.
8. Case-insensitive Username nur auf API-Ebene. Funktionaler DB-Unique-Index mit sicherem Collision-Abbruch.
9. Kontolöschung ließ identifizierende Custom-Exercise-Felder bei Fremdreferenz. Unreferenzierte löschen, referenzierte neutral anonymisieren.
10. Prisma-CLI/Dev-Abhängigkeiten im API-Image und vier Backend-Advisories. Prisma 7.10.1, separater Migration-Target, Production Audit 0.

Keine behauptete Behebung: reale Docker-/TLS-/Firewallkette, Restic-Offsite-Transport/Alarmierung, native SecureStore-/Gerätetests, EAS-Signierung/Store und rechtliche Datenschutzfreigabe.

## 3. Migrationen

- `server/prisma/migrations/20261021120000_stable_drop_sets/migration.sql`: nullable `dropSetOfId`, historischer nearest-prior-non-drop Backfill, Index/FK. Additiv; unzuordenbare historische Drops bleiben null.
- `server/prisma/migrations/20261021121000_case_insensitive_usernames/migration.sql`: preflightet `lower(username)`-Kollisionen und erstellt Unique-Index. Stoppt absichtlich bei Kollision; keine Daten werden automatisch geändert.

Beide liefen zusammen mit allen zehn älteren Migrationen auf frischem PostgreSQL 18.6 als `vytor_migrator` durch. Ein Custom-Dump wurde in eine neue DB restauriert.

## 4. Geänderte Dateien

Code/Abhängigkeiten: `package.json`, `package-lock.json`, `app.json`, `src/services/session-store.ts`, `src/services/api.ts`, `src/context/workout-context.tsx`, `src/utils/recovery.ts`, `src/app/create-user.tsx`, `src/app/workout-setup.tsx`, `server/package.json`, `server/package-lock.json`, `server/src/index.ts`, `server/src/security.ts`, `server/src/workout-validation.ts`, Tests/Skripte und Prisma-Schema/Migrationen.

Deployment: `.env.production.example`, `server/Dockerfile`, `compose.production.yml`, `deployment/Caddyfile`, `deployment/postgres/init-roles.sh`.

Dokumentation: `README.md`, `CHANGELOG.md`, `TODO.md`, `docs/RELEASE_CHECKLIST.md`, `docs/HETZNER_SECURITY_REVIEW.md`, `docs/HETZNER_DEPLOYMENT.md`, `docs/TECH_STACK.md`, `docs/DEPLOYMENT_READINESS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, `docs/ROLLBACK_AND_RECOVERY.md`, `docs/PRIVACY_TECHNICAL.md`, dieses Dokument.

## 5. Tatsächlich ausgeführte Prüfungen

| Befehl | Exit | Ergebnis |
| --- | ---: | --- |
| `npm run lint` | 0 | PASS |
| `npx tsc --noEmit` | 0 | PASS |
| `npx tsc --noEmit -p server/tsconfig.json` | 0 | PASS |
| `npm --prefix server run build` | 0 | PASS |
| `npm --prefix server test` | 0 | PASS, 17/17 |
| `npm run test:ui` | 0 | PASS, 16/16 |
| `npx expo-doctor` | 0 | PASS, 21/21 |
| `npm --prefix server run test:isolated` | 0 | PASS: HTTP/DB/Races, 12 Migrationen, Least Privilege, Dump/Restore |
| `npm --prefix server audit --omit=dev --json` | 0 | PASS, 0 Advisories nach Prisma 7.10.1 |
| `npm audit --json` | 1 | 29 moderate/high Expo/Metro-Transitivbefunde; keine Criticals |
| `npx expo export --platform all ...` mit lokaler HTTP-URL | 1 | erwarteter Security-Guard; Release-URL abgewiesen |
| gleicher Export mit `EXPO_PUBLIC_API_URL=https://api.vytor.example` | 0 | PASS Android/iOS/Web |
| `bash -n deployment/*.sh deployment/postgres/*.sh` | 0 | PASS |
| YAML-Parse von `compose.production.yml` mit `js-yaml` | 0 | PASS, vier Dienste |
| temporäres `npm ci --omit=dev --omit=optional` | 0 | PASS; Prisma CLI fehlt, Client/Adapter 7.10.1 vorhanden |
| Git-Historie Patternscan (nur Dateinamen ausgegeben) | 0 | keine Private-Key/Bearer/AWS/GitHub-Token-Muster |
| `docker version` | 127 | BLOCKED: Docker nicht installiert |
| `systemd-analyze verify ...` | 1 | BLOCKED durch Sandbox/User-Bus-Berechtigung; keine inhaltliche Freigabe |

Der isolierte Test startete einen temporären PostgreSQL-18.6-Cluster, verwendete ausschließlich Datenbanken unter `/tmp`, stoppte ihn und entfernte das Verzeichnis. Keine Entwicklungs-/Produktionsdatenbank wurde beschrieben.

Zwischenläufe, die Fehler fanden und danach behoben wurden: erster Migrationslauf Exit 1 wegen einer ungültigen `UPDATE ... LATERAL`-Referenz im neuen Drop-Backfill; auf korrelierte Subquery korrigiert und mehrfach erfolgreich wiederholt. Ein später Frontend-Typecheck Exit 2 fand zu enge Type-Guard-Typen; Cast/Null-Narrowing korrigiert, final Exit 0. Ein Sandboxlauf des isolierten Tests scheiterte vor Testbeginn mit `listen EPERM`; derselbe erlaubte localhost-Harness lief danach vollständig durch. Diese Zwischenfehler sind keine finalen PASS-Nachweise.

## 6. Fehlende Prüfungen und Restrisiken

- Dockerfile-Build, `docker compose config`, Containerhealth, Read-only-FS, Ressourcenlimits und Caddy-Adapt nicht real ausgeführt.
- Kein VPS: DNS, öffentliches TLS/Erneuerung, IPv4/IPv6-Firewalls, externe Port-/Headerprüfung, SSH-Härtung und Monitoring sind BLOCKED.
- Restic-Repository, Verschlüsselung, Retention, Provider-Löschschutz und externer Alarm nicht getestet. Nur PostgreSQL-Dump/Restore ist bewiesen.
- Android/iOS/Web-Interaktionsmatrix, zwei echte Geräte, Suspend/Resume, SecureStore-Reinstall/Backup und Screenreader NOT RUN.
- EAS-Projekt-ID, Bundle-/Package-Identifier, Credentials und Preview/Production-Build fehlen.
- Root-Audit: 29 Expo/Metro-Advisories. npm schlägt inkompatible Expo-44-Downgrades bzw. SDK-58-Pakete vor. Vor Release mit offiziellen Expo-Patches neu bewerten; keine `--force`-Änderung.
- In-memory Rate Limits gelten nur für eine API-Instanz und gehen beim Neustart verloren. Für den geplanten Einzelprozess akzeptabel; vor Skalierung Shared Store.
- Ein gültig aussehendes erfundenes Workout kann nicht sicher von echtem Training unterschieden werden. Frequenz-/Mengenlimits reduzieren XP-Automation, lösen Produktbetrug nicht vollständig.
- Web-Sessionstorage ist XSS-lesbar. Breite Webveröffentlichung benötigt CSP/Hostingreview und gegebenenfalls HttpOnly-Cookie-Architektur.

## 7. Betreiberentscheidungen

Domain/Standort/Admin-CIDRs, Image-Digests, Backupanbieter/Object Lock, Alarmdienst, RPO/RTO, Invite-Code-Rotation, Privacy/Retention/Exportprozess, Verantwortlicher/AVV, EAS-/Storedaten, Identifier und Geräteabnahme.

## 8. Review-Anleitung

1. `git diff --check` und kompletten Diff lesen; besondere Stellen: Workout-Strukturrouten, `flushWorkoutDraft`, Session Store, Rollen-SQL und beide Migrationen.
2. Befehle aus Abschnitt 5 reproduzieren.
3. Vor Bestandsmigration Case-Collision-Query aus `DEPLOYMENT_RUNBOOK.md` ausführen und Drop-Backfill stichprobenartig prüfen.
4. Auf Docker-Staging API-/Migration-Targets bauen, Runtime auf fehlende Prisma-CLI prüfen, Compose/Caddy validieren und manipulierte Proxyheader testen.
5. Restic-Offsite-Restore und native Matrix durchführen; Ergebnisse in `RELEASE_CHECKLIST.md` ändern.

Querverweise: `DEPLOYMENT_READINESS.md` (Gates), `RELEASE_CHECKLIST.md` (Nachweise), `DEPLOYMENT_RUNBOOK.md` (Start), `ROLLBACK_AND_RECOVERY.md` (Fehlerfälle), `PRIVACY_TECHNICAL.md` (Daten), `TECH_STACK.md` (Architektur).

## 9. Einschätzung

**CONDITIONAL GO – REQUIREMENTS OUTSTANDING.** Code und isolierte Datenbank sind nach automatisierter Evidenz bereit für Deployment-Vorbereitung. Ohne reale Infrastruktur-, Offsite-Restore-, native Geräte- und Betreiberabnahme sind `INFRA_READY`, `DEPLOYED` und `RELEASE_APPROVED` falsch.
