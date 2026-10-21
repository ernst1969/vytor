type Draft = { exercises: { workoutExerciseId?: number }[]; restEndsAt?: number | null; notes?: string };
type Local = Draft & { workoutId: number; revision: number; syncedSignature?: string };
type Server = { id: number; revision: number; draft?: Draft | null; notes?: string; exercises: { id: number }[] };
export function isLocalWorkoutSnapshot(value: unknown): value is Local & { startedAt: number } {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (!Number.isSafeInteger(item.workoutId) || !Number.isInteger(item.revision) || !Number.isFinite(item.startedAt) || !Array.isArray(item.exercises) || item.exercises.length > 30) return false;
  return item.exercises.every((exercise) => {
    if (!exercise || typeof exercise !== "object") return false;
    const candidate = exercise as Record<string, unknown>;
    return Number.isSafeInteger(candidate.workoutExerciseId) && Number.isSafeInteger(candidate.exerciseId) && Array.isArray(candidate.sets) && candidate.sets.length <= 30 && candidate.sets.every((set) => {
      if (!set || typeof set !== "object") return false;
      const workoutSet = set as Record<string, unknown>;
      return typeof workoutSet.id === "string" && workoutSet.id.length > 0 && workoutSet.id.length <= 100 && Number.isSafeInteger(workoutSet.setNumber) && Number(workoutSet.setNumber) > 0 && ["WARMUP", "REGULAR", "DROP"].includes(String(workoutSet.setType ?? "REGULAR"));
    });
  });
}
export function draftSignature(draft: Draft) {
  return JSON.stringify({ exercises: draft.exercises, restEndsAt: draft.restEndsAt ?? null, notes: draft.notes ?? "" });
}
export function recoverySource(server: Server | null, local: Local | null): "server" | "local" | "conflict" | "none" {
  if (!server) return "none";
  if (!local || local.workoutId !== server.id) return "server";
  const current = draftSignature(local);
  if (local.syncedSignature && current === local.syncedSignature) return "server";
  const remote = server.draft ? draftSignature({ ...server.draft, notes: server.notes ?? "" }) : "";
  if (current === remote) return "server";
  const serverIds = server.exercises.map((item) => item.id).sort().join(",");
  const localIds = local.exercises.map((item) => item.workoutExerciseId).sort().join(",");
  return server.revision === local.revision && serverIds === localIds ? "local" : "conflict";
}
