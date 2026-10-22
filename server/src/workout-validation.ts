import { canonicalPath } from "./security.js";
import type { Request, Response, NextFunction } from "express";
export const WORKOUT_LIMITS = { exercises: 30, setsPerExercise: 30, setsTotal: 200, reps: 999, weightKg: 1000, distanceKm: 1000, durationSeconds: 86400, notes: 5000, bytes: 256_000 };
export const object = (v: unknown): v is Record<string, any> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
export const integer = (v: unknown, min = 0, max = 2_147_483_647): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const optionalEnum = (v: unknown, values: string[]) => v === undefined || (typeof v === "string" && values.includes(v));
const units = (v: Record<string, any>) => optionalEnum(v.weightUnit, ["KG", "LBS"]) && optionalEnum(v.distanceUnit, ["KM", "MI"]);
export function boundedTree(value: unknown, maxBytes = WORKOUT_LIMITS.bytes) {
  let nodes = 0;
  const stack: [unknown, number][] = [[value, 0]];
  while (stack.length) {
    const [item, depth] = stack.pop()!;
    if (++nodes > 15000 || depth > 10) return false;
    if (typeof item === "string" && item.length > maxBytes) return false;
    if (item && typeof item === "object") {
      for (const [key, entry] of Object.entries(item)) {
        if (["__proto__", "constructor", "prototype"].includes(key) || key.length > 100) return false;
        stack.push([entry, depth + 1]);
      }
    }
  }
  return Buffer.byteLength(JSON.stringify(value) ?? "") <= maxBytes;
}
function measurement(value: unknown, max: number, whole: boolean, draft: boolean) {
  if (value === undefined || value === null || (draft && value === "")) return true;
  if (draft && typeof value === "string") {
    if (value.length > 16 || !/^\d*(\.\d*)?$/.test(value)) return false;
    value = Number(value);
  }
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max && (!whole || Number.isSafeInteger(value));
}
export function validSets(sets: unknown, draft: boolean, weightUnit?: unknown, distanceUnit?: unknown): boolean {
  if (!Array.isArray(sets) || sets.length > WORKOUT_LIMITS.setsPerExercise || (!draft && !sets.length)) return false;
  const numbers = new Set<number>();
  return sets.every((s) => {
    if (!object(s) || !optionalEnum(s.setType, ["WARMUP", "REGULAR", "DROP"])) return false;
    if (!draft || s.setNumber !== undefined) {
      if (!integer(s.setNumber, 1, WORKOUT_LIMITS.setsPerExercise) || numbers.has(s.setNumber)) return false;
      numbers.add(s.setNumber);
    }
    if (s.id !== undefined && !text(s.id, 100)) return false;
    if (s.completed !== undefined && typeof s.completed !== "boolean") return false;
    return (s.id === undefined || text(s.id, 100)) && (s.dropSetOfId === undefined || s.dropSetOfId === null || text(s.dropSetOfId, 100)) &&
      measurement(s.weight, weightUnit === "LBS" || weightUnit === undefined ? WORKOUT_LIMITS.weightKg * 2.2046226218 : WORKOUT_LIMITS.weightKg, false, draft) &&
      measurement(s.distance, distanceUnit === "MI" ? WORKOUT_LIMITS.distanceKm * 0.6213711922 : WORKOUT_LIMITS.distanceKm, false, draft) &&
      measurement(s.reps, WORKOUT_LIMITS.reps, true, draft) &&
      measurement(s.targetReps, WORKOUT_LIMITS.reps, true, true) &&
      measurement(s.durationSeconds, WORKOUT_LIMITS.durationSeconds, true, draft);
  });
}
export function validWorkoutBody(path: string, method: string, body: unknown): boolean {
  if (!object(body) || !boundedTree(body)) return false;
  const b = body;
  if (path === "/workouts" && method === "POST") {
    return integer(b.userId, 1) && (b.templateId == null || integer(b.templateId, 1)) && Array.isArray(b.exercises) && b.exercises.length > 0 && b.exercises.length <= WORKOUT_LIMITS.exercises &&
      new Set(b.exercises.map((e: any) => e?.exerciseId)).size === b.exercises.length && b.exercises.every((e: unknown) => object(e) && integer(e.exerciseId, 1) && units(e));
  }
  if (/^\/workouts\/[^/]+\/finish$/.test(path) && method === "POST") {
    return integer(b.revision) && Array.isArray(b.exercises) && b.exercises.length > 0 && b.exercises.length <= WORKOUT_LIMITS.exercises &&
      new Set(b.exercises.map((e: any) => e?.workoutExerciseId)).size === b.exercises.length && b.exercises.every((e: unknown) => object(e) && integer(e.workoutExerciseId, 1) && units(e) && validSets(e.sets, false, e.weightUnit, e.distanceUnit)) &&
      b.exercises.reduce((n: number, e: any) => n + e.sets.length, 0) <= WORKOUT_LIMITS.setsTotal;
  }
  if (/^\/workouts\/[^/]+\/draft$/.test(path) && method === "PUT") {
    if (!integer(b.revision) || !text(b.notes, WORKOUT_LIMITS.notes) || !object(b.draft) || !Array.isArray(b.draft.exercises) || b.draft.exercises.length > WORKOUT_LIMITS.exercises || (b.draft.restEndsAt != null && !integer(b.draft.restEndsAt, 0, 8_640_000_000_000_000))) return false;
    return b.draft.exercises.every((e: unknown) => object(e) && integer(e.workoutExerciseId, 1) && integer(e.exerciseId, 1) && units(e) &&
      (e.restSeconds == null || integer(e.restSeconds, 0, 3600)) && (e.notes === undefined || text(e.notes, 2000)) && (e.name === undefined || text(e.name, 100)) &&
      (e.description == null || text(e.description, 2000)) && (e.id === undefined || text(e.id, 100)) && optionalEnum(e.measurementType, ["WEIGHT_REPS", "REPS", "DISTANCE_TIME", "TIME", "WEIGHT_DISTANCE"]) && validSets(e.sets, true, e.weightUnit, e.distanceUnit) &&
      (e.previousSets === undefined || validSets(e.previousSets, false, "LBS", "KM"))) &&
      b.draft.exercises.reduce((n: number, e: any) => n + e.sets.length, 0) <= WORKOUT_LIMITS.setsTotal;
  }
  if (/^\/workouts\/[^/]+\/exercises\/order$/.test(path) && method === "PATCH") return integer(b.revision) && Array.isArray(b.exerciseIds) && b.exerciseIds.length <= WORKOUT_LIMITS.exercises && b.exerciseIds.every((id: unknown) => integer(id, 1)) && new Set(b.exerciseIds).size === b.exerciseIds.length;
  if (/^\/workouts\/[^/]+\/exercises$/.test(path) && method === "POST") return integer(b.revision) && integer(b.exerciseId, 1) && units(b);
  if (/^\/workout-exercises\/[^/]+$/.test(path) && method === "DELETE") return integer(b.revision);
  if (/^\/workout-exercises\/[^/]+\/(settings|replace)$/.test(path) && method === "PATCH") {
    return units(b) && integer(b.revision) && (b.restSeconds === undefined || integer(b.restSeconds, 0, 3600)) && (!path.endsWith("/replace") || integer(b.exerciseId, 1));
  }
  return true;
}
export function workoutValidation(req: Request, res: Response, next: NextFunction) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const path = canonicalPath(req.path);
  if ((path.startsWith("/workouts") || path.startsWith("/workout-exercises")) && !validWorkoutBody(path, req.method, req.body ?? {})) return res.status(400).json({ error: "Invalid workout data or safety limit exceeded", code: "INVALID_WORKOUT" });
  next();
}
