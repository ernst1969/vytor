import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import bodyPaths from "../../assets/muscles/body-paths.json";
import { useAppTheme } from "@/context/theme-context";
import { anatomicalGroups, anatomicalLabels, anatomicalLoad, anatomicalMuscles, muscleHeatColor, type AnatomicalMuscle } from "@/utils/muscles";

type ExerciseLoad = { name: string; category?: string | null; sets: number; completedAt?: string };
export function MuscleOverview({ exercises, now }: { exercises: ExerciseLoad[]; now?: number }) {
  const { colors } = useAppTheme();
  const [initialNow] = useState(() => Date.now());
  const [period, setPeriod] = useState<7 | 30 | 0>(7);
  const [figure, setFigure] = useState<"male" | "female">("male");
  const [selected, setSelected] = useState<AnatomicalMuscle | null>(null);
  const filtered = useMemo(() => exercises.filter((item) => !period || !item.completedAt || new Date(item.completedAt).getTime() >= (now ?? initialNow) - period * 86400000), [exercises, period, now, initialNow]);
  const loads = useMemo(() => anatomicalLoad(filtered), [filtered]);
  const maximum = Math.max(1, ...Object.values(loads).map((load) => load.direct));
  const unassigned = filtered.filter((item) => item.sets > 0 && !anatomicalMuscles(item.name, item.category).primary.length).length;
  const chosen = selected ? loads[selected] : null;
  const button = { borderColor: colors.border, backgroundColor: colors.background };

  return <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Muscle load</Text>
    <View style={styles.controls}>
      {([7, 30, 0] as const).map((days) => <Pressable key={days} accessibilityRole="button" accessibilityState={{ selected: period === days }} style={[styles.option, button, period === days && { borderColor: colors.accent }]} onPress={() => setPeriod(days)}><Text style={{ color: period === days ? colors.accent : colors.textMuted }}>{days ? `${days} days` : "All time"}</Text></Pressable>)}
    </View>
    <View style={styles.controls}>{(["male", "female"] as const).map((sex) => <Pressable key={sex} accessibilityRole="button" accessibilityState={{ selected: figure === sex }} style={[styles.option, button, figure === sex && { borderColor: colors.accent }]} onPress={() => setFigure(sex)}><Text style={{ color: figure === sex ? colors.accent : colors.textMuted }}>{sex === "male" ? "Male figure" : "Female figure"}</Text></Pressable>)}</View>
    <View style={styles.figures}>
      {(["front", "back"] as const).map((side) => {
        const geometry = bodyPaths[figure][side];
        return <View key={side} style={styles.figure}>
          <Svg width="100%" height={300} viewBox={geometry.vb} accessibilityLabel={`${figure} ${side} muscle map`}>
            {Object.entries(geometry.p).flatMap(([part, paths]) => {
              const muscle = anatomicalGroups.includes(part as AnatomicalMuscle) ? part as AnatomicalMuscle : null;
              const load = muscle ? loads[muscle] : null;
              const fill = load ? muscleHeatColor(load, maximum, colors.border, colors.accent) : colors.border;
              return paths.map((path, index) => <Path key={`${part}-${index}`} d={path} fill={fill} stroke={selected === muscle && muscle ? colors.text : colors.surface} strokeWidth={selected === muscle && muscle ? 4 : 1.5} onPress={muscle ? () => setSelected(muscle) : undefined} />);
            })}
          </Svg>
          <Text style={[styles.side, { color: colors.textMuted }]}>{side === "front" ? "Front" : "Back"}</Text>
        </View>;
      })}
    </View>
    <View style={styles.legend}>
      {[{ label: "Direct", color: colors.accent }, { label: "Indirect", color: muscleHeatColor({ direct: 0, indirect: 1 }, 1, colors.border, colors.accent) }, { label: "Untrained", color: colors.border }].map((item) => <View key={item.label} style={styles.legendItem}><View style={[styles.swatch, { backgroundColor: item.color }]} /><Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.label}</Text></View>)}
    </View>
    <Text accessibilityLiveRegion="polite" style={[styles.explanation, { color: colors.text }]}>{selected && chosen ? `${anatomicalLabels[selected]}: ${chosen.direct} direct / ${chosen.indirect} indirect sets` : "Tap a muscle to see its training load."}</Text>
    <View style={styles.muscles}>{anatomicalGroups.map((muscle) => <Pressable key={muscle} accessibilityRole="button" accessibilityLabel={`${anatomicalLabels[muscle]}: ${loads[muscle].direct} direct and ${loads[muscle].indirect} indirect sets`} onPress={() => setSelected(muscle)} style={[styles.muscle, { borderColor: selected === muscle ? colors.accent : colors.border }]}><Text style={{ color: loads[muscle].direct ? colors.accent : colors.textMuted, fontSize: 11 }}>{anatomicalLabels[muscle]} · {loads[muscle].direct}/{loads[muscle].indirect}</Text></Pressable>)}</View>
    <Text style={[styles.explanation, { color: colors.textMuted }]}>Direct / indirect recorded sets. Estimated from movement names and categories; lighter copper indicates indirect load.{unassigned ? ` ${unassigned} uncategorized exercise entries omitted.` : ""}</Text>
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://github.com/melihcolpan/MuscleMap")} style={styles.attribution}><Text style={{ color: colors.textMuted, fontSize: 11 }}>Body outlines: MuscleMap / Melih Colpan · MIT · via openGym</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  container: { marginVertical: 20, padding: 14, borderRadius: 14, borderWidth: 1, width: "100%", minWidth: 0 },
  title: { fontWeight: "800", fontSize: 17, marginBottom: 12 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  option: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderRadius: 8 },
  figures: { flexDirection: "row", width: "100%", maxWidth: 640, alignSelf: "center", gap: 8 },
  figure: { flex: 1, minWidth: 0 },
  side: { textAlign: "center", marginBottom: 12, fontSize: 12 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  explanation: { marginTop: 12, fontSize: 12, lineHeight: 18 },
  muscles: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  muscle: { borderWidth: 1, borderRadius: 6, minHeight: 36, justifyContent: "center", paddingHorizontal: 8 },
  attribution: { minHeight: 44, justifyContent: "center", marginTop: 8 },
});
