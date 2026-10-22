export const SESSION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export type LegacyValidation = "valid" | "invalid" | "deferred";

export type SessionStorageAdapter = {
  readSecure: () => Promise<string | null>;
  writeSecure: (token: string) => Promise<void>;
  deleteSecure: () => Promise<void>;
  readLegacy: () => Promise<string | null>;
  deleteLegacy: () => Promise<void>;
  readUserId: () => Promise<string | null>;
  writeUserId: (userId: string) => Promise<void>;
  deleteUserId: () => Promise<void>;
};

export type SessionTokenResult = {
  token: string | null;
  invalidated: boolean;
  migration: "none" | "migrated" | "deferred" | "cleaned";
};

export type SessionIdentity = {
  token: string | null;
  userId: string | null;
};

export class SessionCredentialStore {
  private operation: Promise<unknown> = Promise.resolve();

  constructor(private readonly storage: SessionStorageAdapter) {}

  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const next = this.operation.then(task, task);
    this.operation = next.then(() => undefined, () => undefined);
    return next;
  }

  getToken(validateLegacy: (token: string) => Promise<LegacyValidation>): Promise<SessionTokenResult> {
    return this.serialized(async () => {
      const secure = await this.storage.readSecure();
      if (secure && SESSION_TOKEN_PATTERN.test(secure)) {
        const legacy = await this.storage.readLegacy();
        if (legacy !== null) {
          await this.storage.deleteLegacy();
          return { token: secure, invalidated: false, migration: "cleaned" };
        }
        return { token: secure, invalidated: false, migration: "none" };
      }

      if (secure !== null) await this.storage.deleteSecure();
      const legacy = await this.storage.readLegacy();
      if (!legacy || !SESSION_TOKEN_PATTERN.test(legacy)) {
        const hadUser = (await this.storage.readUserId()) !== null;
        if (legacy !== null) await this.storage.deleteLegacy();
        if (hadUser) await this.storage.deleteUserId();
        return { token: null, invalidated: hadUser, migration: legacy === null ? "none" : "cleaned" };
      }

      const validation = await validateLegacy(legacy);
      if (validation === "deferred") {
        return { token: legacy, invalidated: false, migration: "deferred" };
      }
      if (validation === "invalid") {
        const hadUser = (await this.storage.readUserId()) !== null;
        await this.storage.deleteSecure();
        await this.storage.deleteLegacy();
        await this.storage.deleteUserId();
        return { token: null, invalidated: hadUser, migration: "cleaned" };
      }

      await this.storage.writeSecure(legacy);
      if (await this.storage.readSecure() !== legacy) {
        throw new Error("Secure session storage verification failed");
      }
      await this.storage.deleteLegacy();
      return { token: legacy, invalidated: false, migration: "migrated" };
    });
  }

  store(userId: number, token?: string): Promise<void> {
    return this.serialized(async () => {
      if (!Number.isSafeInteger(userId) || userId < 1 || (token !== undefined && !SESSION_TOKEN_PATTERN.test(token))) {
        throw new Error("Invalid session credentials");
      }
      const previousSecure = await this.storage.readSecure();
      const previousUserId = await this.storage.readUserId();
      try {
        if (token) {
          await this.storage.writeSecure(token);
          if (await this.storage.readSecure() !== token) {
            throw new Error("Secure session storage verification failed");
          }
        }
        await this.storage.writeUserId(String(userId));
        if (token) await this.storage.deleteLegacy();
      } catch (error) {
        if (previousSecure === null) await this.storage.deleteSecure();
        else await this.storage.writeSecure(previousSecure);
        if (previousUserId === null) await this.storage.deleteUserId();
        else await this.storage.writeUserId(previousUserId);
        throw error;
      }
    });
  }

  getIdentity(): Promise<SessionIdentity> {
    return this.serialized(async () => ({
      token: await this.storage.readSecure() ?? await this.storage.readLegacy(),
      userId: await this.storage.readUserId(),
    }));
  }

  clear(): Promise<boolean> {
    return this.serialized(async () => {
      const hadSession = (await this.storage.readSecure()) !== null ||
        (await this.storage.readLegacy()) !== null ||
        (await this.storage.readUserId()) !== null;
      await this.storage.deleteSecure();
      await this.storage.deleteLegacy();
      await this.storage.deleteUserId();
      return hadSession;
    });
  }

  clearIfCurrent(expectedToken: string): Promise<boolean> {
    return this.serialized(async () => {
      const current = await this.storage.readSecure() ?? await this.storage.readLegacy();
      if (current !== expectedToken) return false;
      await this.storage.deleteSecure();
      await this.storage.deleteLegacy();
      await this.storage.deleteUserId();
      return true;
    });
  }

  clearIfUserId(expectedUserId: string): Promise<boolean> {
    return this.serialized(async () => {
      if (await this.storage.readUserId() !== expectedUserId) return false;
      await this.storage.deleteSecure();
      await this.storage.deleteLegacy();
      await this.storage.deleteUserId();
      return true;
    });
  }


  clearIfIdentity(expected: SessionIdentity): Promise<boolean> {
    return this.serialized(async () => {
      const currentToken = await this.storage.readSecure() ?? await this.storage.readLegacy();
      const currentUserId = await this.storage.readUserId();
      if (currentToken !== expected.token || currentUserId !== expected.userId) return false;
      const hadSession = currentToken !== null || currentUserId !== null;
      if (!hadSession) return false;
      await this.storage.deleteSecure();
      await this.storage.deleteLegacy();
      await this.storage.deleteUserId();
      return true;
    });
  }
}
