# Vytor – Final Production Review

Stand: 21.10.2026. Dieses Dokument beschreibt überprüfbare Evidenz, keinen Produktivbetrieb. Maßgebliche Betriebsanleitung ist `DEPLOYMENT_RUNBOOK.md`; Einzelgates stehen in `RELEASE_CHECKLIST.md`.

## A. Repository-Identität

- Ausgangscommit und derzeitiger `HEAD`: `68999e91837e4e2b33d23607d9698f0610aa01ee` (`Harden security and deployment readiness`).
- Der geprüfte Stand ist ein **uncommitteter Arbeitsbaum** auf diesem Commit. Es wurde kein Commit, Push, Tag oder Cloud-Deploy erzeugt. Ein unveränderlicher Release-Commit existiert daher noch nicht.
- Änderungen betreffen Client-Session/Draft/Recovery, Servervalidierung und Integrationstests, PostgreSQL-Restore-Rollen, CI, Expo-Konfiguration sowie Release-/Deployment-Dokumentation. Vollständige Liste: `git status --short` im Abnahmeprotokoll; keine bestehenden Migrationen geändert und keine neue Migration ergänzt.
- Relevante Migrationen bleiben `20261021120000_stable_drop_sets` und `20261021121000_case_insensitive_usernames`; insgesamt zwölf Migrationen.
- Getestete Hauptstände: Node 24.21.0/npm 12.2.0, Expo 57.0.31, Expo Router 57.0.29, React/Renderer 19.2.3, React Native 0.86.3, TypeScript 6.0.3, Express 5.2.1, Prisma 7.10.1, PostgreSQL 18.6. Container-Sollstände: Node 22.23.3-bookworm-slim, PostgreSQL 18.6-bookworm, Caddy 2.10.2-alpine; Registry-Digests sind vor VPS-Deployment noch festzulegen.
- Reproduzierbarkeit: beide `package-lock.json` sind maßgeblich. Releaseexport benötigt eine explizite HTTPS-`EXPO_PUBLIC_API_URL`. Produktion benötigt die Variablen aus `.env.production.example` und getrennte Admin-/Migrator-/API-Passwörter.

### Nachtrag: Final Race Condition Remediation

Die Findings R3-01 bis R3-03 sind im uncommitteten Arbeitsbaum behoben. Workout-Mutationen verwenden eine gemeinsame unveränderliche Account-/Workout-/Session-/Workout-Generationsidentität; Hydration und Reload besitzen Lifecycle-/Request-Generationen; erfolgreiche Kontolöschung setzt vor lokalen Writes eine persistente kontospezifische Purge-Barriere. Details, Operationsmatrix und ausschließlich in dieser Runde neu ausgeführte Evidenz stehen in `FINAL_RACE_CONDITION_REVIEW.md`.

Frisch nach den R3-Codeänderungen bestanden: `npm run lint`, beide Typechecks, Backend-Build, `npm run test:ui` 61/61, Backend 17/17, isolierte PostgreSQL-18.6-Neuinstallations-/Restore-Suite und Expo Doctor 21/21. Frühere Installations-, Export-, Audit- und Docker-Nachweise in diesem Dokument wurden in der R3-Runde nicht als neu ausgeführt gezählt. Das lokale Gate bleibt `CODE_READY=YES`; laufendes Docker-Staging, Infrastruktur, Offsite-Restore und native Geräte bleiben offen.

## B. Findings N-01 bis N-03

### N-01 – Workout-Datenverlust

**Root Cause:** `logoutUser()` löschte `vytor_active_workout_<userId>`. Zusätzlich invalidierte der Session-Listener lokale Writes und reihte unabhängig vom Syncstatus eine Löschung desselben Schlüssels ein. Ein lokal persistierter, aber nicht serverbestätigter Draft ging bei Logout, 401 oder Accountwechsel verloren.

**Änderungen:**

