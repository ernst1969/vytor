import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { workoutColumns, workoutFields, workoutRowLabel } from "../src/utils/workout-layout";
import { anatomicalGroups, anatomicalLoad, anatomicalMuscles, muscleHeatColor } from "../src/utils/muscles";

test("all measurement types retain the correct input columns", () => {
  assert.deepEqual(workoutFields("WEIGHT_REPS"), ["weight", "reps"]);
  assert.deepEqual(workoutFields("REPS"), ["reps"]);
  assert.deepEqual(workoutFields("TIME"), ["durationSeconds"]);
  assert.deepEqual(workoutFields("DISTANCE_TIME"), ["distance", "durationSeconds"]);
  assert.deepEqual(workoutFields("WEIGHT_DISTANCE"), ["weight", "distance"]);
});
test("session labels cover combat sports and remain wide enough on narrow screens", () => {
  for (const name of ["Boxing", "Muay Thai", "Heavy Bag", "MMA", "Brazilian Jiu-Jitsu"]) assert.equal(workoutRowLabel(name), "Session");
  assert.equal(workoutRowLabel("Barbell Back Squat"), "Set");
  assert.equal(workoutRowLabel("Plank", "TIME"), "Session");
  const columns = workoutColumns(true, true);
  assert.ok(columns.label >= 60);
  // 320 px viewport, 8 px outer margins and 10 px card padding plus borders.
  const available = 320 - 16 - 22;
  const timeWidth = available - columns.label - columns.previous - columns.action - columns.gap * 3;
  assert.ok(timeWidth >= 100);
  const strength = workoutColumns(false, true);
  const valueWidth = (available - strength.label - strength.previous - strength.action - strength.gap * 4) / 2;
  assert.ok(valueWidth >= 60);
});
test("body geometry includes complete front and back views for both figures", () => {
  const body = JSON.parse(readFileSync(new URL("../assets/muscles/body-paths.json", import.meta.url), "utf8"));
  const available = new Set<string>();
  for (const sex of ["male", "female"]) for (const side of ["front", "back"]) {
    const view = body[sex][side];
    assert.equal(view.vb.split(" ").length, 4);
    assert.ok(Object.keys(view.p).length > 12);
    for (const [part, paths] of Object.entries(view.p)) {
      available.add(part);
      assert.ok(Array.isArray(paths) && paths.length > 0);
      assert.ok((paths as string[]).every((path) => /^\s*[Mm]/.test(path)));
    }
  }
  assert.ok(anatomicalGroups.every((muscle) => available.has(muscle)));
});
test("muscle mapping distinguishes primary and indirect load and supports custom categories", () => {
  assert.ok(anatomicalMuscles("Barbell Back Squat").primary.includes("quadriceps"));
  assert.ok(anatomicalMuscles("Boxing").primary.includes("deltoids"));
  assert.deepEqual(anatomicalMuscles("Custom movement", "Hamstring").primary, ["hamstring"]);
  assert.deepEqual(anatomicalMuscles("Custom movement").primary, []);
  const load = anatomicalLoad([{ name: "Bench Press", sets: 3 }, { name: "Leg Press", sets: 2 }, { name: "Biceps Curl", sets: 0 }]);
  assert.equal(load.chest.direct, 3);
  assert.equal(load.triceps.direct, 0);
  assert.equal(load.triceps.indirect, 3);
  assert.equal(load.quadriceps.direct, 2);
  assert.equal(load.biceps.direct, 0);
});
test("untrained regions stay neutral and indirect regions use lighter copper", () => {
  const neutral = "#3A3A3A", copper = "#B87333";
  assert.equal(muscleHeatColor({ direct: 0, indirect: 0 }, 3, neutral, copper), neutral);
  assert.equal(muscleHeatColor({ direct: 3, indirect: 0 }, 3, neutral, copper), copper.toLowerCase());
  const indirect = muscleHeatColor({ direct: 0, indirect: 3 }, 3, neutral, copper);
  assert.notEqual(indirect, neutral);
  assert.notEqual(indirect, copper.toLowerCase());
  assert.ok(parseInt(indirect.slice(1, 3), 16) > parseInt(copper.slice(1, 3), 16), "indirect copper is visibly lighter");
});
