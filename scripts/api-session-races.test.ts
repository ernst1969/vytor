import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "../server/node_modules/esbuild/lib/main.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((accept) => { resolve = accept; });
  return { promise, resolve };
}

async function loadApi() {
  const result = await build({
    absWorkingDir: process.cwd(), entryPoints: ["src/services/api.ts"], bundle: true,
    platform: "node", format: "cjs", write: false, define: { __DEV__: "true" },
    plugins: [{
      name: "api-session-race-mocks",
      setup(buildApi) {
        const modules: Record<string, string> = {
          "@react-native-async-storage/async-storage": `
            const state = () => globalThis.__vytorApiSessionTest;
            export default {
              getItem: async (key) => key === "vytor_user_id" ? state().userId : state().storage.get(key) ?? null,
              setItem: async (key, value) => state().storage.set(key, value),
              removeItem: async (key) => state().storage.delete(key),
            };
          `,
          "@/services/session-store": `
            const state = () => globalThis.__vytorApiSessionTest;
            export const getSessionIdentity = async () => ({ token: state().token, userId: state().userId });
            export const getSessionToken = async () => {
              if (state().tokenGate) await state().tokenGate.promise;
              return { token: state().token, invalidated: false };
            };
            export const clearSessionCredentialsIfIdentityCurrent = async (expected) => {
              const current = state();
              current.identityClears.push(expected);
              if (current.token !== expected.token || current.userId !== expected.userId) return false;
              if (current.token === null && current.userId === null) return false;
              current.token = null; current.userId = null; return true;
            };
            export const clearSessionCredentialsIfCurrent = async (expected) => {
              const current = state();
              if (current.token !== expected) return false;
              current.token = null; current.userId = null; return true;
            };
            export const clearSessionCredentialsIfUserCurrent = async (expected) => {
              const current = state();
              if (current.userId !== expected) return false;
              current.token = null; current.userId = null; return true;
            };
            export const clearSessionCredentials = async () => false;
            export const storeSessionCredentials = async (userId, token) => { state().userId = String(userId); state().token = token ?? null; };
          `,
        };
        buildApi.onResolve({ filter: /.*/ }, (args) => modules[args.path] ? { path: args.path, namespace: "api-session-mock" } : undefined);
        buildApi.onLoad({ filter: /.*/, namespace: "api-session-mock" }, (args) => ({ contents: modules[args.path], loader: "js" }));
      },
    }],
  });
  const module = { exports: {} as any };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", result.outputFiles[0].text)(require, module, module.exports);
  return module.exports;
}

const tokenA = "a".repeat(64);
const tokenB = "b".repeat(64);
const apiPromise = loadApi();

function setup(token: string | null, userId: string | null) {
  const state = {
    token, userId, tokenGate: null as ReturnType<typeof deferred> | null,
    storage: new Map<string, string>(), identityClears: [] as unknown[],
  };
  (globalThis as any).__vytorApiSessionTest = state;
  return state;
}

async function withFetch(response: () => Promise<Response>, task: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = response;
  try { await task(); } finally { globalThis.fetch = original; }
}

test("logout with a token and tokenless logout clear only their captured identity", async () => {
  const api = await apiPromise;
  for (const token of [tokenA, null]) {
    const state = setup(token, "1");
    const changes: unknown[] = [];
    const unsubscribe = api.onSessionChange((change: unknown) => changes.push(change));
    await withFetch(async () => new Response("{}", { status: token ? 200 : 401 }), async () => { await api.logoutUser(); });
    unsubscribe();
    assert.equal(state.token, null);
    assert.equal(state.userId, null);
    assert.deepEqual(changes, [{ reason: "logout" }]);
  }
});

test("delayed tokenless logout cannot send with or clear a newer B or newer A session", async () => {
  const api = await apiPromise;
  for (const nextUserId of ["2", "1"]) {
    const state = setup(null, "1");
    const gate = deferred();
    state.tokenGate = gate;
    let networkCalls = 0;
    await withFetch(async () => { networkCalls += 1; return new Response("{}", { status: 200 }); }, async () => {
      const logout = api.logoutUser();
      await new Promise((resolve) => setTimeout(resolve, 5));
      state.token = tokenB;
      state.userId = nextUserId;
      gate.resolve();
      assert.equal(await logout, false);
    });
    assert.equal(networkCalls, 0);
    assert.equal(state.token, tokenB);
    assert.equal(state.userId, nextUserId);
  }
});

