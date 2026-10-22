# Vytor – Hetzner Deployment Runbook

Dieses Runbook bereitet den Erststart vor; es wurde nicht auf einem echten VPS ausgeführt. Ersetze Großbuchstaben-Platzhalter. Befehle mit **lokal** laufen auf dem Entwicklungsrechner, **VPS** auf dem Server. Die ausführliche Härtung steht zusätzlich in `HETZNER_DEPLOYMENT.md`.

## 1. Betreiberentscheidungen und Konten

Manuell: Domain/API-Hostname, EU-Standort, Admin-IP/CIDRs, Backupanbieter, Alarmdienst, RPO/RTO, Datenschutztexte und Beta-Einladungsverfahren freigeben. Hetzner-Konto, Git-Host, Backupanbieter und EAS mit MFA absichern. Für die private Beta Registrierung entweder geschlossen lassen oder einen ausreichend zufälligen Invite-Code erzeugen und ausschließlich dessen SHA-256-Hash konfigurieren.

## 2. Lokal vor dem Upload

```bash
git status --short
git rev-parse HEAD
npm ci
npm --prefix server ci
npm run lint
npx tsc --noEmit
npx tsc --noEmit -p server/tsconfig.json
npm --prefix server test
npm run test:ui
npm --prefix server run test:isolated
npx expo-doctor
EXPO_PUBLIC_API_URL=https://API_DOMAIN npx expo export --platform all --output-dir /tmp/vytor-release-export
```

Docker ist auf einer Stagingmaschine zusätzlich zwingend:

```bash
cp .env.production.example .env.production
# Nur Platzhalter/Testsecrets eintragen; Datei bleibt untracked und chmod 600.
sudo bash deployment/compose.sh config --quiet
sudo bash deployment/compose.sh build api migrate
```

Auf derselben isolierten Stagingmaschine anschließend mit Testsecrets und einer Testdomain ausführen; erst nach vollständigem Protokoll darf Docker/Caddy von BLOCKED auf PASS wechseln:

```bash
sudo bash deployment/compose.sh config
sudo bash deployment/compose.sh up -d --wait db
sudo bash deployment/compose.sh run --rm migrate
sudo bash deployment/compose.sh up -d --wait api caddy
sudo bash deployment/compose.sh ps
sudo bash deployment/compose.sh exec -T api sh -c 'id; test ! -w /app; test -w /tmp'
curl --fail --silent https://STAGING_API_DOMAIN/api/health
curl --fail --silent https://STAGING_API_DOMAIN/api/ready
curl --fail --silent -H 'Forwarded: for=127.0.0.1' -H 'X-Forwarded-For: 127.0.0.1' https://STAGING_API_DOMAIN/api/health
sudo bash deployment/compose.sh restart db api caddy
sudo bash deployment/compose.sh stop db
sudo bash deployment/compose.sh start db
sudo bash deployment/compose.sh up -d --wait api
sudo bash deployment/compose.sh stop --timeout 30 api caddy db
sudo bash deployment/compose.sh up -d --wait db api caddy
```

Zusätzlich extern `80/443` sowie geschlossene `3000/5432` prüfen, Caddy-Konfiguration im Container validieren, Logrotation/Ressourcenlimits mit `docker inspect`, DB-Persistenz über Neustart und einen kontrollierten API-Reconnect nach DB-Unterbrechung nachweisen. Testdaten vor/nach Neustart lesen. YAML-Parsing oder Image-Build allein genügt nicht.

Prüfe vor Migration read-only auf Username-Kollisionen:

```sql
SELECT lower("username"), count(*) FROM "User" GROUP BY lower("username") HAVING count(*) > 1;
```

## 3. VPS sicher anlegen

Ubuntu 24.04 LTS oder eine zu diesem Zeitpunkt unterstützte neuere LTS-Version wählen. SSH-Key bei Anlage setzen. Root-Session offenhalten, Nicht-Root-Admin anlegen, Key-Login in einem zweiten Terminal testen und erst dann Passwortlogin/Rootlogin abschalten. Updates, `unattended-upgrades`, Zeitsynchronisation, Docker aus dem offiziellen Repository, Restic und UFW einrichten.

Hetzner-Firewall und UFW: TCP 22 nur Admin-IPv4/IPv6-CIDRs; 80/443 öffentlich; alles andere inbound sperren. 3000/5432 niemals freigeben. Docker kann UFW umgehen, deshalb zusätzlich extern scannen.

## 4. Release und Secrets auf den VPS bringen

**VPS:**

```bash
sudo install -d -o deploy -g deploy -m 750 /opt/vytor
git clone REPOSITORY_URL /opt/vytor
cd /opt/vytor
git checkout --detach RELEASE_COMMIT
umask 077
cp .env.production.example .env.production
chmod 600 .env.production
```

Erzeuge drei unterschiedliche 64-Hex-Passwörter für Administrator, Migrator und API. Setze `POSTGRES_PASSWORD`, `API_DB_PASSWORD`, `MIGRATION_DB_PASSWORD`, die beiden passenden URLs, Domain, Mail, Commit und geprüfte Image-Digests. Keine Werte in Shell-History, Chat oder Logs kopieren. `REGISTRATION_INVITE_CODE_SHA256` bleibt leer (geschlossen) oder enthält nur den Hash. `WEB_ORIGIN` bleibt ohne Webhosting leer oder ist exakt dessen HTTPS-Origin.

