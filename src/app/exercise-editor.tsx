import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useAppTheme } from "@/context/theme-context";
import { getExercises, request, type ExerciseMeasurementType } from "@/services/api";

export default function ExerciseEditor() {
  const { colors: Colors } = useAppTheme();
  const { exerciseId } = useLocalSearchParams<{ exerciseId?: string }>();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [measurementType, setMeasurementType] = useState<ExerciseMeasurementType>("WEIGHT_REPS");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!exerciseId) return;
    void getExercises().then((items) => {
      const item = items.find((entry) => entry.id === Number(exerciseId));
      if (!item || item.ownerId == null) { setError("Only personal exercises can be edited"); return; }
      setName(item.name); setDescription(item.description ?? ""); setCategory(item.category ?? ""); setMeasurementType(item.measurementType);
    }).catch((cause) => setError(cause.message));
  }, [exerciseId]);
  async function save(remove = false) {
    if (busy) return;
    setBusy(true);
    try {
      await request(exerciseId ? `/exercises/${exerciseId}` : "/exercises", remove ? "DELETE" : exerciseId ? "PATCH" : "POST", remove ? undefined : { name, description, category, measurementType });
      router.back();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save exercise"); }
    finally { setBusy(false); setConfirm(false); }
  }
  const input = { color: Colors.text, backgroundColor: Colors.surface, padding: 14, borderRadius: 8, marginBottom: 12, minHeight: 48 };
  return <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
    <Pressable onPress={() => router.back()}><Text style={input}>‹ Back</Text></Pressable>
    <Text accessibilityRole="header" style={{ color: Colors.text, fontSize: 24, marginBottom: 20 }}>{exerciseId ? "Edit exercise" : "Create exercise"}</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: Colors.accent }}>{error}</Text>}
    <TextInput accessibilityLabel="Exercise name" style={input} value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={Colors.textMuted} maxLength={100} />
    <TextInput accessibilityLabel="Category" style={input} value={category} onChangeText={setCategory} placeholder="Category / primary muscle" placeholderTextColor={Colors.textMuted} maxLength={100} />
    <TextInput accessibilityLabel="Description" style={input} value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={Colors.textMuted} maxLength={2000} multiline />
    <Text style={{ color: Colors.textMuted, marginBottom: 12 }}>Measurement (fixed after creation to preserve history)</Text>
    <View>{(["WEIGHT_REPS", "REPS", "TIME", "DISTANCE_TIME", "WEIGHT_DISTANCE"] as const).map((type) => <Pressable key={type} disabled={!!exerciseId} onPress={() => setMeasurementType(type)} style={[input, { borderWidth: 1, borderColor: type === measurementType ? Colors.accent : Colors.border }]}><Text style={{ color: Colors.text }}>{type.replaceAll("_", " + ")}</Text></Pressable>)}</View>
    <Pressable disabled={busy} style={[input, { backgroundColor: Colors.accent }]} onPress={() => void save()}><Text style={{ color: "#fff" }}>Save exercise</Text></Pressable>
    {!!exerciseId && <Pressable disabled={busy} onPress={() => setConfirm(true)}><Text style={input}>Delete exercise</Text></Pressable>}
  </ScrollView><ConfirmDialog visible={confirm} busy={busy} title="Delete exercise?" message="Remove it from your catalog? Existing workout history will be preserved." onCancel={() => setConfirm(false)} onConfirm={() => void save(true)} confirmLabel="Delete" /></SafeAreaView>;
}
