# Vytor – Release-Checkliste

Stand: 22.10.2026. Statuswerte: **PASS**, **FAIL**, **NOT RUN**, **BLOCKED**, **NOT APPLICABLE**. Ein Export ist kein Gerätetest.

## Automatisierte Gates

| Prüfung | Status | Nachweis |
| --- | --- | --- |
| Reproduzierbare Installation | PASS | `npm ci` und `npm --prefix server ci`, jeweils Exit 0; Prisma Client 7.10.1 generiert |
| Lint | PASS | `npm run lint`, Exit 0 |
| Frontend-Typecheck | PASS | `npx tsc --noEmit`, Exit 0 |
| Backend-Typecheck/Build | PASS | `npx tsc --noEmit -p server/tsconfig.json`; `npm --prefix server run build`, Exit 0 |
| Backend-Unit-Tests | PASS | `npm --prefix server test`: 17/17 |
| UI-/Provider-/Race-Tests | PASS | `npm run test:ui`: 90/90, einschließlich echtem Settings-Screen/`WorkoutProvider`, gebundener Account-Löschung und Passwortänderung, Save-Preset, tokenlosem Logout, fail-closed Tombstones, sieben verzögerten Workout-Mutationen, A→B→A, Delete-Purge, Draft-Sync und Recovery |
| PostgreSQL-18-Integration | PASS | `npm --prefix server run test:isolated`: API-Races, frische 12 Migrationen, Restore aus 10-Migrations-Altstand, Ownership und Pending-Migrationen |
| Expo-Abhängigkeiten | PASS | `npx expo-doctor`: 21/21 |
| Release-Export | PASS | `EXPO_PUBLIC_API_URL=https://api.vytor.example npx expo export --platform all ...`; Android/iOS/Web erzeugt |
| Unsichere Release-URL abgewiesen | PASS | `NODE_ENV=production EXPO_PUBLIC_API_URL=http://api.vytor.example npx expo export --platform all ...`, Exit 1 mit erwarteter HTTPS-Guard-Meldung |
| Backend Production Audit | PASS | `npm --prefix server audit --omit=dev --json`: 0 Advisories nach Prisma 7.10.1 |
| Mobiler Dependency Audit | PASS mit akzeptiertem Restrisiko | nach SDK-57-Patches 21 transitive Befunde: 3 moderate, 18 high, 0 critical. High-Ketten liegen in Expo CLI/Metro/Buildwerkzeugen, nicht im ausgelieferten API-Runtime; ein moderater Router-Decode-Pfad kann im Client-Bundle erreichbar sein. npm bietet nur inkompatible Expo-/RN-Wechsel. Vor Store-Release erneut prüfen; Details in `FINAL_PRODUCTION_REVIEW.md`. |
| Deployment-Preflight (statisch) | PASS | Compose-YAML geparst: db/api/migrate/caddy, internes DB-Netz, nur Caddy veröffentlicht Ports; `bash -n` für compose/backup/restore/init-roles, Exit 0 |
| API-Runtime-Abhängigkeiten | PASS | temporäre Production-Installation enthält Client/Adapter, aber keine Prisma-CLI |
| Docker Build/Compose | BLOCKED | Docker ist in der Audit-Umgebung nicht installiert |
| Caddy-Adapt/Live-TLS | BLOCKED | Kein Caddy/Docker, keine Domain/Testinstallation |
| Secret-Pattern Git-Historie | PASS | Dateinamen-only Scan über alle Commits: keine Private-Key/Bearer/AWS/GitHub-Token-Muster; kein Ersatz für spezialisierten Secret-Scanner |

## Sicherheits- und Datenintegritätsfälle

