#!/usr/bin/env bash
# Use libpq PGSERVICE / PGPASSFILE, never a password-bearing command argument.
set -Eeuo pipefail
umask 077
: "${PGSERVICE:?Configure PGSERVICE in ~/.pg_service.conf and ~/.pgpass first}"
target=${1:?Usage: PGSERVICE=vytor-local bash deployment/dump-local.sh backups/local.dump}
[[ ! -e "$target" ]] || { echo 'ERROR: Target already exists' >&2; exit 1; }
mkdir -p "$(dirname "$target")"
work=$(mktemp "${target}.XXXXXX")
trap 'rm -f -- "$work"' EXIT
pg_dump --format=custom --no-owner --no-acl --file="$work"
pg_restore --list "$work" >/dev/null
# Hard link fails safely if another process created target in the meantime.
ln "$work" "$target"
echo 'Local dump created and archive index checked'
