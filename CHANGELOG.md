# Changelog

Alle wesentlichen Änderungen an Vytor werden in dieser Datei dokumentiert.

## 2026-10-22 – Final Account Deletion Race Fix & Code Freeze

### R5-01 – Sessiongebundene destruktive Account-Aktionen (HIGH)

- **Fehler und Ursache:** Der Settings-Dialog importierte `deleteAccount()` erst nach der Bestätigung dynamisch; die API las Account und Token anschließend neu aus dem globalen Sessionzustand. Eine unter A bestätigte Löschung konnte deshalb nach A→B unter B gesendet werden. Die benachbarte Passwortänderung verwendete denselben ungebundenen Requestpfad. Navigation und Cleanup besaßen kein Ergebnis darüber, ob noch die ursprünglich bestätigte Session aktuell war.
- **Fix:** `src/app/(tabs)/settings.tsx` lädt Settings zusammen mit einem unveränderlichen Account-/Token-Snapshot und erfasst beim Öffnen jedes Logout-/Passwort-/Delete-Dialogs erneut exakt diese angezeigte Identität. `src/services/api.ts` verlangt dieses `SessionRequestBinding` für Löschen und Passwortwechsel, prüft es unmittelbar vor Versand und verwendet ausschließlich dessen Bearer. Cleanup vergleicht Token plus User-ID atomar; die API liefert `sessionCleared`, und nur dann navigiert Settings zu Login. Ein synchrones In-Flight-Ref verhindert doppelte Bestätigung.
- **Cleanup:** Ein bereits unter A gesendeter, später erfolgreicher Delete setzt nur A's Tombstone und bereinigt nur A. Das Account-Delete-Ereignis wird auch nach einem Wechsel zu B accountbezogen zugestellt. `WorkoutProvider` reiht für ein fremdes gelöschtes Konto ausschließlich dessen Purge hinter laufende Writes ein, ohne B-State, B-Draft oder B-Session zurückzusetzen.
- **Betroffene Funktionen:** `accountAction`, `openAccountDialog`, `captureCurrentSessionRequestBinding`, `captureSessionRequestBinding`, `isSessionRequestBindingCurrent`, `deleteAccount`, `changePassword`, `logoutUser` und der Account-Delete-Zweig des Provider-Sessionlisteners.
- **Regression:** `scripts/settings-account-actions.test.ts`, `scripts/account-deletion.integration.test.ts`, `scripts/api-session-races.test.ts` und `scripts/workout-provider.integration.test.ts` prüfen Normalfall, Doppelklick, A→B, A→B→A, Wechsel während Capture, laufenden A-Request, gleiches Passwort, 403, Netzwerkfehler sowie offene Draft-Writes. Frischer Gesamtstand: 90/90 App-/Provider-/Race- und 17/17 Backend-Tests bestanden.
- **Kompatibilität:** Keine neue Runtime-Abhängigkeit, Datenbankmigration oder öffentliche UI-Änderung. Interne API-Aufrufer müssen für destruktive Account-Aktionen eine erfasste Sessionbindung übergeben. Sensitive Eingaben und alte Settings werden bei Sessionereignissen verworfen.
- **Grenzen:** Docker/Caddy/VPS/TLS, Restic-Offsite, EAS und reale Geräte bleiben BLOCKED/NOT RUN. Der geprüfte Arbeitsbaum ist noch uncommittet und damit noch kein unveränderlicher Release-Commit.

## 2026-10-21 – Final Session & Account Isolation Hardening

### R4-01 – Sessiongebundenes Save-Preset (HIGH)

- **Fehler und Ursache:** `savePreset()` wartete auf einen dynamischen API-Import und verwendete anschließend den dann aktuellen globalen Bearer-Token. Nach A→B konnten dadurch Workout-Daten aus A als Template unter B gesendet werden; gleiche Account-ID nach A→B→A genügte außerdem als falsches Gültigkeitssignal.
- **Fix:** `src/context/workout-context.tsx` erfasst Account, Session-Generation und einen unveränderlichen Workout-Payload vor dem ersten Await. `captureSessionRequestBinding()` in `src/services/api.ts` bindet den Request an die atomar gelesene Account-/Token-Identität; der Fetch-Wrapper prüft sie erneut unmittelbar vor Versand. Bereits gestartete Requests behalten den ursprünglichen Authorization-Header. `src/app/(tabs)/index.tsx` zeigt Erfolg nur für die weiterhin aktuelle Provider-Generation.
- **Regression:** Normalfall, Wechsel vor Request, Wechsel während Request, A→B→A, aktueller/staler Netzwerkfehler und unveränderlicher Authorization-Header sind über echte Provider-/API-Pfade mit kontrollierten Promises abgedeckt.

### R4-02 – Identitätsgebundener tokenloser Logout (MEDIUM/HIGH)

- **Fehler und Ursache:** Ein Logout ohne Request-Token fiel auf unbedingtes Credential-Cleanup zurück. Ein verzögerter A-Logout konnte deshalb eine später gespeicherte B-Session oder eine neue A-Session entfernen.
- **Fix:** `SessionCredentialStore` erfasst und vergleicht die vollständige Identität aus Token und User-ID innerhalb derselben serialisierten Queue. `logoutUser()` löscht ausschließlich diese Startidentität, auch wenn der Token fehlt, sendet keinen alten Logout unter einer neuen Session und navigiert nur nach tatsächlich abgeschlossener lokaler Abmeldung. Netzwerkfehler verhindern das sichere lokale Logout der ursprünglichen Identität nicht.
- **Regression:** Gültiger und tokenloser Logout, B-Login, erneuter A-Login, Wiederholung, Netzwerkfehler, paralleler Login und verspäteter 401 sind in `scripts/session-store.test.ts` und `scripts/api-session-races.test.ts` abgedeckt.

