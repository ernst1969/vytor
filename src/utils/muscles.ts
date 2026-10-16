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
