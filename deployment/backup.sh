#!/usr/bin/env bash
# VPS only. RESTIC_* and provider credentials come from a protected EnvironmentFile.
set -Eeuo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")/.."
: "${RESTIC_REPOSITORY:?Missing RESTIC_REPOSITORY}"
: "${RESTIC_PASSWORD_FILE:?Missing RESTIC_PASSWORD_FILE}"
command -v restic >/dev/null
exec 9>/run/lock/vytor-backup.lock
flock -n 9 || { echo 'ERROR: Backup already running' >&2; exit 1; }
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
trap 'echo "ERROR: Vytor backup failed; inspect vytor-backup.service" >&2' ERR
bash deployment/compose.sh exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > "$work/database.dump"
test -s "$work/database.dump"
bash deployment/compose.sh exec -T db pg_restore --list < "$work/database.dump" > /dev/null
# Fixed host/path ensures retention groups do not change with temporary directories.
(cd "$work" && restic backup database.dump --host vytor-production --tag vytor-db)
restic check
# Restrict retention to our database snapshots; no other repository backups are removed.
restic forget --host vytor-production --tag vytor-db --group-by host,tags --keep-daily 14 --prune
install -d -m 700 /var/lib/vytor-backup
date -u +%FT%TZ > /var/lib/vytor-backup/last-success
echo 'Vytor encrypted external backup and repository check succeeded'
