export type StartupSessionResult = "authenticated" | "create-user" | "login" | "stale" | "offline";

export type StartupSessionDependencies = {
  readUserId: () => Promise<string | null>;
  getSession: (captureToken: (token: string | null) => void) => Promise<{ userId: unknown }>;
  clearIfUserCurrent: (userId: string) => Promise<boolean>;
  clearIfTokenCurrent: (token: string) => Promise<boolean>;
};

export async function checkStartupSession(dependencies: StartupSessionDependencies): Promise<StartupSessionResult> {
  const storedUserId = await dependencies.readUserId();
  if (!storedUserId) {
    return await dependencies.readUserId() === null ? "create-user" : "stale";
  }

  const userId = Number(storedUserId);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return await dependencies.clearIfUserCurrent(storedUserId) ? "create-user" : "stale";
  }

  let requestToken: string | null = null;
  try {
    const session = await dependencies.getSession((token) => { requestToken = token; });
    if (await dependencies.readUserId() !== storedUserId) return "stale";
    if (session.userId !== userId) {
      if (!requestToken) return "stale";
      return await dependencies.clearIfTokenCurrent(requestToken) ? "login" : "stale";
    }
    return "authenticated";
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) {
      const currentUserId = await dependencies.readUserId();
      return currentUserId === null ? "login" : "stale";
    }
    if (status === 404 && requestToken) {
      return await dependencies.clearIfTokenCurrent(requestToken) ? "login" : "stale";
    }
    return "offline";
  }
}
