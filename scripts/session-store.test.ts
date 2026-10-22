import assert from "node:assert/strict";
import test from "node:test";

import { SessionCredentialStore, type SessionStorageAdapter } from "../src/services/session-store-core";

const tokenA = "a".repeat(64);
const tokenB = "b".repeat(64);

function memory(initial: { secure?: string | null; legacy?: string | null; userId?: string | null } = {}) {
  const state = { secure: initial.secure ?? null, legacy: initial.legacy ?? null, userId: initial.userId ?? null };
  const adapter: SessionStorageAdapter = {
    readSecure: async () => state.secure,
    writeSecure: async (token) => { state.secure = token; },
    deleteSecure: async () => { state.secure = null; },
    readLegacy: async () => state.legacy,
    deleteLegacy: async () => { state.legacy = null; },
    readUserId: async () => state.userId,
    writeUserId: async (userId) => { state.userId = userId; },
    deleteUserId: async () => { state.userId = null; },
  };
  return { state, adapter, store: new SessionCredentialStore(adapter) };
}

test("validates and crash-safely migrates a legacy token", async () => {
  const fixture = memory({ legacy: tokenA, userId: "1" });
  const result = await fixture.store.getToken(async () => "valid");
  assert.deepEqual(result, { token: tokenA, invalidated: false, migration: "migrated" });
  assert.equal(fixture.state.secure, tokenA);
  assert.equal(fixture.state.legacy, null);

  const repeated = await fixture.store.getToken(async () => { throw new Error("must not revalidate"); });
  assert.equal(repeated.token, tokenA);
});

test("invalid legacy credentials clear the matching session while offline validation defers", async () => {
  const invalid = memory({ legacy: tokenA, userId: "1" });
  assert.equal((await invalid.store.getToken(async () => "invalid")).invalidated, true);
  assert.deepEqual(invalid.state, { secure: null, legacy: null, userId: null });

  for (const reason of ["offline", "timeout"]) {
    const deferred = memory({ legacy: tokenA, userId: "1" });
    const result = await deferred.store.getToken(async () => "deferred");
    assert.equal(result.token, tokenA, reason);
    assert.equal(result.migration, "deferred", reason);
    assert.equal(deferred.state.legacy, tokenA, reason);
    assert.equal(deferred.state.secure, null, reason);
  }
});

test("storage failures never delete the only usable legacy credential", async () => {
  const readFailure = memory({ legacy: tokenA, userId: "1" });
  readFailure.adapter.readSecure = async () => { throw new Error("secure read failed"); };
  await assert.rejects(readFailure.store.getToken(async () => "valid"), /secure read failed/);
  assert.equal(readFailure.state.legacy, tokenA);

  const writeFailure = memory({ legacy: tokenA, userId: "1" });
  writeFailure.adapter.writeSecure = async () => { throw new Error("secure write failed"); };
  await assert.rejects(writeFailure.store.getToken(async () => "valid"), /secure write failed/);
  assert.equal(writeFailure.state.legacy, tokenA);
  assert.equal(writeFailure.state.secure, null);
});

test("a crash after secure write is recovered and stale plaintext is cleaned", async () => {
  const fixture = memory({ legacy: tokenA, userId: "1" });
  let first = true;
  fixture.adapter.deleteLegacy = async () => {
    if (first) { first = false; throw new Error("simulated crash"); }
    fixture.state.legacy = null;
  };
  await assert.rejects(fixture.store.getToken(async () => "valid"), /simulated crash/);
  assert.equal(fixture.state.secure, tokenA);
  assert.equal(fixture.state.legacy, tokenA);
  const recovered = await fixture.store.getToken(async () => "invalid");
  assert.equal(recovered.token, tokenA);
  assert.equal(recovered.migration, "cleaned");
  assert.equal(fixture.state.legacy, null);
});

test("an existing secure token wins over and removes a stale legacy token", async () => {
  const fixture = memory({ secure: tokenB, legacy: tokenA, userId: "2" });
  const result = await fixture.store.getToken(async () => { throw new Error("must not validate stale token"); });
  assert.equal(result.token, tokenB);
  assert.equal(fixture.state.legacy, null);
});

test("delayed 401, logout, account switch and parallel 401s are serialized", async () => {
  const delayed = memory({ secure: tokenA, userId: "1" });
  await delayed.store.store(2, tokenB);
  assert.equal(await delayed.store.clearIfCurrent(tokenA), false, "old 401 cannot delete a new login");
  assert.deepEqual(delayed.state, { secure: tokenB, legacy: null, userId: "2" });

  const parallel = memory({ secure: tokenA, userId: "1" });
  assert.deepEqual((await Promise.all([
    parallel.store.clearIfCurrent(tokenA),
    parallel.store.clearIfCurrent(tokenA),
  ])).sort(), [false, true]);

  const logout = memory({ secure: tokenA, userId: "1" });
  assert.equal(await logout.store.clear(), true);
  assert.equal(await logout.store.clearIfCurrent(tokenA), false, "response after logout is harmless");
});