### R4-03 – Fail-closed Account-Deletion-Tombstones (MEDIUM)

- **Fehler und Ursache:** Beliebige AsyncStorage-Lese- und JSON-Parsingfehler wurden als leere Tombstone-Liste interpretiert. Dadurch konnte ein Provider-Write trotz unbekanntem Löschstatus Daten eines gelöschten Accounts erneut persistieren.
- **Fix:** `src/services/account-local-data.ts` unterscheidet fehlenden Marker von Lese-, Parsing- und Schemafehlern und wirft bei unbekanntem Status `AccountDeletionBarrierError`. Beschädigte Evidenz wird nicht überschrieben. Die Provider-Write-Queue behandelt eine fehlgeschlagene Prüfung als blockierten Write, bleibt aber für einen späteren verifizierten Retry nutzbar; Tombstone vor Cleanup und idempotenter Startup-Purge bleiben erhalten.
- **Regression:** Fehlender/gültiger Marker, `getItem`-Fehler, beschädigtes JSON/Schema, fehlgeschlagener Tombstone-Write, Recovery, ausstehende Write-Queue, Restart, B-Isolation und wiederholter Purge sind getestet.

### Frische Release-Gate-Ergebnisse und Grenzen

- PASS: Clean Installs, Lint, beide Typechecks, Backend-Build, 79/79 App-/Provider-/Session-/Race-Tests, 17/17 Backend-Tests, PostgreSQL-18.6-Neuinstallation/Least-Privilege/Altstand-Restore, Expo Doctor 21/21 sowie Android/iOS/Web-Export mit HTTPS. Der HTTP-Release-Export wurde erwartungsgemäß abgewiesen.
- PASS (statisch): Deployment-Shellskripte, Compose-YAML, interne Datenbank und ausschließlich über Caddy veröffentlichte Ports 80/443. CI führt die vollständige UI-/Race-Suite aus.
- BLOCKED/NOT RUN: Docker-/Caddy-Runtime, VPS/DNS/TLS/Firewall, Restic-Offsite, EAS und reale Android-/iOS-Geräte. Diese Punkte blockieren Staging-/Produktionsfreigabe, nicht das isolierte Code-Gate. Es wurde kein Commit, Deploy oder Cloud-Vorgang ausgeführt.

## 2026-10-21 – Race Condition & Lifecycle Hardening

### R3-01 – Veraltete Workout-Operationen (HIGH)

- **Ursache:** Finish, Cancel, Start und strukturelle Exercise-Mutationen erfassten Account, Workout und Revision nicht als unveränderliche Operationseinheit. Nach `await` verwendeten einzelne Pfade inzwischen aktuelle Refs oder React-Closures und konnten dadurch State, Revision, Sync-Status oder den Draft eines später angemeldeten Accounts verändern.
- **Fix:** Jede asynchrone Provider-Mutation erfasst vor dem ersten Await eine gemeinsame Identität aus Account-ID, Workout-ID, Session-Generation und Workout-Generation. `flushForOperation()` und Guards nach jedem asynchronen Schritt verhindern stale React-/Ref-Schreibvorgänge. Stale Fehler und 409 ändern keinen neuen UI-State. Finish/Cancel behandeln einen bestätigten Remote-Erfolg weiter, bereinigen aber ausschließlich den ursprünglichen, signaturgleichen Account-/Workout-Draft; ein neuerer oder fremder Draft bleibt unangetastet. Ein Owner-Token verhindert, dass ein alter `finally`-Block eine neuere Mutation als beendet markiert.
- **Tests:** Der echte `WorkoutProvider` wird für Finish, Cancel, Start, Add, Delete, Move und Replace jeweils mit offen gehaltenem A-Promise, Wechsel zu B, eigenem B-Workout/Draft und erst danach eintreffender A-Antwort geprüft. Ergänzt sind stale Reject und 409 sowie Assertions für Workout-ID, Revision, Übungen, Notes, Sync-Status, Storage und Serverziel.

### R3-02 – Account-Delete-Purge-Barrier (HIGH)

- **Ursache:** Nach erfolgreichem Server-Delete entfernte `deleteAccount()` zunächst den Draft; der anschließende allgemeine Session-Listener konnte den zuvor erfassten unbestätigten A-Snapshot erneut schreiben. Bereits laufende Storage-Writes kannten den Löschzustand nicht.
- **Fix:** Session-Ereignisse unterscheiden Login, Logout, Ablauf und bestätigte Kontolöschung. Nach Serverbestätigung wird vor dem Cleanup ein persistenter, auf 20 interne IDs begrenzter Tombstone gesetzt. Jeder Provider-Write prüft diese kontospezifische Barriere; die serialisierte Queue führt danach einen idempotenten Purge aus. Startup wiederholt unterbrochene Purges. Normales Logout/Expiry erhält weiterhin wertvolle Drafts. Fehlgeschlagenes Server-Delete setzt weder Tombstone noch Cleanup noch Session-Event. Der Delete-Request ist vor Versand an die ursprünglich erfasste Account-ID gebunden.
- **Tests:** Echter `deleteAccount()`-Pfad für Erfolg und Serverfehler, idempotenter/beschränkter Tombstone, simuliertes Crashfenster, Restart-Purge sowie echter Provider mit blockiertem A-Write, Delete-Event und parallel nutzbarem B.