| Fall | Status | Nachweis |
| --- | --- | --- |
| Bestätigte Account-Löschung A→B/A→B→A | PASS | Settings-, API- und Provider-Tests: exaktes Dialog-Binding, kein B-Request auch bei gleichem Passwort, unveränderlicher A-Bearer nach Versand, kein B-Credential-Clear/Navigation/Draft-Cleanup |
| Passwortänderung nach Sessionwechsel | PASS | Vor Versand unter B blockiert; laufender A-Request behält A-Bearer und kann B nach Antwort nicht abmelden |
| Mehrfache Delete-Bestätigung | PASS | echter Settings-Component-Pfad erlaubt trotz zweier Callbacks nur einen Service-/Netzwerkaufruf; wiederholter stale Callback wird vor Netzwerk blockiert |
| Save-Preset über A→B/A→B→A | PASS | Provider- und API-Race-Tests: kein Versand unter neuer Session, laufender Request behält A-Bearer, späte Erfolge/Fehler verändern B nicht |
| Tokenloser Logout + neue Session | PASS | vollständige Token-/User-ID-Identität wird queue-atomar verglichen; regulär, tokenlos, B-Login, neuer A-Login, Netzwerkfehler, Wiederholung, paralleler Login/401 getestet |
| Tombstone-Lese-/Parsingfehler | PASS | unbekannter Zustand blockiert Writes fail-closed; beschädigte Evidenz bleibt erhalten; verifizierter Retry, Restart, Queue-Drain, B-Isolation und idempotenter Purge getestet |
| Draft: null/falsche Sets, Grenzen, NaN/Infinity, IDs | PASS | Unit- und Provider-Integrationstests; korrupte lokale Snapshots werden nicht geladen und nicht automatisch gelöscht |
| Logout/401/App-Neustart mit unbestätigtem Draft | PASS (automatisiert) | echter `WorkoutProvider` mit AsyncStorage/API-Simulation: lokaler Write bleibt über Logout, leere Session, Account B und erneuten Login A erhalten; native Prozessbeendigung NOT RUN |
| Logout während Save / App-Ende vor Server-Antwort | PASS (automatisiert) | Provider-Race erhält den neuesten Account-A-Snapshot; verspätete Antwort darf neuen State nicht akzeptieren |
| Bestätigter Save / Finish / bewusstes Discard | PASS | Provider-Integration prüft gezielte Cache-Bereinigung ausschließlich nach bestätigtem Pfad |
| Explizite Account-Löschung | PASS | echter Settings-/API-/Provider-Pfad: persistenter Tombstone vor Cleanup, blockierter A-Write wird auch nach bereits aktivem B gepurgt, Restart wiederholt Cleanup; Server-/Netzwerkfehler erhält Daten ohne falschen Abschluss |
| Stale Workout-Actions A→B | PASS | Finish/Cancel/Start/Add/Delete/Move/Replace: verzögerter Erfolg, Reject und 409 dürfen B-Workout, Revision, Notes, Übungen, Sync-Status und Draft nicht verändern |
| Hydration/Reload-Lifecycle | PASS | Session-/Workout-/Reload-Generation schützt A→B, A→B→A, verspätetes Theme/Settings und umgekehrte Antwortreihenfolge konkurrierender Reloads |
| Startup 401/404/Offline/Accountwechsel | PASS | `session-startup.test.ts` und Session-Store-Tests: alte A-Antwort navigiert/löscht B nicht; aktueller 401/404 führt zu Login; Netzwerkfehler behält Session |
| Geordnete lokale Speicherung/Flush | PASS (automatisiert) | gemeinsame Promise wartet laufenden Save und Folgeänderungen ab; alte Workout-/Account-Antworten verworfen; echter Gerätetest ausstehend |
| Revision bei Draft/Add/Delete/Replace/Reorder/Settings/Finish | PASS | PostgreSQL-Integration inklusive stale 409, parallelen Settings sowie Settings-/Finish-/Suspend-Races |
| Drop-Set-Ursprung | PASS | FK-Migration + Integration prüft gespeicherte Ursprung-ID; historische Zuordnung deterministisch |
| Einmalige XP-Vergabe | PASS | paralleler Finish-Test: genau ein Erfolg; Unique-Event + Transaktion |
| Auth/Session/IDOR | PASS | Mehrkonto-HTTP-Tests plus verzögerter 401/404, parallele Requests, RootLayout-Startup, Logout/Accountwechsel und fehlgeschlagener Session-Write |
| Freundschaft Reject/Withdraw/Remove/Race | PASS | PostgreSQL-Integration; Accept/Reject genau ein Gewinner |
| Private-Beta-Registrierung | PASS | Produktion ohne Hash geschlossen; Timing-safe Hashvergleich unit-getestet |
| Exakte fremde Workout-Zeitpunkte | PASS | Nicht-Freunde erhalten leere Aktivitätsliste; Freunde/Eigentümer behalten Zugriff |
| Account-Löschung mit fremder Referenz | PASS | Integration erhält fremde Template-Referenz und anonymisiert die eigene Übung |
| DB Least Privilege | PASS | Migrator besitzt frische und restaurierte App-Objekte/DDL; API-DML erfolgreich, CREATE TABLE/DB abgewiesen; keine Adminflags |
| Case-insensitive Username-Race | PASS | DB-Unique-Index; Migration verweigert Bestandskollisionen |
| PostgreSQL Dump/Restore | PASS | echte 18.6-Custom-Dump-Wiederherstellung eines Altstands, gezielter Owner-Transfer, zwei ausstehende Migrationen, Daten/FK/Sequenzen/Historie geprüft |
| Restic-Offsite-Restore | BLOCKED | Kein Repository/Provider-Credential; externe Verschlüsselungs-/Retentionkette nicht ausgeführt |

