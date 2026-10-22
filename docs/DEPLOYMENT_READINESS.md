# Vytor – Deployment Readiness

Remediation: 22.10.2026. Basiscommit und aktueller `HEAD`: `68999e91837e4e2b33d23607d9698f0610aa01ee`; geprüft wurde zusätzlich der uncommittete Code-Release-Kandidat. Umgebung: Linux/Node 24.21.0, npm 12.2.0, PostgreSQL 18.6; kein Docker, Caddy, VPS, DNS, EAS-Konto oder echtes Gerät.

## Ergebnis

**Gesamt: CODE READY – PROCEED TO DOCKER STAGING.** R5-01, R4-01 bis R4-03, die angrenzenden Cross-Account-Races und die isolierte Datenbank sind als Code-Release-Kandidat verifiziert. Der Code-Freeze gilt für den dokumentierten, noch uncommitteten Arbeitsbaum. Infrastruktur, Restic-Offsite-Restore, native Geräte/EAS sowie Betreiber-/Datenschutzentscheidungen sind nicht abgenommen.

- `CODE_READY`: **ja**, mit dokumentiertem Expo-Dependency-Restrisiko und ausstehender unabhängiger Diff-Abnahme.
- `STAGING_READY`: **nein, nächster Schritt**; Docker-/Caddy-Runtime ist in dieser Umgebung blockiert.
- `INFRA_READY`: **nein**.
- `DEPLOYED`: **nein**.
- `PRODUCTION_APPROVED`: **nein**.

## Findings nach Schwere

| Schwere | Befund | Status |
| --- | --- | --- |
| Hoch | Unter A bestätigte Account-Löschung konnte nach dynamischem Import die aktuelle B-Session verwenden | Behoben: Screen-/Dialog-Binding aus Account+Token, Fetch-Prüfung vor Versand, identitätsgebundener Cleanup/Navigation und accountbezogener Provider-Purge; Settings/API/Provider-Races PASS |
| Hoch (angrenzend) | Passwortänderung konnte nach Sessionwechsel unter neuer Session ausgeführt werden | Behoben mit derselben verpflichtenden Request-Bindung; Vor-/Nach-Versand-Races PASS |
| Hoch | Save-Preset konnte A-Payload nach Sessionwechsel unter B senden | Behoben: Payload/Generation vor Await, atomare Account-/Token-Bindung vor Versand, unveränderlicher Bearer; Provider-/API-Races PASS |
| Mittel/Hoch | Tokenloser alter Logout konnte eine neue Session löschen | Behoben: queue-atomarer Vergleich der vollständigen Startidentität; Login-/401-/Netzwerk-Races PASS |
| Mittel | Tombstone-Lese-/Parsingfehler galt als „nicht gelöscht“ | Behoben: fail-closed Fehlerzustand, kein Write/Overwrite bei unbekannter Barriere, Retry/Restart/Purge PASS |
| Hoch | Stale Client konnte Übungsreihenfolge überschreiben; Add/Delete waren nicht revisioniert | Behoben und PostgreSQL-getestet |
| Hoch | API-Prozess sollte DB-Initial/Superuser verwenden | Behoben: drei Rollen; Berechtigungen real getestet |
| Hoch | Laufender Draft-Save wurde beim Workout-Wechsel nicht abgewartet | Behoben: gemeinsame Sync-Promise, Folgeflush, Account-/Workout-/Generation-Bindung; Race-Tests PASS |
| Hoch | Logout/Sessionwechsel löschte unbestätigte accountgebundene Drafts | Behoben: verlustfreier Session-Übergang, gezielte Cleanup-Regeln und echter Provider-/Storage-/API-Test PASS |
| Mittel | Startup-401/404 konnte neue Session löschen oder zu Login navigieren | Behoben: token-/usergebundenes Compare-and-clear und Navigation; Startup-Race-Tests PASS |
| Niedrig/Mittel | Settings-Revision wurde im Handler implizit konvertiert | Behoben: echter Number-/Safe-Integer-/int32-Vertrag; Unit- und HTTP/PostgreSQL-Tests PASS |
| Hoch | Verspäteter API-401 konnte eine neuere Session löschen | Behoben: serialisiertes Compare-and-clear; Session-Race-Tests PASS |
| Hoch | Restore unter Admin beließ Bestandsobjekte beim falschen Owner | Behoben: gezielter Ownership-Transfer; Altstand-Restore + Pending-Migration auf PostgreSQL 18.6 PASS |
| Mittel/Hoch | CI exportierte Release-JavaScript mit HTTP-URL/PostgreSQL 17 | Behoben: `https://api.invalid`, negativer HTTP-Test und PostgreSQL 18 |
| Mittel | Legacy-Token wurde ohne Serverprüfung migriert | Behoben: `/api/session`, Offline-Aufschub, Write-Verifikation und serialisierte Bereinigung; native Geräteabnahme BLOCKED |
| Mittel | Lokale Snapshot-Messwerte nur teilweise validiert | Behoben: vollständiger Modell-/Messwert-/Drop-Link-Validator; Regressionstests PASS |
| Mittel | Exercise-Settings ohne atomare Parent-Revision | Behoben: transaktionaler Parent-CAS; Settings-/Finish-/Suspend-Races PASS |
| Mittel | Widersprüchliche Audit-Dokumente | Behoben: Hierarchie definiert, historische Übergabe markiert, operative Quelle ist `DEPLOYMENT_RUNBOOK.md` |
| Mittel | Drop-Ursprung nur Arrayposition | Behoben durch FK + Migration + Integrationstest |
| Mittel | Öffentliche Registrierung für private Beta | Behoben: Produktion fail-closed, optionaler serverseitiger Invite-Hash |
| Mittel | Nicht-Freunde erhielten exakte Workout-Zeitpunkte | Behoben und Mehrkonto-getestet |
| Mittel | Accept/Reject nicht atomar | Behoben durch bedingte Updates; Race getestet |
| Mittel | Case-insensitive Username nur auf Anwendungsebene | Behoben durch DB-Index; Bestandskollision blockiert Migration |
| Mittel | Account-Löschung ließ personenbezogene Übungsfelder bei Fremdreferenz | Behoben: löschen wenn frei, sonst neutral anonymisieren; getestet |
| Mittel | API-Image enthielt Prisma CLI/Dev-Abhängigkeiten | Behoben durch getrennte Runtime-/Migration-Targets; Containerbuild BLOCKED |
| Mittel | Expo/Metro transitive Advisories | Offen bis kompatibler SDK-57-Patch oder geprüfte SDK-58-Migration; nicht im API-Server |
| Mittel | Restic-Offsite-/Alarmkette unbewiesen | BLOCKER für Releasefreigabe |
| Mittel | Kein echter VPS-/TLS-/Firewall-Test | BLOCKER für `INFRA_READY` |
| Mittel | Keine native Geräte-/SecureStore-Abnahme | BLOCKER für App-Verteilung |

