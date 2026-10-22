type Draft = { exercises: { workoutExerciseId?: number }[]; restEndsAt?: number | null; notes?: string };
type Local = Draft & { workoutId: number; revision: number; syncedSignature?: string };
type Server = { id: number; revision: number; draft?: Draft | null; notes?: string; exercises: { id: number }[] };

const measurementTypes = new Set(["WEIGHT_REPS", "REPS", "DISTANCE_TIME", "TIME", "WEIGHT_DISTANCE"]);
const setTypes = new Set(["WARMUP", "REGULAR", "DROP"]);
const numericDraft = (value: unknown, whole = false) => {
  if (typeof value !== "string" || value.length > 16) return false;
  if (value === "") return true;
  if (!/^\d*(\.\d*)?$/.test(value)) return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && (!whole || Number.isSafeInteger(number));
};
const optionalText = (value: unknown, max: number) => value === undefined || (typeof value === "string" && value.length <= max);
const optionalFinite = (value: unknown) => value === null || value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= 0);

export function isLocalWorkoutSnapshot(value: unknown): value is Local & { startedAt: number } {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (!Number.isSafeInteger(item.workoutId) || Number(item.workoutId) < 1 || !Number.isSafeInteger(item.revision) || Number(item.revision) < 0 || typeof item.startedAt !== "number" || !Number.isFinite(item.startedAt) || item.startedAt < 0 || !optionalFinite(item.restEndsAt) || !optionalText(item.notes, 5000) || !optionalText(item.syncedSignature, 256_000) || !Array.isArray(item.exercises) || item.exercises.length > 30) return false;
  const exerciseIds = new Set<number>();
  const workoutExerciseIds = new Set<number>();
  return item.exercises.every((exercise) => {
    if (!exercise || typeof exercise !== "object") return false;
    const candidate = exercise as Record<string, unknown>;
    if (!Number.isSafeInteger(candidate.workoutExerciseId) || Number(candidate.workoutExerciseId) < 1 || workoutExerciseIds.has(Number(candidate.workoutExerciseId)) ||
        !Number.isSafeInteger(candidate.exerciseId) || Number(candidate.exerciseId) < 1 || exerciseIds.has(Number(candidate.exerciseId)) ||
        typeof candidate.id !== "string" || candidate.id.length < 1 || candidate.id.length > 100 ||
        typeof candidate.name !== "string" || candidate.name.length < 1 || candidate.name.length > 100 ||
        !measurementTypes.has(String(candidate.measurementType)) || !["KG", "LBS"].includes(String(candidate.weightUnit)) || !["KM", "MI"].includes(String(candidate.distanceUnit)) ||
        (candidate.description !== undefined && candidate.description !== null && (typeof candidate.description !== "string" || candidate.description.length > 2000)) ||
        !optionalText(candidate.notes, 2000) || (candidate.restSeconds !== undefined && (!Number.isSafeInteger(candidate.restSeconds) || Number(candidate.restSeconds) < 0 || Number(candidate.restSeconds) > 3600)) ||
        !Array.isArray(candidate.sets) || candidate.sets.length > 30) return false;
    exerciseIds.add(Number(candidate.exerciseId));
    workoutExerciseIds.add(Number(candidate.workoutExerciseId));
    const setIds = new Set<string>();
    const setTypeById = new Map<string, string>();
    const setNumbers = new Set<number>();
    const validSets = candidate.sets.every((set) => {
      if (!set || typeof set !== "object") return false;
      const workoutSet = set as Record<string, unknown>;
      if (typeof workoutSet.id !== "string" || workoutSet.id.length < 1 || workoutSet.id.length > 100 || setIds.has(workoutSet.id) ||
          !Number.isSafeInteger(workoutSet.setNumber) || Number(workoutSet.setNumber) < 1 || Number(workoutSet.setNumber) > 30 || setNumbers.has(Number(workoutSet.setNumber)) ||
          !setTypes.has(String(workoutSet.setType)) || typeof workoutSet.completed !== "boolean" ||
          !numericDraft(workoutSet.weight) || !numericDraft(workoutSet.reps, true) || !numericDraft(workoutSet.distance) || !numericDraft(workoutSet.durationSeconds, true) ||
          (workoutSet.targetReps !== undefined && !numericDraft(workoutSet.targetReps, true))) return false;
      if (workoutSet.dropSetOfId !== undefined && workoutSet.dropSetOfId !== null) {
        if (workoutSet.setType !== "DROP" || typeof workoutSet.dropSetOfId !== "string" || !setIds.has(workoutSet.dropSetOfId) || setTypeById.get(workoutSet.dropSetOfId) === "DROP") return false;
      }
      setIds.add(workoutSet.id);
      setTypeById.set(workoutSet.id, String(workoutSet.setType));
      setNumbers.add(Number(workoutSet.setNumber));
      return true;
    });
    if (!validSets) return false;
    if (candidate.previousSets !== undefined) {
      if (!Array.isArray(candidate.previousSets) || candidate.previousSets.length > 30 || !candidate.previousSets.every((set) => {
        if (!set || typeof set !== "object" || Array.isArray(set)) return false;
        const previous = set as Record<string, unknown>;
        return Number.isSafeInteger(previous.setNumber) && Number(previous.setNumber) > 0 && [previous.weight, previous.reps, previous.distance, previous.durationSeconds].every(optionalFinite);
      })) return false;
    }
    return true;
  });
}
export function draftSignature(draft: Draft) {
  return JSON.stringify({ exercises: draft.exercises, restEndsAt: draft.restEndsAt ?? null, notes: draft.notes ?? "" });
}
export function recoverySource(server: Server | null, local: Local | null): "server" | "local" | "conflict" | "none" {
  if (!server) return local ? "conflict" : "none";
  if (!local) return "server";
  const current = draftSignature(local);
  if (local.syncedSignature && current === local.syncedSignature) return "server";
  if (local.workoutId !== server.id) return "conflict";
  const remote = server.draft ? draftSignature({ ...server.draft, notes: server.notes ?? "" }) : "";
  if (current === remote) return "server";
  const serverIds = server.exercises.map((item) => item.id).sort().join(",");
  const localIds = local.exercises.map((item) => item.workoutExerciseId).sort().join(",");
  return server.revision === local.revision && serverIds === localIds ? "local" : "conflict";
}
