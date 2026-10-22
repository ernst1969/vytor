import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { build } from "../server/node_modules/esbuild/lib/main.js";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type MemoryStorage = ReturnType<typeof memoryStorage>;
type Harness = ReturnType<typeof harness>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage = {
    values,
    beforeGet: null as null | ((key: string) => Promise<void>),
    beforeSet: null as null | ((key: string, value: string) => Promise<void>),
    async getItem(key: string) { await storage.beforeGet?.(key); return values.get(key) ?? null; },
    async setItem(key: string, value: string) { await storage.beforeSet?.(key, value); values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
    async mergeItem(key: string, value: string) {
      const previous = JSON.parse(values.get(key) ?? "{}");
      values.set(key, JSON.stringify({ ...previous, ...JSON.parse(value) }));
    },
  };
  return storage;
}

function exercise(id = 11, exerciseId = 1, name = "Squat") {
  return {
    id: `exercise-${id}`, workoutExerciseId: id, exerciseId, name, description: null,
    measurementType: "WEIGHT_REPS", weightUnit: "KG", distanceUnit: "KM", restSeconds: 90, notes: "",
    sets: [{ id: "set-1", setNumber: 1, weight: "100", reps: "5", distance: "", durationSeconds: "", completed: true, setType: "REGULAR" }],
  };
}

function active(notes = "server", revision = 0, id = 10, workoutExercises = [exercise()]) {
  return {
    id, revision, notes, startedAt: new Date(1_700_000_000_000 + id).toISOString(),
    draft: { exercises: workoutExercises, restEndsAt: null },
    exercises: workoutExercises.map((item) => ({ id: item.workoutExerciseId, restSeconds: 90, weightUnit: "KG", distanceUnit: "KM", exercise: { id: item.exerciseId, name: item.name, description: null, measurementType: "WEIGHT_REPS" } })),
  };
}

function harness(storage: MemoryStorage) {
  const listeners = new Set<(change?: { reason: string; accountId?: string }) => void>();
  const state = {
    activeByAccount: new Map([["1", active()]]),
    offline: false,
    settings: async () => ({ preferredWeightUnit: "KG", preferredDistanceUnit: "KM", restSeconds: 90, theme: "SYSTEM" }),
    captureSession: async (accountId: string) => ({ accountId, token: "a".repeat(64) }),
    createTemplate: async () => ({ id: 50 }),
    getActive: async () => state.activeByAccount.get(account() ?? "") ?? null,
    saveDraft: async (_id: number, revision: number) => ({ revision: revision + 1 }),
    createWorkout: async () => ({ id: 15, revision: 0, exercises: [] }),
    cancelWorkout: async () => ({ success: true }),
    finishWorkout: async () => ({ id: 99 }),
    addExercise: async () => ({ id: 77, revision: 2 }),
    deleteExercise: async () => ({ revision: 2 }),
    moveExercise: async () => ({ revision: 2 }),
    replaceExercise: async () => ({ id: 77, revision: 2 }),
    calls: [] as Array<{ operation: string; args: unknown[] }>,
    cancelCalls: 0,
    finishCalls: 0,
  };
  const account = () => storage.values.get("vytor_user_id") ?? null;
  const api = {
    onSessionChange(listener: (change?: { reason: string; accountId?: string }) => void) { listeners.add(listener); return () => listeners.delete(listener); },
    emitSessionChange(change = { reason: "login" }) { for (const listener of listeners) listener(change); },
    async getSettings() {
      if (state.offline) throw new Error("offline");
      return state.settings();
    },
    async captureSessionRequestBinding(accountId: string) { state.calls.push({ operation: "capture-preset-session", args: [accountId] }); return state.captureSession(accountId); },
    async createWorkoutTemplate(...args: unknown[]) { state.calls.push({ operation: "save-preset", args }); return state.createTemplate(); },
    async getActiveWorkout() {
      if (state.offline) throw new Error("offline");
      return state.getActive();
    },
    saveWorkoutDraft: (...args: [number, number, unknown, string]) => state.saveDraft(args[0], args[1]),
    async cancelWorkout(...args: unknown[]) { state.cancelCalls += 1; state.calls.push({ operation: "cancel", args }); return state.cancelWorkout(); },
    async finishWorkout(...args: unknown[]) { state.finishCalls += 1; state.calls.push({ operation: "finish", args }); return state.finishWorkout(); },
    async getLastExerciseWorkout() { return null; },
    async createWorkout(...args: unknown[]) { state.calls.push({ operation: "start", args }); return state.createWorkout(); },
    async addExerciseToWorkout(...args: unknown[]) { state.calls.push({ operation: "add", args }); return state.addExercise(); },
    async deleteWorkoutExercise(...args: unknown[]) { state.calls.push({ operation: "delete", args }); return state.deleteExercise(); },
    async updateWorkoutExerciseOrder(...args: unknown[]) { state.calls.push({ operation: "move", args }); return state.moveExercise(); },
    async request(...args: unknown[]) { state.calls.push({ operation: "replace", args }); return state.replaceExercise(); },
  };
  return { api, state };
}

