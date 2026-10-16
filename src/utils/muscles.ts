export type Muscle = "Chest" | "Back" | "Shoulders" | "Arms" | "Core" | "Legs";
export const muscleGroups: Muscle[] = ["Shoulders", "Chest", "Arms", "Back", "Core", "Legs"];
export function exerciseMuscles(name: string): { primary: Muscle[]; secondary: Muscle[] } {
  if (/squat|lunge|leg|deadlift|running|cycling|calf|glute/i.test(name)) return { primary: ["Legs"], secondary: ["Core", "Back"] };
  if (/bench|push.?up|chest|fly/i.test(name)) return { primary: ["Chest"], secondary: ["Arms", "Shoulders"] };
  if (/row|pull.?up|pulldown|back/i.test(name)) return { primary: ["Back"], secondary: ["Arms"] };
  if (/shoulder|overhead|lateral/i.test(name)) return { primary: ["Shoulders"], secondary: ["Arms"] };
  if (/curl|triceps|biceps/i.test(name)) return { primary: ["Arms"], secondary: [] };
  if (/plank|crunch|sit.?up|core|boxing|muay/i.test(name)) return { primary: ["Core"], secondary: ["Shoulders", "Legs"] };
  return { primary: [], secondary: [] };
}

export const anatomicalGroups = ["chest", "abs", "obliques", "biceps", "triceps", "deltoids", "forearm", "trapezius", "upper-back", "lower-back", "gluteal", "quadriceps", "hamstring", "adductors", "calves", "tibialis", "serratus", "hip-flexors"] as const;
export type AnatomicalMuscle = typeof anatomicalGroups[number];
export const anatomicalLabels: Record<AnatomicalMuscle, string> = {
  chest: "Chest", abs: "Abdominals", obliques: "Obliques", biceps: "Biceps", triceps: "Triceps", deltoids: "Shoulders", forearm: "Forearms", trapezius: "Trapezius", "upper-back": "Upper back", "lower-back": "Lower back", gluteal: "Glutes", quadriceps: "Quadriceps", hamstring: "Hamstrings", adductors: "Adductors", calves: "Calves", tibialis: "Shins", serratus: "Serratus", "hip-flexors": "Hip flexors",
};
type MuscleTargets = { primary: AnatomicalMuscle[]; secondary: AnatomicalMuscle[] };
// Vytor's own movement mapping. Order distinguishes e.g. leg curls from biceps curls.
export function anatomicalMuscles(name: string, category?: string | null): MuscleTargets {
  const text = name.toLowerCase();
  if (/calf|calves/.test(text)) return { primary: ["calves"], secondary: [] };
  if (/tibialis|shin/.test(text)) return { primary: ["tibialis"], secondary: [] };
  if (/leg curl|nordic|hamstring|romanian|stiff.leg|good morning/.test(text)) return { primary: ["hamstring", "gluteal"], secondary: ["lower-back", "abs"] };
  if (/hip thrust|glute bridge|glute kick/.test(text)) return { primary: ["gluteal"], secondary: ["hamstring"] };
  if (/deadlift/.test(text)) return { primary: ["gluteal", "hamstring", "lower-back"], secondary: ["quadriceps", "trapezius", "forearm", "abs"] };
  if (/squat|lunge|leg press|leg extension|step.up|sled/.test(text)) return { primary: ["quadriceps", "gluteal"], secondary: ["hamstring", "adductors", "abs"] };
  if (/adduct/.test(text)) return { primary: ["adductors"], secondary: [] };
  if (/triceps|pushdown|skull crusher|overhead extension/.test(text)) return { primary: ["triceps"], secondary: [] };
  if (/curl|chin.up/.test(text)) return { primary: ["biceps"], secondary: /chin/.test(text) ? ["upper-back", "forearm"] : ["forearm"] };
  if (/reverse fly|face pull/.test(text)) return { primary: ["deltoids", "upper-back"], secondary: ["trapezius"] };
  if (/shoulder|overhead press|lateral raise|front raise|arnold/.test(text)) return { primary: ["deltoids"], secondary: ["triceps", "trapezius"] };
  if (/shrug/.test(text)) return { primary: ["trapezius"], secondary: ["forearm"] };
  if (/bench|chest|push.up|fly|pec deck|dip/.test(text)) return { primary: ["chest"], secondary: ["triceps", "deltoids", "serratus"] };
  if (/row|pull.up|pulldown|straight.arm pull/.test(text) && !/rowing/.test(text)) return { primary: ["upper-back"], secondary: ["biceps", "deltoids", "forearm"] };
  if (/back extension|hyperextension/.test(text)) return { primary: ["lower-back"], secondary: ["gluteal", "hamstring"] };
  if (/side plank|russian twist|woodchop|side bend/.test(text)) return { primary: ["obliques"], secondary: ["abs", "deltoids"] };
  if (/plank|crunch|sit.up|ab wheel|leg raise|hanging knee/.test(text)) return { primary: ["abs"], secondary: ["obliques", "hip-flexors"] };
  if (/carry|farmer/.test(text)) return { primary: ["forearm", "trapezius"], secondary: ["abs", "obliques", "gluteal"] };
  if (/boxing|muay|heavy bag|mitt work|speed bag|mma|karate|taekwondo/.test(text)) return { primary: ["deltoids", "abs", "obliques"], secondary: ["triceps", "quadriceps", "calves", "hip-flexors"] };
  if (/jiu.jitsu|wrestling|judo/.test(text)) return { primary: ["upper-back", "abs", "forearm"], secondary: ["biceps", "gluteal", "quadriceps"] };
  if (/rowing|ski erg/.test(text)) return { primary: ["upper-back", "quadriceps"], secondary: ["biceps", "abs", "gluteal"] };
  if (/running|walk|cycling|bike|stair|elliptical|jump rope|versaclimber/.test(text)) return { primary: ["quadriceps", "calves"], secondary: ["gluteal", "hamstring", "hip-flexors"] };
  if (/swim/.test(text)) return { primary: ["upper-back", "deltoids"], secondary: ["abs", "quadriceps"] };
  if (/battle rope/.test(text)) return { primary: ["deltoids", "forearm"], secondary: ["abs", "upper-back"] };
  const categories: Record<string, AnatomicalMuscle[]> = { chest: ["chest"], back: ["upper-back", "lower-back"], shoulders: ["deltoids"], arms: ["biceps", "triceps"], core: ["abs", "obliques"], legs: ["quadriceps", "hamstring", "gluteal"], ...Object.fromEntries(anatomicalGroups.map((muscle) => [muscle, [muscle]])) };
  return { primary: categories[category?.trim().toLowerCase() ?? ""] ?? [], secondary: [] };
}

