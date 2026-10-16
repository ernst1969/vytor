import type { ExerciseMeasurementType } from "../services/api";

export type WorkoutField = "weight" | "reps" | "distance" | "durationSeconds";
export function workoutFields(type: ExerciseMeasurementType): WorkoutField[] {
  switch (type) {
    case "WEIGHT_REPS": return ["weight", "reps"];
    case "REPS": return ["reps"];
    case "DISTANCE_TIME": return ["distance", "durationSeconds"];
    case "TIME": return ["durationSeconds"];
    case "WEIGHT_DISTANCE": return ["weight", "distance"];
  }
}
export function workoutRowLabel(name: string, type?: ExerciseMeasurementType) {
  return type === "TIME" || /boxing|muay|heavy bag|shadow boxing|speed bag|mitt work|\bmma\b|jiu.jitsu|wrestling|judo|karate|taekwondo/i.test(name) ? "Session" : "Set";
}
// Header and rows share these dimensions. Value cells divide the remaining space.
export function workoutColumns(session: boolean, compact: boolean) {
  return { label: session ? 62 : 40, previous: compact ? 52 : 80, action: 44, gap: compact ? 4 : 8 };
}
