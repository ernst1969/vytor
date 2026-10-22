import assert from "node:assert/strict";
import test from "node:test";
import { boundedTree, validWorkoutBody, WORKOUT_LIMITS as L } from "./workout-validation.js";
const finish = (set: unknown) => ({ revision: 0, exercises: [{ workoutExerciseId: 1, sets: [set] }] });
const valid = { setNumber: 1, reps: 12, weight: 100, setType: "REGULAR" };
test("finish rejects malformed values, enums, excessive sets and unsafe integers", () => {
  const path = "/workouts/1/finish";
  for (const body of [null, [], {}, finish(null), finish({ ...valid, reps: 1000 }), finish({ ...valid, weight: 2205 }), finish({ ...valid, durationSeconds: 86401 }), finish({ ...valid, reps: "12" }), finish({ ...valid, reps: 1.5 }), finish({ ...valid, reps: -1 }), finish({ ...valid, weight: Infinity }), finish({ ...valid, setType: "FAKE" }), finish({ ...valid, setNumber: Number.MAX_SAFE_INTEGER }), { ...finish(valid), revision: -1 }, { revision: 0, exercises: Array(31).fill({ workoutExerciseId: 1, sets: [valid] }) }, { revision: 0, exercises: [{ workoutExerciseId: 1, sets: Array(31).fill(valid) }] }]) assert.equal(validWorkoutBody(path, "POST", body), false, JSON.stringify(body));
  assert.equal(validWorkoutBody("/workouts/%31/finish", "POST", finish(null)), false, "encoded IDs cannot bypass validation");
  assert.equal(validWorkoutBody(path, "POST", finish(valid)), true);
  assert.equal(validWorkoutBody(path, "POST", finish({ setNumber: 1, durationSeconds: 7200 })), true, "Boxing/Muay Thai time remains valid");
  assert.equal(validWorkoutBody(path, "POST", finish({ setNumber: 1, distance: 100, durationSeconds: 43200 })), true, "endurance remains valid");
  assert.equal(validWorkoutBody(path, "POST", { revision: 0, exercises: Array.from({ length: 10 }, (_, i) => ({ workoutExerciseId: i + 1, sets: Array.from({ length: 21 }, (_, j) => ({ ...valid, setNumber: j + 1 })) })) }), false, "total set limit");
});
test("create/edit/draft reject malformed nested input while accepting incomplete drafts", () => {
  assert.equal(validWorkoutBody("/workouts", "POST", { userId: 1, exercises: [null] }), false);
  assert.equal(validWorkoutBody("/workouts", "POST", { userId: 1, exercises: [{ exerciseId: "1" }] }), false);
  assert.equal(validWorkoutBody("/workouts/1/exercises", "POST", { exerciseId: 1, weightUnit: "fake" }), false);
  assert.equal(validWorkoutBody("/workout-exercises/1/settings", "PATCH", { revision: 0, restSeconds: "60" }), false);
  assert.equal(validWorkoutBody("/workout-exercises/1/settings", "PATCH", { restSeconds: 60 }), false);
  assert.equal(validWorkoutBody("/workout-exercises/1/settings", "PATCH", { revision: 0, restSeconds: 60 }), true);
  for (const revision of [undefined, null, false, "5", -1, 1.5, 2_147_483_648, [], {}]) {
    assert.equal(validWorkoutBody("/workout-exercises/1/settings", "PATCH", { revision, restSeconds: 60 }), false, `revision ${JSON.stringify(revision)}`);
  }
  assert.equal(validWorkoutBody("/workouts/1/exercises/order", "PATCH", { exerciseIds: [1, 1] }), false);
  const draft = { revision: 0, notes: "", draft: { restEndsAt: null, exercises: [{ workoutExerciseId: 1, exerciseId: 1, restSeconds: null, sets: [{ reps: "", weight: "", durationSeconds: "", completed: false }] }] } };
  assert.equal(validWorkoutBody("/workouts/1/draft", "PUT", draft), true);
  assert.equal(validWorkoutBody("/workouts/1/draft", "PUT", { ...draft, notes: "a".repeat(L.notes + 1) }), false);
  let deep: unknown = {};
  for (let i = 0; i < 20; i++) deep = { nested: deep };
  assert.equal(boundedTree(deep), false);
  assert.equal(boundedTree({ text: "a".repeat(L.bytes) }), false);
  assert.equal(boundedTree(JSON.parse('{"__proto__":{"polluted":true}}')), false);
});
