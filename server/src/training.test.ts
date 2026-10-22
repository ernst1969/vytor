import assert from "node:assert/strict";
import test from "node:test";
import { formatTime, parseTime } from "../../src/utils/duration.js";
import { exerciseMuscles } from "../../src/utils/muscles.js";
import { rankTier } from "./progression.js";

test("duration entry supports formatted typing and deletion", () => {
  for (const [input, seconds] of [["1", 1], ["12", 12], ["123", 83], ["00:01:234", 754], ["00:01:2", 12], ["123456", 45296], ["00:00:00", 0]] as const) assert.equal(parseTime(input), seconds);
  assert.equal(formatTime(83), "00:01:23");
  assert.equal(formatTime(3600), "01:00:00");
  for (const input of ["", "-1", "1.5", "60", "1260", "006000", "1000000", "abc"]) assert.equal(parseTime(input), null);
});
test("rank tiers change at documented thresholds", () => {
  assert.equal(rankTier(999).tier, "Bronze");
  assert.equal(rankTier(1000).tier, "Silver");
  assert.equal(rankTier(5000).tier, "Gold");
  assert.equal(rankTier(15000).tier, "Platinum");
  assert.deepEqual(rankTier(40000), { tier: "Diamond", nextTierXp: null });
});
test("muscle estimates separate primary and indirect load", () => {
  assert.deepEqual(exerciseMuscles("Bench Press"), { primary: ["Chest"], secondary: ["Arms", "Shoulders"] });
  assert.deepEqual(exerciseMuscles("Uncategorized"), { primary: [], secondary: [] });
});

test("offline recovery preserves unsynced edits, detects conflicts and rejects corrupt caches", async () => {
  const { recoverySource, draftSignature, isLocalWorkoutSnapshot } = await import("../../src/utils/recovery.js");
  const draft = { exercises: [{ id: "exercise-1", workoutExerciseId: 1, exerciseId: 1, name: "Squat", measurementType: "WEIGHT_REPS", weightUnit: "KG", distanceUnit: "KM", sets: [{ id: "set-1", setNumber: 1, weight: "", reps: "", distance: "", durationSeconds: "", completed: false, setType: "REGULAR" }] }], restEndsAt: 123, notes: "local" };
  const server = { id: 1, revision: 2, exercises: [{ id: 1 }], notes: "remote", draft: { ...draft, notes: "remote" } };
  const local = { ...draft, workoutId: 1, revision: 2, startedAt: 1 };
  assert.equal(isLocalWorkoutSnapshot(local), true);
  assert.equal(isLocalWorkoutSnapshot({ ...local, exercises: [{ ...local.exercises[0], sets: [null] }] }), false);
  assert.equal(isLocalWorkoutSnapshot({ ...local, exercises: [null] }), false);
  assert.equal(recoverySource(server, local), "local");
  assert.equal(recoverySource({ ...server, revision: 3 }, local), "conflict");
  assert.equal(recoverySource({ ...server, exercises: [] }, local), "conflict");
  assert.equal(recoverySource(server, { ...local, syncedSignature: draftSignature(draft) }), "server");
  assert.equal(recoverySource(null, local), "conflict");
  assert.equal(recoverySource(server, { ...local, workoutId: 99 }), "conflict");
});

test("presets reject malformed configurations before database writes", async () => {
  const { validTemplateConfiguration } = await import("./validation.js");
  assert.equal(validTemplateConfiguration({ "1": { targetReps: [10, 8], setTypes: ["REGULAR", "DROP"], restSeconds: 83 } }, [1]), true);
  assert.equal(validTemplateConfiguration({ "2": { targetReps: [10] } }, [1]), false);
  assert.equal(validTemplateConfiguration({ "1": { targetReps: [] } }, [1]), false);
  assert.equal(validTemplateConfiguration({ "1": { targetReps: [-1] } }, [1]), false);
  assert.equal(validTemplateConfiguration({ "1": { targetReps: [10], setTypes: ["BAD"] } }, [1]), false);
});
