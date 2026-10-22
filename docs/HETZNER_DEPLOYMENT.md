# Vytor: Vorbereitung und späterer Hetzner-Umzug

Stand: 21.10.2026. **Nur vorbereitet. Kein VPS, DNS, Build oder Deployment angelegt;
keine Daten migriert. Alle folgenden Betriebsbefehle sind erst später manuell auszuführen.**
Das verbindliche aktuelle Ablaufdokument ist [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md);
bei Widersprüchen gilt dieses. Der vorliegende Hintergrundtext bleibt als Detailreferenz erhalten.
Vor Internetfreigabe die umgesetzten Schutzmaßnahmen und verbleibenden Risiken in
[HETZNER_SECURITY_REVIEW.md](HETZNER_SECURITY_REVIEW.md) abnehmen und die reale Caddy-IP-Kette testen. Der vorbereitete Stand ist keine Freigabe für öffentlichen Betrieb.

## Tatsächliche Architektur und Dateien

Expo SDK 57 / React Native 0.86 / Expo Router in `src/app`, npm mit zwei Lockfiles.
Client `src/services/api.ts` nutzt `EXPO_PUBLIC_API_URL`; Bearer-Tokens liegen nativ in SecureStore
und im Web nur im tabgebundenen Session Storage. Nicht geheime Drafts/User-ID bleiben in AsyncStorage.
Backend: Express 5 + TypeScript, `server/src/index.ts`; PostgreSQL via `pg`, Prisma 7
und `@prisma/adapter-pg`. Prisma-Konfiguration in `server/prisma.config.ts`, Schema und
versionierte SQL-Migrationen in `server/prisma/`. Passwörter bcrypt, Sessions in PostgreSQL.
Profilbilder sind Data-URLs in `User.avatarData`; keine Upload-Dateien und kein Storage-Service.
XP serverseitig, Level aus XP, Streak inklusive Rest Days aus Historie im Client.

Lokal PostgreSQL **18.6** durch reine SELECT-Abfrage bestätigt. Compose-Ziel deshalb
18.6, kein Downgrade auf 17. Der PostgreSQL-18-Volume-Mount ist `/var/lib/postgresql`.
Die CI verwendet PostgreSQL 18 und prüft Release-Exports mit der reservierten HTTPS-Testadresse `https://api.invalid`; ein separater Negativschritt muss eine HTTP-Release-URL ablehnen.

| Datei | Zweck |
| --- | --- |
| `server/Dockerfile`, `.dockerignore` | Lockfile-Build, generierter Prisma-Client, kompiliertes Backend, Non-root-Runtime; nur Backend-Quellen im Kontext |
| `server/tsconfig.build.json`, Backend-Skripte | `build`, `start`, `db:generate`, `db:deploy`; dev/watch bleibt erhalten |
| `compose.production.yml`, `.env.production.example` | Drei dauerhafte Dienste: db/api/caddy; manuelles Migrationsprofil, keine automatische Migration/Seeds |
| `deployment/Caddyfile` | Automatisches TLS, HTTP-Redirect, Body-Limit, Reverse Proxy |
| `deployment/compose.sh` | Explizite Projekt-/Env-Auswahl unabhängig von Arbeitsverzeichnis |
| `deployment/dump-local.sh`, `restore.sh` | Custom-Dump, Prüfung; Restore nur in leeres public-Schema, mit Eingabebestätigung |
| `deployment/backup.sh`, `backup.env.example`, `systemd/*` | Täglicher verschlüsselter externer Restic-Backup, 14 Tage, Fehler-/Erfolgskontrolle |
| `eas.json`, `src/services/api.ts` | Build-Profile und verpflichtende HTTPS-API für Release-JavaScript |
| `docs/HETZNER_SECURITY_REVIEW.md` | Nach Schwere priorisierte offene Risiken |

Variablen: Client ausschließlich `EXPO_PUBLIC_API_URL` (öffentlich im Bundle).
Backend: `DATABASE_URL`, optional `DATABASE_SCHEMA` (lokale isolierte Tests), `PORT`, `NODE_ENV`.
Compose zusätzlich `POSTGRES_*`, `API_DOMAIN`, `ACME_EMAIL`, `VYTOR_RELEASE`, drei Image-Variablen,
`PROXY_SUBNET` und `CADDY_PROXY_IP`. Produktion setzt `TRUSTED_PROXY_IP` auf genau diese Caddy-IP.
Das eigene Netz (Standard 172.30.50.0/24, Caddy .2) darf mit keinem anderen VPS-Netz kollidieren.
Restic-Variablen sind ausschließlich in `/etc/vytor/backup.env`, niemals im Client.
Keine lokale `.env` umbenennen/überschreiben; Produktion nutzt explizit `.env.production`.

