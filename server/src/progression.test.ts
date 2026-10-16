import assert from "node:assert/strict";
import test from "node:test";

import { levelForXp, progressForXp, workoutXp } from "./progression.js";

test("level boundaries follow the quadratic curve", () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(99), 1);
  assert.equal(levelForXp(100), 2);
  assert.equal(levelForXp(399), 2);
  assert.equal(levelForXp(400), 3);
});

test("progress exposes the current level range", () => {
  assert.deepEqual(progressForXp(250), {
    xp: 250,
    level: 2,
    levelStartXp: 100,
    nextLevelXp: 400,
  });
});

test("workout XP rewards completion and completed sets", () => {
  assert.equal(workoutXp(0), 100);
  assert.equal(workoutXp(5), 150);
});