### R3-03 – Hydration- und Reload-Generation (MEDIUM/HIGH)

- **Ursache:** Hydration prüfte Settings und Recovery nicht gegen eine Lifecycle-Generation; Reload verglich nur die aktuelle Account-ID. Damit waren A→B→A und zwei überlappende Reloads derselben ID nicht eindeutig.
- **Fix:** Jeder Sessionwechsel invalidiert synchron Session-, Workout-, Storage- und Reload-Generation. Hydration prüft ihre Generation nach jedem Await, bevor Account, Settings, Theme, Recovery, Revision oder Hydrated-State verändert werden. Reloads besitzen zusätzlich eine monoton steigende Request-Generation, sodass ausschließlich der neueste Request schreiben darf.
- **Tests:** A→B mit verspäteten A-Settings, A→B→A mit wiederholter ID, Theme-Isolation, zwei Reloads in umgekehrter Antwortreihenfolge, Restart-/Recovery- und bestehende Offline-/Logout-Races.

### Verifikation, Kompatibilität und Restrisiken

- Frisch ausgeführt: Lint, beide Typechecks, Backend-Build, 61/61 App-/Provider-/Session-Tests, 17/17 Backend-Tests, vollständige isolierte PostgreSQL-18.6-Neuinstallations-/Restore-Suite und Expo Doctor 21/21; alle Exit 0. CI führt `npm run test:ui` einschließlich der neuen Tests bereits aus.
- Keine Datenbankmigration und keine neue Runtime-Abhängigkeit. Öffentliches UI bleibt unverändert; der Workout-Context stellt für überprüfbare Lifecycle-Zustände zusätzlich aktive Workout-ID und Revision bereit.
- Docker/Caddy/TLS/VPS, Restic-Offsite, EAS und reale Android-/iOS-Races wurden in dieser Runde nicht ausgeführt. Diese externen Abnahmen blockieren weiterhin `STAGING_READY`, `INFRA_READY` und `PRODUCTION_APPROVED`, nicht jedoch das lokale `CODE_READY`-Gate.

## 2026-10-21 – Final Production Hardening

### N-01 – Verlustfreie accountgebundene Workout-Drafts (HIGH)

- **Ursache:** `logoutUser()` und der Session-Listener des `WorkoutProvider` entfernten den accountgebundenen AsyncStorage-Snapshot unabhängig von lokaler Änderung und Serverbestätigung. Eine Generationserhöhung konnte außerdem bereits eingereihte lokale Writes überspringen.
- **Fix:** Logout löscht ausschließlich die passende Session. Der Provider erfasst beim Sessionwechsel atomar Account, Workout, Revision und neuesten React-Draft und persistiert nicht bestätigte Daten unter `vytor_active_workout_<accountId>`, bevor der sichtbare State isoliert zurückgesetzt wird. Bestätigte Saves entfernen redundante Caches; Finish, bestätigtes Discard und bestätigte Account-Löschung sind die einzigen weiteren Löschpfade. Recovery erhält lokale Daten bei fehlendem oder abweichendem Server-Workout als Konflikt. Korrupte Snapshots werden weder geladen noch indirekt gelöscht.
- **Datenschutz:** Android Auto Backup ist mit `android.allowBackup=false` deaktiviert. Drafts bleiben kontogebunden in der App-Sandbox; kein zweiter App-Account kann sie laden. Keine ungetestete Verschlüsselungsmigration wurde eingeführt. Root-/Gerätekompromittierung und iOS-Backup/Reinstall bleiben dokumentierte native Restrisiken.
- **Tests:** `scripts/workout-provider.integration.test.ts` mountet den echten Provider mit simuliertem AsyncStorage/API und prüft Offline-Edit → Logout → Account B → Account A, Logout während HTTP-Save, Cache-Cleanup, Finish, Discard und beschädigten Snapshot. Ergänzend prüfen Sync-/Recovery-/Account-Cleanup-Tests 409, späte Antworten, lokale Reihenfolge und explizite Kontolöschung.

### N-02 – Startup-Session-Race (MEDIUM)

- **Ursache:** RootLayout rief bei verspätetem 401/404 `clearLocalSession()` und Login-Navigation ohne Bindung an Request-Token oder gespeicherte Identität auf.
- **Fix:** `checkStartupSession()` liefert nur nach compare-and-clear der angefragten Identität ein Navigationsergebnis. 401 nutzt den bereits tokengebundenen Fetch-Cleanup; 404 löscht ausschließlich das Request-Token. Eine neue Anmeldung oder ein Accountwechsel erzeugt `stale` und keine Navigation. Netzwerkfehler behalten die Session.
- **Tests:** `scripts/session-startup.test.ts` deckt keine/gültige/offline Session, aktuellen 401, verspäteten 401/404, Login während Prüfung und ungültige alte User-ID ab; `SessionCredentialStore` serialisiert Token-/User-ID-Cleanup.