## Gates

| Gate | Status | Begründung |
| --- | --- | --- |
| Code Integrity | PASS | R5-01, R4-01/02/03 und vorherige Lifecycle-Fixes automatisiert; keine bekannte kritische/hohe Cross-Account- oder Datenverlust-Codelücke |
| Backend Security | PASS (Code) | Auth, IDOR, Limits, Input, Proxy und Fehlerpfade geprüft; Internetkette noch nicht |
| Authentication | PASS (Server), BLOCKED (native E2E) | Server-Sessiontests bestanden; Geräte fehlen |
| Database | PASS (isoliert) | frische 12 Migrationen plus Restore aus 10-Migrations-Altstand, Owner, DDL/DML, FK, Sequenzen auf PostgreSQL 18.6 |
| Workout Reliability | PASS (automatisiert), NOT RUN (Geräte) | echter Provider plus Storage/API, Save-Preset, Draft-/Wechsel-/Background-/Logout-/Account-Races und Parent-Revision automatisiert; native Prozess-/Zweigeräte-Abnahme offen |
| Automated Tests | PASS | 90/90 App-/Provider-/Race- und 17/17 Backend-Tests sowie alle ausführbaren Pflichtchecks bestanden |
| Infrastructure | BLOCKED | Compose/Shell/Caddy statisch geprüft; Docker/VPS/DNS/TLS/Firewall nicht verfügbar |
| Backups | BLOCKED | DB-Restore PASS; Restic-Offsite und Timer/Alarm nicht getestet |
| Client | BLOCKED | Export PASS; EAS/native Geräte nicht ausgeführt |
| Privacy | BLOCKED | technische Minimierung verbessert; Betreibertext, Retention und Rechtsprüfung offen |
| Operations | BLOCKED | Runbooks vorhanden; reale Alarmierung/Übung fehlt |

## Migration und Rollback

`20261021120000_stable_drop_sets` ist additiv und rekonstruiert historische Drop-Ursprünge als nächsten vorherigen Nicht-Drop-Satz. `20261021121000_case_insensitive_usernames` ist additiv, bricht aber absichtlich ab, falls `lower(username)` kollidiert. Vor Produktion Kollisionen read-only prüfen. Keine automatische Down-Migration: vor Deploy Dump/Restic-Snapshot, bei Fehler alten Code nur bei Schemakompatibilität zurückrollen; sonst in neuer DB aus Backup restaurieren.

## Externe Voraussetzungen

VPS und Domain, geprüfte Image-Digests, drei getrennte DB-Passwörter, optionaler Invite-Code-Hash, Restic-Repository/Passwort, externer Uptime-/Backupalarm, EAS-Projekt/Identifier/Signierung, echte Android-/iOS-Geräte und Betreiberfreigabe für Datenschutz/Retention. Details: `DEPLOYMENT_RUNBOOK.md`, `ROLLBACK_AND_RECOVERY.md`, `PRIVACY_TECHNICAL.md`.