API-Inventar am Ende dieser Datei. Development unverändert:

```bash
# Lokal, zwei Terminals; vorhandene .env-Dateien unverändert lassen
cd server
npm run dev
# Projektwurzel im anderen Terminal
npm start
```

## 1–7: Konto, VPS, Ubuntu, SSH, Firewall und Docker

**Hetzner-Konsole (später):** Konto mit MFA; Projekt Vytor; EU-Standort; kleiner x86-64
Shared-vCPU-VPS mit mindestens 2 vCPU, 4 GB RAM, etwa 40 GB SSD (CX23 sofern verfügbar).
Ubuntu 24.04 LTS oder 26.04 LTS; Primary IPv4 plus IPv6, SSH-Public-Key bei Erstellung hinterlegen.
Keine Managed-Datenbank, Load Balancer oder extra Volumes für 5–15 Nutzer nötig.
Diskbelegung und RAM beobachten; Skalierung richtet sich nach Messwerten.

**Lokal (später):** vorhandenen Schlüssel verwenden oder separaten erzeugen:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/vytor_vps
cat ~/.ssh/vytor_vps.pub
ssh -i ~/.ssh/vytor_vps root@VPS_IP
```

**VPS (später, root):** Deploy-User anlegen; Schlüssel übertragen; Zugang in zweitem
Terminal testen, bevor Passwort-/Root-Login deaktiviert wird.

```bash
adduser deploy
usermod -aG sudo deploy
install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
install -o deploy -g deploy -m 600 /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
apt update
apt upgrade
apt install unattended-upgrades ufw git curl ca-certificates restic openssl
sudo dpkg-reconfigure -plow unattended-upgrades
```

**Hetzner-Firewall:** eingehend TCP 22 nur eigene Admin-IP/CIDR (IPv4 und ggf. IPv6),
TCP 80/443 öffentlich für beide IP-Familien; übrige eingehende Verbindungen sperren.
Ausgehend DNS, HTTPS, Zeitabgleich und Systemupdates zulassen (anfangs Standard).
**VPS:** dieselben Regeln mit UFW setzen; `ADMIN_IP` unten ersetzen:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from ADMIN_IP to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Docker-Portfreigaben umgehen teilweise UFW; daher zusätzlich Hetzner-Firewall und
keine `ports` für db/api. SSH nach erfolgreichem Key-Login in `/etc/ssh/sshd_config.d/60-vytor.conf`
mit `PasswordAuthentication no`, `PermitRootLogin no` konfigurieren; `sudo sshd -t`, dann
`sudo systemctl reload ssh`. Bestehende Session bis erfolgreichem neuen Login offenhalten.

**VPS, deploy:** Docker über offizielles Apt-Repository installieren:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' "$VERSION_CODENAME" "$(dpkg --print-architecture)" | sudo tee /etc/apt/sources.list.d/docker.sources
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
```

Befehle nutzen bewusst sudo; Docker-Gruppenmitgliedschaft wäre faktisch Root-Zugriff.
Docker-/Restic-Version dokumentieren. Security-Updates regelmäßig installieren,
Containerimages kontrolliert aktualisieren. Ubuntu-Rebootfenster einplanen.

## 8–10: Repository, Secrets und leere Datenbank

**VPS, deploy:** `REPOSITORY_URL` und `RELEASE_COMMIT` ersetzen; read-only Git-Deploy-Key
für privates Repository verwenden, keine Zugangsdaten in URLs.

```bash
sudo install -d -o deploy -g deploy /opt/vytor
git clone REPOSITORY_URL /opt/vytor
cd /opt/vytor
git checkout --detach RELEASE_COMMIT
umask 077
cp .env.production.example .env.production
chmod 600 .env.production
openssl rand -hex 32
nano .env.production
```

