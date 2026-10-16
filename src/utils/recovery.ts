type Draft = { exercises: { workoutExerciseId?: number }[]; restEndsAt?: number | null; notes?: string };
type Local = Draft & { workoutId: number; revision: number; syncedSignature?: string };
type Server = { id: number; revision: number; draft?: Draft | null; notes?: string; exercises: { id: number }[] };
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