- `src/services/api.ts`: Logout trennt Sessionwiderruf/Credential-Cleanup von Workout-Daten. Netzwerkfehler führen weiterhin zur lokalen Abmeldung; ein neuer Login wird per Tokenvergleich geschützt.
- `src/context/workout-context.tsx`: Sessionwechsel erfasst alten Account, Workout, Startzeit, Revision, neuesten Draft und bestätigte Signatur. Nur unbestätigte Daten werden unter dem alten Account erhalten; sichtbarer State und Timer werden isoliert zurückgesetzt. Späte Saves können keine andere Identität übernehmen.
- Bestätigter Save entfernt einen redundanten Cache. Entstehen während des Saves weitere Änderungen, wird stattdessen der neueste Snapshot mit neuer Revision und alter bestätigter Signatur persistiert.
- Fehlendes/abweichendes Server-Workout überschreibt keinen unbestätigten lokalen Draft, sondern erzeugt einen Konflikt. „Reload server workout“ und „Discard“ erfordern vorhandene Bestätigung im UI.
- Finish und Discard löschen erst nach erfolgreicher Serverantwort. `deleteAccount()` bereinigt erst nach erfolgreicher Kontolöschung und schützt einen parallelen Login. Korrupte Snapshots werden nicht geladen und nicht automatisch gelöscht.
- `app.json`: Android Auto Backup deaktiviert. Drafts bleiben in AsyncStorage/App-Sandbox, kontogebunden und ohne zusätzliche Kopie. Keine ungetestete Verschlüsselungsmigration; Root/Jailbreak und iOS-Backup sind verbleibende native Risiken.

**Tests:** `scripts/workout-provider.integration.test.ts`, `workout-sync.test.ts`, `recovery.test.ts`, `account-local-data.test.ts`, Backend-HTTP/PostgreSQL-Integration. Der Provider-Test bundle-mountet den produktiven `WorkoutProvider` und ersetzt ausschließlich Storage, HTTP, AppState und Theme durch kontrollierte Testadapter.

**Verbleibend:** Ein echtes OS-Kill-Signal, SecureStore/AsyncStorage auf Hardware, iOS-Reinstall sowie zwei physische Geräte sind NOT RUN. Die automatisierte Semantik „lokaler Write abgeschlossen, Prozess endet vor Serverantwort“ ist durch den persistierten Snapshot abgedeckt, nicht durch einen echten Prozessabbruch.

### N-02 – Startup-Session-Race

**Root Cause:** RootLayout behandelte 401/404 mit unbedingtem Credential-Cleanup und Login-Navigation. Eine Antwort der alten Session A konnte deshalb Session B beeinflussen.

**Änderungen:** `src/services/session-startup.ts` zentralisiert die Zustandsmaschine. RootLayout fragt den authentifizierten `/api/session`-Endpunkt ab und verlangt, dass dessen `userId` exakt der lokal gespeicherten Identität entspricht. Der Request erfasst sein Token; 404 nutzt `clearIfCurrent(token)`, ungültige lokale IDs `clearIfUserId`, 401 verlässt sich auf den bereits tokengebundenen Fetch-Cleanup. Vor Navigation wird der aktuelle Zustand geprüft. Offlinefehler löschen und navigieren nicht. RootLayout hat keinen zweiten unkoordinierten Löschpfad.

**Tests:** `scripts/session-startup.test.ts` und `session-store.test.ts`: keine Session, gültig, offline, aktueller 401, verspäteter 401, verspäteter 404, Token/User-ID-Mismatch, neuer Login während Prüfung, Accountwechsel, parallele 401 und Storagefehler.

**Verbleibend:** Native Router-/Lifecycle-Ausführung auf Hardware ist NOT RUN; die Entscheidungsschicht und RootLayout-Verdrahtung sind typgeprüft und automatisiert.

### N-03 – Settings-Revision

**Root Cause:** Der Handler verwendete `Number(req.body.revision)`. Der vorgeschaltete Validator war bereits streng, der Endpunkt selbst dokumentierte/erzwang den Vertrag aber nicht lokal.

**Änderungen:** `server/src/index.ts` und `workout-validation.ts` akzeptieren nur JSON-`number`, sichere Ganzzahl und PostgreSQL-`int4`-Bereich `0..2147483647`. Fehlend, Null, Boolean, String, Dezimal, zu groß, Array und Objekt ergeben vor DB-Zugriff 400. Der transaktionale Parent-Revision-CAS liefert für eine gültige alte Revision 409.