### N-03 – Strikte Settings-Revision (LOW/MEDIUM)

- **Ursache:** Der Handler wandelte `revision` mit `Number(...)` um, obwohl der vorgeschaltete Validator bereits strenger war.
- **Fix:** Middleware und Handler akzeptieren ausschließlich einen tatsächlichen JSON-`number`, sichere Ganzzahl, `0..2147483647`; keine String-/Boolean-/Null-Konvertierung. Der atomare Parent-CAS bleibt maßgeblich für 409.
- **Tests:** Unit- und echte HTTP/PostgreSQL-Tests prüfen fehlend, `null`, `false`, `"5"`, negativ, dezimal, zu groß, Array, Objekt, gültig/stale/parallel sowie Settings gegen Finish/Suspend.

### Weitere Änderungen und Kompatibilität

- Neue/angepasste Dateien: Session-Startup/-Store, accountbezogene lokale Bereinigung, Workout-Sync/Provider/Recovery, Settings-Validator/-Route, CI-Tests, Android-Backup-Konfiguration und Release-Dokumentation.
- Testabhängigkeit `react-test-renderer` exakt `19.2.3` ergänzt; keine Runtime-Abhängigkeit und keine Schema-Migration.
- PostgreSQL-18.6-Neuinstallation und Altstand-Custom-Dump/Restore mit Ownership, Pending-Migrationen, Sequenzen, FKs und Rollen erneut bestanden.
- Expo-kompatible SDK-57-Patches (`expo` 57.0.31, Router 57.0.29, UI 57.0.26) installiert. Backend-Production-Audit: 0 Advisories. Root-Audit: 21 transitive Befunde (3 moderate, 18 high, 0 critical); High-Befunde liegen in Expo/Metro/CLI-Buildpfaden, kein nachgewiesener High-Runtime-Pfad. Der moderate Router-Decode-Pfad bleibt bis zu einem kompatiblen Expo-Update akzeptiertes Beta-Risiko.
- Reproduzierbarkeit: Server-`postinstall` von einem nicht existierenden tolerierten Prisma-Befehl auf verpflichtendes `prisma generate` korrigiert; beide `npm ci`-Installationen wurden anschließend erfolgreich wiederholt.
- Docker/Caddy/VPS, Restic-Offsite, EAS und reale Android-/iOS-Geräte bleiben BLOCKED/NOT RUN und verhindern `INFRA_READY`/`PRODUCTION_APPROVED`.

## 2026-10-21 – Independent Review Remediation

### Findings, Root Cause und Korrektur

- **VY-01 · HIGH · Draft-Flush-Race:** `flushWorkoutDraft()` interpretierte `syncing.current` als erfolgreichen Abschluss; ein Resume konnte daher vor dem Save fortfahren und verspätete Antworten konnten globale Revisionen verändern. `WorkoutDraftSyncCoordinator` stellt nun eine gemeinsam abwartbare Promise bereit, sendet während eines Saves entstandene Änderungen in Folgerevisionen und bindet Accept/Persist/Status an Account, Workout-ID und Generation. 409, Netzwerk- und lokale Speicherfehler propagieren; der lokale Draft bleibt erhalten. Betroffen: `src/context/workout-context.tsx`, `src/services/workout-draft-sync.ts`, `scripts/workout-sync.test.ts`. Tests: laufender Save vor Wechsel, verspätete Antwort, Folgeänderungen, 409, Netzwerk, zwei Wechsel, Accountwechsel und Background-Flush.
- **VY-02 · HIGH · veralteter 401:** Der Fetch-Wrapper löschte bei jedem 401 die dann aktuelle Session. `clearSessionCredentialsIfCurrent(expectedToken)` führt Tokenvergleich und Löschung in derselben Session-Queue aus; Listener werden nur bei tatsächlicher Invalidierung benachrichtigt. Betroffen: `src/services/api.ts`, `src/services/session-store.ts`, `src/services/session-store-core.ts`, `scripts/session-store.test.ts`. Tests: alter 401 nach neuem Login, parallele 401, Logout, Accountwechsel, aktuelle Session und fehlgeschlagener Write.
- **VY-03 · HIGH · Restore-Ownership:** `--no-owner` plus Admin-Restore ließ Bestandsobjekte beim Administrator; Schema-Ownership allein genügte nicht. Das Rollenskript überträgt ausschließlich administrator-eigene App-Relationen, freie Sequenzen, Views, Funktionen und Enum-/Domain-Typen in `public` an `vytor_migrator`; tabellengebundene Sequenzen folgen ihrem Table-Owner. `restore.sh` führt die Reparatur automatisch aus. Betroffen: `deployment/postgres/init-roles.sh`, `deployment/restore.sh`, `server/scripts/test-database.mjs`. Der PostgreSQL-18.6-Test restauriert einen echten 10-Migrations-Altstand, wendet zwei ausstehende Migrationen als Migrator an und prüft Owner, DDL, API-DML/DDL-Denial, Daten, FK, Sequenzen und Historie. Keine Schema-Migration hinzugefügt.
- **VY-04 · MEDIUM/HIGH · CI-Release-URL:** Die Release-Export-Pipeline verwendete HTTP und PostgreSQL 17. CI nutzt jetzt PostgreSQL 18 und die reservierte, nicht live geroutete HTTPS-Adresse `https://api.invalid`; ein Negativschritt erwartet beim HTTP-Release-Export einen Fehler. HTTPS-Validierung blieb unverändert streng. Betroffen: `.github/workflows/checks.yml`.
- **VY-05 · MEDIUM · Legacy-Token-Migration:** Die Migration prüfte nur das Tokenformat und ließ bei vorhandenem SecureStore-Token Klartextreste zurück. `GET /api/session` validiert Token und Kontozuordnung vor Übernahme; Offline/Timeout verschieben die Migration, SecureStore-Write wird zurückgelesen, Klartext erst danach entfernt. Bestehender SecureStore-Token gewinnt und bereinigt Legacy; Login/Logout/Wechsel/Migration sind serialisiert und crash-wiederholbar. Betroffen: Session-Store, API und `server/src/index.ts`. Unit-Tests decken gültig/ungültig, offline, Timeout, Read/Write-Fehler, Crashfenster, Doppelablage, Logout, Accountwechsel und Neustart ab. Native Geräte bleiben offen.
- **VY-06 · MEDIUM · Snapshot-Validierung:** Der alte Guard prüfte Messwerte und viele Pflichtfelder nicht. Der neue Guard validiert vollständiges Clientmodell, Strings/numerische Draftwerte, IDs/Nummern/Eindeutigkeit, Enums, Units, Bounds, vorherige Sets, Drop-Ursprung und verschachtelte Strukturen; leere Eingabefelder bleiben gültig. Abgelehnte Snapshots werden ignoriert, nicht gelöscht. Betroffen: `src/utils/recovery.ts`, `scripts/recovery.test.ts`, `server/src/training.test.ts`.
- **VY-07 · MEDIUM · Settings-Revision:** Settings prüften den Workout-Zustand vor einem unbedingten Child-Update. Die Route verlangt nun `revision`, erhöht den Parent per atomarem `updateMany`-CAS in derselben Transaktion und liefert bei stale/finished/suspended 409. Clientvertrag und Validator wurden angepasst. Betroffen: `server/src/index.ts`, `server/src/workout-validation.ts`, `src/services/api.ts`, Tests. Integration prüft gültig, stale, parallel, fremd, beendet sowie Finish-/Suspend-Races.
- **VY-08 · MEDIUM · Dokumentationsdrift:** Operative Autorität ist `docs/DEPLOYMENT_RUNBOOK.md`; Gates stehen in `DEPLOYMENT_READINESS.md`, Remediation-Evidenz in `INDEPENDENT_REVIEW_REMEDIATION.md`. Der erste Handoff ist historisch markiert. README, Techstack, Security-/Hetzner-Dokumente, Checkliste und TODO wurden gegen Code und Tests abgeglichen.

