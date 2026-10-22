# Vytor – Final Race Condition Review

Stand: 21.10.2026. Scope: R3-01 bis R3-03. Basis und aktueller `HEAD`: `68999e91837e4e2b33d23607d9698f0610aa01ee`; der geprüfte Release-Kandidat besteht aus diesem Commit plus dem dokumentierten uncommitteten Arbeitsbaum. Es wurde kein Commit, Push, Deploy oder Cloud-/EAS-Vorgang ausgeführt.

## A. Findings und Korrekturen

### R3-01 – Stale Workout Operations (HIGH)

**Fehler:** Eine für Account A gestartete Workout-Action konnte nach einem Wechsel zu B aktuelle Refs lesen und B-State, B-Revision, B-Syncstatus oder B-Draft verändern. Besonders Finish/Cancel konstruierten ihren Cleanup-Schlüssel erst nach der Serverantwort aus der dann aktuellen Account-ID. Start/Add/Replace luden historische Daten nach und schrieben danach ungeschützt.

**Ursache:** Asynchrone Actions besaßen keine gemeinsame unveränderliche Lifecycle-Identität. Einzelne bestehende Workout-Generationsprüfungen schützten den Draft-Sync, nicht aber alle Provider-Actions und ihre `finally`-/Fehlerpfade.

**Implementierung:** `src/context/workout-context.tsx` erfasst `WorkoutOperationIdentity` aus Account-ID, Workout-ID, Session-Generation und Workout-Generation vor dem ersten Await. `flushForOperation()` sowie Guards nach jedem Await schützen React-State, Revision, Syncstatus und Refs. Stale Erfolge aktualisieren B nicht; stale Reject/409 werden nicht in B angezeigt. Finish/Cancel bereinigen nach Remote-Erfolg nur den ursprünglichen Schlüssel und nur einen noch signaturgleichen Draft. Ein Mutation-Owner verhindert, dass das `finally` einer alten Action den Busy-Zustand einer neueren Action freigibt.

**Grenzen:** Serverseitig bereits angenommene A-Mutationen bleiben angenommen und werden bei Rückkehr zu A über den Server-/Revisionsabgleich sichtbar. Der Client führt keinen Cross-Account-Rollback aus. Native UI-/Router-Ausführung und echte Netzabbrüche bleiben Teil der Geräteabnahme.

### R3-02 – Account Deletion Purge Race (HIGH)

**Fehler:** Nach bestätigtem Account-Delete konnte der allgemeine Session-Listener einen zuvor erfassten A-Draft erneut in AsyncStorage schreiben. Ein bereits laufender lokaler Write kann zudem nach dem ersten Remove eintreffen.

**Ursache:** Logout, Expiry, Login und Account-Delete verwendeten dasselbe untypisierte Session-Signal. Lokale Writes kannten keinen dauerhaften, kontospezifischen Löschzustand.

**Implementierung:** `src/services/api.ts` sendet typisierte Lifecycle-Ereignisse und bindet den Delete-Request vor Versand an die ursprüngliche Account-ID. Erst nach bestätigtem Servererfolg setzt `src/services/account-local-data.ts` einen persistenten, auf 20 interne IDs begrenzten Tombstone und löscht Account-/Legacy-Drafts. Alle Provider-Writes prüfen die Barriere. Der Account-Delete-Listener reiht den idempotenten Purge hinter vorhandenen Writes ein; Startup wiederholt Purges nach einem Crashfenster. Normales Logout/Expiry erhält unbestätigte Drafts. B besitzt keinen globalen Lock und bleibt nutzbar.

**Grenzen:** Bei dauerhaft defektem OS-Storage kann keine App eine physische Löschung garantieren; der Fehler wird nicht als erfolgreicher lokaler Cleanup verschwiegen und der persistente Marker/Startup-Purge ermöglicht Wiederholung, sobald Storage wieder funktioniert. Tombstones enthalten ausschließlich interne IDs, maximal 20 Einträge, keine Benutzernamen oder Tokens.

### R3-03 – Stale Hydration/Reload (MEDIUM/HIGH)

**Fehler:** Eine alte A-Hydration konnte nach B noch Settings/Theme oder Recovery-State schreiben. Reload verglich nur die Account-ID und unterschied deshalb A→B→A nicht. Bei zwei Reloads konnte die ältere Antwort zuletzt gewinnen.

**Ursache:** Hydration und Settings waren nicht an eine Session-Generation gebunden; Reload besaß keine Request-Sequenz.

**Implementierung:** Jeder Sessionwechsel invalidiert Session-, Workout-, Storage- und Reload-Generation synchron. Hydration prüft ihre Generation nach jedem Storage-/API-Await vor Account-, Settings-, Theme-, Recovery- oder Hydrated-Schreibzugriff. Jeder Reload erhält zusätzlich eine monotone Request-Generation; ausschließlich der neueste Request derselben aktuellen Session darf State übernehmen.

**Grenzen:** Ein abgebrochener alter HTTP-Request wird nicht zwingend transportseitig gecancelt; sein Ergebnis ist jedoch logisch wirkungslos. Native Background-/Foreground-Scheduling bleibt noch auf Hardware zu prüfen.