**Tests:** `server/src/workout-validation.test.ts` und `server/scripts/integration.mjs` prüfen alle ungültigen Typen, gültig/stale, fremden Zugriff, parallele Settings sowie Settings gegen Finish und Suspend.

**Verbleibend:** Keines im bekannten Codepfad. Angrenzende revisionierte Workout-Mutationen verwenden denselben strikten Middleware-Validator.

## C. Datenintegrität und Workout-Lifecycle

| Eigenschaft | Nachweis | Ergebnis |
| --- | --- | --- |
| Offline-Draft/Logout/Neustartsemantik | echter Provider + AsyncStorage/API-Test | PASS automatisiert |
| Account A → B → A | B erhält keinen A-State; A lädt eigenen Schlüssel | PASS automatisiert |
| 401/404/Netzwerk | compare-and-clear; offline behält Session/Draft | PASS automatisiert |
| Logout während Save/späte Antwort | Identitätsgeneration verhindert Accept; Snapshot bleibt | PASS automatisiert |
| 409/abweichende Revision | lokaler Draft bleibt, Status Konflikt, kein stiller Overwrite | PASS automatisiert |
| konkurrierende lokale Writes | gemeinsame Queue; Transition-Snapshot zuletzt | PASS automatisiert |
| Server-Save/Finish/Discard | Cache nur nach bestätigtem Pfad entfernt | PASS automatisiert |
| korrupter Snapshot | nicht hydriert und nicht automatisch gelöscht | PASS automatisiert |
| Multi-Device-Revision | Draft/Add/Delete/Reorder/Replace/Settings/Finish über Revision/CAS | PASS PostgreSQL |
| Drop-Set-Referenz | stabile ID/FK und Migrationstest | PASS PostgreSQL |
| XP genau einmal | Finish-Transaktion + Unique-Event/Paralleltest | PASS PostgreSQL |
| kompletter nativer 2-Geräte-Ablauf | reale Android-/iOS-Geräte fehlen | NOT RUN |

Der automatisierte Backend-Lifecycle erstellt Workouts, ändert Struktur/Settings/Drafts, prüft Geräte-Resume/409, Sets/Drop-Sets, Finish, einmalige XP, Historie und Account-Cleanup gegen echtes PostgreSQL. UI-Interaktion und OS-Prozessende bleiben Teil der Gerätematrix.

## D. Security Release Gate

- **Authentifizierung:** bcrypt Cost 12; zufällige 32-Byte-Tokens nur SHA-256-gehasht in PostgreSQL; 30-Tage-Ablauf und serverseitiger Widerruf. Native Ablage über SecureStore, Legacy-Migration servervalidiert. Logout funktioniert lokal bei Netzfehler; alte Requests löschen keine neue Session. Produktionsregistrierung ist ohne Invite-Hash geschlossen.
- **Autorisierung:** Mehrkonto-Integration prüft fremde Workouts/Settings/Templates/Profile/Übungen, Freundschaften und exakte Aktivitätsdaten. Parent-Ownership ist Teil revisionierter Mutationen; fremde Settings ergeben 403.
- **API:** strikte Workout-/Baum-/Bodylimits, Request-Timeouts, rate limits, allowlist-basierte Fehler, keine Tokenlogs, exakte CORS-Origin, feste Proxy-IP und bereinigte Forwarded-Header im Caddyfile. In-Memory-Limits sind nur für die geplante Einzelinstanz geeignet.
- **Datenbank:** API-Rolle ist DML-only; Migrator besitzt Appobjekte/DDL; Admin nur Init/Restore. Frischer Stand und Restore wurden real auf PostgreSQL 18.6 verifiziert.
- **Dependencies:** Server-Production-Audit meldet 0. Nach Installation der aktuellen kompatiblen SDK-57-Patches meldet der Root-Audit 21 transitive Pakete (18 high, 3 moderate, 0 critical). `braces`/`micromatch`/Metro, `node-forge`/Expo CLI und RN-Metro-Ketten laufen in Build-/Development-Werkzeugen und sind nicht als ausgelieferter High-Runtime-Pfad nachgewiesen. `query-string`/`decode-uri-component` hängt über Expo Router im Client und ist ein potenziell erreichbarer moderater DoS-Pfad bei speziell manipulierten URI-Daten. npm schlägt inkompatible Expo-44-/Expo-58-/RN-Downgrades vor; kein `--force`. Für die kleine private Beta ist dies dokumentiertes Restrisiko, vor Storefreigabe erneut zu prüfen. Ein bestätigter High/Critical-Runtime-Pfad würde das Code-Gate wieder schließen.
- **Lokale Daten:** Accountschlüssel und Provider-Isolation verhindern Cross-Account-Anzeige in der App. AsyncStorage ist keine Verschlüsselung gegen ein kompromittiertes Gerät. Android-Cloudbackup ist deaktiviert; iOS bleibt NOT RUN.