let providerModule: Promise<any> | null = null;
async function loadProvider() {
  if (providerModule) return providerModule;
  providerModule = (async () => {
    const result = await build({
      absWorkingDir: process.cwd(), entryPoints: ["src/context/workout-context.tsx"], bundle: true,
      platform: "node", format: "cjs", write: false, jsx: "automatic", external: ["react"],
      plugins: [{
        name: "provider-test-mocks",
        setup(buildApi) {
          const modules: Record<string, string> = {
            "@/services/api": `
              const api = () => globalThis.__vytorProviderTest.api;
              export const onSessionChange = (...a) => api().onSessionChange(...a);
              export const saveWorkoutDraft = (...a) => api().saveWorkoutDraft(...a);
              export const addExerciseToWorkout = (...a) => api().addExerciseToWorkout(...a);
              export const cancelWorkout = (...a) => api().cancelWorkout(...a);
              export const captureSessionRequestBinding = (...a) => api().captureSessionRequestBinding(...a);
              export const createWorkoutTemplate = (...a) => api().createWorkoutTemplate(...a);
              export const createWorkout = (...a) => api().createWorkout(...a);
              export const deleteWorkoutExercise = (...a) => api().deleteWorkoutExercise(...a);
              export const finishWorkout = (...a) => api().finishWorkout(...a);
              export const getActiveWorkout = (...a) => api().getActiveWorkout(...a);
              export const getSettings = (...a) => api().getSettings(...a);
              export const getLastExerciseWorkout = (...a) => api().getLastExerciseWorkout(...a);
              export const updateWorkoutExerciseOrder = (...a) => api().updateWorkoutExerciseOrder(...a);
              export const request = (...a) => api().request(...a);
            `,
            "@/context/theme-context": `export const useAppTheme = () => ({ setPreference: (value) => globalThis.__vytorProviderTest.themePreferences.push(value) });`,
            "@react-native-async-storage/async-storage": `
              const storage = () => globalThis.__vytorProviderTest.storage;
              export default {
                getItem: (...a) => storage().getItem(...a), setItem: (...a) => storage().setItem(...a),
                removeItem: (...a) => storage().removeItem(...a), mergeItem: (...a) => storage().mergeItem(...a),
              };
            `,
            "react-native": `export const AppState = { addEventListener: (_event, listener) => { globalThis.__vytorProviderTest.background = listener; return { remove() {} }; } };`,
          };
          buildApi.onResolve({ filter: /.*/ }, (args) => modules[args.path] ? { path: args.path, namespace: "provider-mock" } : undefined);
          buildApi.onLoad({ filter: /.*/, namespace: "provider-mock" }, (args) => ({ contents: modules[args.path], loader: "js" }));
        },
      }],
    });
    const module = { exports: {} as any };
    const require = createRequire(import.meta.url);
    new Function("require", "module", "exports", result.outputFiles[0].text)(require, module, module.exports);
    return module.exports;
  })();
  return providerModule;
}

async function settle(milliseconds = 20) {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, milliseconds)); });
}

async function mount(storage: MemoryStorage, h: Harness) {
  (globalThis as any).__vytorProviderTest = { storage, api: h.api, background: null, themePreferences: [] };
  const provider = await loadProvider();
  let context: any;
  function Probe() { context = provider.useWorkout(); return null; }
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(provider.WorkoutProvider, null, React.createElement(Probe))); });
  await settle();
  return { get context() { return context; }, renderer };
}