## B. Asynchrone Operationsmatrix

| Operation | Capture vor Await | Guard nach Await | Storage-sicher | Generation-sicher |
| --- | --- | --- | --- | --- |
| `finishWorkout` | Account, Workout, Session/Workout-Generation, Revision, Draftsignatur | nach Flush, Remote-Response und Cleanup | nur ursprünglicher Key + Workout + gleiche Signatur | ja; Mutation-Owner schützt `finally` |
| `cancelActiveWorkout` | Account, Workout, Generationen, Draftsignatur | nach Response und Cleanup | wie Finish; kein B-/neuerer Draft | ja |
| `startWorkout` | Account, vorherige Workout-Identität, Generationen | nach Create und Previous-Sets | kein nachträglich gelesener Account | ja; stale 409 löst keinen Reload aus |
| `addExercise` | Account, Workout, Generationen | nach Flush, Add und Previous-Sets | keine Cross-Account-Schlüssel | ja; Revision erst beim finalen Accept |
| `deleteExercise` | Account, Workout, Generationen | nach Flush und Delete | keine Storage-Löschung | ja |
| `moveExercise` | Account, Workout, Generationen | nach Flush und Reorder | keine Storage-Löschung | ja |
| `replaceExercise` | Account, Workout, Generationen | nach Flush, Replace und Previous-Sets | kein später Account-Read | ja; Mutation-Owner schützt `finally` |
| `flushWorkoutDraft` | Sync-Snapshot mit Account/Workout/Generation | Coordinator prüft nach Save/Persist/Folgeänderung | serialisierte Queue + Tombstone vor Write | ja |
| lokaler Draft-Effect | Account + Storage-Generation | innerhalb Queue vor Set | kontogebundener Key + Tombstone | ja |
| Session-Listener | alten Account/Workout/Draft atomar vor Reset | Queue prüft Event und Tombstone | Logout bewahrt; Delete purgt hinter Queue | ja; alle Generationen synchron invalidiert |
| `hydrate` | Session-Generation | nach Purge, User-ID, Tombstone, Settings, Recovery und Reload | lädt nur aktuellen Account-Key | ja; A→B→A geschützt |
| `reloadActiveWorkout` | Account, Session- und Reload-Generation | nach Tombstone, Local-Read und API | nur ursprünglicher Account-Key | ja; newest request wins |
| `deleteAccount` | ursprüngliche Account-ID vor Request | Identität vor Versand; Compare-and-clear nach Erfolg | Tombstone vor Remove, B unberührt | typisiertes Delete-Event |
| `savePreset` | unveränderlicher Payload aus aktuellem Render | verändert keinen Provider-/Storage-State | nicht an Draft-Key beteiligt | kein geteilter State nach Await |

## C. Neue Integrationstests

| Testdatei / Szenario | Kontrollierte Reihenfolge | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| `workout-provider.integration.test.ts` – Finish | A-Finish offen → B laden + B-Key setzen → A-Erfolg | B-ID/Revision/Notes/Exercises/Key unverändert; A-Servercall ID 10 | PASS |
| dieselbe Datei – Cancel | A-Cancel offen → B → A-Erfolg | wie oben; nur ursprünglicher Cleanup zulässig | PASS |
| dieselbe Datei – Start | A ohne aktives Workout, Create offen → B → A-Erfolg | B bleibt Workout 20/Revision 7 | PASS |
| dieselbe Datei – Add | A-Add offen → B → A-Erfolg | keine A-Übung/Revision in B | PASS |
| dieselbe Datei – Delete | A-Delete offen → B → A-Erfolg | B-Übung bleibt vorhanden | PASS |
| dieselbe Datei – Move | A-Reorder offen → B → A-Erfolg | B-Reihenfolge unverändert | PASS |
| dieselbe Datei – Replace | A-Replace offen → B → A-Erfolg | B-Übung/Revision unverändert | PASS |
| dieselbe Datei – Reject/409 | A-Add offen → B → Reject 500 bzw. 409 | B-State und Syncstatus bleiben unverändert | PASS |
| dieselbe Datei – Delete-Write-Race | A-Storage-Set blockiert → Tombstone/Delete-Event → B → alten Write freigeben | A-Key entsteht nach Queue-Drain nicht erneut; B aktiv | PASS |
| dieselbe Datei – Restart-Purge | Tombstone + erneut vorhandener A-Key → Provider-Neustart als B | A-Key vor B-Hydration entfernt; B normal geladen | PASS |
| dieselbe Datei – A→B Settings | A-Settings offen → B-Settings/Theme → A-Erfolg | nur B-Settings/Theme | PASS |
| dieselbe Datei – A→B→A | erstes A offen → B → neues A erfolgreich → altes A erfolgreich | zweite A-Generation gewinnt trotz gleicher ID | PASS |
| dieselbe Datei – Reload-Reihenfolge | Reload 1 offen → Reload 2 offen → 2 erfolgreich → 1 erfolgreich | Workout 30/Revision 9 bleibt | PASS |
| `account-deletion.integration.test.ts` – API-Erfolg | echter `deleteAccount`, Server 200 | Marker/Purge vor Delete-Event; B bleibt; Token compare-clear | PASS |
| dieselbe Datei – API-Fehler | echter `deleteAccount`, Server 403 | kein Marker, kein Cleanup, kein Credential-Clear/Event | PASS |
| `account-local-data.test.ts` – Barrier/Crash | 25 idempotente Deletes → stale Write → Restart-Purge | Grenze 20; letzter Tombstone purgt; fremder Key bleibt | PASS |

