import assert from "node:assert/strict";
import test from "node:test";

import { isLocalWorkoutSnapshot } from "../src/utils/recovery";

function snapshot() {
  return {
    workoutId: 10,
    revision: 2,
    startedAt: Date.now(),
    restEndsAt: null,
    notes: "",
    syncedSignature: "",
    exercises: [{
      id: "exercise-1",
      workoutExerciseId: 11,
      exerciseId: 1,
      name: "Squat",
      description: null,
      measurementType: "WEIGHT_REPS",
      weightUnit: "KG",
      distanceUnit: "KM",
      restSeconds: 90,
      notes: "",
      sets: [{ id: "set-1", setNumber: 1, weight: "", reps: "", distance: "", durationSeconds: "", completed: false, setType: "REGULAR" }],
      previousSets: [{ setNumber: 1, weight: 100, reps: 5, distance: null, durationSeconds: null }],
    }],
  };
}

test("accepts valid complete and incomplete workout snapshots", () => {
  assert.equal(isLocalWorkoutSnapshot(snapshot()), true, "empty active measurements are legitimate");
  const completed = snapshot();
  completed.exercises[0].sets[0] = { ...completed.exercises[0].sets[0], weight: "102.5", reps: "5", completed: true };
  assert.equal(isLocalWorkoutSnapshot(completed), true);
});

test("rejects malformed measurement values and nested structures", () => {
  for (const mutate of [
    (value: any) => { value.exercises[0].sets[0].weight = {}; },
    (value: any) => { value.exercises[0].sets[0].reps = []; },
    (value: any) => { value.exercises[0].sets[0] = null; },
    (value: any) => { value.exercises[0].sets[0].durationSeconds = 60; },
    (value: any) => { value.exercises[0].sets[0].distance = "Infinity"; },
    (value: any) => { value.exercises[0].previousSets = [{ setNumber: 1, weight: {} }]; },
    (value: any) => { value.exercises = null; },
  ]) {
    const value: any = snapshot();
    mutate(value);
    assert.equal(isLocalWorkoutSnapshot(value), false);
  }
});

test("rejects invalid set identity, numbering and drop-set references", () => {
  const duplicate = snapshot();
  duplicate.exercises[0].sets.push({ ...duplicate.exercises[0].sets[0], id: "set-1", setNumber: 2 });
  assert.equal(isLocalWorkoutSnapshot(duplicate), false);

  const missing = snapshot() as any;
  delete missing.exercises[0].sets[0].completed;
  assert.equal(isLocalWorkoutSnapshot(missing), false);

  for (const dropSetOfId of ["missing", "drop-1"]) {
    const value = snapshot();
    value.exercises[0].sets.push({ ...value.exercises[0].sets[0], id: "drop-1", setNumber: 2, setType: "DROP", dropSetOfId });
    assert.equal(isLocalWorkoutSnapshot(value), false);
  }

  const validDrop = snapshot();
  validDrop.exercises[0].sets.push({ ...validDrop.exercises[0].sets[0], id: "drop-1", setNumber: 2, setType: "DROP", dropSetOfId: "set-1" });
  assert.equal(isLocalWorkoutSnapshot(validDrop), true);
});