Passwortausgabe nur interaktiv in eigenem Terminal, nicht in Tickets/Logs kopieren.
`POSTGRES_PASSWORD`, `API_DB_PASSWORD`, `MIGRATION_DB_PASSWORD` sowie die URLs für
`vytor_api` und `vytor_migrator` setzen (64 Hexzeichen vermeiden URL-Encoding-Fallen). Domain, ACME-Mail, Release-Commit
setzen; keine `.example`-Domain verwenden. Keine Secrets committen.
`sudo` muss für Backup/Compose dieselbe Datei lesen können.

Image-Tags sind explizite Ausgangswerte, keine bereits geprüften Registry-Digests.
Vor Deployment unterstützte aktuelle Patchversionen prüfen, pullen und `RepoDigests`
mit `sudo docker image inspect IMAGE --format '{{json .RepoDigests}}'` ermitteln.
Alle drei Image-Variablen auf `name@sha256:…` setzen und die geheimnisfreie Image-Liste
mit dem Release archivieren. Node/PG/Caddy-Patches regelmäßig neu testen; niemals
PostgreSQL-Major durch bloßes Ändern eines Tags auf bestehendem Volume upgraden.

```bash
sudo bash deployment/compose.sh config --quiet
sudo bash deployment/compose.sh build api
sudo bash deployment/compose.sh up -d --wait db
sudo bash deployment/compose.sh exec -T db sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SHOW server_version;"'
```

`config` ohne `--quiet` würde Secrets ausgeben. DB hat ein persistentes Volume;
Caddy-Zertifikate ebenfalls. Datenbank-Initialvariablen gelten nur bei leerem Volume,
Passwortrotation benötigt später SQL plus angepasste API-Konfiguration.
Der Initialbenutzer ist nur Administrator. Migration und API verwenden getrennte, nicht administrative Rollen;
das Rollen-/Grant-Skript ist auf frischem PostgreSQL 18.6 einschließlich DDL-Denials getestet. Nach einem `--no-owner`-Restore überträgt es gezielt administrator-eigene Tabellen, Partitionen, Sequenzen, Views, Funktionen und Enum-/Domain-Typen im `public`-App-Schema an `vytor_migrator`; fremde Rollen und andere Schemas bleiben unberührt.
API läuft Non-root/read-only ohne Capabilities; db benötigt Image-Initialisierungsrechte,
Caddy Schreibrechte für Zertifikate. Keine privilegierten Container, kein Docker-Socket im Container.

## 11–12: Späterer Datenumzug, kontrolliert und wiederholbar

**Lokal:** zuerst alle schreibenden App-/Backend-Prozesse anhalten; bis Abnahme keine
weiteren Trainings in der alten Umgebung speichern. Dump ist konsistent, aber spätere
Änderungen würden sonst fehlen. Lokale Datenbank bleibt als Rückfall unverändert bestehen.

libpq-Service `vytor-local` in `~/.pg_service.conf` mit host, port, dbname und user
entsprechend vorhandener `server/.env` konfigurieren. Passwort ausschließlich in
`~/.pgpass` (Format `host:port:database:user:password`, Modus 600), nicht in Befehlszeilen.
`DATABASE_URL` enthält ggf. Prisma-Parameter `schema=public`, die nicht ungeprüft an libpq gehören.

```bash
chmod 600 ~/.pgpass ~/.pg_service.conf
PGSERVICE=vytor-local psql -X -c 'SHOW server_version;'
pg_dump --version
pg_restore --version
PGSERVICE=vytor-local psql -X -c 'SELECT extname, extversion FROM pg_extension;'
PGSERVICE=vytor-local psql -X -c 'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name;'
PGSERVICE=vytor-local bash deployment/dump-local.sh backups/pre-move.dump
sha256sum backups/pre-move.dump > backups/pre-move.dump.sha256
scp -i ~/.ssh/vytor_vps backups/pre-move.dump* deploy@VPS_IP:/opt/vytor/backups/
```