## E. Deployment, Restore und Betrieb

| Bereich | Status | Evidenz / Grenze |
| --- | --- | --- |
| PostgreSQL Neuinstallation | PASS | 12 Migrationen als Migrator, API-DML, API-DDL verweigert |
| Bestandsmigration/Restore | PASS lokal | 10-Migrations-Custom-Dump → leere Ziel-DB → Ownership/Grants → 2 Migrationen → Daten/FK/Sequenzen/Historie |
| Docker Images/Compose Runtime | BLOCKED | `docker` nicht installiert; reproduzierbare Stagingprozedur im Runbook |
| Caddy/Proxy/TLS | BLOCKED | Caddy/Docker/Domain fehlen; Datei nur statisch geprüft |
| Firewall/Hetzner | BLOCKED | kein VPS, keine Cloud-/DNS-Aktion autorisiert |
| PostgreSQL-Dump | PASS lokal | Custom-Dump und atomarer Restore |
| Restic-Offsite | BLOCKED | kein Repository/Provider-Credential; nicht mit DB-Restore gleichgesetzt |
| Monitoring/Alarm | BLOCKED | systemd-Timer vorhanden; externer Alarmdienst nicht gewählt |
| RPO/RTO | NOT RUN | Ziel 24 h/4 h; erst Offsite-Übung misst tatsächliche Werte |
| Löschabgleich nach Restore | Betreiberpflicht | Löschjournal gegen restaurierte IDs anwenden, reaktivierte Konten vor API-Start erneut löschen/anonymisieren und Vorgang protokollieren |

Compose veröffentlicht nur 80/443; DB-Netz ist intern. API ist non-root, read-only, ohne Capabilities, mit tmpfs, Limits und Logrotation. Diese Eigenschaften sind Konfiguration, bis `docker inspect` und laufende Stagingtests sie bestätigen.

## F. Testprotokoll

| Befehl | Exit | Umfang | Ergebnis |
| --- | ---: | --- | --- |
| `npm ci` | 0 | Root-Lockfile, 837 Pakete | PASS |
| `npm --prefix server ci` | 0 | Server-Lockfile + Prisma-Client | PASS, 0 Advisories |
| `npm run lint` | 0 | Expo/ESLint Client | PASS |
| `npx tsc --noEmit` | 0 | Client + Root-Tests | PASS |
| `npx tsc --noEmit -p server/tsconfig.json` | 0 | Server | PASS |
| `npm --prefix server run build` | 0 | Server-Produktionsbuild | PASS |
| `npm run test:ui` | 0 | 61 Provider/Session/Recovery/UI-Tests | PASS; in der R3-Runde frisch wiederholt |
| `npm --prefix server test` | 0 final | 17 Unit-Tests | PASS |
| `npm --prefix server run test:isolated` | 0 | PostgreSQL 18.6, HTTP, Neuinstallation, Restore | PASS |
| `npx expo-doctor` | 0 | 21 Checks | PASS |
| HTTPS `expo export --platform all` | 0 | Android/iOS/Web-Bundles | PASS; kein Gerätetest |
| HTTP-Releaseexport | 1 erwartet | HTTPS-Fail-closed | PASS |
| `npm --prefix server audit --omit=dev --json` | 0 | Server Runtime | PASS, 0 |
| `npm audit --json` | 1 | Root/Expo | 24 dokumentierte Befunde |
| Shell `bash -n` | 0 | Deploymentskripte | PASS |
| `docker version` | 127 | Docker-Verfügbarkeit | BLOCKED |
| `git diff --check` | 0 | Patch-Whitespace | PASS |