### Ausgeführte Regression und Ergebnis

- PASS: `npm run test:ui` mit 33/33 Tests; neue Session-, Sync- und Recovery-Fälle eingeschlossen.
- PASS: `npm --prefix server test` mit 17/17 sowie Backend-Build und beide Typechecks.
- PASS: `npm --prefix server run test:isolated` auf PostgreSQL 18.6, einschließlich HTTP-Races, frischer Installation und Altstand-Restore.
- PASS: `npm run lint` und `git diff --check`.
- Die vollständigen abschließenden Befehle, Exitcodes, Export-/Doctor-Ergebnisse und Grenzen stehen in `docs/INDEPENDENT_REVIEW_REMEDIATION.md`.

### Verbleibende Risiken

- Keine neuen Datenbankmigrationen. Bestehende Drop-/Username-Migrationen bleiben unverändert.
- Native SecureStore-/Workout-Races, Docker/Caddy/TLS/VPS, Restic-Offsite, EAS/Signierung, zwei reale Geräte und Betreiber-/Datenschutzfreigabe bleiben ausstehend. Expo/Metro-Transitiv-Advisories bleiben ohne ungeprüften Major-Wechsel offen.

## 2026-10-21 – Security Audit und Deployment Readiness

### Behobene Probleme

- **Workout-Revisionslücke (hoch):** Add/Delete/Reorder prüften die Revision nicht; Reorder schrieb mehrere Zeilen ohne atomaren Versionswechsel. Alle strukturellen Operationen verwenden nun ein bedingtes Workout-Update in derselben Transaktion, erhöhen die Revision und liefern bei stale Clients 409. Betroffen: Serverrouten, Client-API und `WorkoutProvider`. PostgreSQL-Race-/Stale-Regression ergänzt.
- **Draft-Verlustfenster (hoch):** Fire-and-forget-AsyncStorage-Writes konnten ältere Snapshots zuletzt schreiben; Draft-Wechsel wartete nicht auf Debounce/Sync. Lokale Writes sind serialisiert, Sessionwechsel invalidiert ausstehende Writes, App-Hintergrund und Draft-Wechsel flushen. Korrupte Caches (`sets:[null]`, falsche Typen/IDs) werden vor partieller Zustandsänderung verworfen.
- **Drop-Set-Ancestry (mittel):** Drop-Sets hingen nur von Arraypositionen ab. `WorkoutSet.dropSetOfId` mit FK, Client-IDs und Finish-Verknüpfung ergänzt. Migration `20261021120000_stable_drop_sets` ordnet historische Drops dem nächsten vorherigen Nicht-Drop-Satz zu.
- **Native Sessionablage (mittel):** Token von AsyncStorage zu Expo SecureStore 57.0.4 migriert; Write/Read-Verifikation vor Legacy-Löschung, serialisierte Migration/Logout, kein nativer Klartext-Fallback. Web verwendet tabgebundenes `sessionStorage`. Neuer nativer Build und Geräteabnahme bleiben erforderlich.
- **DB-Superuser (hoch):** Admin-, Migrations- und DML-only-API-Rolle getrennt. Init-/Grant-Skript, Compose-URLs und getrennte Docker-Targets ergänzt. PostgreSQL 18.6 bestätigte Migration ohne Admin sowie verweigerte API-DDL/DB-Erstellung.
- **Private Beta (mittel):** Produktion verweigert Registrierung ohne gültigen SHA-256-geprüften Invite-Code. Klartextcode bleibt außerhalb Serverkonfiguration/Repository.
- **Privacy/Social (mittel):** Nicht-Freunde erhalten keine exakten Workout-Zeitpunkte. Accept/Reject verwendet atomare Pending-Transitions. Account-Löschung entfernt freie Custom Exercises und anonymisiert referenzierte. Reject/Withdraw/Remove/Race und Fremdreferenz sind integriert getestet.
- **Username-Race (mittel):** Funktionaler Unique-Index auf `lower(username)`; Migration `20261021121000_case_insensitive_usernames` verweigert kollidierende Bestandsdaten statt sie destruktiv zu ändern.
- **Runtime-Härtung:** Prisma auf 7.10.1 aktualisiert (Backend Production Audit: 0), Prisma-CLI aus dem API-Runtime-Target entfernt, Graceful Shutdown/HTTP-Timeouts, Caddy-Healthchecks und Compose-Ressourcenlimits ergänzt.