export type MuscleLoad = { direct: number; indirect: number };
export function anatomicalLoad(exercises: { name: string; category?: string | null; sets: number }[]) {
  const loads = Object.fromEntries(anatomicalGroups.map((muscle) => [muscle, { direct: 0, indirect: 0 }])) as Record<AnatomicalMuscle, MuscleLoad>;
  for (const exercise of exercises) {
    if (!Number.isFinite(exercise.sets) || exercise.sets <= 0) continue;
    const targets = anatomicalMuscles(exercise.name, exercise.category);
    for (const muscle of new Set(targets.primary)) loads[muscle].direct += exercise.sets;
    for (const muscle of new Set(targets.secondary)) if (!targets.primary.includes(muscle)) loads[muscle].indirect += exercise.sets;
  }
  return loads;
}
export function muscleHeatColor(load: MuscleLoad, maximum: number, neutral: string, accent: string) {
  if (!load.direct && !load.indirect) return neutral;
  const intensity = load.direct ? 0.48 + 0.52 * load.direct / Math.max(1, maximum) : 0.6 - 0.15 * Math.min(1, load.indirect / Math.max(1, maximum));
  const base = load.direct ? neutral : accent;
  const target = load.direct ? accent : "#F1E0D0";
  const channels = [1, 3, 5].map((offset) => Math.round(parseInt(base.slice(offset, offset + 2), 16) * (1 - intensity) + parseInt(target.slice(offset, offset + 2), 16) * intensity));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
