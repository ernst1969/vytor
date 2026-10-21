# Vytor – Release-Checkliste

Stand: 21.10.2026. Statuswerte: **PASS**, **FAIL**, **NOT RUN**, **BLOCKED**, **NOT APPLICABLE**. Ein Export ist kein Gerätetest.

## Automatisierte Gates

| Prüfung | Status | Nachweis |
| --- | --- | --- |
| Lint | PASS | `npm run lint`, Exit 0 |
| Frontend-Typecheck | PASS | `npx tsc --noEmit`, Exit 0 |
| Backend-Typecheck/Build | PASS | `npx tsc --noEmit -p server/tsconfig.json`; `npm --prefix server run build`, Exit 0 |
| Backend-Unit-Tests | PASS | `npm --prefix server test`: 17/17 |
| UI-/Utility-Tests | PASS | `npm run test:ui`: 16/16 |
| PostgreSQL-18-Integration | PASS | `npm --prefix server run test:isolated`: API, Race-Tests, 12 Migrationen, Rollen und Dump/Restore |
| Expo-Abhängigkeiten | PASS | `npx expo-doctor`: 21/21 |
| Release-Export | PASS | `EXPO_PUBLIC_API_URL=https://api.vytor.example npx expo export --platform all ...`; Android/iOS/Web erzeugt |
| Unsichere Release-URL abgewiesen | PASS | Export mit lokaler HTTP-URL schlug absichtlich fehl |
| Backend Production Audit | PASS | `npm --prefix server audit --omit=dev --json`: 0 Advisories nach Prisma 7.10.1 |
| Mobiler Dependency Audit | BLOCKED | 29 transitive moderate/high Expo/Metro-Advisories; npm bietet nur inkompatible Downgrades/SDK-58-Wechsel. Vor Store-Release mit Expo-57-Patches neu prüfen. |
| Compose-Parsing | PASS | YAML lokal mit `js-yaml` geparst; Dienste db/api/migrate/caddy |
| API-Runtime-Abhängigkeiten | PASS | temporäre Production-Installation enthält Client/Adapter, aber keine Prisma-CLI |
| Docker Build/Compose | BLOCKED | Docker ist in der Audit-Umgebung nicht installiert |
| Caddy-Adapt/Live-TLS | BLOCKED | Kein Caddy/Docker, keine Domain/Testinstallation |
| Secret-Pattern Git-Historie | PASS | Dateinamen-only Scan über alle Commits: keine Private-Key/Bearer/AWS/GitHub-Token-Muster; kein Ersatz für spezialisierten Secret-Scanner |

## Sicherheits- und Datenintegritätsfälle

| Fall | Status | Nachweis |
| --- | --- | --- |
| Draft: null/falsche Sets, Grenzen, NaN/Infinity, IDs | PASS | Unit- und HTTP-Integrationstests; korrupte lokale Snapshots werden vor Zustandsänderung verworfen |
| Geordnete lokale Speicherung/Flush | PASS (Code) | serialisierte Writes; Flush vor Draft-Wechsel und bei App-Hintergrund; echter Suspend-Test ausstehend |
| Revision bei Draft/Add/Delete/Replace/Reorder/Finish | PASS | PostgreSQL-Integration inklusive stale reorder 409 und Finish-Race |
| Drop-Set-Ursprung | PASS | FK-Migration + Integration prüft gespeicherte Ursprung-ID; historische Zuordnung deterministisch |
| Einmalige XP-Vergabe | PASS | paralleler Finish-Test: genau ein Erfolg; Unique-Event + Transaktion |
| Auth/Session/IDOR | PASS | echte Mehrkonto-HTTP-Tests für private Daten und fremde Mutationen |
| Freundschaft Reject/Withdraw/Remove/Race | PASS | PostgreSQL-Integration; Accept/Reject genau ein Gewinner |
| Private-Beta-Registrierung | PASS | Produktion ohne Hash geschlossen; Timing-safe Hashvergleich unit-getestet |
| Exakte fremde Workout-Zeitpunkte | PASS | Nicht-Freunde erhalten leere Aktivitätsliste; Freunde/Eigentümer behalten Zugriff |
| Account-Löschung mit fremder Referenz | PASS | Integration erhält fremde Template-Referenz und anonymisiert die eigene Übung |
| DB Least Privilege | PASS | Migration als `vytor_migrator`; API-DML erfolgreich, CREATE TABLE/DB abgewiesen; keine Adminflags |
| Case-insensitive Username-Race | PASS | DB-Unique-Index; Migration verweigert Bestandskollisionen |
| PostgreSQL Dump/Restore | PASS | echte 18.6-Custom-Dump-Wiederherstellung, Daten/Sequenzen/Migrationshistorie/Rechte geprüft |
| Restic-Offsite-Restore | BLOCKED | Kein Repository/Provider-Credential; externe Verschlüsselungs-/Retentionkette nicht ausgeführt |

## Manuelle Plattformmatrix

Alle folgenden Punkte sind bis zur realen Ausführung **NOT RUN** für Android, iOS und Web: Registrierung/Login/Logout, Profilbild, Templates, eigene Übungen, Satzoperationen/Drop-Verknüpfung, Timer, Offline/Online, zwei Geräte, Konfliktauflösung, Finish/Discard, Historie, Freunde, Ranking, Settings, Account-Löschung, Theme, Safe Areas, Tastatur, Touch-Ziele, große Schrift und Screenreader.

Zusätzlich:

- EAS Preview-/Production-Build, Signierung und Store-Metadaten: **BLOCKED** (Projekt-ID, Bundle-/Package-ID, Konten und Freigabe fehlen).
- SecureStore-Migration auf Android/iOS einschließlich Backup/Reinstall/Logout-Race: **BLOCKED** (neuer nativer Build und Geräte fehlen).
- Hetzner-Firewall, UFW, IPv6, DNS, TLS-Erneuerung, externe Portprüfung: **BLOCKED** (kein VPS/Domain).
- Externes Uptime-/Backup-Alerting: **BLOCKED** (Betreiber muss Dienst/Ziel wählen und konfigurieren).
- Datenschutz-/Store-Texte und Aufbewahrungsentscheidung: **BLOCKED** (Betreiber-/Rechtsprüfung).
