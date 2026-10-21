#!/usr/bin/env bash
set -Eeuo pipefail
: "${POSTGRES_DB:?Missing POSTGRES_DB}"
: "${POSTGRES_USER:?Missing POSTGRES_USER}"
: "${API_DB_PASSWORD:?Missing API_DB_PASSWORD}"
: "${MIGRATION_DB_PASSWORD:?Missing MIGRATION_DB_PASSWORD}"

psql -X -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=db_name="$POSTGRES_DB" --set=api_password="$API_DB_PASSWORD" --set=migration_password="$MIGRATION_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE vytor_migrator LOGIN PASSWORD %L', :'migration_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vytor_migrator') \gexec
SELECT format('ALTER ROLE vytor_migrator PASSWORD %L', :'migration_password') \gexec
SELECT format('CREATE ROLE vytor_api LOGIN PASSWORD %L', :'api_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vytor_api') \gexec
SELECT format('ALTER ROLE vytor_api PASSWORD %L', :'api_password') \gexec

ALTER ROLE vytor_migrator NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE vytor_api NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO vytor_migrator;
REVOKE CONNECT, TEMPORARY ON DATABASE :"db_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db_name" TO vytor_migrator, vytor_api;
GRANT USAGE ON SCHEMA public TO vytor_api;
ALTER DEFAULT PRIVILEGES FOR ROLE vytor_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vytor_api;
ALTER DEFAULT PRIVILEGES FOR ROLE vytor_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO vytor_api;

-- Idempotent grants also cover objects restored from a no-owner dump.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vytor_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vytor_api;
SQL
