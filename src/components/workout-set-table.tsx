import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/context/theme-context";
import { useWorkout, type WorkoutExercise, type WorkoutSet } from "@/context/workout-context";
import { formatTime, parseTime } from "@/utils/duration";
import { workoutColumns, workoutFields, workoutRowLabel, type WorkoutField } from "@/utils/workout-layout";

const headings: Record<WorkoutField, string> = { weight: "WEIGHT", reps: "REPS", distance: "DISTANCE", durationSeconds: "TIME" };

export function WorkoutSetTable({ exercise, compact, onError }: {
  exercise: WorkoutExercise;
  compact: boolean;
  onError: (message: string) => void;
}) {
  const { colors } = useAppTheme();
  const { updateSet, completeSet, addSet, deleteSet, setSetType, addDropSet } = useWorkout();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const label = workoutRowLabel(exercise.name, exercise.measurementType);
  const columns = workoutColumns(label === "Session", compact);
  const fields = workoutFields(exercise.measurementType);
  const row = { flexDirection: "row" as const, alignItems: "center" as const, gap: columns.gap };
  const header = { color: colors.textMuted, fontSize: compact ? 9 : 11, fontWeight: "800" as const, textAlign: "center" as const };
  const input = { color: colors.text, backgroundColor: colors.background, borderColor: colors.border };
  const special = (set: WorkoutSet, index: number) => set.setType === "WARMUP" ? "W" : set.setType === "DROP" || exercise.sets[index + 1]?.setType === "DROP" ? "D" : String(exercise.sets.slice(0, index + 1).filter((item) => item.setType === "REGULAR").length);

  function previousText(set: WorkoutSet) {
    const last = exercise.previousSets?.find((item) => item.setNumber === set.setNumber);
    if (!last) return "—";
    return fields.map((field) => {
      const value = last[field];
      if (value === null || value === undefined) return "—";
      if (field === "durationSeconds") return formatTime(value);
      if (field === "weight") return String(Number((value * (exercise.weightUnit === "LBS" ? 2.2046226218 : 1)).toFixed(2)));
      if (field === "distance") return String(Number((value * (exercise.distanceUnit === "MI" ? 0.6213711922 : 1)).toFixed(2)));
      return String(value);
    }).join(" / ");
  }

  return <View style={styles.table}>
    <View style={[row, styles.header]}>
      <Text numberOfLines={1} style={[header, { width: columns.label }]}>{label.toUpperCase()}</Text>
      <Text numberOfLines={1} style={[header, { width: columns.previous }]}>LAST</Text>
      {fields.map((field) => <Text key={field} numberOfLines={1} style={[header, styles.valueColumn]}>{headings[field]}</Text>)}
      <View style={{ width: columns.action }} />
    </View>
    {exercise.sets.map((set, index) => <View key={set.id} style={styles.setGroup}>
      <View style={[row, styles.row]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${index + 1} options, ${set.setType.toLowerCase()}`} onPress={() => setSelectedId(selectedId === set.id ? null : set.id)} style={[styles.labelCell, { width: columns.label, borderColor: set.setType === "DROP" ? colors.accent : "transparent" }]}>
          <Text style={{ color: set.setType !== "REGULAR" || exercise.sets[index + 1]?.setType === "DROP" ? colors.accent : colors.textMuted, fontWeight: "800" }}>{set.setType === "DROP" ? "↳ " : ""}{special(set, index)}</Text>
        </Pressable>
        <Text accessibilityLabel={`Previous ${label.toLowerCase()}: ${previousText(set)}`} numberOfLines={2} style={[styles.previous, { width: columns.previous, color: colors.textMuted }]}>{previousText(set)}</Text>
        {fields.map((field) => {
          const unit = field === "weight" ? (exercise.weightUnit === "KG" ? "kg" : "lb") : field === "distance" ? exercise.distanceUnit.toLowerCase() : null;
          const time = field === "durationSeconds";
          return <View key={field} style={[styles.valueColumn, styles.inputCell, input]}>
            <TextInput accessibilityLabel={`${exercise.name}, ${label.toLowerCase()} ${index + 1}, ${headings[field].toLowerCase()}${unit ? ` in ${unit}` : ""}`}
              style={[styles.input, { color: colors.text, fontSize: compact && time && fields.length > 1 ? 11 : 14 }]}
              value={time && set[field] ? formatTime(Number(set[field])) : set[field]}
              onChangeText={(value) => {
                if (!time) { updateSet(exercise.id, set.id, field, value); return; }
                const seconds = parseTime(value);
                if (value === "") updateSet(exercise.id, set.id, field, "");
                else if (seconds !== null) updateSet(exercise.id, set.id, field, String(seconds));
                else onError("Minutes and seconds must be below 60");
              }} keyboardType={field === "weight" || field === "distance" ? "decimal-pad" : "number-pad"}
              placeholder={time ? "00:00:00" : field === "reps" ? set.targetReps || "reps" : "0"} placeholderTextColor={colors.textMuted}
            />
            {unit && <Text style={[styles.unit, { color: colors.textMuted }]}>{unit}</Text>}
          </View>;
        })}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: set.completed }} accessibilityLabel={`Complete ${label.toLowerCase()} ${index + 1}`} onPress={() => { if (!completeSet(exercise.id, set.id)) onError("Enter valid non-negative values first"); }} style={[styles.confirm, { width: columns.action, backgroundColor: set.completed ? colors.accent : colors.background, borderColor: set.completed ? colors.accent : colors.border }]}>
          <Text style={{ color: set.completed ? "#fff" : colors.accent, fontSize: 21, fontWeight: "900" }}>✓</Text>
        </Pressable>
      </View>
      {selectedId === set.id && <View style={[styles.options, { borderColor: colors.border }]}>
        {fields.includes("reps") && <TextInput accessibilityLabel="Target reps" keyboardType="number-pad" placeholder="Target reps" placeholderTextColor={colors.textMuted} value={set.targetReps ?? ""} onChangeText={(value) => { if (/^\d{0,3}$/.test(value)) updateSet(exercise.id, set.id, "targetReps", value); }} style={[styles.target, input, { color: colors.text }]} />}
        {[
          { text: `Add another ${label}`, action: () => addSet(exercise.id, set.id) },
          { text: "Warm-up", action: () => setSetType(exercise.id, set.id, "WARMUP") },
          { text: "Regular", action: () => setSetType(exercise.id, set.id, "REGULAR") },
          { text: "+ Drop set", action: () => addDropSet(exercise.id, set.id) },
          { text: `Delete ${label.toLowerCase()}`, action: () => deleteSet(exercise.id, set.id), destructive: true },
        ].map((option) => <Pressable key={option.text} accessibilityRole="button" style={[styles.option, { borderColor: colors.border }]} onPress={() => { option.action(); setSelectedId(null); }}><Text style={{ color: option.destructive ? "#E05252" : colors.text, fontSize: 12 }}>{option.text}</Text></Pressable>)}
      </View>}
    </View>)}
    <Pressable accessibilityRole="button" accessibilityLabel={`Add ${label.toLowerCase()} to ${exercise.name}`} style={[styles.add, { borderTopColor: colors.border }]} onPress={() => addSet(exercise.id)}><Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 1 }}>+ {label.toUpperCase()}</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  table: { width: "100%", minWidth: 0 },
  header: { minHeight: 30, marginBottom: 4 },
  valueColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  setGroup: { marginBottom: 8 },
  row: { minHeight: 48 },
  labelCell: { height: 48, justifyContent: "center", alignItems: "center", borderLeftWidth: 2 },
  previous: { fontSize: 11, textAlign: "center", fontVariant: ["tabular-nums"] },
  inputCell: { height: 48, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 6, overflow: "hidden" },
  input: { flex: 1, minWidth: 0, height: "100%", paddingHorizontal: 4, paddingVertical: 0, textAlign: "center", fontWeight: "600", fontVariant: ["tabular-nums"] },
  unit: { flexShrink: 0, paddingRight: 5, fontSize: 10 },
  confirm: { height: 48, borderWidth: 1, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  options: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6, borderTopWidth: 1, paddingTop: 8 },
  target: { minHeight: 44, width: 110, paddingHorizontal: 10, borderWidth: 1, borderRadius: 6 },
  option: { minHeight: 44, justifyContent: "center", paddingHorizontal: 10, borderWidth: 1, borderRadius: 6 },
  add: { minHeight: 44, marginTop: 4, borderTopWidth: 1, justifyContent: "center", alignItems: "center" },
});
