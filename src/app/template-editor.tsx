import { useAppDialog } from "@/context/dialog-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/context/theme-context";
import {
  createWorkoutTemplate,
  getExercises,
  getWorkoutTemplates,
  updateWorkoutTemplate,
  type Exercise,
  type WorkoutTemplate,
} from "@/services/api";

export default function TemplateEditorScreen() {
  const { alert } = useAppDialog();
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const numericTemplateId = templateId ? Number(templateId) : null;
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configuration, setConfiguration] = useState<NonNullable<WorkoutTemplate["configuration"]>>({});

  useEffect(() => {
    async function load() {
      try {
        const [availableExercises, templates] = await Promise.all([
          getExercises(),
          numericTemplateId ? getWorkoutTemplates() : Promise.resolve([]),
        ]);
        setExercises(availableExercises);

        if (numericTemplateId) {
          const template = templates.find((item) => item.id === numericTemplateId);
          if (!template || template.userId === null) {
            alert("Template unavailable", "This template cannot be edited.", [
              { text: "OK", onPress: () => router.back() },
            ]);
            return;
          }
          setName(template.name);
          setConfiguration(template.configuration ?? {});
          setSelectedIds(
            [...template.exercises]
              .sort((a, b) => a.order - b.order)
              .map((item) => item.exercise.id),
          );
        }
      } catch (error) {
        alert("Could not load template", error instanceof Error ? error.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [numericTemplateId, router, alert]);

  const filteredExercises = useMemo(() => {
    const query = search.trim().toLowerCase();
    return exercises.filter((exercise) => exercise.name.toLowerCase().includes(query));
  }, [exercises, search]);

  function toggleExercise(exerciseId: number) {
    setSelectedIds((current) =>
      current.includes(exerciseId)
        ? current.filter((id) => id !== exerciseId)
        : [...current, exerciseId],
    );
  }

  async function save() {
    if (!name.trim()) {
      alert("Name required", "Enter a name for the template.");
      return;
    }
    if (selectedIds.length === 0) {
      alert("Exercises required", "Select at least one exercise.");
      return;
    }

    try {
      setSaving(true);
      if (numericTemplateId) {
        await updateWorkoutTemplate(numericTemplateId, name, selectedIds, configuration);
      } else {
        await createWorkoutTemplate(name, selectedIds, configuration);
      }
      router.back();
    } catch (error) {
      alert("Could not save template", error instanceof Error ? error.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{numericTemplateId ? "EDIT TEMPLATE" : "NEW TEMPLATE"}</Text>
        <Pressable style={styles.headerButton} disabled={saving || loading} onPress={() => void save()}>
          <Text style={[styles.saveText, saving && styles.disabled]}>SAVE</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Push day"
            placeholderTextColor={Colors.textMuted}
            maxLength={60}
          />

          <Text style={styles.label}>EXERCISES ({selectedIds.length})</Text>
          <TextInput
            style={styles.input}
            value={search}
            onChangeText={setSearch}
            placeholder="Search exercises"
            placeholderTextColor={Colors.textMuted}
          />

          {selectedIds.map((id) => <View key={id} style={{ marginBottom: 16 }}>
            <Text style={styles.exerciseName}>{exercises.find((item) => item.id === id)?.name}: target reps per set</Text>
            <TextInput accessibilityLabel="Target reps separated by commas" style={styles.input} placeholder="e.g. 10,10,8" placeholderTextColor={Colors.textMuted} value={(configuration[String(id)]?.targetReps ?? [0]).join(",")} onChangeText={(value) => {
              if (!/^[0-9,]*$/.test(value)) return;
              const targets = value.split(",").slice(0, 30).map((entry) => Math.min(999, Number(entry)));
              setConfiguration((current) => ({ ...current, [String(id)]: { ...current[String(id)], targetReps: targets, setTypes: targets.map((_, index) => current[String(id)]?.setTypes?.[index] ?? "REGULAR") } }));
            }} />
          </View>)}
          {filteredExercises.map((exercise) => {
            const selected = selectedIds.includes(exercise.id);
            const position = selectedIds.indexOf(exercise.id) + 1;
            return (
              <Pressable
                key={exercise.id}
                style={[styles.exerciseRow, selected && styles.exerciseRowSelected]}
                onPress={() => toggleExercise(exercise.id)}
              >
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.measurement}>{exercise.measurementType.replaceAll("_", " + ")}</Text>
                </View>
                <Text style={selected ? styles.selectedText : styles.addText}>
                  {selected ? position : "+"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (Colors: AppPalette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    minHeight: 58,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: { width: 64, minHeight: 44, alignItems: "center", justifyContent: "center" },
  backText: { color: Colors.text, fontSize: 38, lineHeight: 38 },
  saveText: { color: Colors.accent, fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  title: { flex: 1, color: Colors.text, fontSize: 18, fontWeight: "900", textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40 },
  label: { marginTop: 10, marginBottom: 8, color: Colors.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  input: {
    height: 46,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 7,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: 15,
  },
  exerciseRow: {
    minHeight: 62,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 7,
    backgroundColor: Colors.surface,
  },
  exerciseRowSelected: { borderColor: Colors.accent },
  exerciseInfo: { flex: 1 },
  exerciseName: { color: Colors.text, fontSize: 15, fontWeight: "800" },
  measurement: { marginTop: 4, color: Colors.textMuted, fontSize: 10, fontWeight: "700" },
  addText: { color: Colors.accent, fontSize: 24, fontWeight: "700" },
  selectedText: { color: Colors.accent, fontSize: 16, fontWeight: "900" },
});