test("WorkoutProvider preserves an offline edit across logout, restart and account switches", async () => {
  const storage = memoryStorage({ vytor_user_id: "1" });
  const h = harness(storage);
  const mounted = await mount(storage, h);
  assert.equal(mounted.context.notes, "server");

  h.state.offline = true;
  await act(async () => { mounted.context.setNotes("offline edit"); });
  await settle();
  storage.values.delete("vytor_user_id");
  await act(async () => { h.api.emitSessionChange(); });
  await settle();
  assert.equal(JSON.parse(storage.values.get("vytor_active_workout_1")!).notes, "offline edit", "logout retains A's local draft");
  assert.equal(mounted.context.isActive, false, "logged-out UI is reset");

  storage.values.set("vytor_user_id", "2");
  h.state.offline = false;
  await act(async () => { h.api.emitSessionChange(); });
  await settle();
  assert.equal(mounted.context.isActive, false, "B never receives A's draft");
  assert.equal(storage.values.has("vytor_active_workout_1"), true);

  storage.values.set("vytor_user_id", "1");
  h.state.offline = true;
  await act(async () => { h.api.emitSessionChange(); });
  await settle();
  assert.equal(mounted.context.notes, "offline edit", "A recovers its own draft after relogin/restart semantics");
  assert.match(mounted.context.syncStatus, /saved on this device/i);
  await act(async () => { mounted.renderer.unmount(); });
});

test("WorkoutProvider retains the latest local snapshot when logout races an HTTP save", async () => {
  const storage = memoryStorage({ vytor_user_id: "1" });
  const h = harness(storage);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  h.state.saveDraft = async (_id, revision) => { await gate; return { revision: revision + 1 }; };
  const mounted = await mount(storage, h);
  await act(async () => { mounted.context.setNotes("save in flight"); });
  await settle(850);
  storage.values.delete("vytor_user_id");
  await act(async () => { h.api.emitSessionChange(); });
  release();
  await settle();
  assert.equal(JSON.parse(storage.values.get("vytor_active_workout_1")!).notes, "save in flight");
  assert.equal(mounted.context.isActive, false);
  await act(async () => { mounted.renderer.unmount(); });
});

test("WorkoutProvider cleans confirmed caches and explicit finish/discard paths", async () => {
  const storage = memoryStorage({ vytor_user_id: "1" });
  const h = harness(storage);
  const mounted = await mount(storage, h);
  await act(async () => { mounted.context.setNotes("confirmed"); });
  await settle(900);
  assert.equal(storage.values.has("vytor_active_workout_1"), false, "server-confirmed draft is redundant and removed");

  await act(async () => { await mounted.context.finishWorkout(); });
  assert.equal(h.state.finishCalls, 1);
  assert.equal(storage.values.has("vytor_active_workout_1"), false);
  assert.equal(mounted.context.isActive, false);
  await act(async () => { mounted.renderer.unmount(); });

  const discardStorage = memoryStorage({ vytor_user_id: "1" });
  const discardHarness = harness(discardStorage);
  const discard = await mount(discardStorage, discardHarness);
  await act(async () => { discard.context.setNotes("discard me"); });
  await settle();
  await act(async () => { await discard.context.cancelActiveWorkout(); });
  assert.equal(discardHarness.state.cancelCalls, 1);
  assert.equal(discardStorage.values.has("vytor_active_workout_1"), false);
  await act(async () => { discard.renderer.unmount(); });
});

test("WorkoutProvider ignores a corrupt account-scoped snapshot", async () => {
  const storage = memoryStorage({ vytor_user_id: "1", vytor_active_workout_1: JSON.stringify({ workoutId: 10, revision: 0, exercises: [null] }) });
  const h = harness(storage);
  h.state.offline = true;
  const mounted = await mount(storage, h);
  assert.equal(mounted.context.isActive, false);
  assert.equal(storage.values.has("vytor_active_workout_1"), true, "invalid evidence is not silently destroyed");
  await act(async () => { mounted.renderer.unmount(); });
});