### Verifikation

- PASS: Lint, beide Typechecks, Backend-Build, 17 Backend- und 16 UI-Tests, Expo Doctor 21/21.
- PASS: isolierter PostgreSQL-18.6-Test mit zwölf Migrationen, Mehrkonto-HTTP/Races, Rollen, Custom-Dump/Restore, Daten, Sequenzen, Grants und Migrationshistorie.
- PASS: Android/iOS/Web-Export mit expliziter HTTPS-URL; lokaler HTTP-Release-Export wurde erwartungsgemäß abgewiesen.
- BLOCKED: echter Dockerbuild/Compose/Caddy/TLS/Firewall (Docker/VPS fehlen), Restic-Offsite-Kette, EAS/native Geräte und rechtliche Betreiberfreigabe.
- Dependency-Risiko: Root-Audit meldet 29 Expo/Metro-Transitivbefunde; vorgeschlagene npm-Fixes sind inkompatible Expo-Downgrades/SDK-58-Schritte. Kein ungeprüftes Major-Upgrade durchgeführt.

### Dokumentation und Kompatibilität

- Neu: `TECH_STACK.md`, `DEPLOYMENT_READINESS.md`, `DEPLOYMENT_RUNBOOK.md`, `ROLLBACK_AND_RECOVERY.md`, `PRIVACY_TECHNICAL.md`, `CODEX_REVIEW_HANDOFF.md`; README, Release-Checkliste und Hetzner-Dokumente aktualisiert.
- Schemaänderungen sind additiv; die Username-Migration kann vorab wegen Bestandskollisionen stoppen. SecureStore benötigt neue native Builds. Produktionsvariablen benötigen getrennte DB-Credentials und optionalen Invite-Hash.

## 2026-10-16 – Home-Redesign, Rest-Day-Streak und Settings

### Added

- Rest-Day-Streak aus eindeutigen lokalen Workout-Abschlusstagen: Bis zu zwei Ruhetage zwischen Trainings erhalten die Serie; ohne weiteres Workout verfällt sie erst zu Beginn des fünften Tages. Mehrere Workouts am selben Tag zählen einmal.
- Gemeinsamer Fortschrittsbalken und Tageswechsel-Hook: Aktualisierung bei Home-Fokus, nach Abschluss/Neuladen, lokaler Mitternacht und Rückkehr aus dem Hintergrund, ohne separate Streak-Persistenz oder Polling.
- Zehn Streak-Tests einschließlich Zeitzonen, Sommerzeit und Ablaufgrenze; insgesamt 16 UI-/Geometrie-/Kalender-/Streak-Tests.

### Changed

- Home an `vytor_home_design_variante_2.png` ausgerichtet: kleinere Wortmarke, angepasste Typografie und Abstände, dunkle Karten sowie dezenteres Orange (`#E89235`) mit passendem Start-Button-Verlauf.
- Progress zeigt echte Monats-Workouts, Day Streak und globalen Rang. Der vorhandene Start-Flow sowie Level-/XP-/Ranking-Berechnungen bleiben erhalten.
- Recent Workouts auf Home ohne Icons, mit lokalen Tagesangaben, Dauer und Detailnavigation; zunächst drei Einträge, weitere über „See all“.
- Profil zeigt zwei Reihen à sieben Tageskacheln für die letzten 14 Tage inklusive heute. Je Tag erscheint die Muscle-Load-Vorschau des zuletzt abgeschlossenen Workouts; Tage ohne Training bleiben leer. Separate Muskel-Chips, Legende und Filter entfernt.
- Friends-Leaderboard in einheitlichen Zeilen mit Rang, Namen, Level und XP; lange Namen, Trennlinien und Activity-Karten vereinheitlicht.
- Settings als aufklappbare Buttons mit aktuellen Werten; Minuten-/Sekundenfelder für den Pausentimer. Logout ist ein eigener Button, Kontolöschung steht separat in der Danger Zone.
- Zentrale Theme-/Layout-Tokens, responsive Übersichten und konsistente Navigation mit vier bestehenden Tabs.
- TODO auf offene Aufgaben reduziert; abgeschlossene Einträge und doppelte Audit-Befunde entfernt.