Vor SCP auf VPS `install -d -m 700 /opt/vytor/backups` ausführen.
Tools derselben PostgreSQL-Majorversion wie Quelle verwenden (hier 18);
`pg_dump` darf nicht älter als Server sein. Ziel gleiche oder unterstützte neuere Majorversion,
nie ungeprüfter Downgrade. System-Collation/Extensions und deren Versionen vergleichen.
Repo-Migrationen deklarieren keine zusätzlichen PostgreSQL-Extensions; lokale DB trotzdem prüfen.
Fehlende Extensions vor Restore mit passenden Image-Paketen bereitstellen.
Dump enthält Tabellen, Daten, Sequenzen, Indizes, Constraints und `_prisma_migrations`,
keine Cluster-Rollen/Passwörter. Rollen werden über Zielkonfiguration neu angelegt.

**VPS:** zunächst Probe in separatem Compose-Projekt/Volume auf separater Testinstallation,
keine öffentliche API starten. Für andere Projekte `docker compose -p vytor-rehearsal
--env-file … -f compose.production.yml …` verwenden; Helper sind fest auf Produktion gerichtet.
Produktionsrestore erst nach bestandener Probe:

```bash
cd /opt/vytor
sha256sum -c backups/pre-move.dump.sha256
sudo bash deployment/compose.sh stop caddy api
sudo bash deployment/restore.sh /opt/vytor/backups/pre-move.dump
sudo bash deployment/compose.sh run --rm migrate
sudo bash deployment/compose.sh run --rm migrate npx prisma migrate status
sudo bash deployment/compose.sh exec -T db sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "ANALYZE;"'
```

Nur vertrauenswürdige eigene Dumps verwenden (Restore kann SQL ausführen).
Script verlangt `RESTORE vytor`, verweigert bestehende Objekte im public-Schema und
restauriert atomar ohne `--clean`. Danach führt es das Rollen-/Ownership-Skript automatisch aus, bevor Migrationen gestartet werden. Voraussetzung: dedizierte DB mit ausschließlich
public-App-Schema. Andere Schemas/Extensions vorher untersuchen, keine blinde Schema-Migration.
Nie vorher `prisma migrate deploy` in die leere Import-DB ausführen; sonst ist sie nicht mehr leer.
Kein `migrate reset`, `db push` oder Seed auf importierten Daten.

Pending SQL-Migrationen vor Ausführung lesen, insbesondere historische destruktive
Spalten-/Enum-Änderungen. Bereits angewendete Migrationen werden über mitimportierte
Prisma-Historie erkannt; bei Drift/fehlgeschlagenen Migrationen stoppen, nicht blind resolve.

Bei Fehler: API gestoppt lassen. Atomarer Restore rollt zurück; Fehler in folgenden
Migrationen können dagegen Schemaänderungen hinterlassen. Statt Löschen/Reset eine neue
leere Zieldatenbank anlegen und Dump erneut importieren (siehe Recovery unten).

## 13–16: Validieren, API, DNS und HTTPS

**Lokal und VPS:** Zeilenzahlen und XP-Werte vor/nach Import vergleichen; auf VPS via
`sudo bash deployment/compose.sh exec -T db sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB"'`:

```sql
SELECT 'User' AS entity, count(*) FROM "User"
UNION ALL SELECT 'Workout', count(*) FROM "Workout"
UNION ALL SELECT 'WorkoutSet', count(*) FROM "WorkoutSet"
UNION ALL SELECT 'FriendRequest', count(*) FROM "FriendRequest"
UNION ALL SELECT 'XpEvent', count(*) FROM "XpEvent";
SELECT sum(xp) AS total_xp FROM "User";
SELECT count(*) AS invalid_indexes FROM pg_index WHERE NOT indisvalid;
SELECT extname, extversion FROM pg_extension;
SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name;
```

Zusätzlich Sequenzen per Probe-Registrierung auf Testkopie, eigene/fremde Profile,
Trainingshistorie, Bilder und Freundschaften prüfen. Stichproben auf privaten Daten
nicht in öffentliche Logs kopieren. Nach Migration erwartete Mengenänderungen erklären.

**Domainanbieter:** Domain selbst auswählen; A-Record `api` auf IPv4 des VPS, AAAA nur
bei funktionierendem IPv6-Routing/Firewall. Proxy/CDN zunächst aus, keine falschen alten
AAAA-Einträge. `api.vytor.example` ist nur Platzhalter und erhält kein öffentliches Zertifikat.

**VPS:** Domain und ACME-Mail in `.env.production` setzen, DNS-Auflösung von extern prüfen.
Caddy verwaltet Zertifikate und HTTP-Redirect automatisch bei erreichbaren Ports 80/443.