for (const operation of ["finish", "cancel", "start", "add", "delete", "move", "replace"] as const) {
  test(`a delayed ${operation} response for A cannot mutate B's workout`, async () => {
    const storage = memoryStorage({ vytor_user_id: "1" });
    const h = harness(storage);
    if (operation === "start") h.state.activeByAccount.set("1", null as any);
    if (operation === "move") h.state.activeByAccount.set("1", active("A", 0, 10, [exercise(), exercise(12, 2, "Bench")]));
    const pending = deferred<any>();
    const state = h.state as any;
    if (operation === "finish") state.finishWorkout = () => pending.promise;
    if (operation === "cancel") state.cancelWorkout = () => pending.promise;
    if (operation === "start") state.createWorkout = () => pending.promise;
    if (operation === "add") state.addExercise = () => pending.promise;
    if (operation === "delete") state.deleteExercise = () => pending.promise;
    if (operation === "move") state.moveExercise = () => pending.promise;
    if (operation === "replace") state.replaceExercise = () => pending.promise;

    const mounted = await mount(storage, h);
    let operationPromise!: Promise<unknown>;
    await act(async () => {
      if (operation === "finish") operationPromise = mounted.context.finishWorkout();
      if (operation === "cancel") operationPromise = mounted.context.cancelActiveWorkout();
      if (operation === "start") operationPromise = mounted.context.startWorkout([exercise(99, 99, "New")]);
      if (operation === "add") operationPromise = mounted.context.addExercise(exercise(99, 99, "New"));
      if (operation === "delete") operationPromise = mounted.context.deleteExercise("exercise-11");
      if (operation === "move") operationPromise = mounted.context.moveExercise("exercise-11", "down");
      if (operation === "replace") operationPromise = mounted.context.replaceExercise("exercise-11", exercise(99, 99, "New"));
      await new Promise((resolve) => setTimeout(resolve, 5));
    });

    h.state.activeByAccount.set("2", active("B server", 7, 20, [exercise(21, 2, "B Bench")]));
    storage.values.set("vytor_user_id", "2");
    await act(async () => { h.api.emitSessionChange({ reason: "login", accountId: "2" }); });
    await settle();
    storage.values.set("vytor_active_workout_2", JSON.stringify({ owner: "B", untouched: true }));

    if (operation === "finish") pending.resolve({ id: 99 });
    if (operation === "cancel") pending.resolve({ success: true });
    if (operation === "start") pending.resolve({ id: 15, revision: 0, exercises: [] });
    if (operation === "add" || operation === "replace") pending.resolve({ id: 77, revision: 2 });
    if (operation === "delete" || operation === "move") pending.resolve({ revision: 2 });
    await act(async () => { await operationPromise; });
    await settle();

    assert.equal(mounted.context.activeWorkoutId, 20);
    assert.equal(mounted.context.workoutRevision, 7);
    assert.equal(mounted.context.notes, "B server");
    assert.deepEqual(mounted.context.exercises.map((item: any) => item.name), ["B Bench"]);
    assert.deepEqual(JSON.parse(storage.values.get("vytor_active_workout_2")!), { owner: "B", untouched: true });
    const call = h.state.calls.find((entry) => entry.operation === operation);
    assert.ok(call, `${operation} reached the server mock`);
    if (operation !== "start" && operation !== "replace") assert.equal(call.args[0], operation === "delete" ? 11 : 10);
    await act(async () => { mounted.renderer.unmount(); });
  });
}

