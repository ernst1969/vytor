import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import bodyPaths from "../../assets/muscles/body-paths.json";
import { useAppTheme } from "@/context/theme-context";
import { anatomicalGroups, anatomicalLabels, anatomicalLoad, muscleHeatColor, type AnatomicalMuscle } from "@/utils/muscles";

type ExerciseLoad = { name: string; category?: string | null; sets: number };

// MuscleMap geometry: MIT, Melih Colpan. See THIRD_PARTY_NOTICES.md.
export const MuscleOverview = memo(function MuscleOverview({ exercises }: { exercises: ExerciseLoad[] }) {
  const { colors } = useAppTheme();
  const loads = useMemo(() => anatomicalLoad(exercises), [exercises]);
  const maximum = Math.max(1, ...Object.values(loads).map((load) => load.direct));
  const summary = anatomicalGroups.filter((muscle) => loads[muscle].direct || loads[muscle].indirect)
    .map((muscle) => `${anatomicalLabels[muscle]}: ${loads[muscle].direct} direct, ${loads[muscle].indirect} indirect sets`).join("; ");

  return <View accessible accessibilityRole="image" accessibilityLabel={`Workout muscle load. ${summary || "No mapped muscle load."}`} style={[styles.thumbnail, { backgroundColor: colors.background }]}>
    {(["front", "back"] as const).map((side) => {
      const geometry = bodyPaths.male[side];
      return <View key={side} style={styles.figure}>
        <Svg width="100%" height="100%" viewBox={geometry.vb} accessibilityLabel={`Workout ${side} muscle map`}>
          {Object.entries(geometry.p).flatMap(([part, paths]) => {
            const muscle = anatomicalGroups.includes(part as AnatomicalMuscle) ? part as AnatomicalMuscle : null;
            const fill = muscle ? muscleHeatColor(loads[muscle], maximum, colors.border, colors.accent) : colors.border;
            return paths.map((path, index) => <Path key={`${part}-${index}`} d={path} fill={fill} stroke={colors.background} strokeWidth={1.5} />);
          })}
        </Svg>
      </View>;
    })}
  </View>;
});
const styles = StyleSheet.create({
  thumbnail: { width: "100%", height: "100%", padding: 2, flexDirection: "row", gap: 2 },
  figure: { flex: 1, minWidth: 0 },
});