test("logout network failure still clears A, repeated logout is harmless", async () => {
  const api = await apiPromise;
  const state = setup(tokenA, "1");
  const changes: unknown[] = [];
  const unsubscribe = api.onSessionChange((change: unknown) => changes.push(change));
  await withFetch(async () => { throw new Error("offline"); }, async () => {
    assert.equal(await api.logoutUser(), true);
  });
  assert.equal(state.token, null);
  assert.equal(state.userId, null);
  await withFetch(async () => new Response("{}", { status: 401 }), async () => { await api.logoutUser(); });
  unsubscribe();
  assert.deepEqual(changes, [{ reason: "logout" }]);
});

test("a 401 during logout clears only A and still reports completed local logout", async () => {
  const api = await apiPromise;
  const state = setup(tokenA, "1");
  const changes: unknown[] = [];
  const unsubscribe = api.onSessionChange((change: unknown) => changes.push(change));
  await withFetch(async () => new Response("{}", { status: 401 }), async () => {
    assert.equal(await api.logoutUser(), true);
  });
  unsubscribe();
  assert.equal(state.token, null);
  assert.equal(state.userId, null);
  assert.deepEqual(changes, [{ reason: "expired" }]);
});

test("preset request binding rejects a newer session before sending A data", async () => {
  const api = await apiPromise;
  const state = setup(tokenA, "1");
  const binding = await api.captureSessionRequestBinding("1");
  state.token = tokenB;
  state.userId = "2";
  let networkCalls = 0;
  await withFetch(async () => { networkCalls += 1; return new Response("{}", { status: 200 }); }, async () => {
    await assert.rejects(api.createWorkoutTemplate("A workout", [1], {}, binding), /Session changed/);
  });
  assert.equal(networkCalls, 0);
});

test("an in-flight preset request keeps A's captured bearer after switching to B", async () => {
  const api = await apiPromise;
  const state = setup(tokenA, "1");
  const binding = await api.captureSessionRequestBinding("1");
  let authorization: string | null = null;
  let release!: () => void;
  const responseGate = new Promise<void>((resolve) => { release = resolve; });
  await withFetch(async (_input, init) => {
    authorization = new Headers(init?.headers).get("Authorization");
    await responseGate;
    return new Response(JSON.stringify({ id: 50 }), { status: 200 });
  }, async () => {
    const request = api.createWorkoutTemplate("A workout", [1], {}, binding);
    await new Promise((resolve) => setTimeout(resolve, 5));
    state.token = tokenB;
    state.userId = "2";
    release();
    await request;
  });
  assert.equal(authorization, `Bearer ${tokenA}`);
  assert.equal(state.token, tokenB);
  assert.equal(state.userId, "2");
});

test("password change binding rejects a newer session before sending", async () => {
  const api = await apiPromise;
  const state = setup(tokenA, "1");
  const binding = await api.captureSessionRequestBinding("1");
  state.token = tokenB;
  state.userId = "2";
  let networkCalls = 0;
  await withFetch(async () => { networkCalls += 1; return new Response("{}", { status: 200 }); }, async () => {
    await assert.rejects(api.changePassword("same-password", "new-password", binding), /Session changed/);
  });
  assert.equal(networkCalls, 0);
  assert.equal(state.userId, "2");
  assert.equal(state.token, tokenB);
});

test("in-flight A password change keeps A bearer and cannot log out or navigate B", async () => {
  const api = await apiPromise;
  const state = setup(tokenA, "1");
  const binding = await api.captureSessionRequestBinding("1");
  const changes: unknown[] = [];
  const unsubscribe = api.onSessionChange((change: unknown) => changes.push(change));
  let authorization: string | null = null;
  let release!: () => void;
  const responseGate = new Promise<void>((resolve) => { release = resolve; });
  await withFetch(async (_input, init) => {
    authorization = new Headers(init?.headers).get("Authorization");
    await responseGate;
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }, async () => {
    const request = api.changePassword("same-password", "new-password", binding);
    await new Promise((resolve) => setTimeout(resolve, 5));
    state.token = tokenB;
    state.userId = "2";
    release();
    const result = await request;
    assert.equal(result.sessionCleared, false);
  });
  unsubscribe();
  assert.equal(authorization, `Bearer ${tokenA}`);
  assert.equal(state.token, tokenB);
  assert.equal(state.userId, "2");
  assert.deepEqual(changes, []);
});
