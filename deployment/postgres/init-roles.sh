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

-- A --no-owner restore executed by the administrator makes that role the owner.
-- Transfer only administrator-owned application objects in public; never touch
-- objects in other schemas or objects owned by an unrelated role.
DO $ownership$
DECLARE object record;
BEGIN
  FOR object IN
    SELECT c.relkind, n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles owner_role ON owner_role.oid = c.relowner
    WHERE n.nspname = 'public'
      AND owner_role.rolname = current_user
      AND c.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')
      AND (c.relkind <> 'S' OR NOT EXISTS (
        SELECT 1 FROM pg_depend dependency
        WHERE dependency.classid = 'pg_class'::regclass
          AND dependency.objid = c.oid
          AND dependency.deptype = 'a'
      ))
  LOOP
    EXECUTE format(
      'ALTER %s %I.%I OWNER TO vytor_migrator',
      CASE object.relkind
        WHEN 'S' THEN 'SEQUENCE'
        WHEN 'v' THEN 'VIEW'
        WHEN 'm' THEN 'MATERIALIZED VIEW'
        WHEN 'f' THEN 'FOREIGN TABLE'
        ELSE 'TABLE'
      END,
      object.nspname,
      object.relname
    );
  END LOOP;

  FOR object IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles owner_role ON owner_role.oid = p.proowner
    WHERE n.nspname = 'public' AND owner_role.rolname = current_user
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) OWNER TO vytor_migrator', object.nspname, object.proname, object.arguments);
  END LOOP;

  FOR object IN
    SELECT n.nspname, t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_roles owner_role ON owner_role.oid = t.typowner
    WHERE n.nspname = 'public'
      AND owner_role.rolname = current_user
      AND t.typtype IN ('e', 'd')
  LOOP
    EXECUTE format('ALTER TYPE %I.%I OWNER TO vytor_migrator', object.nspname, object.typname);
  END LOOP;
END
$ownership$;

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