## Manuelle Plattformmatrix

Alle folgenden Punkte sind bis zur realen Ausführung **NOT RUN** für Android, iOS und Web: Registrierung/Login/Logout, Profilbild, Templates, eigene Übungen, Satzoperationen/Drop-Verknüpfung, Timer, Offline/Online, zwei Geräte, Konfliktauflösung, Finish/Discard, Historie, Freunde, Ranking, Settings, Account-Löschung, Theme, Safe Areas, Tastatur, Touch-Ziele, große Schrift und Screenreader.

Verbindliche Gerätematrix: zwei physische Geräte (mindestens ein aktuelles Android und ein aktuelles iPhone) und zwei Testkonten A/B. Auf beiden Geräten A anmelden, dasselbe Workout konkurrierend bearbeiten, 409 prüfen, Gerät 1 offline ändern, Logout bei nicht erreichbarer API, Prozess beenden/starten, B anmelden (kein A-Draft), A erneut anmelden (Draft wieder da), bewusst Serverstand laden, Finish gegen Save/Settings prüfen. Danach Android-Deinstallation/Neuinstallation (`allowBackup=false`: kein Draft-Restore), iOS-Deinstallation/Neuinstallation und Keychain-/Draft-Verhalten, Timer im Hintergrund, Safe Areas, 200-%-Schrift und VoiceOver/TalkBack protokollieren.

Zusätzlich:

- EAS Preview-/Production-Build, Signierung und Store-Metadaten: **BLOCKED** (Projekt-ID, Bundle-/Package-ID, Konten und Freigabe fehlen).
- SecureStore-Migration auf Android/iOS einschließlich Backup/Reinstall/Logout-Race: **BLOCKED** (neuer nativer Build und Geräte fehlen).
- Hetzner-Firewall, UFW, IPv6, DNS, TLS-Erneuerung, externe Portprüfung: **BLOCKED** (kein VPS/Domain).
- Externes Uptime-/Backup-Alerting: **BLOCKED** (Betreiber muss Dienst/Ziel wählen und konfigurieren).
- Datenschutz-/Store-Texte und Aufbewahrungsentscheidung: **BLOCKED** (Betreiber-/Rechtsprüfung).