```bash
sudo bash deployment/compose.sh up -d --wait api
sudo bash deployment/compose.sh up -d caddy
sudo bash deployment/compose.sh ps
sudo bash deployment/compose.sh logs --tail 50 api caddy
curl --fail https://YOUR_REAL_API_DOMAIN/api/health
curl --fail https://YOUR_REAL_API_DOMAIN/api/ready
curl -I http://YOUR_REAL_API_DOMAIN/api/health
curl -i https://YOUR_REAL_API_DOMAIN/api/settings
sudo ss -lntp
```

Health bestätigt Prozess, Ready DB-Verbindung (kein Schema-/Daten-Abnahmetest).
Settings ohne Token muss 401 liefern, HTTP auf HTTPS umleiten. Von einem externen
Rechner prüfen, dass 3000/5432 nicht erreichbar sind; Provider-Firewall für IPv4/IPv6 prüfen.
Healthchecks melden Status, Docker startet ungesunde Prozesse nicht allein deswegen neu;
`restart: unless-stopped` greift bei Prozessende. Status/Logs und externen Uptime-Check überwachen.

## 17–19: Expo, Android und Mehrbenutzertest

`app.json` bleibt unverändert: Scheme `vytor`, keine bestehenden Android-Package-/iOS-Bundle-IDs
oder EAS-Projekt-ID vorhanden; keine konfigurierte EAS-Update-URL/runtimeVersion.
Diese IDs vor erstem echten Build bewusst festlegen; keine erfundene ID in dieser Vorbereitung.
EXPO_PUBLIC-Variablen werden ins Bundle eingebettet und sind keine Secrets.
Development darf weiterhin HTTP/LAN nutzen; Preview/Production müssen HTTPS konfigurieren.

