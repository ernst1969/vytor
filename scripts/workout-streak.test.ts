import assert from "node:assert/strict";
import test from "node:test";
import { workoutStreak } from "../src/utils/workout-streak";

const now = (day: number, hour = 20) => new Date(2026, 9, day, hour);
const workout = (day: number, hour = 12) => ({ endedAt: now(day, hour).toISOString() });

for (const gap of [1, 2, 3]) {
  test(`training days with a ${gap}-calendar-day gap keep the streak`, () => {
    assert.equal(workoutStreak([workout(1), workout(1 + gap)], now(1 + gap)), 2);
  });
}
test("a four-day gap starts a new streak", () => {
  assert.equal(workoutStreak([workout(1), workout(5)], now(5)), 1);
});
test("two rest days preserve the training-day count", () => {
  assert.equal(workoutStreak([workout(1)], now(3)), 1);
});
test("the streak lasts through day four and expires at midnight on day five", () => {
  assert.equal(workoutStreak([workout(1)], new Date(2026, 9, 4, 23, 59, 59, 999)), 1);
  assert.equal(workoutStreak([workout(1)], new Date(2026, 9, 5)), 0);
});
test("multiple workouts on one local day count once", () => {
  assert.equal(workoutStreak([workout(1, 9), workout(1, 18), workout(2)], now(2)), 2);
});
test("unfinished, cancelled, invalid and future workouts do not count", () => {
  assert.equal(workoutStreak([{ endedAt: null }, { endedAt: "invalid" }, workout(6)], now(5)), 0);
  assert.equal(workoutStreak([], now(5)), 0);
});
test("unsorted history with repeated rest phases counts only the current series", () => {
  assert.equal(workoutStreak([workout(13), workout(1), workout(8), workout(4), workout(11), workout(6)], now(14)), 6);
  assert.equal(workoutStreak([workout(1), workout(4), workout(8), workout(11), workout(13)], now(14)), 3);
});
test("local dates and DST transitions work across time zones", () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = "Europe/Berlin";
    // Fall-back: 73 elapsed hours, but three calendar days.
    assert.equal(workoutStreak([{ endedAt: new Date(2026, 9, 24, 12).toISOString() }, { endedAt: new Date(2026, 9, 27, 12).toISOString() }], new Date(2026, 9, 27, 20)), 2);
    // Spring-forward: 71 elapsed hours, but three calendar days.
    assert.equal(workoutStreak([{ endedAt: new Date(2026, 2, 28, 12).toISOString() }, { endedAt: new Date(2026, 2, 31, 12).toISOString() }], new Date(2026, 2, 31, 20)), 2);
    const history = [{ endedAt: "2026-10-02T00:30:00Z" }, { endedAt: "2026-10-02T23:30:00Z" }];
    process.env.TZ = "America/Los_Angeles";
    assert.equal(workoutStreak(history, new Date("2026-10-03T06:00:00Z")), 2);
    process.env.TZ = "Asia/Tokyo";
    assert.equal(workoutStreak(history, new Date("2026-10-03T12:00:00Z")), 2);
    process.env.TZ = "UTC";
    assert.equal(workoutStreak(history, new Date("2026-10-03T12:00:00Z")), 1);
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
