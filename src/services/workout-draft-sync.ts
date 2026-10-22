export type WorkoutSyncIdentity = {
  accountId: string;
  workoutId: number;
  generation: number;
};

export type WorkoutSyncSnapshot<Draft> = WorkoutSyncIdentity & {
  hydrated: boolean;
  revision: number;
  draft: Draft;
  signature: string;
  syncedSignature: string;
  conflict: boolean;
};

export type WorkoutSyncDependencies<Draft> = {
  awaitLocalWrite: () => Promise<void>;
  read: () => WorkoutSyncSnapshot<Draft> | null;
  save: (snapshot: WorkoutSyncSnapshot<Draft>) => Promise<{ revision: number }>;
  accept: (snapshot: WorkoutSyncSnapshot<Draft>, revision: number) => void;
  persistAccepted: (snapshot: WorkoutSyncSnapshot<Draft>, revision: number) => Promise<void>;
  status: (value: "syncing" | "saved" | "pending" | "conflict" | "error" | "local-error") => void;
};

export class StaleWorkoutSyncError extends Error {
  constructor() { super("Workout or account changed while the draft was being synchronized"); }
}

function sameIdentity(a: WorkoutSyncIdentity, b: WorkoutSyncIdentity) {
  return a.accountId === b.accountId && a.workoutId === b.workoutId && a.generation === b.generation;
}

export class WorkoutDraftSyncCoordinator<Draft> {
  private inFlight: Promise<void> | null = null;

  flush(dependencies: WorkoutSyncDependencies<Draft>): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const operation = this.run(dependencies);
    const wrapped = operation.finally(() => {
      if (this.inFlight === wrapped) this.inFlight = null;
    });
    this.inFlight = wrapped;
    return wrapped;
  }

  private async run(dependencies: WorkoutSyncDependencies<Draft>) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        await dependencies.awaitLocalWrite();
      } catch (error) {
        dependencies.status("local-error");
        throw error;
      }
      const snapshot = dependencies.read();
      if (!snapshot || !snapshot.hydrated) return;
      if (snapshot.conflict) {
        dependencies.status("conflict");
        throw Object.assign(new Error("Resolve the workout conflict before continuing"), { status: 409 });
      }
      if (snapshot.signature === snapshot.syncedSignature) {
        dependencies.status("saved");
        return;
      }

      dependencies.status("syncing");
      let result: { revision: number };
      try {
        result = await dependencies.save(snapshot);
      } catch (error) {
        const current = dependencies.read();
        if (!current || !sameIdentity(snapshot, current)) throw new StaleWorkoutSyncError();
        dependencies.status((error as { status?: number }).status === 409 ? "conflict" : "error");
        throw error;
      }

      const current = dependencies.read();
      if (!current || !sameIdentity(snapshot, current)) throw new StaleWorkoutSyncError();
      dependencies.accept(snapshot, result.revision);
      try {
        await dependencies.persistAccepted(snapshot, result.revision);
      } catch (error) {
        dependencies.status("local-error");
        throw error;
      }

      const newest = dependencies.read();
      if (!newest || !sameIdentity(snapshot, newest)) throw new StaleWorkoutSyncError();
      if (newest.signature === snapshot.signature) {
        dependencies.status("saved");
        return;
      }
      dependencies.status("pending");
    }
    dependencies.status("pending");
    throw new Error("Workout kept changing during synchronization; try the switch again");
  }
}