**Lokal, erst später:** EAS-Projekt/Konto zuordnen, API-Variable je Environment setzen
(Plaintext ist für öffentliche API-Adresse richtig):

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://YOUR_REAL_API_DOMAIN --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_URL --value https://YOUR_REAL_API_DOMAIN --visibility plaintext
npx eas-cli@latest build --platform android --profile preview
# Alternativ explizite Production-APK statt unverändertem AAB-Profil:
npx eas-cli@latest build --platform android --profile production-apk
```

Keine dieser Aktionen wurde ausgeführt. `production` bleibt Store-AAB-Profil;
`production-apk` erbt Production-Environment. EAS-Variablen gezielt je Umgebung pflegen;
lokale LAN-`.env` nicht als Release-Konfiguration verwenden.
Release-Client bricht bei fehlender/HTTP-URL mit klarem Fehler ab.

`development` ist als interner Android-Debug-Build vorbereitet (`:app:assembleDebug`),
mit `development`-Environment und Metro/LAN-API. `expo-dev-client` ist aktuell nicht installiert;
vor gewünschtem vollständigem Expo Development Client später `npx expo install expo-dev-client`
ausführen, `developmentClient: true` konfigurieren und neu bauen. Keine neue native Dependency
wurde in dieser Vorbereitung installiert. Bestehendes `npm start` bleibt unverändert.

Mit mindestens zwei separaten Konten und zwei Android-Geräten die Matrix in
[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) prüfen: Registrierung/Login/Logout, Erstellen,
Abschluss, History, XP/Level, Streak mit zwei Rest Days und Ablauf, Leaderboard, Friends,
Profil, Settings, Passwortwechsel, Account-Löschung, Netzverlust und gleichzeitige Geräte.
Fremde User-/Workout-/Template-/Friend-IDs gezielt versuchen: Schreibzugriffe müssen
401/403/404 ergeben, fremde XP unverändert bleiben. Echte Gerätetests sind noch offen.

## 20: Externe Backups und Wiederherstellung

Dediziertes externes Restic-Repository vorbereiten, z.B. S3-kompatibler Bucket bei einem
anderen Anbieter/Account oder Storage Box via SFTP. Kein weiterer Container nötig.
Restic verschlüsselt vor Upload. Credentials auf Bucket/Prefix beschränken; Repository-
Passwort unabhängig vom VPS im Passwortmanager sichern. Für prune braucht das Backup-Konto
Löschrechte; bei kompromittiertem VPS können Backups daher gelöscht werden. Separates
Object-Lock/Versioning oder Append-only-Zugang ist zusätzliche Härtung mit gesondertem
Retention-Konzept. Ein Docker-Volume oder alleiniger VPS-Snapshot ist kein externes Backup.

**VPS, später:** Endpoint/Bucket/Zugang vom Anbieter beziehen, getrennt von DB-Secrets.

```bash
sudo install -d -m 700 /etc/vytor
sudo install -m 600 deployment/backup.env.example /etc/vytor/backup.env
sudo nano /etc/vytor/backup.env
sudo sh -c 'umask 077; openssl rand -hex 32 > /etc/vytor/restic-password'
# Passwort jetzt außerhalb des VPS sicher aufbewahren.
sudo bash -c 'set -a; source /etc/vytor/backup.env; set +a; restic init'
sudo bash -c 'set -a; source /etc/vytor/backup.env; set +a; bash /opt/vytor/deployment/backup.sh'
sudo install -m 644 deployment/systemd/vytor-backup.service deployment/systemd/vytor-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vytor-backup.timer
sudo systemctl start vytor-backup.service
sudo systemctl status vytor-backup.service
sudo systemctl list-timers vytor-backup.timer
sudo journalctl -u vytor-backup.service --since today
sudo cat /var/lib/vytor-backup/last-success
```

Nur eigene, kontrollierte Environment-Datei sourcen. Backups täglich 03:00 UTC plus
bis 20 Minuten Zufallsverzögerung; 14 tägliche Snapshots; normale temporäre Dumps Modus
600 werden nach Upload entfernt. Restic-Exitcode, Dump-Verzeichnisprüfung und
Repository-Metadatenprüfung müssen erfolgreich sein; erst dann Erfolgstimestamp.
Fehler sind im Journal als ERROR sichtbar, Service schlägt fehl. `restic check` ist
keine vollständige Entschlüsselungs-/SQL-Wiederherstellungsprobe. Verfügbarkeit des externen
Speichers und genug freier VPS-Disk für einen Dump überwachen.

**Vor Freigabe:** tägliche Kontrolle des Timestamps automatisieren, extern Alarm bei
Alter >26 Stunden oder fehlgeschlagenem Dienst einrichten (eigener Monitoringdienst mit
Mail/Push). Hier wurden keine fremden Konten oder Benachrichtigungen eingerichtet.
Ohne externen Alarm bleibt ein ausgefallener VPS durch seine eigenen Logs unentdeckt.

**Restore-Test auf separater Testinstallation, mindestens monatlich und vor Updates:**

```bash
sudo bash -c 'set -a; source /etc/vytor/backup.env; set +a; restic snapshots --host vytor-production --tag vytor-db'
# Explizite Snapshot-ID auswählen; nicht irgendeinen fremden latest-Snapshot.
sudo bash -c 'set -a; source /etc/vytor/backup.env; set +a; restic check --read-data'
sudo install -d -m 700 /opt/vytor/backups/restore-test
sudo bash -c 'set -a; source /etc/vytor/backup.env; set +a; restic restore SNAPSHOT_ID --target /opt/vytor/backups/restore-test'
```

Den gefundenen `database.dump` in leere Test-DB importieren, Migrationen ausführen,
Validierungs-SQL und Mehrbenutzerabläufe prüfen. Recovery-Dauer und Snapshot-Alter
protokollieren. Tägliche Backups bedeuten bis ca. 24 Stunden Datenverlust; kein PITR.
Ziel für private Tests: Wiederherstellung innerhalb weniger Stunden, durch Probe bestätigen.

**Echte Recovery auf VPS:** api/caddy stoppen, bisherigen Zustand sichern, neue DB
statt Überschreiben anlegen:

```bash
sudo bash deployment/compose.sh stop caddy api
sudo bash deployment/compose.sh exec -T db sh -c 'createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" vytor_recovery'
sudo nano .env.production
# POSTGRES_DB=vytor_recovery und DATABASE_URL-Pfad /vytor_recovery setzen.
sudo bash deployment/compose.sh up -d --wait db
sudo bash deployment/restore.sh /absolute/path/to/restored/database.dump
sudo bash deployment/compose.sh run --rm migrate
# Erst nach SQL-/API-Abnahme:
sudo bash deployment/compose.sh up -d --wait api
sudo bash deployment/compose.sh up -d caddy
```

Alte DB bleibt erhalten. Zurückschalten: Dienste stoppen, vorherige DB-Variablen und
vorheriges Backend-Image wieder wählen, Dienste starten. Nach erfolgreichem Umzug lokale
Dump-Dateien gemäß privater Aufbewahrung sicher entfernen; nie `docker compose down -v`
als Wartungs-/Rollback-Schritt verwenden.

## Updates, Migrationen und Rollback

Lokal Änderungen testen, committen/pushen. VPS bewusst auf exakten Commit wechseln;
keine automatischen Deployments und keine neue CI/CD-Pipeline.

```bash
# Lokal
npm run lint
npx tsc --noEmit
npx tsc --noEmit -p server/tsconfig.json
npm --prefix server run build
npm --prefix server test
npm run test:ui
# Integration nur gegen dedizierte Test-DB, siehe Hinweis unten.

