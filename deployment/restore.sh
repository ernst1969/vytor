#!/usr/bin/env bash
# VPS only; refuses nonempty public schemas. Never automatically drops data.
set -Eeuo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")/.."
archive=${1:?Usage: bash deployment/restore.sh /absolute/path/database.dump}
test -s "$archive"
bash deployment/compose.sh exec -T db pg_restore --list < "$archive" > /dev/null
running=$(bash deployment/compose.sh ps --status running --services)
if printf '%s\n' "$running" | grep -Eq '^(api|caddy|migrate)$'; then
  echo 'ERROR: Stop api/caddy and migration jobs before restore' >&2; exit 1
fi
db=$(bash deployment/compose.sh exec -T db sh -c 'printf "%s" "$POSTGRES_DB"')
printf 'Restore trusted archive into EMPTY database %s. Type RESTORE %s: ' "$db" "$db"
read -r confirmation
[[ "$confirmation" == "RESTORE $db" ]] || { echo 'Cancelled' >&2; exit 1; }
objects=$(bash deployment/compose.sh exec -T db sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1' <<'SQL'
SELECT (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace) +
       (SELECT count(*) FROM pg_type WHERE typnamespace = 'public'::regnamespace) +
       (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace);
SQL
)
[[ "$objects" == 0 ]] || { echo 'ERROR: public schema is not empty. Restore to a NEW database instead.' >&2; exit 1; }
bash deployment/compose.sh exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --single-transaction --exit-on-error --no-owner --no-acl' < "$archive"
bash deployment/compose.sh exec -T db bash /docker-entrypoint-initdb.d/20-vytor-roles.sh
echo 'Restore completed atomically; scoped ownership/grant repair completed afterward. Validate data before starting the API.'
