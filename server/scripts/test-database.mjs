// Disposable PostgreSQL cluster; never reads the development .env or connects to its DB.
import { cp, mkdir, mkdtemp, readdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import pg from "pg";
const bin = process.env.PG_TEST_BIN ?? "/usr/lib/postgresql/18/bin";
const probe = createServer();
await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", resolve); });
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const work = await mkdtemp(join(tmpdir(), "vytor-test-postgres-"));
const data = join(work, "data");
const secret = randomBytes(24).toString("hex");
const passfile = join(work, "password");
await writeFile(passfile, secret, { mode: 0o600 });
async function run(command, args, env = process.env) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => output += chunk);
    child.stderr.on("data", (chunk) => output += chunk);
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? (console.log(output.replaceAll(secret, "[test-secret]")), resolve()) : reject(new Error(output.replaceAll(secret, "[test-secret]"))));
  });
}
let started = false;
try {
  await run(join(bin, "initdb"), ["-D", data, "-U", "vytor_test", "--auth-local=trust", "--auth-host=scram-sha-256", `--pwfile=${passfile}`]);
  await run(join(bin, "pg_ctl"), ["-D", data, "-l", join(work, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${work}`, "-w", "start"]);
  started = true;
  await run(join(bin, "createdb"), ["-h", work, "-p", String(port), "-U", "vytor_test", "vytor_security_test"]);
  const url = `postgresql://vytor_test:${secret}@127.0.0.1:${port}/vytor_security_test`;
  await run(process.execPath, ["scripts/integration.mjs"], { ...process.env, TEST_DATABASE_URL: url, DATABASE_URL: url, NODE_ENV: "test", TRUSTED_PROXY_IP: "" });

  // Prove migrations work without the cluster administrator and the API role cannot perform DDL.
  await run(join(bin, "createdb"), ["-h", work, "-p", String(port), "-U", "vytor_test", "vytor_role_test"]);
  const apiSecret = randomBytes(24).toString("hex");
  const migrationSecret = randomBytes(24).toString("hex");
  const roleEnv = { ...process.env, PGHOST: work, PGPORT: String(port), POSTGRES_USER: "vytor_test", POSTGRES_DB: "vytor_role_test", API_DB_PASSWORD: apiSecret, MIGRATION_DB_PASSWORD: migrationSecret };
  await run("/bin/bash", ["../deployment/postgres/init-roles.sh"], roleEnv);
  const migrationUrl = `postgresql://vytor_migrator:${migrationSecret}@127.0.0.1:${port}/vytor_role_test`;
  const apiUrl = `postgresql://vytor_api:${apiSecret}@127.0.0.1:${port}/vytor_role_test`;
  await run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { ...process.env, DATABASE_URL: migrationUrl });
  const runtime = new pg.Client({ connectionString: apiUrl });
  await runtime.connect();
  const inserted = await runtime.query('INSERT INTO "User" ("username") VALUES ($1) RETURNING "id"', ["least_privilege_probe"]);
  await runtime.query('DELETE FROM "User" WHERE "id" = $1', [inserted.rows[0].id]);
  for (const statement of ['CREATE TABLE runtime_must_not_create (id integer)', 'CREATE DATABASE runtime_must_not_create']) {
    await runtime.query(statement).then(
      () => { throw new Error(`Runtime role unexpectedly executed: ${statement}`); },
      (error) => { if (error.code !== "42501") throw error; },
    );
  }
  await runtime.end();
  const admin = new pg.Client({ connectionString: `postgresql://vytor_test:${secret}@127.0.0.1:${port}/vytor_role_test` });
  await admin.connect();
  const flags = await admin.query("SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname IN ('vytor_api', 'vytor_migrator') ORDER BY rolname");
  if (flags.rows.length !== 2 || flags.rows.some((role) => role.rolsuper || role.rolcreatedb || role.rolcreaterole || role.rolreplication || role.rolbypassrls)) throw new Error("Database application roles have administrative privileges");
  await admin.end();
  console.log("PASS: isolated PostgreSQL migration/runtime least-privilege roles");

  // Rehearse the production path from an older migration state. The source and
  // destination are disposable databases in this isolated cluster.
  await run(join(bin, "createdb"), ["-h", work, "-p", String(port), "-U", "vytor_test", "vytor_restore_source_test"]);
  const oldPrisma = join(work, "old-prisma");
  const oldMigrations = join(oldPrisma, "migrations");
  await mkdir(oldMigrations, { recursive: true });
  await cp("prisma/schema.prisma", join(oldPrisma, "schema.prisma"));
  const migrationNames = (await readdir("prisma/migrations")).filter((name) => /^\d/.test(name)).sort();
  const oldMigrationNames = migrationNames.slice(0, -2);
  await cp("prisma/migrations/migration_lock.toml", join(oldMigrations, "migration_lock.toml"));
  for (const name of oldMigrationNames) await cp(join("prisma/migrations", name), join(oldMigrations, name), { recursive: true });
  const oldConfig = join(oldPrisma, "prisma.config.ts");
  const prismaConfigModule = pathToFileURL(resolve("node_modules/prisma/config.js")).href;
  await writeFile(oldConfig, `import { defineConfig } from ${JSON.stringify(prismaConfigModule)};\nexport default defineConfig({ schema: ${JSON.stringify(join(oldPrisma, "schema.prisma"))}, migrations: { path: ${JSON.stringify(oldMigrations)} }, datasource: { url: process.env.DATABASE_URL } });\n`);
  const sourceUrl = `postgresql://vytor_test:${secret}@127.0.0.1:${port}/vytor_restore_source_test`;
  await run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", oldConfig], { ...process.env, DATABASE_URL: sourceUrl });
  const source = new pg.Client({ connectionString: sourceUrl });
  await source.connect();
  const sourceUser = await source.query('INSERT INTO "User" ("username") VALUES ($1) RETURNING "id"', ["restore_probe"]);
  const sourceExercise = await source.query('INSERT INTO "Exercise" ("name") VALUES ($1) RETURNING "id"', ["Restore lift"]);
  const sourceWorkout = await source.query('INSERT INTO "Workout" ("userId") VALUES ($1) RETURNING "id"', [sourceUser.rows[0].id]);
  const sourceWorkoutExercise = await source.query('INSERT INTO "WorkoutExercise" ("workoutId", "exerciseId", "order") VALUES ($1, $2, 0) RETURNING "id"', [sourceWorkout.rows[0].id, sourceExercise.rows[0].id]);
  await source.query('INSERT INTO "WorkoutSet" ("workoutExerciseId", "setNumber", "weight", "reps") VALUES ($1, 1, 100, 5)', [sourceWorkoutExercise.rows[0].id]);
  await source.end();

  const archive = join(work, "database.dump");
  await run(join(bin, "pg_dump"), ["-h", work, "-p", String(port), "-U", "vytor_test", "-d", "vytor_restore_source_test", "--format=custom", "--no-owner", "--no-acl", `--file=${archive}`]);
  await run(join(bin, "pg_restore"), ["--list", archive]);
  await run(join(bin, "createdb"), ["-h", work, "-p", String(port), "-U", "vytor_test", "vytor_restore_test"]);
  await run("/bin/bash", ["../deployment/postgres/init-roles.sh"], { ...roleEnv, POSTGRES_DB: "vytor_restore_test" });
  await run(join(bin, "pg_restore"), ["-h", work, "-p", String(port), "-U", "vytor_test", "-d", "vytor_restore_test", "--single-transaction", "--exit-on-error", "--no-owner", "--no-acl", archive]);
  await run("/bin/bash", ["../deployment/postgres/init-roles.sh"], { ...roleEnv, POSTGRES_DB: "vytor_restore_test" });
  const restoredMigrationUrl = `postgresql://vytor_migrator:${migrationSecret}@127.0.0.1:${port}/vytor_restore_test`;
  await run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { ...process.env, DATABASE_URL: restoredMigrationUrl });

  const restoredAdmin = new pg.Client({ connectionString: `postgresql://vytor_test:${secret}@127.0.0.1:${port}/vytor_restore_test` });
  await restoredAdmin.connect();
  const wrongOwners = await restoredAdmin.query(`SELECT n.nspname, c.relname, r.rolname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_roles r ON r.oid = c.relowner
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','S','v','m','f') AND r.rolname <> 'vytor_migrator'`);
  if (wrongOwners.rowCount !== 0) throw new Error(`Restored relations have wrong owners: ${JSON.stringify(wrongOwners.rows)}`);
  const wrongTypes = await restoredAdmin.query(`SELECT t.typname, r.rolname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_roles r ON r.oid=t.typowner WHERE n.nspname='public' AND t.typtype IN ('e','d') AND r.rolname <> 'vytor_migrator'`);
  if (wrongTypes.rowCount !== 0) throw new Error(`Restored types have wrong owners: ${JSON.stringify(wrongTypes.rows)}`);
  await restoredAdmin.end();

  const restoredMigrator = new pg.Client({ connectionString: restoredMigrationUrl });
  await restoredMigrator.connect();
  await restoredMigrator.query('ALTER TABLE "User" ADD COLUMN ownership_probe text');
  await restoredMigrator.query('ALTER TABLE "User" DROP COLUMN ownership_probe');
  await restoredMigrator.end();

  const restored = new pg.Client({ connectionString: `postgresql://vytor_api:${apiSecret}@127.0.0.1:${port}/vytor_restore_test` });
  await restored.connect();
  const restoredProbe = await restored.query('SELECT "id" FROM "User" WHERE "username" = $1', ["restore_probe"]);
  if (restoredProbe.rowCount !== 1) throw new Error("Restored data probe is missing");
  const sequenceProbe = await restored.query('INSERT INTO "User" ("username") VALUES ($1) RETURNING "id"', ["restore_sequence_probe"]);
  if (sequenceProbe.rows[0].id <= restoredProbe.rows[0].id) throw new Error("Restored sequence did not advance");
  const migrationProbe = await restored.query('SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL');
  if (migrationProbe.rows[0].count !== migrationNames.length) throw new Error("Restored migration history is incomplete");
  await restored.query('CREATE TABLE runtime_restore_must_not_create (id integer)').then(
    () => { throw new Error("Runtime role unexpectedly performed DDL after restore"); },
    (error) => { if (error.code !== "42501") throw error; },
  );
  await restored.query('INSERT INTO "Workout" ("userId") VALUES (2147483647)').then(
    () => { throw new Error("Restored foreign key was not enforced"); },
    (error) => { if (error.code !== "23503") throw error; },
  );
  await restored.end();
  console.log("PASS: PostgreSQL 18 old-state dump/restore, scoped ownership, pending migrations, DDL/DML boundaries, data, sequences, foreign keys and migration history");
} finally {
  if (started) await run(join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "-w", "stop"]);
  await rm(work, { recursive: true, force: true });
}