test("startup cleanup is conditional on the same stored account", async () => {
  const stale = memory({ secure: tokenA, userId: "1" });
  await stale.store.store(2, tokenB);
  assert.equal(await stale.store.clearIfUserId("1"), false);
  assert.deepEqual(stale.state, { secure: tokenB, legacy: null, userId: "2" });

  assert.equal(await stale.store.clearIfUserId("2"), true);
  assert.deepEqual(stale.state, { secure: null, legacy: null, userId: null });
});

test("logout and account changes wait for an in-progress migration", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const logout = memory({ legacy: tokenA, userId: "1" });
  const migration = logout.store.getToken(async () => { await gate; return "valid"; });
  const clearing = logout.store.clear();
  release();
  await migration;
  assert.equal(await clearing, true);
  assert.deepEqual(logout.state, { secure: null, legacy: null, userId: null });

  const account = memory({ legacy: tokenA, userId: "1" });
  let releaseSwitch!: () => void;
  const switchGate = new Promise<void>((resolve) => { releaseSwitch = resolve; });
  const oldMigration = account.store.getToken(async () => { await switchGate; return "valid"; });
  const newLogin = account.store.store(2, tokenB);
  releaseSwitch();
  await oldMigration;
  await newLogin;
  assert.deepEqual(account.state, { secure: tokenB, legacy: null, userId: "2" });
});

test("failed storage of a new session does not report success or replace the old token", async () => {
  const fixture = memory({ secure: tokenA, userId: "1" });
  fixture.adapter.writeSecure = async () => { throw new Error("disk full"); };
  await assert.rejects(fixture.store.store(2, tokenB), /disk full/);
  assert.deepEqual(fixture.state, { secure: tokenA, legacy: null, userId: "1" });

  const userWriteFailure = memory({ secure: tokenA, userId: "1" });
  userWriteFailure.adapter.writeUserId = async (userId) => {
    if (userId === "2") throw new Error("user storage failed");
    userWriteFailure.state.userId = userId;
  };
  await assert.rejects(userWriteFailure.store.store(2, tokenB), /user storage failed/);
  assert.deepEqual(userWriteFailure.state, { secure: tokenA, legacy: null, userId: "1" });
});

test("logout cleanup is bound to the complete starting identity, including tokenless sessions", async () => {
  const regular = memory({ secure: tokenA, userId: "1" });
  const regularIdentity = await regular.store.getIdentity();
  assert.equal(await regular.store.clearIfIdentity(regularIdentity), true);
  assert.deepEqual(regular.state, { secure: null, legacy: null, userId: null });

  const tokenless = memory({ userId: "1" });
  const tokenlessIdentity = await tokenless.store.getIdentity();
  assert.deepEqual(tokenlessIdentity, { token: null, userId: "1" });
  assert.equal(await tokenless.store.clearIfIdentity(tokenlessIdentity), true);
  assert.deepEqual(tokenless.state, { secure: null, legacy: null, userId: null });

  assert.equal(await tokenless.store.clearIfIdentity(tokenlessIdentity), false, "repeated logout is idempotent");
});

test("delayed tokenless logout cannot clear a newer B or newer A session", async () => {
  for (const next of [{ userId: 2, token: tokenB }, { userId: 1, token: tokenB }]) {
    const fixture = memory({ userId: "1" });
    const oldIdentity = await fixture.store.getIdentity();
    await fixture.store.store(next.userId, next.token);
    assert.equal(await fixture.store.clearIfIdentity(oldIdentity), false);
    assert.deepEqual(fixture.state, { secure: tokenB, legacy: null, userId: String(next.userId) });
  }
});

test("parallel logout, login and delayed 401 preserve whichever newer session wins the queue", async () => {
  const loginWins = memory({ secure: tokenA, userId: "1" });
  const oldIdentity = await loginWins.store.getIdentity();
  const newLogin = loginWins.store.store(2, tokenB);
  const oldLogout = loginWins.store.clearIfIdentity(oldIdentity);
  const late401 = loginWins.store.clearIfCurrent(tokenA);
  await newLogin;
  assert.equal(await oldLogout, false);
  assert.equal(await late401, false);
  assert.deepEqual(loginWins.state, { secure: tokenB, legacy: null, userId: "2" });

  const logoutWinsFirst = memory({ secure: tokenA, userId: "1" });
  const identity = await logoutWinsFirst.store.getIdentity();
  const clearing = logoutWinsFirst.store.clearIfIdentity(identity);
  const login = logoutWinsFirst.store.store(2, tokenB);
  assert.equal(await clearing, true);
  await login;
  assert.deepEqual(logoutWinsFirst.state, { secure: tokenB, legacy: null, userId: "2" });
});
