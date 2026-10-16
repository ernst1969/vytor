import { Text, View } from "react-native";
import { useAppTheme } from "@/context/theme-context";
import { exerciseMuscles, muscleGroups, type Muscle } from "@/utils/muscles";
export function MuscleOverview({ exercises }: { exercises: { name: string; sets: number }[] }) {
  const { colors } = useAppTheme();
  const load = new Map<Muscle, { direct: number; indirect: number }>();
  for (const exercise of exercises) {
    const groups = exerciseMuscles(exercise.name);
    for (const muscle of groups.primary) { const item = load.get(muscle) ?? { direct: 0, indirect: 0 }; item.direct += exercise.sets; load.set(muscle, item); }
    for (const muscle of groups.secondary) { const item = load.get(muscle) ?? { direct: 0, indirect: 0 }; item.indirect += exercise.sets; load.set(muscle, item); }
  }
  const maximum = Math.max(1, ...[...load.values()].map((item) => item.direct + item.indirect * 0.35));
  return <View style={{ marginVertical: 20 }}><Text accessibilityRole="header" style={{ color: colors.text, fontWeight: "800", marginBottom: 12 }}>Muscle load · last 7 days</Text>
    <View style={{ alignItems: "center" }}><View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.border, marginBottom: 8 }} />
    {muscleGroups.map((muscle) => { const item = load.get(muscle) ?? { direct: 0, indirect: 0 }; return <View key={muscle} accessibilityLabel={`${muscle}: ${item.direct} direct sets, ${item.indirect} indirect sets`} style={{ width: muscle === "Legs" ? 120 : muscle === "Arms" ? 230 : 150, minHeight: 36, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 4, overflow: "hidden", justifyContent: "center" }}><View style={{ position: "absolute", inset: 0, backgroundColor: colors.accent, opacity: (item.direct + item.indirect * 0.35) / maximum * (item.direct ? 0.85 : 0.35) }} /><Text style={{ color: colors.text, textAlign: "center", padding: 6 }}>{muscle} · {item.direct} / {item.indirect}</Text></View>; })}</View>
    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>Direct / indirect sets. Lighter copper indicates indirect load. Exercise-name estimates; uncategorized exercises are omitted.</Text>
  </View>;
}