test("stale rejection and HTTP 409 do not change B's state or sync status", async () => {
  for (const status of [500, 409]) {
    const storage = memoryStorage({ vytor_user_id: "1" });
    const h = harness(storage);
    const pending = deferred<any>();
    (h.state as any).addExercise = () => pending.promise;
    const mounted = await mount(storage, h);
    let result!: Promise<unknown>;
    await act(async () => {
      result = mounted.context.addExercise(exercise(99, 99, "New")).catch((error: unknown) => error);
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    h.state.activeByAccount.set("2", active("B", 7, 20, [exercise(21, 2, "B Bench")]));
    storage.values.set("vytor_user_id", "2");
    await act(async () => { h.api.emitSessionChange({ reason: "login", accountId: "2" }); });
    await settle();
    pending.reject(Object.assign(new Error("late failure"), { status }));
    await act(async () => { await result; });
    assert.equal(mounted.context.activeWorkoutId, 20);
    assert.equal(mounted.context.workoutRevision, 7);
    assert.doesNotMatch(mounted.context.syncStatus, /conflict/i);
    await act(async () => { mounted.renderer.unmount(); });
  }
});

test("account deletion drains an in-flight write without recreating A and leaves B usable", async () => {
  const storage = memoryStorage({ vytor_user_id: "1" });
  const h = harness(storage);
  const mounted = await mount(storage, h);
  const writeGate = deferred<void>();
  let blocked = false;
  storage.beforeSet = async (key) => {
    if (!blocked && key === "vytor_active_workout_1") { blocked = true; await writeGate.promise; }
  };
  await act(async () => { mounted.context.setNotes("pending deletion write"); });
  await settle();
  assert.equal(blocked, true);

  storage.values.set("vytor_deleted_accounts", JSON.stringify(["1"]));
  storage.values.delete("vytor_active_workout_1");
  storage.values.delete("vytor_user_id");
  await act(async () => { h.api.emitSessionChange({ reason: "account-deleted", accountId: "1" }); });
  h.state.activeByAccount.set("2", active("B", 3, 20, [exercise(21, 2, "B Bench")]));
  storage.values.set("vytor_user_id", "2");
  await act(async () => { h.api.emitSessionChange({ reason: "login", accountId: "2" }); });
  writeGate.resolve();
  await settle(50);

  assert.equal(storage.values.has("vytor_active_workout_1"), false);
  assert.equal(mounted.context.activeWorkoutId, 20);
  assert.equal(mounted.context.notes, "B");
  await act(async () => { mounted.renderer.unmount(); });
});

test("late confirmed deletion of A purges its queued write without resetting current B", async () => {
  const storage = memoryStorage({ vytor_user_id: "1" });
  const h = harness(storage);
  const mounted = await mount(storage, h);
  const writeGate = deferred<void>();
  let blocked = false;
  storage.beforeSet = async (key) => {
    if (!blocked && key === "vytor_active_workout_1") { blocked = true; await writeGate.promise; }
  };
  await act(async () => { mounted.context.setNotes("A write already in flight"); });
  await settle();
  assert.equal(blocked, true);

  h.state.activeByAccount.set("2", active("B remains active", 8, 20, [exercise(21, 2, "B Bench")]));
  storage.values.set("vytor_user_id", "2");
  await act(async () => { h.api.emitSessionChange({ reason: "login", accountId: "2" }); });
  await settle();
  assert.equal(mounted.context.activeWorkoutId, 20);

  storage.values.set("vytor_deleted_accounts", JSON.stringify(["1"]));
  await act(async () => { h.api.emitSessionChange({ reason: "account-deleted", accountId: "1" }); });
  writeGate.resolve();
  await settle(50);

  assert.equal(storage.values.has("vytor_active_workout_1"), false);
  assert.equal(storage.values.get("vytor_user_id"), "2");
  assert.equal(mounted.context.activeWorkoutId, 20);
  assert.equal(mounted.context.workoutRevision, 8);
  assert.equal(mounted.context.notes, "B remains active");
  await act(async () => { mounted.renderer.unmount(); });
});

test("restart cleanup removes a tombstoned stale draft before B hydration", async () => {
  const storage = memoryStorage({
    vytor_user_id: "2",
    vytor_deleted_accounts: JSON.stringify(["1"]),
    vytor_active_workout_1: "stale A",
  });
  const h = harness(storage);
  h.state.activeByAccount.set("2", active("B", 4, 20, [exercise(21, 2, "B Bench")]));
  const mounted = await mount(storage, h);
  assert.equal(storage.values.has("vytor_active_workout_1"), false);
  assert.equal(mounted.context.activeWorkoutId, 20);
  assert.equal(mounted.context.workoutRevision, 4);
  await act(async () => { mounted.renderer.unmount(); });
});

test("an unreadable deletion barrier blocks draft writes until a verified retry succeeds", async () => {
  const storage = memoryStorage({ vytor_user_id: "1" });
  const h = harness(storage);
  const mounted = await mount(storage, h);
  storage.values.delete("vytor_active_workout_1");
  h.state.offline = true;
  storage.beforeGet = async (key) => {
    if (key === "vytor_deleted_accounts") throw new Error("temporary tombstone read failure");
  };
  await act(async () => { mounted.context.setNotes("must not persist while unknown"); });
  await settle();
  assert.equal(storage.values.has("vytor_active_workout_1"), false);

  storage.beforeGet = null;
  await act(async () => { mounted.context.setNotes("persist after verified retry"); });
  await settle();
  assert.equal(JSON.parse(storage.values.get("vytor_active_workout_1")!).notes, "persist after verified retry");
  await act(async () => { mounted.renderer.unmount(); });
});

test("A to B hydration rejects late A settings and theme", async () => {
  const storage = memoryStorage({ vytor_user_id: "1" });
  const h = harness(storage);
  const firstA = deferred<any>();
  (h.state as any).settings = () => storage.values.get("vytor_user_id") === "1"
    ? firstA.promise
    : Promise.resolve({ preferredWeightUnit: "LBS", preferredDistanceUnit: "MI", restSeconds: 45, theme: "DARK" });
  h.state.activeByAccount.set("2", active("B", 7, 20));
  const mounted = await mount(storage, h);
  storage.values.set("vytor_user_id", "2");
  await act(async () => { h.api.emitSessionChange({ reason: "login", accountId: "2" }); });
  await settle();
  firstA.resolve({ preferredWeightUnit: "KG", preferredDistanceUnit: "KM", restSeconds: 120, theme: "LIGHT" });
  await settle();
  assert.equal(mounted.context.preferredWeightUnit, "LBS");
  assert.equal(mounted.context.preferredDistanceUnit, "MI");
  assert.equal(mounted.context.restSeconds, 45);
  assert.equal((globalThis as any).__vytorProviderTest.themePreferences.at(-1), "DARK");
  await act(async () => { mounted.renderer.unmount(); });
});

test("A to B to A uses the newest lifecycle even when the account id repeats", async () => {
  const storage = memoryStorage({ vytor_user_id: "1" });
  const h = harness(storage);
  const oldA = deferred<any>();
  let firstA = true;
  (h.state as any).settings = () => {
    const accountId = storage.values.get("vytor_user_id");
    if (accountId === "1" && firstA) { firstA = false; return oldA.promise; }
    return Promise.resolve(accountId === "1"
      ? { preferredWeightUnit: "LBS", preferredDistanceUnit: "MI", restSeconds: 30, theme: "DARK" }
      : { preferredWeightUnit: "KG", preferredDistanceUnit: "KM", restSeconds: 60, theme: "SYSTEM" });
  };
  const mounted = await mount(storage, h);
  storage.values.set("vytor_user_id", "2");
  await act(async () => { h.api.emitSessionChange({ reason: "login", accountId: "2" }); });
  await settle();
  storage.values.set("vytor_user_id", "1");
  await act(async () => { h.api.emitSessionChange({ reason: "login", accountId: "1" }); });
  await settle();
  oldA.resolve({ preferredWeightUnit: "KG", preferredDistanceUnit: "KM", restSeconds: 180, theme: "LIGHT" });
  await settle();
  assert.equal(mounted.context.restSeconds, 30);
  assert.equal(mounted.context.preferredWeightUnit, "LBS");
  assert.equal((globalThis as any).__vytorProviderTest.themePreferences.at(-1), "DARK");
  await act(async () => { mounted.renderer.unmount(); });
});

test("the newest overlapping reload wins when responses arrive out of order", async () => {
  const storage = memoryStorage({ vytor_user_id: "1" });
  const h = harness(storage);
  const mounted = await mount(storage, h);
  const first = deferred<any>();
  const second = deferred<any>();
  let call = 0;
  (h.state as any).getActive = () => (++call === 1 ? first.promise : second.promise);
  let firstReload!: Promise<void>;
  let secondReload!: Promise<void>;
  await act(async () => { firstReload = mounted.context.reloadActiveWorkout(); await new Promise((resolve) => setTimeout(resolve, 5)); });
  await act(async () => { secondReload = mounted.context.reloadActiveWorkout(); await new Promise((resolve) => setTimeout(resolve, 5)); });
  second.resolve(active("newest", 9, 30, [exercise(31, 3, "Newest")]));
  await act(async () => { await secondReload; });
  first.resolve(active("old", 8, 29, [exercise(29, 4, "Old")]));
  await act(async () => { await firstReload; });
  assert.equal(mounted.context.activeWorkoutId, 30);
  assert.equal(mounted.context.workoutRevision, 9);
  assert.equal(mounted.context.notes, "newest");
  assert.deepEqual(mounted.context.exercises.map((item: any) => item.name), ["Newest"]);
  await act(async () => { mounted.renderer.unmount(); });
});

test("save preset succeeds exactly once for the unchanged originating session", async () => {
  const storage = memoryStorage({ vytor_user_id: "1" });
  const h = harness(storage);
  const mounted = await mount(storage, h);
  let saved!: boolean;
  await act(async () => { saved = await mounted.context.savePreset(); });
  assert.equal(saved, true);
  const calls = h.state.calls.filter((entry) => entry.operation === "save-preset");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.args[1], [1]);
  assert.deepEqual(calls[0]?.args[3], { accountId: "1", token: "a".repeat(64) });
  await act(async () => { mounted.renderer.unmount(); });
});

test("save preset aborts before its request when the session changes during identity capture", async () => {
  const storage = memoryStorage({ vytor_user_id: "1" });
  const h = harness(storage);
  const capture = deferred<any>();
  (h.state as any).captureSession = () => capture.promise;
  const mounted = await mount(storage, h);
  let result!: Promise<boolean>;
  await act(async () => { result = mounted.context.savePreset(); await new Promise((resolve) => setTimeout(resolve, 5)); });
  h.state.activeByAccount.set("2", active("B", 4, 20));
  storage.values.set("vytor_user_id", "2");
  await act(async () => { h.api.emitSessionChange({ reason: "login", accountId: "2" }); });
  capture.resolve({ accountId: "1", token: "a".repeat(64) });
  await act(async () => { assert.equal(await result, false); });
  assert.equal(h.state.calls.some((entry) => entry.operation === "save-preset"), false);
  assert.equal(mounted.context.activeWorkoutId, 20);
  await act(async () => { mounted.renderer.unmount(); });
});

test("save preset keeps an in-flight request bound to A and suppresses its late result in B", async () => {
  const storage = memoryStorage({ vytor_user_id: "1" });
  const h = harness(storage);
  const request = deferred<any>();
  (h.state as any).createTemplate = () => request.promise;
  const mounted = await mount(storage, h);
  let result!: Promise<boolean>;
  await act(async () => { result = mounted.context.savePreset(); await new Promise((resolve) => setTimeout(resolve, 5)); });
  const call = h.state.calls.find((entry) => entry.operation === "save-preset");
  assert.deepEqual(call?.args[3], { accountId: "1", token: "a".repeat(64) });
  h.state.activeByAccount.set("2", active("B", 4, 20));
  storage.values.set("vytor_user_id", "2");
  await act(async () => { h.api.emitSessionChange({ reason: "login", accountId: "2" }); });
  request.resolve({ id: 50 });
  await act(async () => { assert.equal(await result, false); });
  assert.equal(mounted.context.activeWorkoutId, 20);
  assert.equal(mounted.context.notes, "B");
  await act(async () => { mounted.renderer.unmount(); });
});

test("save preset does not revive across A to B to A and stale failures stay silent", async () => {
  const storage = memoryStorage({ vytor_user_id: "1" });
  const h = harness(storage);
  const capture = deferred<any>();
  (h.state as any).captureSession = () => capture.promise;
  const mounted = await mount(storage, h);
  let result!: Promise<boolean>;
  await act(async () => { result = mounted.context.savePreset(); await new Promise((resolve) => setTimeout(resolve, 5)); });
  storage.values.set("vytor_user_id", "2");
  await act(async () => { h.api.emitSessionChange({ reason: "login", accountId: "2" }); });
  await settle();
  storage.values.set("vytor_user_id", "1");
  await act(async () => { h.api.emitSessionChange({ reason: "login", accountId: "1" }); });
  capture.reject(new Error("late network failure"));
  await act(async () => { assert.equal(await result, false); });
  assert.equal(h.state.calls.some((entry) => entry.operation === "save-preset"), false);

  (h.state as any).captureSession = async () => ({ accountId: "1", token: "c".repeat(64) });
  (h.state as any).createTemplate = async () => { throw new Error("network unavailable"); };
  await act(async () => { await assert.rejects(mounted.context.savePreset(), /network unavailable/); });
  await act(async () => { mounted.renderer.unmount(); });
});