### Fixed

- Entwürfe akzeptieren `restSeconds: null` als fehlende individuelle Pause. Dadurch scheitert das Speichern vor dem Workout-Abschluss nicht mehr mit „Invalid draft exercise“.
- Ungültiger JSX-Leerzeichen-Textknoten im Footer der Übungsauswahl entfernt.

### Validation und lokale Entwicklung

- Lint, App-/Server-Typecheck, UI-/Logiktests und PostgreSQL-Integration geprüft; zusätzliche Regression für Speichern, Wiederherstellen und Abschluss mit leerer Pausenvorgabe sowie ungültige Pausenwerte.
- Browserprüfung bei 320/344/360/390/768/1440 px: Workout-Flow, Tageskacheln, Settings, Home-Navigation, stabile Motivationssprüche, Leaderboard-Gleichstände, Theme-Wechsel und Streak-Verfall um Mitternacht ohne zusätzliche Historienabfrage.
- Exporte für Web, iOS und Android erfolgreich; native Geräte- und Release-Abnahme bleiben offen.
- Android-LAN-Verbindung nach Netzwerkdiagnose vom Nutzer als funktionierend bestätigt. Eine auf WLAN-Adresse und lokales Subnetz beschränkte Windows-Firewall-Freigabe für API-Port 3000 wurde lokal angelegt; sie ist keine versionierte App-Konfiguration. Die einzelne Netzwerkursache wurde nicht abschließend isoliert.

## 2026-10-16 – Responsives Workout-Layout und anatomische Muskelkarte

- Gemeinsame Spalten für Überschriften und Eingaben aller fünf Messarten; 48-Punkte-Zeilen, einzeiliges SESSION und Einheiten innerhalb des Feldrahmens ohne Überlagerung.
- Volle mobile Inhaltsbreite, begrenzte Desktopbreite, konsistente Kartenabstände, lange Übungsnamen und unverrückte Drop-Markierungen.
- Footer außerhalb des Scrollbereichs, automatische Tastatur-Scrollhilfe und ausgeblendete Tab-Leiste bei Tastatureingabe.
- Set-/Session-Bezeichnungen in Satzaktionen, Abschlusscheckliste und Detailansicht vereinheitlicht.
- Anatomische MuscleMap-Konturen aus OpenGyms separat MIT-lizenzierten Geometriedaten; Vorder-/Rückseite, zwei Körperformen, Zeitraumfilter, interaktive Muskeln und hellere indirekte Kupfertöne.
- Eigene detaillierte Bewegungs-/Kategoriezuordnung und vollständige Drittanbieterhinweise; keine AGPL-Anwendungslogik übernommen.
- Expo-kompatibles `react-native-svg`, fünf UI-/Geometrietests und Browser-Prüfskript für fünf Bildschirmbreiten.
- Bestehende API-Schnittstellen, Datenmodelle und Workout-Geschäftslogik bleiben erhalten. Offene Punkte aus dem TODO-Audit sind separat gekennzeichnet.

## 2026-10-16 – TODO-Umsetzung

### Added

- Versionierte Workout-Entwürfe mit kontoabhängigem Offline-Cache, Wiederholungsversuchen, Wiederherstellung nach Login und expliziter Geräte-Konfliktauflösung.
- Partieller Datenbankindex gegen parallele aktive Workouts; atomarer Übungsersatz. Ältere doppelte offene Trainings bleiben als wiederaufnehmbare pausierte Entwürfe erhalten.
- Workout-Notizen, dauerhafte persönliche Form-Cues sowie gespeicherte Einheiten und Pausen je Übung.
- Persönliche Übungen mit Editor, Kategorie, Messart und historienerhaltender Archivierung.
- Presets auf Basis bestehender Vorlagen inklusive Zielen je Satz, Satztypen, Einheiten und Pausen.
- Freie Timer, validierte Zifferneingabe für `hh:mm:ss`, Einfügen einzelner Sätze und Drop-Set-Verbindungen.
- Ergebnisansicht mit Gesamt-/Übungs-XP, Levelbalken, Epley-1RM und Verbesserungen gegenüber früheren Trainings.
- XP-Ränge Bronze/Silver/Gold/Platinum/Diamond und eigenständig erstellte Muskelübersicht für direkte/indirekte Belastung.
- Zentrales Hell-/Dunkel-/System-Theme, plattformübergreifende Bestätigungsdialoge und Avatar-Fallback.
- Feedbackeingang mit Datenschutzhinweis, Passwortänderung mit Session-Widerruf und bestätigte Kontolöschung.
- Acht Unit-/Logiktests, isolierte PostgreSQL-/HTTP-Integrationssuite, GitHub-Checks, EAS-Profile und manuelle Release-Testmatrix.

### Changed