# VPS, Wartungsfenster; alten Commit/Image-Tag notieren
cd /opt/vytor
sudo bash deployment/compose.sh stop caddy api
sudo systemctl start vytor-backup.service
sudo systemctl is-failed vytor-backup.service
# is-failed muss "inactive" mit Exitcode 1 ergeben; Backup-Erfolg zusätzlich prüfen.
sudo cat /var/lib/vytor-backup/last-success
git fetch origin
git checkout --detach NEW_COMMIT
sudo nano .env.production
# VYTOR_RELEASE=NEW_COMMIT setzen; alte Image-Version behalten.
sudo bash deployment/compose.sh config --quiet
sudo bash deployment/compose.sh build api
# SQL vorher lesen und auf restaurierter Kopie testen!
sudo bash deployment/compose.sh run --rm migrate
sudo bash deployment/compose.sh up -d --wait api
sudo bash deployment/compose.sh up -d caddy
curl --fail https://YOUR_REAL_API_DOMAIN/api/ready
```

Bei Fehlern nicht weiterarbeiten. Rückwärtskompatible Schemaänderung: altes Git-Commit
und `VYTOR_RELEASE` setzen, altes lokal erhaltenes Image starten (`up -d --no-build`).
Nicht rückwärtskompatible Migration: alte Version plus Pre-Update-Dump in **neue** DB
restaurieren, validieren, Verbindung umstellen. Daten nach Backup gehen dabei verloren;
deshalb Schreibpause während Update. Prisma hat keine allgemeine automatische Down-Migration.
Keine Images/Volumes prune, solange Rückfall benötigt wird. Monitoring, Updates,
Backup-Alarm und Restore-Probe als laufende Betreiberaufgaben einplanen.

## Ressourcen, Kosten und offene Entscheidungen

Budget für EU-CX23 als Richtwert: 5,49 €/Monat netto laut offizieller Preisliste,
IPv4 zusätzlich 0,50 € netto; bei 19 % MwSt. zusammen ca. 7,13 €. Externes Backup und
Domain zusätzlich: als Planungsreserve etwa 2–10 €/Monat (anbieter-/mengenabhängig,
kein verifiziertes Angebot). Gesamt grob 9–18 €/Monat brutto; EAS-Kosten je Kontingent
separat. Tarifverfügbarkeit, Steuern, Storage-Mindestpreis und aktuelle Preise vor Bestellung prüfen.
[Hetzner-Preisliste](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/),
[IPv4-Kosten](https://docs.hetzner.com/cloud/servers/overview/).

Offen vor Deployment: echte Domain/ACME-Mail, Repository-Zugang, genauer VPS-Tarif,
aktuelle Image-Patches/Digests, externer Backupanbieter/Alarmierung, Wiederherstellungsziele,
DB-Extensions/Collation und Migrationsstatus, Android-Package/EAS-Projekt/Signierung,
Freigabe der Datenschutzregeln und separat umgesetzte Sicherheitsbefunde.
Kein Passwort/DB-URL darf in EXPO_PUBLIC oder Git gelangen.

## Prüfung dieses Vorbereitungsstands

Lint, App-Typecheck, Backend-Typecheck, Backend-Build und nun 32 Unit-/HTTP-/UI-Logiktests
bestanden; zusätzlich erweiterte API-Integration im temporären PostgreSQL-18-Testcluster. Sieben zusätzliche Client-Konfigurationsfälle (Development-Fallback, HTTPS,
fehlende/ungültige URL und eingebettete Credentials) bestanden. Shellsyntax, erforderliche
Compose-Variablen und YAML-Struktur inklusive Port-/Netzwerkregeln separat geprüft. Docker und Restic sind in der
Arbeitsumgebung nicht installiert: kein `docker compose config`, Image-Build, Caddy-Parser,
Backup-Upload oder echter Restore ausgeführt. Registry-Tags/Digests müssen später validiert werden.
Integrationstest `server/scripts/integration.mjs` führt Migrationen und Schreibvorgänge
ausschließlich in einem isolierten Schema einer expliziten Testdatenbank aus.
Integrationstests inzwischen im separaten temporären PostgreSQL-Cluster bestanden;
`npm --prefix server run test:isolated` erzeugt und entfernt diesen ohne Entwicklungs-DB-Zugriff.
Alternativ verlangt `test:integration` explizit `TEST_DATABASE_URL` auf eine dedizierte `vytor_*test`-DB.
Lokale DB nur per SELECT auf Version geprüft, keine Migration/Seeds/Schemaänderung.
Android-/Mehrbenutzer-/HTTPS-Gerätetests sind offen. Kein echter EAS-Build/Deployment.

## Quellen für spätere Nachprüfung

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Expo-Index](https://docs.expo.dev/llms.txt)
- [EAS-Profile](https://docs.expo.dev/build/eas-json/), [API-Variablen](https://docs.expo.dev/guides/environment-variables/), [APK](https://docs.expo.dev/build-reference/apk/)
- [Docker Ubuntu](https://docs.docker.com/engine/install/ubuntu/), [Compose-Startreihenfolge](https://docs.docker.com/compose/how-tos/startup-order/)
- [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [Caddy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
- [Restic Backup](https://restic.readthedocs.io/en/stable/040_backup.html), [Retention](https://restic.readthedocs.io/en/stable/060_forget.html)

## API-Inventar

Öffentlich: Health, Readiness, Registrierung und Login. Alle übrigen Routen erfordern
Bearer-Session und die im Security-Bericht beschriebenen Zugriffskontrollen.

| Methode | Pfad |
| --- | --- |
| GET | `/api/health` |
| POST | `/api/users` |
| POST | `/api/login` |
| GET | `/api/ready` |
| POST | `/api/logout` |
| GET | `/api/leaderboard` |
| GET | `/api/settings` |
| PATCH | `/api/settings` |
| GET | `/api/users/search` |
| GET | `/api/users/:id/public` |
| GET | `/api/users/:id` |
| PATCH | `/api/users/:id/profile` |
| GET | `/api/friends/:userId` |
| GET | `/api/friends/:userId/requests` |
| POST | `/api/friends/request` |
| POST | `/api/friends/requests/:id/accept` |
| POST | `/api/friends/requests/:id/reject` |
| DELETE | `/api/friends/requests/:id` |
| GET | `/api/friends/:userId/feed` |
| DELETE | `/api/friends/:friendId` |
| GET | `/api/exercises` |
| GET | `/api/templates` |
| POST | `/api/templates` |
| PUT | `/api/templates/:id` |
| DELETE | `/api/templates/:id` |
| POST | `/api/workouts` |
| PATCH | `/api/workout-exercises/:id/settings` |
| POST | `/api/workouts/:id/finish` |
| POST | `/api/workouts/:id/exercises` |
| PATCH | `/api/workout-exercises/:id/replace` |
| DELETE | `/api/workout-exercises/:id` |
| PATCH | `/api/workouts/:id/exercises/order` |
| GET | `/api/workouts/drafts/suspended` |
| POST | `/api/workouts/:id/resume` |
| GET | `/api/workouts/active/current` |
| DELETE | `/api/workouts/:id` |
| GET | `/api/workouts/:userId` |
| GET | `/api/exercises/:exerciseId/last-workout` |
| PUT | `/api/workouts/:id/draft` |
| GET | `/api/workouts/detail/:id` |
| PUT | `/api/exercises/:id/preferences` |
| POST | `/api/exercises` |
| PATCH | `/api/exercises/:id` |
| DELETE | `/api/exercises/:id` |
| POST | `/api/feedback` |
| PUT | `/api/account/password` |
| DELETE | `/api/account` |
