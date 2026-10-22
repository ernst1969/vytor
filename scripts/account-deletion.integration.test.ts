import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "../server/node_modules/esbuild/lib/main.js";

async function loadApi() {
  const result = await build({
    absWorkingDir: process.cwd(),
    entryPoints: ["src/services/api.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    define: { __DEV__: "true" },
    plugins: [{
      name: "account-delete-test-mocks",
      setup(buildApi) {
        const modules: Record<string, string> = {
          "@react-native-async-storage/async-storage": `
            const state = () => globalThis.__vytorAccountDeleteTest;
            export default {
              getItem: (key) => key === "vytor_user_id" ? Promise.resolve(state().userId) : state().storage.getItem(key),
              setItem: (...args) => state().storage.setItem(...args),
              removeItem: (...args) => state().storage.removeItem(...args),
            };
          `,
          "@/services/session-store": `
            const state = () => globalThis.__vytorAccountDeleteTest;
            export const getSessionToken = async () => {
              if (state().tokenGate) await state().tokenGate.promise;
              return { token: state().token, invalidated: false };
            };
            export const getSessionIdentity = async () => {
              if (state().identityGate) await state().identityGate.promise;
              return { token: state().token, userId: state().userId };
            };
            export const clearSessionCredentials = async () => { state().clears += 1; return true; };
            export const clearSessionCredentialsIfCurrent = async (token) => {
              const current = state();
              current.clearTokens.push(token);
              if (current.token !== token) return false;
              current.token = null; current.userId = null; return true;
            };
            export const clearSessionCredentialsIfUserCurrent = async (userId) => {
              const current = state();
              if (current.userId !== userId) return false;
              current.token = null; current.userId = null; return true;
            };
            export const clearSessionCredentialsIfIdentityCurrent = async (identity) => {
              const current = state();
              current.identityClears.push(identity);
              if (current.token !== identity.token || current.userId !== identity.userId) return false;
              current.token = null; current.userId = null; return true;
            };
            export const storeSessionCredentials = async () => undefined;
          `,
        };
        buildApi.onResolve({ filter: /.*/ }, (args) => modules[args.path]
          ? { path: args.path, namespace: "account-delete-mock" }
          : undefined);
        buildApi.onLoad({ filter: /.*/, namespace: "account-delete-mock" }, (args) => ({ contents: modules[args.path], loader: "js" }));
      },
    }],
  });
  const module = { exports: {} as any };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", result.outputFiles[0].text)(require, module, module.exports);
  return module.exports;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((accept) => { resolve = accept; });
  return { promise, resolve };
}

const tokenA = "a".repeat(64);
const tokenB = "b".repeat(64);

function setup(values: Record<string, string>, token = tokenA, userId = "1") {
  const entries = new Map(Object.entries(values));
  const state = {
    storage: {
      getItem: async (key: string) => entries.get(key) ?? null,
      setItem: async (key: string, value: string) => { entries.set(key, value); },
      removeItem: async (key: string) => { entries.delete(key); },
    },
    entries,
    token,
    userId,
    tokenGate: null as ReturnType<typeof deferred> | null,
    identityGate: null as ReturnType<typeof deferred> | null,
    clears: 0,
    clearTokens: [] as string[],
    identityClears: [] as unknown[],
    login(nextUserId: string, nextToken: string) { this.userId = nextUserId; this.token = nextToken; },
  };
  (globalThis as any).__vytorAccountDeleteTest = state;
  return state;
}

const apiPromise = loadApi();

test("confirmed delete establishes the barrier before lifecycle notification and preserves B", async () => {
  const api = await apiPromise;
  const state = setup({
    vytor_user_id: "1",
    vytor_active_workout_1: "A",
    vytor_active_workout_2: "B",
    vytor_active_workout: "legacy",
  });
  const changes: unknown[] = [];
  const unsubscribe = api.onSessionChange((change: unknown) => changes.push(change));
  const binding = await api.captureSessionRequestBinding("1");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true }), { status: 200 });
  try {
    const result = await api.deleteAccount("password", binding);
    assert.equal(result.sessionCleared, true);
  } finally {
    globalThis.fetch = originalFetch;
    unsubscribe();
  }
  assert.equal(state.entries.has("vytor_active_workout_1"), false);
  assert.equal(state.entries.has("vytor_active_workout"), false);
  assert.equal(state.entries.get("vytor_active_workout_2"), "B");
  assert.deepEqual(JSON.parse(state.entries.get("vytor_deleted_accounts")!), ["1"]);
  assert.deepEqual(state.identityClears, [{ token: tokenA, userId: "1" }]);
  assert.deepEqual(changes, [{ reason: "account-deleted", accountId: "1" }]);
});

