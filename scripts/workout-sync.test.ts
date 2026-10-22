import assert from "node:assert/strict";
import test from "node:test";

import { StaleWorkoutSyncError, WorkoutDraftSyncCoordinator, type WorkoutSyncSnapshot } from "../src/services/workout-draft-sync";

type Draft = { value: string };
const signature = (draft: Draft) => JSON.stringify(draft);

function fixture() {
  let snapshot: WorkoutSyncSnapshot<Draft> = {
    accountId: "1", workoutId: 10, generation: 1, hydrated: true,
    revision: 0, draft: { value: "first" }, signature: signature({ value: "first" }),
    syncedSignature: signature({ value: "server" }), conflict: false,
  };
  const saves: WorkoutSyncSnapshot<Draft>[] = [];
  const statuses: string[] = [];
  const persisted: { signature: string; revision: number }[] = [];
  let save = async (item: WorkoutSyncSnapshot<Draft>) => {
    saves.push(structuredClone(item));
    return { revision: item.revision + 1 };
  };
  const dependencies = {
    awaitLocalWrite: async () => {},
    read: () => snapshot,
    save: (item: WorkoutSyncSnapshot<Draft>) => save(item),
    accept: (item: WorkoutSyncSnapshot<Draft>, revision: number) => {
      snapshot = { ...snapshot, revision, syncedSignature: item.signature };
    },
    persistAccepted: async (item: WorkoutSyncSnapshot<Draft>, revision: number) => {
      persisted.push({ signature: item.signature, revision });
    },
    status: (value: "syncing" | "saved" | "pending" | "conflict" | "error" | "local-error") => { statuses.push(value); },
  };
  return {
    coordinator: new WorkoutDraftSyncCoordinator<Draft>(), dependencies, saves, statuses, persisted,
    read: () => snapshot,
    change(value: string) { const draft = { value }; snapshot = { ...snapshot, draft, signature: signature(draft) }; },
    switchWorkout(workoutId: number) { snapshot = { ...snapshot, workoutId, generation: snapshot.generation + 1, revision: 0, syncedSignature: "" }; },
    switchAccount(accountId: string) { snapshot = { ...snapshot, accountId, generation: snapshot.generation + 1, revision: 0, syncedSignature: "" }; },
    conflict() { snapshot = { ...snapshot, conflict: true }; },
    setSave(next: typeof save) { save = next; },
  };
}

test("a workout switch waits for the shared in-flight save", async () => {
  const f = fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  f.setSave(async (item) => { f.saves.push(structuredClone(item)); await gate; return { revision: 1 }; });
  const automatic = f.coordinator.flush(f.dependencies);
  const beforeSwitch = f.coordinator.flush(f.dependencies);
  let completed = false;
  void beforeSwitch.then(() => { completed = true; });
  await Promise.resolve();
  assert.equal(completed, false);
  release();
  await Promise.all([automatic, beforeSwitch]);
  assert.equal(f.saves.length, 1);
  assert.equal(f.read().revision, 1);
});

test("changes made during a save are sent in a second revision", async () => {
  const f = fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  f.setSave(async (item) => {
    f.saves.push(structuredClone(item));
    if (f.saves.length === 1) await gate;
    return { revision: item.revision + 1 };
  });
  const flushing = f.coordinator.flush(f.dependencies);
  await Promise.resolve();
  f.change("newer");
  release();
  await flushing;
  assert.deepEqual(f.saves.map((item) => [item.revision, item.draft.value]), [[0, "first"], [1, "newer"]]);
  assert.equal(f.read().revision, 2);
  assert.equal(f.read().syncedSignature, signature({ value: "newer" }));
});

test("a late response cannot update another workout or account", async () => {
  for (const transition of ["workout", "account"] as const) {
    const f = fixture();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    f.setSave(async (item) => { await gate; return { revision: item.revision + 1 }; });
    const flushing = f.coordinator.flush(f.dependencies);
    await Promise.resolve();
    if (transition === "workout") f.switchWorkout(11);
    else f.switchAccount("2");
    release();
    await assert.rejects(flushing, StaleWorkoutSyncError);
    assert.equal(f.read().revision, 0, transition);
    assert.equal(f.persisted.length, 0, transition);
  }
});

test("409 and network errors reject the flush without accepting a revision", async () => {
  for (const status of [409, undefined]) {
    const f = fixture();
    f.setSave(async () => { throw Object.assign(new Error(status ? "conflict" : "offline"), { status }); });
    await assert.rejects(f.coordinator.flush(f.dependencies));
    assert.equal(f.read().revision, 0);
    assert.equal(f.persisted.length, 0);
    assert.equal(f.statuses.at(-1), status === 409 ? "conflict" : "error");
  }
});

test("two rapid switches and an app-background flush share one complete operation", async () => {
  const f = fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  f.setSave(async (item) => { f.saves.push(structuredClone(item)); await gate; return { revision: 1 }; });
  const firstSwitch = f.coordinator.flush(f.dependencies);
  const secondSwitch = f.coordinator.flush(f.dependencies);
  const background = f.coordinator.flush(f.dependencies);
  release();
  await Promise.all([firstSwitch, secondSwitch, background]);
  assert.equal(f.saves.length, 1);
  assert.equal(f.persisted.length, 1);
});

test("an existing conflict blocks a switch and preserves the local draft", async () => {
  const f = fixture();
  f.conflict();
  await assert.rejects(f.coordinator.flush(f.dependencies), (error: { status?: number }) => error.status === 409);
  assert.equal(f.saves.length, 0);
  assert.equal(f.read().draft.value, "first");
});
