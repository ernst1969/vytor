# Vytor – Rollback und Disaster Recovery

## Ziele und Grenzen

Planwerte, nicht gemessen: RPO höchstens 24 Stunden bei täglichem Backup; RTO vier Stunden für einen vorbereiteten Betreiber. Die lokale Dump/Restore-Probe misst diese Ziele nicht. Erst eine vollständige Offsite-Übung darf sie bestätigen.

## Backend-Release zurückrollen

Vor jedem Deploy alten Image-Digest/Commit behalten, Datenbankdump und Offsite-Snapshot prüfen. Bei reinem Codefehler Caddy/API stoppen, `VYTOR_RELEASE` und Image-Digest auf das vorherige kompatible Release setzen, API starten und Health/Smoke-Tests ausführen. Niemals alten Code gegen ein unbekannt inkompatibles neues Schema starten.

## Fehlerhafte Migration

Migration sofort stoppen, API nicht starten, Prisma-Status und PostgreSQL-Logs sichern. Keine erfundene Down-Migration und kein `migrate reset`. Additive kompatible Fehler dürfen mit einer neuen Vorwärtsmigration korrigiert werden. Bei partieller/inkompatibler Änderung neue leere Datenbank/Volume anlegen und den Pre-Deploy-Dump atomar restaurieren. Erst nach Validierung DNS/Caddy/API umschalten.

Die Username-Migration kann bei Case-Kollisionen absichtlich abbrechen. Betroffene IDs/Usernames read-only ermitteln, Betreiberentscheidung dokumentieren, Benutzer kontrolliert umbenennen und Migration erneut ausführen. Keine automatische Datenzusammenführung.

## Restore auf neuem VPS

1. Kompromittierung eindämmen; bei Security-Incident alten VPS isolieren, nicht als vertrauenswürdige Quelle weiterverwenden.
2. Neuen gehärteten VPS aus sauberem Ubuntu-Image erstellen; Firewall/SSH/Docker prüfen.
3. Exakten geprüften Release-Commit und Image-Digests ausrollen.
4. Neue, unterschiedliche DB-/Backup-/Deploy-Credentials erzeugen; kompromittierte widerrufen.
5. Leere Datenbank und Rollen initialisieren.
6. Letzten verifizierten Restic-Snapshot auf einen geschützten Pfad restaurieren; Prüfsumme/Archivliste prüfen.
7. Mit `deployment/restore.sh` in die leere DB restaurieren; das Skript repariert Ownership/Grants automatisch und gezielt; anschließend Migrationstatus prüfen.
8. Datenproben, FKs, Sequenzen, Nutzer, Workouts, XP, Templates und Freundschaften prüfen.
9. API intern, danach Caddy/TLS extern testen; erst dann DNS/IP-Verkehr umstellen.
10. Nutzer über Verlustfenster/Incident nach Betreiber- und Rechtsentscheidung informieren.

## Datenbankvolume verloren

Schreibzugriff stoppen, neues Volume statt Reparaturversuch am einzigen Exemplar anlegen, letzten Offsite-Snapshot restaurieren und das tatsächliche RPO aus Snapshotzeit und letztem bestätigten Write bestimmen. Altes beschädigtes Volume read-only für Forensik aufbewahren, sofern Datenschutz und Speicher dies erlauben.

## Zugangsdaten kompromittiert

- API-Sessionverdacht: alle `Session`-Zeilen widerrufen; Nutzer müssen neu anmelden.
- DB: Admin-, Migrator- und API-Passwort getrennt rotieren; URLs aktualisieren; Container kontrolliert neu starten; Verbindungen/Logs prüfen.
- Restic/Provider: Repository-Zugang und Passwort rotieren; Schreib-/Löschrechte prüfen. Unveränderbare/Object-Lock-Kopien sind eine Betreiberoption.
- Git/SSH/Hetzner/EAS: Token/Keys widerrufen, MFA/Auditlogs prüfen, Deploy-Key neu ausstellen.
- Invite-Code: neuen Code erzeugen, nur SHA-256-Hash setzen.

Secrets niemals in Incident-Tickets oder Git dokumentieren.

## Löschung und Backup

Produktiv gelöschte Konten können bis zum Ablauf der 14-Tage-Backup-Retention in verschlüsselten Snapshots liegen. Ein Restore kann gelöschte Daten technisch wiederbringen. Betreiber muss ein Löschjournal/Abgleichverfahren festlegen, damit Wiederherstellung keine dauerhafte Reaktivierung bewirkt. Backupmedien nicht ad hoc manipulieren; Verfahren rechtlich prüfen.

## Regelmäßige Übung

Quartalsweise neuen isolierten Restore durchführen, Zeit messen, Snapshot-ID und Ergebnisse dokumentieren. Halbjährlich VPS-Neuaufbau, Credential-Rotation, Alarmwege und Kontaktliste üben. Nach jedem Schemawechsel Restore-Probe wiederholen.