test("rejected server delete keeps the account draft and does not notify or clear credentials", async () => {
  const api = await apiPromise;
  const state = setup({ vytor_user_id: "1", vytor_active_workout_1: "valuable A draft" });
  const changes: unknown[] = [];
  const unsubscribe = api.onSessionChange((change: unknown) => changes.push(change));
  const binding = await api.captureSessionRequestBinding("1");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "wrong password" }), { status: 403 });
  try {
    await assert.rejects(api.deleteAccount("wrong", binding), (error: any) => error.status === 403);
  } finally {
    globalThis.fetch = originalFetch;
    unsubscribe();
  }
  assert.equal(state.entries.get("vytor_active_workout_1"), "valuable A draft");
  assert.equal(state.entries.has("vytor_deleted_accounts"), false);
  assert.deepEqual(state.clearTokens, []);
  assert.deepEqual(changes, []);
});

test("A binding cannot delete B or a newer A session before request start", async () => {
  const api = await apiPromise;
  for (const [nextUserId, nextToken] of [["2", tokenB], ["1", "c".repeat(64)]] as const) {
    const state = setup({ vytor_active_workout_1: "A", vytor_active_workout_2: "B" });
    const binding = await api.captureSessionRequestBinding("1");
    state.login(nextUserId, nextToken);
    let calls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify({ success: true }), { status: 200 }); };
    try {
      await assert.rejects(api.deleteAccount("same-password", binding), /Session changed/);
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(calls, 0);
    assert.equal(state.userId, nextUserId);
    assert.equal(state.token, nextToken);
    assert.equal(state.entries.get("vytor_active_workout_1"), "A");
    assert.equal(state.entries.get("vytor_active_workout_2"), "B");
  }
});

test("session switch during identity capture cannot bind A confirmation to B", async () => {
  const api = await apiPromise;
  const state = setup({});
  const gate = deferred();
  state.identityGate = gate;
  const capture = api.captureSessionRequestBinding("1");
  state.login("2", tokenB);
  gate.resolve();
  await assert.rejects(capture, /Session changed/);
});

test("in-flight A deletion purges only A and preserves the newer B session", async () => {
  const api = await apiPromise;
  const state = setup({
    vytor_active_workout_1: "A",
    vytor_active_workout_2: "B",
  });
  const binding = await api.captureSessionRequestBinding("1");
  const changes: unknown[] = [];
  const unsubscribe = api.onSessionChange((change: unknown) => changes.push(change));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let authorization: string | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get("Authorization");
    await gate;
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  try {
    const deletion = api.deleteAccount("same-password", binding);
    await new Promise((resolve) => setTimeout(resolve, 5));
    state.login("2", tokenB);
    release();
    const result = await deletion;
    assert.equal(result.sessionCleared, false);
  } finally {
    globalThis.fetch = originalFetch;
    unsubscribe();
  }
  assert.equal(authorization, `Bearer ${tokenA}`);
  assert.equal(state.userId, "2");
  assert.equal(state.token, tokenB);
  assert.equal(state.entries.has("vytor_active_workout_1"), false);
  assert.equal(state.entries.get("vytor_active_workout_2"), "B");
  assert.deepEqual(changes, [{ reason: "account-deleted", accountId: "1" }]);
});

test("network failure and repeated stale callback keep session/data and do not duplicate delete", async () => {
  const api = await apiPromise;
  const state = setup({ vytor_active_workout_1: "A" });
  const binding = await api.captureSessionRequestBinding("1");
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls += 1; throw new Error("offline"); };
  try {
    await assert.rejects(api.deleteAccount("password", binding), /offline/);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(state.entries.get("vytor_active_workout_1"), "A");
  assert.equal(state.userId, "1");
  assert.equal(state.token, tokenA);

  globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify({ success: true }), { status: 200 }); };
  try {
    await api.deleteAccount("password", binding);
    await assert.rejects(api.deleteAccount("password", binding), /Session changed/);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls, 2, "one offline call and one successful DELETE; stale repeat is blocked before network");
});