- Start- und Finish-/Verwerfen-Aktionen bleiben am unteren Bildschirmrand erreichbar; Übung hinzufügen steht oben rechts.
- Leaderboard steht im Friends-Tab; das eigene Profil trennt „Level X“, XP-Rang und globalen Rang.
- Workout-Details werden gezielt geladen und für Besitzer sowie bestätigte Freunde freigegeben; andere Profile verlinken die eigene Trainingsübersicht.
- Die alte Starter-Vorlage wird aus der Auswahl ausgeblendet; globale Vorlagen bleiben geschützt.
- Einheiten stehen direkt hinter den Eingaben und werden in Übungsoptionen gewählt; Settings bieten eine freie Standardpause.
- Bildauswahl fordert keine Kamera-/Mikrofonberechtigungen mehr an.

### Fixed

- Freundschaftsanfragen scheitern nicht mehr am fehlenden Prisma-Pflichtfeld `updatedAt`; konkurrierende Anfragen werden je Nutzerpaar serialisiert.
- Historische Messartenmigration verwendet das gewählte Schema, konvertiert `MILES` korrekt und erhält vorhandene Messarten.
- Übungslöschung und Sortierung melden Backend-Fehler sichtbar; Übungsersatz verliert bei Fehlern keine ursprüngliche Übung.
- Profilbilder werden in öffentlichen Profilen und Freundeslisten angezeigt; Profilrahmen sind rund.
- Freestyle-Suchfeld lässt sich leeren, Auswahl lässt sich zurücknehmen, selbst erstellte Übungen erscheinen nach Rückkehr im Picker.
- Leere Abschlüsse vergeben keine XP; Einheiten, doppelte Sätze, veraltete Versionen und Vorlagenkonfigurationen werden geprüft.
- Unfertige lokale Änderungen werden beim Neustart nicht stillschweigend durch Serverdaten überschrieben.

### Validation

- Lint, App-/Server-Typecheck, Unit-Tests, vollständige Migrationskette/Seed und echte API-Tests gegen PostgreSQL geprüft.
- Expo Doctor: 21/21 Prüfungen erfolgreich. Additive Migration auf der lokalen Entwicklungsdatenbank angewendet.
- Expo-Export für iOS, Android und Web erfolgreich; manuelle Geräte- und Store-Abnahmen bleiben ausdrücklich offen.

## 2026-10-16

### Added

- Plattformgerechte Symbole für Home, Freunde, Profil und Einstellungen in der Tab-Leiste.
- Bestätigungsdialog vor dem Abschließen eines Workouts; Abbrechen bleibt ebenfalls abgesichert.
- Persönliche Workout-Vorlagen mit Erstellen, Bearbeiten und Löschen.
- Besitzerzuordnung für persönliche Vorlagen; globale Seed-Vorlagen bleiben schreibgeschützt.
- Serverseitige 30-Tage-Sessions mit Bearer-Token und Logout.
- XP-Ereignisse, quadratische Levelkurve und globale Rangliste mit Gleichständen.
- Profilfortschritt, Top-5-Ranking und echte Aktivitätsdaten auf Freundesprofilen.
- Persistenz und Wiederherstellung aktiver Workouts sowie expliziter Workout-Abbruch.
- Backend-Synchronisierung für Entfernen, Ersetzen und Sortieren aktiver Übungen.
- Einstellungen für Gewichts-/Distanzeinheit, Pausendauer und Darstellungspräferenz.
- Ablehnen und Zurückziehen von Freundschaftsanfragen sowie Entfernen von Freunden.
- Umgebungsbeispiele für API, Datenbank und Server-Port.
- Unit-Tests für Level-, Fortschritts- und XP-Regeln.

### Changed

- Der Übungskatalog verwendet passende Messarten: Kampfsport und statische Übungen erfassen Zeit, Cardio Distanz und Zeit, Körpergewichtsübungen Wiederholungen und Carries Gewicht und Distanz.
- Eine Datenmigration korrigiert Messarten bereits vorhandener Übungen, damit beispielsweise Muay Thai keine Gewichtsangabe mehr anzeigt.
- Prisma-Schema, Migrationen, Seed und API verwenden einheitliche Mess-, Distanz- und Freundschaftsfelder.
- Workout-Abschluss speichert Sätze, Abschlusszeit und XP atomar in einer Transaktion.
- Neue Workouts übernehmen die bevorzugten Einheiten; der Pausentimer nutzt die gespeicherte Dauer.
- App- und Server-TypeScript-Konfigurationen sind getrennt und der Server verwendet ESM.
- Expo-Pakete wurden auf die von SDK 57 erwarteten Patchversionen gebracht und native Abhängigkeiten dedupliziert.

### Fixed

- Vorlagen erzeugen vollständige Übungen für alle unterstützten Messarten.
- Netzwerkfehler beim App-Start melden den Benutzer nicht mehr automatisch ab.
- Fest eingetragene Level-, Rang- und Freundesaktivitätswerte wurden entfernt.
- Bestehende Theme-, Style-, Seed- und API-Typfehler wurden behoben.

### Security

- Private API-Routen benötigen eine gültige Session und prüfen den angemeldeten Benutzer bei privaten Ressourcen.
- Passwörter bleiben mit bcrypt und Kostenfaktor 12 gehasht; Session-Token werden nur als SHA-256-Hash gespeichert.
