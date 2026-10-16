import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import pg from "pg";

// All migrations and API writes run in a fresh, isolated PostgreSQL schema.
const schema = `vytor_test_${Date.now()}_${process.pid}`;
const connection = new pg.Client({ connectionString: process.env.DATABASE_URL });
await connection.connect();
await connection.query(`CREATE SCHEMA "${schema}"`);
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set("schema", schema);
const probe = createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const env = { ...process.env, DATABASE_URL: url.toString(), DATABASE_SCHEMA: schema, PORT: String(port) };
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
  await api(`/workouts/${workout.id}/draft`, "PUT", { revision: 0, draft, notes: "Test notes" }, a.token);
  await api(`/workouts/${workout.id}/draft`, "PUT", { revision: 0, draft, notes: "stale" }, secondDevice.token, 409);
  const resumed = await api("/workouts/active/current", "GET", undefined, secondDevice.token);
  assert.equal(resumed.draft.exercises[0].sets[0].reps, "10");
  assert.equal(resumed.notes, "Test notes");
  const added = await api(`/workouts/${workout.id}/exercises`, "POST", { exerciseId: custom.id }, a.token);
  await api(`/workout-exercises/${added.id}`, "DELETE", undefined, b.token, 404);
  const replacement = exercises.find((item) => item.id !== exercise.id && item.measurementType === "WEIGHT_REPS");
  await api(`/workout-exercises/${added.id}/replace`, "PATCH", { exerciseId: replacement.id, weightUnit: "KG", distanceUnit: "KM", revision: 1 }, a.token);
  await api(`/workout-exercises/${added.id}/replace`, "PATCH", { exerciseId: custom.id, weightUnit: "KG", distanceUnit: "KM", revision: 1 }, a.token, 409);
  assert.equal((await api("/workouts/active/current", "GET", undefined, a.token)).exercises.find((item) => item.id === added.id).exerciseId, replacement.id);
  await api(`/workout-exercises/${added.id}`, "DELETE", undefined, a.token);
  assert.equal((await api("/workouts/active/current", "GET", undefined, a.token)).exercises.length, 1);
  await api(`/workouts/${workout.id}/finish`, "POST", { exercises: [] }, a.token, 400);
  const payload = { revision: 2, exercises: [{ workoutExerciseId: workout.exercises[0].id, weightUnit: "LBS", sets: [{ setNumber: 1, weight: 100, reps: 10, setType: "REGULAR" }, { setNumber: 2, weight: 80, reps: 8, setType: "DROP" }, { setNumber: 3, weight: 40, reps: 10, setType: "WARMUP" }] }] };
  await api(`/workouts/${workout.id}/finish`, "POST", { ...payload, revision: 0 }, a.token, 409);
  const finished = await api(`/workouts/${workout.id}/finish`, "POST", payload, a.token);
  assert.equal(finished.earnedXp, 120);
  assert.ok(Math.abs(finished.exercises[0].sets[0].weight - 45.359237) < 0.001);
  await api(`/workouts/${workout.id}/finish`, "POST", payload, a.token, 400);
  assert.equal((await api(`/users/${a.id}`, "GET", undefined, a.token)).xp, 120);
  await api(`/workouts/detail/${workout.id}`, "GET", undefined, b.token);
  await api(`/workouts/detail/${workout.id}`, "GET", undefined, c.token, 403);
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
  await api("/account/password", "PUT", { currentPassword: password, password: "changed-password-123" }, c.token);
  await api("/settings", "GET", undefined, c.token, 401);
  const changed = await api("/login", "POST", { username: "tester_c", password: "changed-password-123" });
  await api("/account", "DELETE", { password: "changed-password-123" }, changed.token);
  await api(`/exercises/${custom.id}`, "DELETE", undefined, a.token);
  await api("/account", "DELETE", { password }, a.token);
  await api("/settings", "GET", undefined, secondDevice.token, 401);
  console.log("PASS: migrations, seed, auth, profiles, friends, templates, draft conflict, device resume, exercise deletion, units, sets, XP, permissions, settings, feedback and account cleanup");
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
  await connection.query(`DROP SCHEMA "${schema}" CASCADE`);
  await connection.end();
}
