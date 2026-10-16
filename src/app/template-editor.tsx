import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import {
  createWorkoutTemplate,
  getExercises,
  getWorkoutTemplates,
  updateWorkoutTemplate,
  type Exercise,
} from "@/services/api";

export default function TemplateEditorScreen() {
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const numericTemplateId = templateId ? Number(templateId) : null;
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
            Alert.alert("Template unavailable", "This template cannot be edited.", [
              { text: "OK", onPress: () => router.back() },
            ]);
            return;
          }
          setName(template.name);
          setSelectedIds(
            [...template.exercises]
              .sort((a, b) => a.order - b.order)
              .map((item) => item.exercise.id),
          );
        }
      } catch (error) {
        Alert.alert("Could not load template", error instanceof Error ? error.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [numericTemplateId, router]);

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
      Alert.alert("Name required", "Enter a name for the template.");
      return;
    }
    if (selectedIds.length === 0) {
      Alert.alert("Exercises required", "Select at least one exercise.");
      return;
    }

    try {
      setSaving(true);
      if (numericTemplateId) {
        await updateWorkoutTemplate(numericTemplateId, name, selectedIds);
      } else {
        await createWorkoutTemplate(name, selectedIds);
      }
      router.back();
    } catch (error) {
      Alert.alert("Could not save template", error instanceof Error ? error.message : "Something went wrong.");
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

const styles = StyleSheet.create({
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
