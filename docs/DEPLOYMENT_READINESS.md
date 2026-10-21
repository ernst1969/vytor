# Vytor – Deployment Readiness

Auditzeit: 21.10.2026, 12:40 CEST. Basiscommit: `cf4e9a257c5b670c0600bc35a844edd254bb97a9`; geprüft wurde zusätzlich der dokumentierte uncommittete Audit-Arbeitsbaum. Umgebung: Linux/Node 24, npm, PostgreSQL 18.6; kein Docker, Caddy, VPS, DNS, EAS-Konto oder echtes Gerät.

## Ergebnis

**Gesamt: CONDITIONAL GO – REQUIREMENTS OUTSTANDING.** Der relevante Code und die isolierte Datenbank sind release-candidate-fähig. Infrastruktur, Restic-Offsite-Restore, native Geräte/EAS sowie Betreiber-/Datenschutzentscheidungen sind nicht abgenommen.

- `CODE_READY`: **ja, mit offenem Expo-Dependency-Risiko und finalem Review des Arbeitsbaums**.
- `INFRA_READY`: **nein**.
- `DEPLOYED`: **nein**.
- `RELEASE_APPROVED`: **nein**.

## Findings nach Schwere

| Schwere | Befund | Status |
| --- | --- | --- |
| Hoch | Stale Client konnte Übungsreihenfolge überschreiben; Add/Delete waren nicht revisioniert | Behoben und PostgreSQL-getestet |
| Hoch | API-Prozess sollte DB-Initial/Superuser verwenden | Behoben: drei Rollen; Berechtigungen real getestet |
| Hoch | Lokale Draft-Writes konnten sich asynchron überholen/Draft-Wechsel vor Sync | Behoben im Code: Queue + Flush; reale Suspend-/Geräteabnahme BLOCKED |
| Mittel | Native Bearer-Tokens in AsyncStorage | Behoben im Code mit SecureStore-Migration; Geräte-/Reinstalltest BLOCKED |
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
| Code Integrity | PASS | keine bekannte kritische Datenverlustlücke; Tests siehe Checkliste |
| Backend Security | PASS (Code) | Auth, IDOR, Limits, Input, Proxy und Fehlerpfade geprüft; Internetkette noch nicht |
| Authentication | PASS (Server), BLOCKED (native E2E) | Server-Sessiontests bestanden; Geräte fehlen |
| Database | PASS (isoliert) | 12 Migrationen, Rollen, Restore und Sequenzen PostgreSQL 18.6 |
| Workout Reliability | PASS (automatisiert), BLOCKED (Geräte) | Draft/Revision/Finish automatisiert; Suspend/Offline manuell offen |
| Automated Tests | PASS | alle ausführbaren Pflichtchecks bestanden |
| Infrastructure | BLOCKED | Docker/VPS/DNS/TLS/Firewall nicht verfügbar |
| Backups | BLOCKED | DB-Restore PASS; Restic-Offsite und Timer/Alarm nicht getestet |
| Client | BLOCKED | Export PASS; EAS/native Geräte nicht ausgeführt |
| Privacy | BLOCKED | technische Minimierung verbessert; Betreibertext, Retention und Rechtsprüfung offen |
| Operations | BLOCKED | Runbooks vorhanden; reale Alarmierung/Übung fehlt |

## Migration und Rollback

`20261021120000_stable_drop_sets` ist additiv und rekonstruiert historische Drop-Ursprünge als nächsten vorherigen Nicht-Drop-Satz. `20261021121000_case_insensitive_usernames` ist additiv, bricht aber absichtlich ab, falls `lower(username)` kollidiert. Vor Produktion Kollisionen read-only prüfen. Keine automatische Down-Migration: vor Deploy Dump/Restic-Snapshot, bei Fehler alten Code nur bei Schemakompatibilität zurückrollen; sonst in neuer DB aus Backup restaurieren.

## Externe Voraussetzungen

VPS und Domain, geprüfte Image-Digests, drei getrennte DB-Passwörter, optionaler Invite-Code-Hash, Restic-Repository/Passwort, externer Uptime-/Backupalarm, EAS-Projekt/Identifier/Signierung, echte Android-/iOS-Geräte und Betreiberfreigabe für Datenschutz/Retention. Details: `DEPLOYMENT_RUNBOOK.md`, `ROLLBACK_AND_RECOVERY.md`, `PRIVACY_TECHNICAL.md`.
