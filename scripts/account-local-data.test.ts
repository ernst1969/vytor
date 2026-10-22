import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountDeletionBarrierError,
  isAccountDeleted,
  markAccountDeleted,
  purgeMarkedDeletedAccountData,
  removeDeletedAccountLocalData,
} from "../src/services/account-local-data";

function storage(values: Map<string, string>) {
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
  };
}

test("confirmed account deletion removes only that account's draft and the legacy cache", async () => {
  const values = new Map([
    ["vytor_active_workout_1", "A"],
    ["vytor_active_workout_2", "B"],
    ["vytor_active_workout", "legacy"],
  ]);
  const local = storage(values);
  await removeDeletedAccountLocalData("1", local);
  assert.equal(values.has("vytor_active_workout_1"), false);
  assert.equal(values.has("vytor_active_workout"), false);
  assert.equal(values.get("vytor_active_workout_2"), "B");
  assert.equal(await isAccountDeleted("1", local), true);
  assert.equal(await isAccountDeleted("2", local), false);
});

test("deletion barriers are idempotent, bounded and finish crash-interrupted cleanup", async () => {
  const values = new Map<string, string>();
  const local = storage(values);
  for (let id = 1; id <= 25; id += 1) {
    values.set(`vytor_active_workout_${id}`, String(id));
    await removeDeletedAccountLocalData(String(id), local);
  }
  await removeDeletedAccountLocalData("25", local);
  values.set("vytor_active_workout_25", "delayed stale write");
  values.set("vytor_active_workout_99", "unrelated");
  await purgeMarkedDeletedAccountData(local);
  assert.equal(values.has("vytor_active_workout_25"), false, "restart purge removes data recreated after a crash point");
  assert.equal(values.get("vytor_active_workout_99"), "unrelated");
  assert.equal(JSON.parse(values.get("vytor_deleted_accounts")!).length, 20);
});

test("missing and valid tombstones are distinguished without affecting other accounts", async () => {
  const values = new Map<string, string>();
  const local = storage(values);
  assert.equal(await isAccountDeleted("1", local), false);
  values.set("vytor_deleted_accounts", JSON.stringify(["1"]));
  assert.equal(await isAccountDeleted("1", local), true);
  assert.equal(await isAccountDeleted("2", local), false);
});

test("tombstone read errors and corrupt data fail closed instead of returning not-deleted", async () => {
  await assert.rejects(
    isAccountDeleted("1", { getItem: async () => { throw new Error("storage unavailable"); } }),
    AccountDeletionBarrierError,
  );
  for (const raw of ["{broken", JSON.stringify({ deleted: ["1"] }), JSON.stringify(["1", 2])]) {
    const values = new Map([["vytor_deleted_accounts", raw]]);
    await assert.rejects(isAccountDeleted("1", storage(values)), AccountDeletionBarrierError);
    await assert.rejects(markAccountDeleted("2", storage(values)), AccountDeletionBarrierError);
    assert.equal(values.get("vytor_deleted_accounts"), raw, "corrupt evidence is never overwritten");
  }
});

test("a failed tombstone write cannot proceed to destructive cleanup", async () => {
  const values = new Map([["vytor_active_workout_1", "valuable draft"]]);
  const local = {
    ...storage(values),
    setItem: async () => { throw new Error("disk full"); },
  };
  await assert.rejects(removeDeletedAccountLocalData("1", local), /disk full/);
  assert.equal(values.get("vytor_active_workout_1"), "valuable draft");
  assert.equal(values.has("vytor_deleted_accounts"), false);
});

test("a temporary read failure can recover on a later verified read", async () => {
  const values = new Map([["vytor_deleted_accounts", JSON.stringify(["1"])]]);
  let fail = true;
  const local = {
    ...storage(values),
    getItem: async (key: string) => {
      if (fail) { fail = false; throw new Error("temporary read failure"); }
      return values.get(key) ?? null;
    },
  };
  await assert.rejects(isAccountDeleted("1", local), AccountDeletionBarrierError);
  assert.equal(await isAccountDeleted("1", local), true);
  await purgeMarkedDeletedAccountData(local);
});
