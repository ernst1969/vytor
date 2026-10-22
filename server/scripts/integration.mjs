import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import pg from "pg";

// Refuse the development DATABASE_URL: integration writes require an explicit test DB.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl || !/^vytor_[a-z_]*test$/.test(new URL(testDatabaseUrl).pathname.slice(1))) {
  throw new Error("TEST_DATABASE_URL must point to a dedicated vytor_*test database");
}
// All migrations and API writes run in a fresh, isolated PostgreSQL schema.
const schema = `vytor_test_${Date.now()}_${process.pid}`;
const connection = new pg.Client({ connectionString: testDatabaseUrl });
await connection.connect();
await connection.query(`CREATE SCHEMA "${schema}"`);
const url = new URL(testDatabaseUrl);
url.searchParams.set("schema", schema);
const probe = createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: url.toString(), DATABASE_SCHEMA: schema, PORT: String(port) };
let server;
let logs = "";
async function run(script, args) {
  const child = spawn(process.execPath, [script, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => output += chunk);
  child.stderr.on("data", (chunk) => output += chunk);
  const [code] = await once(child, "exit");
  assert.equal(code, 0, output.replaceAll(url.toString(), "[test database]"));
}
const base = `http://127.0.0.1:${port}/api`;
async function api(path, method = "GET", body, token, status = 200) {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
try {
  await run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
  await run("node_modules/tsx/dist/cli.mjs", ["prisma/seed.ts"]);
  server = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "src/index.ts"], { env, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", (chunk) => logs += chunk);
  server.stderr.on("data", (chunk) => logs += chunk);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(base + "/health")).ok) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, logs);
  const password = "integration-password-123";
  const a = await api("/users", "POST", { username: "tester_a", password }, undefined, 201);
  const b = await api("/users", "POST", { username: "tester_b", password }, undefined, 201);
  const c = await api("/users", "POST", { username: "tester_c", password }, undefined, 201);
  const secondDevice = await api("/login", "POST", { username: "tester_a", password });
  await api(`/users/${a.id}`, "GET", undefined, b.token, 403);
  for (const malformed of [null, [], { userId: a.id, exercises: [null] }, { userId: a.id, exercises: [{ exerciseId: "1" }] }, { userId: a.id, exercises: Array(31).fill({ exerciseId: 1 }) }]) await api("/workouts", "POST", malformed, a.token, 400);
  const malformedJson = await fetch(base + "/workouts", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${a.token}` }, body: "{" });
  assert.equal(malformedJson.status, 400);
  const oversized = await fetch(base + "/workouts", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${a.token}` }, body: JSON.stringify({ data: "x".repeat(3_200_000) }) });
  assert.equal(oversized.status, 400);

  await api("/settings", "GET", undefined, undefined, 401);
  const exercises = await api("/exercises", "GET", undefined, a.token);
  assert.ok(exercises.length > 10);
  const exercise = exercises.find((item) => item.measurementType === "WEIGHT_REPS");
  const avatarData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDWQAAAAASUVORK5CYII=";
  await api(`/users/${a.id}/profile`, "PATCH", { username: "tester_a", displayName: "Test Athlete", avatarData }, a.token);
  assert.equal((await api(`/users/${a.id}/public`, "GET", undefined, b.token)).avatarData, avatarData);
  await api("/friends/request", "POST", { requesterId: a.id, recipientId: a.id }, a.token, 400);
  await api("/friends/request", "POST", { requesterId: b.id, recipientId: c.id }, a.token, 403);
  const request = await api("/friends/request", "POST", { requesterId: a.id, recipientId: b.id }, a.token, 201);
  await api(`/friends/requests/${request.id}/accept`, "POST", { userId: c.id }, c.token, 403);
  await api(`/friends/requests/${request.id}/accept`, "POST", { userId: b.id }, b.token);
  assert.equal((await api(`/friends/${b.id}`, "GET", undefined, b.token))[0].avatarData, avatarData);
  const custom = await api("/exercises", "POST", { name: "Private movement", measurementType: "TIME", category: "Core", description: "Cue" }, a.token, 201);
  assert.ok(!(await api("/exercises", "GET", undefined, b.token)).some((item) => item.id === custom.id));
  await api(`/exercises/${custom.id}`, "DELETE", undefined, b.token, 403);
  await api(`/exercises/${exercise.id}/preferences`, "PUT", { notes: "Brace", restSeconds: 123, weightUnit: "LBS", distanceUnit: "MI" }, a.token);
  const template = await api("/templates", "POST", { name: "Test preset", exerciseIds: [exercise.id], configuration: { [exercise.id]: { targetReps: [10, 8], restSeconds: 123 } } }, a.token, 201);
  assert.equal((await api("/templates", "GET", undefined, a.token)).find((item) => item.id === template.id).configuration[exercise.id].targetReps.length, 2);
  await api(`/templates/${template.id}`, "DELETE", undefined, b.token, 403);
  assert.ok(!(await api("/templates", "GET", undefined, a.token)).some((item) => item.name === "Starter Workout"));
  const workout = await api("/workouts", "POST", { userId: a.id, templateId: template.id, exercises: [{ exerciseId: exercise.id, weightUnit: "LBS" }] }, a.token, 201);
  await api("/workouts", "POST", { userId: a.id, exercises: [{ exerciseId: exercise.id }] }, secondDevice.token, 409);
  assert.equal((await api("/workouts/active/current", "GET", undefined, secondDevice.token)).id, workout.id);
  const draft = { exercises: [{ workoutExerciseId: workout.exercises[0].id, exerciseId: exercise.id, weightUnit: "LBS", distanceUnit: "KM", sets: [{ reps: "10", weight: "100", setType: "REGULAR", completed: true }] }], restEndsAt: Date.now() + 123000 };
  // A nullable per-exercise pause means "use the default", not an invalid draft.
  draft.exercises[0].restSeconds = null;
  for (const restSeconds of [-1, 3601, 1.5, "90"]) {
    await api(`/workouts/${workout.id}/draft`, "PUT", { revision: 0, draft: { ...draft, exercises: [{ ...draft.exercises[0], restSeconds }] }, notes: "" }, a.token, 400);
  }
  await api(`/workouts/${workout.id}/draft`, "PUT", { revision: 0, draft, notes: "Test notes" }, a.token);
  await api(`/workouts/${workout.id}/draft`, "PUT", { revision: 0, draft, notes: "stale" }, secondDevice.token, 409);
  const resumed = await api("/workouts/active/current", "GET", undefined, secondDevice.token);
  assert.equal(resumed.draft.exercises[0].sets[0].reps, "10");
  assert.equal(resumed.notes, "Test notes");
  assert.equal(resumed.draft.exercises[0].restSeconds, null);
  assert.equal(resumed.exercises[0].restSeconds, null);
  const added = await api(`/workouts/${workout.id}/exercises`, "POST", { exerciseId: custom.id, revision: 1 }, a.token);
  await api(`/workout-exercises/${added.id}`, "DELETE", { revision: added.revision }, b.token, 404);
  const replacement = exercises.find((item) => item.id !== exercise.id && item.measurementType === "WEIGHT_REPS");
  await api(`/workouts/${workout.id}/exercises/order`, "PATCH", { exerciseIds: [added.id, workout.exercises[0].id], revision: 1 }, a.token, 409);
  const reordered = await api(`/workouts/${workout.id}/exercises/order`, "PATCH", { exerciseIds: [added.id, workout.exercises[0].id], revision: 2 }, a.token);
  assert.equal(reordered.revision, 3);
  await api(`/workout-exercises/${added.id}/replace`, "PATCH", { exerciseId: replacement.id, weightUnit: "KG", distanceUnit: "KM", revision: 3 }, a.token);
  await api(`/workout-exercises/${added.id}/replace`, "PATCH", { exerciseId: custom.id, weightUnit: "KG", distanceUnit: "KM", revision: 3 }, a.token, 409);
  assert.equal((await api("/workouts/active/current", "GET", undefined, a.token)).exercises.find((item) => item.id === added.id).exerciseId, replacement.id);
  await api(`/workout-exercises/${added.id}/settings`, "PATCH", { revision: 4, restSeconds: 75 }, b.token, 403);
  for (const revision of [undefined, null, false, "5", -1, 1.5, 2_147_483_648, [], {}]) {
    const body = revision === undefined ? { restSeconds: 75 } : { revision, restSeconds: 75 };
    await api(`/workout-exercises/${added.id}/settings`, "PATCH", body, a.token, 400);
  }
  const settingsUpdate = await api(`/workout-exercises/${added.id}/settings`, "PATCH", { revision: 4, restSeconds: 75 }, a.token);
  assert.equal(settingsUpdate.revision, 5);
  await api(`/workout-exercises/${added.id}/settings`, "PATCH", { revision: 4, restSeconds: 80 }, a.token, 409);
  const settingsRace = await Promise.all([80, 85].map((restSeconds) => fetch(base + `/workout-exercises/${added.id}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${a.token}` },
    body: JSON.stringify({ revision: 5, restSeconds }),
  })));
  assert.deepEqual(settingsRace.map((response) => response.status).sort(), [200, 409]);
  await api(`/workout-exercises/${added.id}`, "DELETE", { revision: 6 }, a.token);
  assert.equal((await api("/workouts/active/current", "GET", undefined, a.token)).exercises.length, 1);
  await api(`/workouts/${workout.id}/finish`, "POST", { exercises: [] }, a.token, 400);
  const payload = { revision: 7, exercises: [{ workoutExerciseId: workout.exercises[0].id, weightUnit: "LBS", sets: [{ id: "main", setNumber: 1, weight: 100, reps: 10, setType: "REGULAR" }, { id: "drop", dropSetOfId: "main", setNumber: 2, weight: 80, reps: 8, setType: "DROP" }, { id: "warmup", setNumber: 3, weight: 40, reps: 10, setType: "WARMUP" }] }] };
  for (const set of [null, { setNumber: 1, reps: -1, weight: 100 }, { setNumber: 1, reps: 12, weight: 100, setType: "FAKE" }, { setNumber: 1, reps: Number.MAX_SAFE_INTEGER, weight: 100 }, { setNumber: 1, durationSeconds: 86401 }]) await api(`/workouts/${workout.id}/finish`, "POST", { ...payload, exercises: [{ workoutExerciseId: workout.exercises[0].id, sets: [set] }] }, a.token, 400);
  await api(`/workouts/${workout.id}/finish`, "POST", payload, b.token, 404);
  await api(`/WORKOUTS/%${workout.id.toString().charCodeAt(0).toString(16)}/FINISH/`, "POST", { ...payload, exercises: [null] }, a.token, 400);

  await api(`/workouts/${workout.id}/finish`, "POST", { ...payload, revision: 0 }, a.token, 409);
  // Race two devices: award XP exactly once.
  const finishRace = await Promise.all([1, 2].map(() => fetch(base + `/workouts/${workout.id}/finish`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${a.token}` }, body: JSON.stringify(payload) })));
  assert.equal(finishRace.filter((r) => r.status === 200).length, 1);
  assert.ok(finishRace.every((r) => [200, 400, 409].includes(r.status)));
  const finished = await finishRace.find((r) => r.status === 200).json();
  assert.equal(finished.earnedXp, 120);
  assert.ok(Math.abs(finished.exercises[0].sets[0].weight - 45.359237) < 0.001);
  assert.equal(finished.exercises[0].sets[1].dropSetOfId, finished.exercises[0].sets[0].id);
  await api(`/workout-exercises/${workout.exercises[0].id}/settings`, "PATCH", { revision: 7, restSeconds: 90 }, a.token, 409);
  await api(`/workouts/${workout.id}/finish`, "POST", payload, a.token, 400);
  assert.equal((await api(`/users/${a.id}`, "GET", undefined, a.token)).xp, 120);
  await api(`/workouts/detail/${workout.id}`, "GET", undefined, b.token);
  await api(`/workouts/detail/${workout.id}`, "GET", undefined, c.token, 403);
  assert.deepEqual((await api(`/users/${a.id}/public`, "GET", undefined, c.token)).recentWorkouts, []);
  assert.equal((await api(`/workouts/${a.id}`, "GET", undefined, a.token)).length, 1);
  await api(`/workouts/${a.id}`, "GET", undefined, c.token, 403);
  assert.equal((await api(`/friends/${b.id}/feed`, "GET", undefined, b.token))[0].id, workout.id);
  const starts = await Promise.all([1, 2].map(() => fetch(base + "/workouts", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${b.token}` }, body: JSON.stringify({ userId: b.id, exercises: [{ exerciseId: exercise.id }] }) })));
  assert.deepEqual(starts.map((response) => response.status).sort(), [201, 409]);
  const raceWinner = await starts.find((response) => response.status === 201).json();
  const paused = await connection.query(`INSERT INTO "${schema}"."Workout" ("userId", "startedAt", "suspended") VALUES ($1, now(), true) RETURNING "id"`, [b.id]);
  const pausedId = paused.rows[0].id;
  await api(`/workouts/${pausedId}/resume`, "POST", undefined, a.token, 404);
  await api(`/workouts/${pausedId}/resume`, "POST", undefined, b.token);
  assert.equal((await api("/workouts/active/current", "GET", undefined, b.token)).id, pausedId);
  assert.ok((await api("/workouts/drafts/suspended", "GET", undefined, b.token)).some((item) => item.id === raceWinner.id));
  await api(`/workouts/${raceWinner.id}/resume`, "POST", undefined, b.token);
  await api(`/workouts/${raceWinner.id}`, "DELETE", undefined, b.token);
  assert.equal(await api("/workouts/active/current", "GET", undefined, b.token), null);
  await api("/settings", "PATCH", { theme: "LIGHT", restSeconds: 123 }, a.token);
  assert.equal((await api("/settings", "GET", undefined, a.token)).theme, "LIGHT");
  await api("/feedback", "POST", { message: "Integration test feedback" }, a.token, 201);
  const withdrawn = await api("/friends/request", "POST", { requesterId: a.id, recipientId: c.id }, a.token, 201);
  await api(`/friends/requests/${withdrawn.id}`, "DELETE", undefined, c.token, 404);
  await api(`/friends/requests/${withdrawn.id}`, "DELETE", undefined, a.token);
  const rejected = await api("/friends/request", "POST", { requesterId: b.id, recipientId: c.id }, b.token, 201);
  await api(`/friends/requests/${rejected.id}/reject`, "POST", { userId: b.id }, b.token, 403);
  await api(`/friends/requests/${rejected.id}/reject`, "POST", { userId: c.id }, c.token);
  const concurrent = await api("/friends/request", "POST", { requesterId: b.id, recipientId: c.id }, b.token);
  const socialRace = await Promise.all(["accept", "reject"].map((action) => fetch(base + `/friends/requests/${concurrent.id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.token}` }, body: JSON.stringify({ userId: c.id }) })));
  assert.deepEqual(socialRace.map((response) => response.status).sort(), [200, 409]);
  await api(`/friends/${c.id}`, "DELETE", undefined, b.token);
  await api(`/friends/${b.id}`, "DELETE", undefined, a.token);
  await api(`/workouts/detail/${workout.id}`, "GET", undefined, b.token, 403);

  // Parent revision atomically serializes settings against finish and suspension.
  const settingsFinishWorkout = await api("/workouts", "POST", { userId: c.id, exercises: [{ exerciseId: exercise.id }] }, c.token, 201);
  const settingsFinishPayload = { revision: 0, exercises: [{ workoutExerciseId: settingsFinishWorkout.exercises[0].id, sets: [{ setNumber: 1, weight: 50, reps: 5, setType: "REGULAR" }] }] };
  const settingsFinishRace = await Promise.all([
    fetch(base + `/workout-exercises/${settingsFinishWorkout.exercises[0].id}/settings`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.token}` }, body: JSON.stringify({ revision: 0, restSeconds: 60 }) }),
    fetch(base + `/workouts/${settingsFinishWorkout.id}/finish`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.token}` }, body: JSON.stringify(settingsFinishPayload) }),
  ]);
  assert.deepEqual(settingsFinishRace.map((response) => response.status).sort(), [200, 409]);
  const stillActiveAfterRace = await api("/workouts/active/current", "GET", undefined, c.token);
  if (stillActiveAfterRace) await api(`/workouts/${settingsFinishWorkout.id}/finish`, "POST", { ...settingsFinishPayload, revision: 1 }, c.token);
  await api(`/workout-exercises/${settingsFinishWorkout.exercises[0].id}/settings`, "PATCH", { revision: 1, restSeconds: 70 }, c.token, 409);

  const suspendSource = await api("/workouts", "POST", { userId: c.id, exercises: [{ exerciseId: exercise.id }] }, c.token, 201);
  const suspendTarget = await connection.query(`INSERT INTO "${schema}"."Workout" ("userId", "startedAt", "suspended") VALUES ($1, now(), true) RETURNING "id"`, [c.id]);
  const suspendRace = await Promise.all([
    fetch(base + `/workout-exercises/${suspendSource.exercises[0].id}/settings`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.token}` }, body: JSON.stringify({ revision: 0, restSeconds: 65 }) }),
    fetch(base + `/workouts/${suspendTarget.rows[0].id}/resume`, { method: "POST", headers: { Authorization: `Bearer ${c.token}` } }),
  ]);
  assert.ok(suspendRace.every((response) => [200, 409].includes(response.status)));
  await api(`/workout-exercises/${suspendSource.exercises[0].id}/settings`, "PATCH", { revision: 2, restSeconds: 70 }, c.token, 409);
  await api("/account/password", "PUT", { currentPassword: password, password: "changed-password-123" }, c.token);
  await api("/settings", "GET", undefined, c.token, 401);
  const changed = await api("/login", "POST", { username: "tester_c", password: "changed-password-123" });
  await api("/account", "DELETE", { password: "changed-password-123" }, changed.token);
  await api(`/exercises/${custom.id}`, "DELETE", undefined, a.token);
  const foreignTemplate = await connection.query(`INSERT INTO "${schema}"."WorkoutTemplate" ("name", "userId") VALUES ('Foreign historical reference', $1) RETURNING "id"`, [b.id]);
  await connection.query(`INSERT INTO "${schema}"."WorkoutTemplateExercise" ("templateId", "exerciseId", "order") VALUES ($1, $2, 0)`, [foreignTemplate.rows[0].id, custom.id]);
  await api("/account", "DELETE", { password }, a.token);
  await api("/settings", "GET", undefined, secondDevice.token, 401);
  const anonymized = await connection.query(`SELECT "ownerId", "archived", "name", "description", "category" FROM "${schema}"."Exercise" WHERE "id" = $1`, [custom.id]);
  assert.deepEqual(anonymized.rows[0], { ownerId: null, archived: true, name: `Deleted exercise ${custom.id}`, description: null, category: null });
  assert.equal((await connection.query(`SELECT count(*)::int AS count FROM "${schema}"."WorkoutTemplateExercise" WHERE "templateId" = $1 AND "exerciseId" = $2`, [foreignTemplate.rows[0].id, custom.id])).rows[0].count, 1);

  // Legitimate time-based Boxing and rapid completion abuse use the same API.
  const time = exercises.find((e) => e.measurementType === "TIME");
  assert.ok(time);
  const boxing = await api("/workouts", "POST", { userId: b.id, exercises: [{ exerciseId: time.id }] }, b.token, 201);
  const round = (w) => ({ revision: 0, exercises: [{ workoutExerciseId: w.exercises[0].id, sets: [{ setNumber: 1, durationSeconds: 180, setType: "REGULAR" }] }] });
  assert.equal((await api(`/workouts/${boxing.id}/finish`, "POST", round(boxing), b.token)).earnedXp, 110);
  const spam = await api("/workouts", "POST", { userId: b.id, exercises: [{ exerciseId: time.id }] }, b.token, 201);
  const burst = await fetch(base + `/workouts/${spam.id}/finish`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${b.token}` }, body: JSON.stringify(round(spam)) });
  assert.equal(burst.status, 429);
  assert.ok(Number(burst.headers.get("retry-after")) > 0);
  assert.equal((await api(`/users/${b.id}`, "GET", undefined, b.token)).xp, 110);
  assert.equal((await api("/workouts/active/current", "GET", undefined, b.token)).id, spam.id);
  // Persisted hourly history blocks abuse even after the minute cooldown has expired.
  await connection.query(`UPDATE "${schema}"."XpEvent" SET "createdAt" = now() - interval '2 minutes' WHERE "userId" = $1`, [b.id]);
  await connection.query(`WITH fixtures AS (
    INSERT INTO "${schema}"."Workout" ("userId", "startedAt", "endedAt") SELECT $1, now() - interval '3 minutes', now() - interval '2 minutes' FROM generate_series(1,11) RETURNING id
  ) INSERT INTO "${schema}"."XpEvent" ("userId", "workoutId", points, "createdAt") SELECT $1, id, 0, now() - interval '2 minutes' FROM fixtures`, [b.id]);
  const hourly = await fetch(base + `/workouts/${spam.id}/finish`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${b.token}` }, body: JSON.stringify(round(spam)) });
  assert.equal(hourly.status, 429);
  assert.ok(Number(hourly.headers.get("retry-after")) > 3000);
  assert.equal((await api(`/users/${b.id}`, "GET", undefined, b.token)).xp, 110);
  // Actual login endpoint, including unknown accounts and spoofed forwarded headers.
  const unknown = await api("/login", "POST", { username: "missing_account", password: "wrong" }, undefined, 401);
  for (let i = 0; i < 10; i++) assert.deepEqual(await api("/login", "POST", { username: "tester_b", password: "wrong" }, undefined, 401), unknown);
  await api("/login", "POST", { username: "TESTER_B", password: "wrong" }, undefined, 429);
  // Three password checks above already consumed this shared IP budget.
  for (let i = 0; i < 7; i++) await api("/account/password", "PUT", { currentPassword: "wrong", password: "valid-password-123" }, b.token, 403);
  await api("/account", "DELETE", { password: "wrong" }, b.token, 429);
  // 3 successful registrations above; invalid registrations also consume the IP budget.
  for (let i = 3; i < 20; i++) await api("/users", "POST", {}, undefined, 400);
  const limitedRegistration = await fetch(base + "/users", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.99" }, body: "{}" });
  assert.equal(limitedRegistration.status, 429);
  assert.ok(Number(limitedRegistration.headers.get("retry-after")) > 0);
  console.log("PASS: migrations, seed, auth, profiles, friends, templates, draft conflict, device resume, exercise deletion, units, sets, XP, permissions, settings, feedback and account cleanup");
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
  await connection.query(`DROP SCHEMA "${schema}" CASCADE`);
  await connection.end();
}