## 5. Datenbank und Rollen

**VPS, neuer leerer Stand:**

```bash
sudo bash deployment/compose.sh config --quiet
sudo bash deployment/compose.sh pull db caddy
sudo bash deployment/compose.sh build api migrate
sudo bash deployment/compose.sh up -d --wait db
sudo bash deployment/compose.sh run --rm migrate
sudo bash deployment/compose.sh run --rm migrate npx prisma migrate status
```

Das Init-Skript erzeugt `vytor_migrator` und `vytor_api` bei einem neuen Volume. Bei bestehenden Volumes kann es idempotent erneut laufen. `deployment/restore.sh` führt es nach dem Restore automatisch aus: administrator-eigene App-Objekte im `public`-Schema gehen gezielt an den Migrator, anschließend werden API-Grants erneuert. Keine fremden Schemas/Owner pauschal übertragen.

```bash
sudo bash deployment/compose.sh exec -T db bash /docker-entrypoint-initdb.d/20-vytor-roles.sh
```

## 6. Bestehende Daten umziehen

Schreibende alte API stoppen. **Lokal** mit geschütztem `PGSERVICE`:

```bash
PGSERVICE=vytor-local bash deployment/dump-local.sh backups/pre-move.dump
sha256sum backups/pre-move.dump > backups/pre-move.dump.sha256
scp backups/pre-move.dump* deploy@VPS_IP:/opt/vytor/backups/
```

Zuerst auf einem getrennten Rehearsal-Volume restaurieren. **VPS**, Produktion erst nach bestandener Probe:

```bash
sha256sum -c backups/pre-move.dump.sha256
sudo bash deployment/compose.sh stop api caddy
sudo bash deployment/restore.sh /opt/vytor/backups/pre-move.dump
sudo bash deployment/compose.sh run --rm migrate
```

Kein `migrate reset`, `db push`, `down -v` oder Seed auf Bestandsdaten.

## 7. API, Caddy und DNS

```bash
sudo bash deployment/compose.sh up -d --wait api caddy
sudo bash deployment/compose.sh ps
curl --fail --silent https://API_DOMAIN/api/health
curl --fail --silent https://API_DOMAIN/api/ready
```

DNS A/AAAA muss ausschließlich auf den VPS zeigen. Von einem externen Netz prüfen: 80 redirectet, 443 hat gültige Kette, 3000/5432/sonstige Ports sind geschlossen. Manipulierte `X-Forwarded-For`-/`Forwarded`-Header dürfen die externe Client-IP nicht ersetzen. Caddy- und API-Container neu starten und Zertifikat/Health erneut prüfen.

## 8. Backup und Monitoring

`/etc/vytor/backup.env` (600, root) mit externem Restic-Repository und Passwortdatei konfigurieren. Timer installieren/starten, manuell ausführen, Offsite-Snapshot von einem zweiten System auflisten. Danach in eine neue Rehearsal-Datenbank restaurieren und Benutzer, Workouts, XP, Templates, Freunde, Sequenzen und `_prisma_migrations` prüfen. Erst dann Backup-Gate PASS setzen.

Extern konfigurieren: HTTPS-Readiness, Zertifikatsablauf und Alarm bei Ausfall. Auf dem VPS: Disk/RAM, Containerrestarts, Backup-Timer und Alter von `/var/lib/vytor-backup/last-success`. Alarmziel darf nicht nur auf demselben VPS liegen.

## 9. Client-Release

`app.json` benötigt eindeutige `ios.bundleIdentifier`, `android.package` und EAS-Projektzuordnung. In EAS Preview/Production `EXPO_PUBLIC_API_URL=https://API_DOMAIN` setzen. Wegen SecureStore neuen nativen Build erstellen; keine Tokens/Passwörter in `EXPO_PUBLIC_*`.

```bash
npx eas-cli@latest build:configure
npx eas-cli@latest build --profile preview --platform all
# Erst nach Geräteabnahme:
npx eas-cli@latest build --profile production --platform all
```

Auf zwei echten Geräten vollständige Matrix aus `RELEASE_CHECKLIST.md` inklusive Legacy-Token-Migration, Logout-Race, gebundener Passwort-/Account-Löschung während A→B/A→B→A, Offline-Draft und Konflikt durchführen. Store-Submission bleibt separate Betreiberfreigabe.

Android Auto Backup ist in `app.json` deaktiviert, damit beim Logout erhaltene Workout-Drafts nicht über Google Drive auf eine Neuinstallation gelangen. iOS-Keychain-, Sandbox-Backup- und Reinstall-Verhalten muss auf einem echten signierten Build geprüft werden.

## 10. Go/No-Go

Release nur wenn Docker/Caddy/TLS/Firewall, Offsite-Restore, externe Alarmierung, native Builds/Geräte, Datenschutztexte und alle hohen Findings belegt sind. Release-Commit, Image-Digests, Testprotokoll, Backup-Snapshot-ID und Rollbackziel archivieren.