Bestehende Tests decken zusätzlich Offline-Draft über Logout und Relogin, Sessionablauf/401/404, Account-Isolation, Draft-Folgeänderungen, 409, Background-Flush, beschädigte Snapshots, PostgreSQL-Revisionen, erfolgreichen Finish/XP und Drop-Set-Persistenz ab.

## D. In dieser Remediation ausgeführte Befehle

| Befehl | Exit | Ergebnis |
| --- | ---: | --- |
| `npm run lint` | 0 | PASS |
| `npx tsc --noEmit` | 0 | PASS |
| `npx tsc --noEmit -p server/tsconfig.json` | 0 | PASS |
| `npm --prefix server run build` | 0 | PASS |
| `npm run test:ui` | 0 | 61/61 PASS |
| `npm --prefix server test` | 0 | 17/17 PASS |
| `npm --prefix server run test:isolated` | 0 | PostgreSQL 18.6: HTTP-Lifecycle, 12-Migrationen-Neuinstallation, Least Privilege, 10→12-Migrationen-Restore PASS |
| `npx expo-doctor` | 0 | 21/21 PASS |

`npm ci`, Exporte, Dependency-Audits und Docker wurden bereits in der vorherigen Production-Hardening-Runde dokumentiert, aber in dieser R3-Runde nicht erneut als frische Evidenz gezählt. Nach der letzten Dokumentationsänderung werden Lint, Typecheck, App-Tests und `git diff --check` nochmals ausgeführt.

## E. Release-Status

| Gate | Status | Begründung |
| --- | --- | --- |
| `CODE_READY` | **PASS** | R3-01/02/03 behoben; 61 App-/Provider- und 17 Backend-Tests sowie echter PostgreSQL-Lifecycle grün; keine bekannte hohe Cross-Account-/Datenverlust-Codelücke |
| `STAGING_READY` | **NO – nächster Schritt vorbereitet** | Code/Compose/Runbook sind vorbereitet, aber kein laufender Docker-/Caddy-Stagingstack wurde in dieser Umgebung abgenommen |
| `INFRA_READY` | **NO** | VPS, DNS, TLS, Firewall, externes Monitoring und Offsite-Restore fehlen |
| `PRODUCTION_APPROVED` | **NO** | Infrastruktur-, Backup-, native Geräte-, EAS-/Signierungs- und Betreiber-/Datenschutzabnahmen fehlen |

## F. Offene Punkte

- Docker-Images und Compose/Caddy auf isolierter Staging-Infrastruktur bauen und live prüfen.
- Hetzner-Netz, DNS, TLS-Erneuerung, Firewall/IPv6 und externe Porttests abnehmen.
- Verschlüsseltes Restic-Offsite-Backup samt separatem Restore, Alarmierung und RPO/RTO messen.
- Die automatisierten Races auf zwei physischen Geräten mit Offline/Online, Background, Prozessende, Reinstall und SecureStore/AsyncStorage wiederholen.
- EAS-Projektidentität, Signierung, Preview-/Production-Builds, Accessibility und Betreiber-/Datenschutzfreigabe abschließen.
- Expo/Metro-/Router-Advisories vor Storefreigabe erneut gegen kompatible SDK-Patches bewerten.

## G. Git-Zustand

- Basiscommit und `HEAD`: `68999e91837e4e2b33d23607d9698f0610aa01ee`.
- Kein neuer Commit; der Arbeitsbaum ist absichtlich dirty. Vor dieser Datei meldete `git status --short` 43 Einträge; mit diesem Review sind es 44.
- R3-spezifisch geändert/neu: `src/context/workout-context.tsx`, `src/services/api.ts`, `src/services/account-local-data.ts`, `scripts/workout-provider.integration.test.ts`, `scripts/account-local-data.test.ts`, `scripts/account-deletion.integration.test.ts`, `CHANGELOG.md`, `docs/TECH_STACK.md`, `docs/FINAL_PRODUCTION_REVIEW.md`, `docs/RELEASE_CHECKLIST.md`, `TODO.md` und dieses Dokument.
- Weitere bereits vorhandene uncommittete Änderungen aus den vorangegangenen Hardening-Runden betreffen CI, README, Expo-Konfiguration, Deployment-/Restore-Dokumente und Skripte, Servervalidierung/-tests, Session-Store/-Startup, Recovery, Workout-Sync sowie Lockfiles. Maßgeblich für die vollständige Liste ist `git status --short`; keine fremde Änderung wurde zurückgesetzt.
