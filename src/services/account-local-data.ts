export type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const DELETED_ACCOUNTS_KEY = "vytor_deleted_accounts";
const MAX_DELETED_ACCOUNT_MARKERS = 20;

export class AccountDeletionBarrierError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AccountDeletionBarrierError";
  }
}

export function workoutDraftKey(accountId: string) {
  return `vytor_active_workout_${accountId}`;
}

async function deletedAccounts(storage: Pick<KeyValueStorage, "getItem">) {
  let raw: string | null;
  try {
    raw = await storage.getItem(DELETED_ACCOUNTS_KEY);
  } catch (error) {
    throw new AccountDeletionBarrierError("Account deletion barrier could not be read", { cause: error });
  }
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new AccountDeletionBarrierError("Account deletion barrier is corrupt", { cause: error });
  }
  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) {
    throw new AccountDeletionBarrierError("Account deletion barrier has an invalid shape");
  }
  return [...new Set(parsed)].slice(-MAX_DELETED_ACCOUNT_MARKERS);
}

export async function isAccountDeleted(accountId: string, storage: Pick<KeyValueStorage, "getItem">) {
  return (await deletedAccounts(storage)).includes(accountId);
}

export async function markAccountDeleted(accountId: string, storage: Pick<KeyValueStorage, "getItem" | "setItem">) {
  const current = await deletedAccounts(storage);
  if (current.includes(accountId)) return;
  await storage.setItem(DELETED_ACCOUNTS_KEY, JSON.stringify([...current, accountId].slice(-MAX_DELETED_ACCOUNT_MARKERS)));
}

export async function purgeMarkedDeletedAccountData(storage: KeyValueStorage) {
  for (const accountId of await deletedAccounts(storage)) {
    await storage.removeItem(workoutDraftKey(accountId));
  }
  await storage.removeItem("vytor_active_workout");
}

export async function removeDeletedAccountLocalData(accountId: string, storage: KeyValueStorage) {
  // Persist the barrier before deleting. Queued and future writes must consult it.
  await markAccountDeleted(accountId, storage);
  await storage.removeItem(workoutDraftKey(accountId));
  await storage.removeItem("vytor_active_workout");
}
