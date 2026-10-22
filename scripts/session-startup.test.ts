import assert from "node:assert/strict";
import test from "node:test";
import { checkStartupSession, type StartupSessionDependencies } from "../src/services/session-startup";

const tokenA = "a".repeat(64);
function fixture(initialUserId: string | null, response: "ok" | 401 | 404 | "offline" = "ok") {
  let userId = initialUserId;
  let currentToken = initialUserId ? tokenA : null;
  let beforeResponse: (() => void) | undefined;
  const dependencies: StartupSessionDependencies = {
    readUserId: async () => userId,
    getSession: async (capture) => {
      const requestToken = currentToken;
      capture(requestToken);
      beforeResponse?.();
      if (response === "ok") return { userId: Number(initialUserId) };
      if (response === 401 && currentToken === requestToken) { currentToken = null; userId = null; }
      throw Object.assign(new Error(String(response)), response === "offline" ? {} : { status: response });
    },
    clearIfUserCurrent: async (expected) => {
      if (userId !== expected) return false;
      userId = null; currentToken = null; return true;
    },
    clearIfTokenCurrent: async (expected) => {
      if (currentToken !== expected) return false;
      userId = null; currentToken = null; return true;
    },
  };
  return {
    dependencies,
    beforeResponse(callback: () => void) { beforeResponse = callback; },
    login(nextUserId: string, token = "b".repeat(64)) { userId = nextUserId; currentToken = token; },
    state() { return { userId, currentToken }; },
  };
}

test("startup distinguishes no session, a valid session and offline operation", async () => {
  assert.equal(await checkStartupSession(fixture(null).dependencies), "create-user");
  assert.equal(await checkStartupSession(fixture("1").dependencies), "authenticated");
  const offline = fixture("1", "offline");
  assert.equal(await checkStartupSession(offline.dependencies), "offline");
  assert.equal(offline.state().userId, "1", "network failure does not log out");
});

test("a current 401 invalidates A and navigates to login", async () => {
  const current = fixture("1", 401);
  assert.equal(await checkStartupSession(current.dependencies), "login");
  assert.deepEqual(current.state(), { userId: null, currentToken: null });
});

test("a late 401 or successful response from A cannot clear or navigate away from B", async () => {
  for (const response of [401, "ok"] as const) {
    const stale = fixture("1", response);
    stale.beforeResponse(() => stale.login("2"));
    assert.equal(await checkStartupSession(stale.dependencies), "stale");
    assert.equal(stale.state().userId, "2");
  }
});

test("a late 404 compare-clears only its own request token", async () => {
  const current = fixture("1", 404);
  assert.equal(await checkStartupSession(current.dependencies), "login");

  const stale = fixture("1", 404);
  stale.beforeResponse(() => stale.login("2"));
  assert.equal(await checkStartupSession(stale.dependencies), "stale");
  assert.equal(stale.state().userId, "2");
});

test("invalid startup identity cannot clear a concurrently stored login", async () => {
  const invalid = fixture("not-a-user");
  invalid.dependencies.clearIfUserCurrent = async () => {
    invalid.login("2");
    return false;
  };
  assert.equal(await checkStartupSession(invalid.dependencies), "stale");
  assert.equal(invalid.state().userId, "2");
});

test("startup rejects a token whose authenticated account differs from stored identity", async () => {
  const mismatch = fixture("1");
  mismatch.dependencies.getSession = async (capture) => { capture(tokenA); return { userId: 2 }; };
  assert.equal(await checkStartupSession(mismatch.dependencies), "login");
  assert.deepEqual(mismatch.state(), { userId: null, currentToken: null });
});