Zwischenfehler sind keine Freigabenachweise: Ein Backend-Test erwartete nach der absichtlichen Recovery-Verschärfung noch `none` statt `conflict`; Erwartung korrigiert und vollständiger finaler Lauf wiederholt. Der Provider-Test deckte die indirekte Löschung eines korrupten Snapshots auf; der automatische Lösch-Effect wurde entfernt und der Wiederholungslauf bestand. Ein sauberer Server-`npm ci` zeigte, dass der alte tolerierte `prisma skills sync` keinen Client generierte; `postinstall` ist nun `prisma generate`, die saubere Neuinstallation sowie beide Typechecks/Builds bestanden danach.

## G. Präzise offene Blocker

1. **Docker/Caddy-Staging:** Docker und Caddy fehlen lokal. Auf isoliertem Host Runbook-Schritte einschließlich Build beider Targets, Config, Health, Proxyheader, non-root/read-only, Limits, Persistenz, Restart, DB-Ausfall/Reconnect und Shutdown ausführen. PASS erst mit Befehls-/Exit-/Requestprotokoll.
2. **Externes TLS/Firewall:** VPS, Domain und Freigabe fehlen. Hetzner/UFW konfigurieren, extern 80/443 sowie geschlossene 3000/5432/IPv6 prüfen, Zertifikatskette/-erneuerung und Header testen. Dann erst `INFRA_READY`.
3. **Offsite-Backup:** Restic-Repository, Passwort und Providerzugang fehlen. Backup, `restic check`, Retention, Alarmfehler und Restore auf separatem Host durchführen; RPO/RTO messen. Dann erst Backup-PASS.
4. **Native Geräte:** EAS-Projekt-ID, Bundle-/Package-Identifier, Signierung, Builds und Geräte fehlen. Zwei Konten auf Android/iOS gemäß Checkliste testen, einschließlich Offline-Logout-Draft, Zweigerätekonflikt, Reinstall, Keychain, Timer und Accessibility. Dann erst Client-PASS.
5. **Release-Identität:** Arbeitsbaum ist dirty und Image-Digests fehlen. Nach unabhängiger Diff-Prüfung einen Commit erstellen, `VYTOR_RELEASE` auf dessen Hash setzen, Images bauen/scannen und Digests pinnen. Dann Suite auf exakt diesem Commit wiederholen.
6. **Betreiber/Datenschutz:** externe Alarmziele, Aufbewahrung, Löschjournal, Datenschutzerklärung und private-Beta-Einwilligung müssen benannt/freigegeben werden. Technische Dokumente ersetzen keine Betreiber-/Rechtsentscheidung.

## H. Release-Entscheidung

| Status | Entscheidung |
| --- | --- |
| `CODE_READY` | **YES** – lokal ausführbarer Code, Datenintegrität und PostgreSQL-Gates bestanden; keine bekannte P0/P1-Codelücke |
| `STAGING_READY` | **NO, NEXT STEP** – Artefakte/Runbook sind vorbereitet, laufende Docker-/Caddy-Stagingabnahme fehlt |
| `INFRA_READY` | **NO** – Zielnetz, TLS, Firewall, Monitoring und Offsite-Restore ungeprüft |
| `DEPLOYED` | **NO** – kein VPS/Cloud-/DNS-/EAS-Deploy durchgeführt |
| `PRODUCTION_APPROVED` | **NO** – Infrastruktur-, Backup-, Geräte- und Betreiberabnahmen fehlen |

Gesamtbewertung: **CODE READY – STAGING NEXT**.

## Release-Commit sicher fixieren

Nach unabhängiger Diff-Prüfung und nur auf ausdrückliche Freigabe:

```bash
git status --short
git diff --check
git diff --stat
git add <explizit geprüfte Dateien>
git diff --cached --check
git commit -m "Finalize production hardening release candidate"
git rev-parse HEAD
```

Danach vollständige Suite auf dem neuen sauberen Commit wiederholen, Commit-ID in `.env.production` als `VYTOR_RELEASE` setzen, Images mit dieser ID bauen und ihre Registry-Digests im Abnahmeprotokoll festhalten. Ohne diesen Schritt ist der hier geprüfte Zustand reproduzierbar über Diff + Basiscommit, aber nicht unveränderlich.
