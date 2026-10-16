import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WorkoutSetTable } from "@/components/workout-set-table";
import { workoutRowLabel } from "@/utils/workout-layout";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatTime, parseTime } from "@/utils/duration";
import { type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/context/theme-context";
import { useWorkout } from "@/context/workout-context";
import { HomeDashboard } from "@/components/home-dashboard";

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 420;
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  const {
    notes, setNotes, syncStatus, reloadActiveWorkout, updateExerciseNotes, setTimer, savePreset, finishWorkout, cancelActiveWorkout,
    isActive,
    exercises,
    updateExerciseRest,
    restSeconds,
    updateWeightUnit,
    updateDistanceUnit,
    deleteExercise,
    moveExercise,
  } = useWorkout();

  const router = useRouter();
  const [dialog, setDialog] = useState<"finish" | "discard" | "reload" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [timerInput, setTimerInput] = useState("");
  async function confirmAction() {
    setBusy(true);
    try {
      if (dialog === "finish") { const id = await finishWorkout(); setDialog(null); if (id) router.push({ pathname: "/workout-detail", params: { workoutId: id, result: "1" } }); }
      else if (dialog === "reload") { await reloadActiveWorkout(); setDialog(null); }
      else { await cancelActiveWorkout(); setDialog(null); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save workout"); setDialog(null); }
    finally { setBusy(false); }
  }


  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  );

  function toggleExerciseMenu(exerciseId: string) {
    setSelectedExerciseId((current) =>
      current === exerciseId ? null : exerciseId,
    );
  }

  function closeExerciseMenu() {
    setSelectedExerciseId(null);
  }

  function changeWeightUnit(exerciseId: string) {
    const exercise = exercises.find(
      (item) => item.id === exerciseId,
    );

    if (!exercise) {
      return;
    }

    updateWeightUnit(
      exerciseId,
      exercise.weightUnit === "KG" ? "LBS" : "KG",
    );

    closeExerciseMenu();
  }

  function changeDistanceUnit(exerciseId: string) {
    const exercise = exercises.find(
      (item) => item.id === exerciseId,
    );

    if (!exercise) {
      return;
    }

    updateDistanceUnit(
      exerciseId,
      exercise.distanceUnit === "KM" ? "MI" : "KM",
    );

    closeExerciseMenu();
  }

  function replaceExercise(exerciseId: string) {
    closeExerciseMenu();

    router.push({
      pathname: "/exercise-picker",
      params: {
        replaceExerciseId: exerciseId,
      },
    });
  }

  function removeExercise(exerciseId: string) {
    void deleteExercise(exerciseId).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not delete exercise"));
    closeExerciseMenu();
  }

  function moveExerciseUp(exerciseId: string) {
    void moveExercise(exerciseId, "up").catch((cause) => setError(cause.message));
    closeExerciseMenu();
  }

  function moveExerciseDown(exerciseId: string) {
    void moveExercise(exerciseId, "down").catch((cause) => setError(cause.message));
    closeExerciseMenu();
  }

  const selectedExercise = exercises.find(
    (exercise) => exercise.id === selectedExerciseId,
  );

  const selectedIndex = selectedExercise
    ? exercises.findIndex(
        (exercise) => exercise.id === selectedExercise.id,
      )
    : -1;

  const canMoveUp = selectedIndex > 0;

  const canMoveDown =
    selectedIndex >= 0 &&
    selectedIndex < exercises.length - 1;

  if (isActive) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={64 + insets.top} style={styles.container}>
        <View style={styles.workoutToolbar}>
          <Pressable style={{ flex: 1, minWidth: 0 }} accessibilityLabel="Open saved workouts and templates" onPress={() => router.push("/workout-setup")}><Text numberOfLines={1} style={styles.workoutToolbarTitle}>ACTIVE WORKOUT · PRESETS ›</Text></Pressable>
          <Pressable style={styles.quickAddButton} onPress={() => router.push("/exercise-picker")}>
            <Text style={styles.quickAddText}>+ EXERCISE</Text>
          </Pressable>
        </View>
        <KeyboardAwareScrollView
          style={{ flex: 1, minWidth: 0 }}
          contentContainerStyle={[styles.workoutContent, { paddingHorizontal: (compact ? 8 : 24) + Math.max(insets.left, insets.right) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          enableOnAndroid
          enableAutomaticScroll
          extraScrollHeight={24}
          enableResetScrollToCoords={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.workoutInner}>
          <Text style={styles.optionText}>{syncStatus}</Text>
          <Pressable onPress={() => setDialog("reload")}><Text style={styles.quickAddText}>Reload server workout</Text></Pressable>
          {!!error && <Text accessibilityRole="alert" style={styles.deleteText}>{error}</Text>}
          <TextInput accessibilityLabel="Workout notes" multiline maxLength={5000} placeholder="Workout notes" placeholderTextColor={Colors.textMuted} value={notes} onChangeText={setNotes} style={[styles.input, { minHeight: 60, textAlign: "left", marginVertical: 12 }]} />
          <Pressable onPress={() => void savePreset().then(() => setError("Preset saved in Templates")).catch((cause) => setError(cause.message))}><Text style={styles.quickAddText}>Save as reusable preset</Text></Pressable>
          {exercises.map((exercise) => {
            const isSelected =
              selectedExerciseId === exercise.id;

            return (
              <View
                key={exercise.id}
                style={styles.exerciseCard}

              >
                {/* Entire header is the touch target */}
                <Pressable
                  style={({ pressed }) => [
                    styles.exerciseHeaderButton,
                    pressed && styles.exerciseHeaderButtonPressed,
                  ]}
                  onPress={() =>
                    toggleExerciseMenu(exercise.id)
                  }
                  hitSlop={6}
                >
                  <View style={styles.exerciseHeaderContent}>
                    <Text numberOfLines={3} style={styles.exerciseName}>
                      {exercise.name}
                    </Text>

                    <Text style={styles.exerciseMenuHint}>
                      {isSelected ? "×" : "•••"}
                    </Text>
                  </View>
                </Pressable>

                {isSelected && (
                  <View style={styles.optionsPanel}>
                    <View style={styles.optionsHeader}>
                      <Text style={styles.optionsTitle}>
                        Exercise options
                      </Text>

                      <Pressable
                        style={styles.closeButton}
                        onPress={closeExerciseMenu}
                        hitSlop={8}
                      >
                        <Text style={styles.closeButtonText}>
                          ×
                        </Text>
                      </Pressable>
                    </View>

                    {(exercise.measurementType === "WEIGHT_REPS" ||
                      exercise.measurementType ===
                        "WEIGHT_DISTANCE") && (
                      <Pressable
                        style={styles.optionButton}
                        onPress={() =>
                          changeWeightUnit(exercise.id)
                        }
                      >
                        <Text style={styles.optionText}>
                          Change weight unit
                        </Text>

                        <Text style={styles.optionValue}>
                          {exercise.weightUnit} →{" "}
                          {exercise.weightUnit === "KG"
                            ? "LBS"
                            : "KG"}
                        </Text>
                      </Pressable>
                    )}

                    {(exercise.measurementType === "DISTANCE_TIME" ||
                      exercise.measurementType ===
                        "WEIGHT_DISTANCE") && (
                      <Pressable
                        style={styles.optionButton}
                        onPress={() =>
                          changeDistanceUnit(exercise.id)
                        }
                      >
                        <Text style={styles.optionText}>
                          Change distance unit
                        </Text>

                        <Text style={styles.optionValue}>
                          {exercise.distanceUnit} →{" "}
                          {exercise.distanceUnit === "KM"
                            ? "MI"
                            : "KM"}
                        </Text>
                      </Pressable>
                    )}


                    <Pressable
                      style={styles.optionButton}
                      onPress={() =>
                        replaceExercise(exercise.id)
                      }
                    >
                      <Text style={styles.optionText}>
                        Replace exercise
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.optionButton,
                        !canMoveUp &&
                          styles.disabledOption,
                      ]}
                      disabled={!canMoveUp}
                      onPress={() =>
                        moveExerciseUp(exercise.id)
                      }
                    >
                      <Text
                        style={[
                          styles.optionText,
                          !canMoveUp &&
                            styles.disabledText,
                        ]}
                      >
                        Move up
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.optionButton,
                        !canMoveDown &&
                          styles.disabledOption,
                      ]}
                      disabled={!canMoveDown}
                      onPress={() =>
                        moveExerciseDown(exercise.id)
                      }
                    >
                      <Text
                        style={[
                          styles.optionText,
                          !canMoveDown &&
                            styles.disabledText,
                        ]}
                      >
                        Move down
                      </Text>
                    </Pressable>

                    <View style={styles.restOption}>
                      <Text style={styles.optionText}>Rest after set: {formatTime(exercise.restSeconds ?? restSeconds)}</Text>
                      <TextInput accessibilityLabel="Rest duration mm:ss" placeholder="mm:ss" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" value={timerInput} onChangeText={setTimerInput} style={styles.input} />
                      <Pressable style={styles.optionButton} onPress={() => { const seconds = parseTime(timerInput); if (seconds === null || seconds > 3600) { setError("Enter a valid timer up to 01:00:00"); return; } updateExerciseRest(exercise.id, seconds); setTimer(seconds); closeExerciseMenu(); }}><Text style={styles.quickAddText}>Set Timer</Text></Pressable>
                    </View>
                    <Pressable
                      style={styles.deleteButton}
                      onPress={() =>
                        removeExercise(exercise.id)
                      }
                    >
                      <Text style={styles.deleteText}>
                        Delete exercise
                      </Text>
                    </Pressable>
                  </View>
                )}

                <TextInput accessibilityLabel={`Form cues for ${exercise.name}`} multiline maxLength={2000} placeholder="Permanent form cues" placeholderTextColor={Colors.textMuted} value={exercise.notes ?? ""} onChangeText={(value) => updateExerciseNotes(exercise.id, value)} style={[styles.input, { textAlign: "left", marginBottom: 10 }]} />
                <WorkoutSetTable exercise={exercise} compact={compact} onError={setError} />
              </View>
            );
          })}

          {exercises.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No exercises yet.
              </Text>
            </View>
          )}

          </View>
        </KeyboardAwareScrollView>
        <View style={[styles.bottomActions, { paddingLeft: 12 + insets.left, paddingRight: 12 + insets.right }]}><View style={styles.bottomActionsInner}>
          <Pressable accessibilityRole="button" disabled={busy} style={styles.bottomButton} onPress={() => setDialog("discard")}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.deleteText}>End / Discard</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy} style={[styles.bottomButton, { backgroundColor: Colors.accent }]} onPress={() => setDialog("finish")}><Text numberOfLines={1} adjustsFontSizeToFit style={{ color: Colors.onAccent, fontWeight: "800" }}>Finish Workout</Text></Pressable>
        </View></View>
        <ConfirmDialog visible={dialog !== null} busy={busy} title={dialog === "reload" ? "Reload server workout?" : dialog === "finish" ? "Finish workout?" : "Discard workout?"} message={dialog === "reload" ? "Unsynced changes on this device will be replaced with the server workout. Continue?" : dialog === "finish" ? (() => { const pending = exercises.flatMap((item) => item.sets.filter((set) => !set.completed).map((set) => `□ ${item.name}: ${workoutRowLabel(item.name, item.measurementType)} ${set.setNumber} (${set.setType.toLowerCase()})`)); return pending.length ? `These sets are unfinished and will not be recorded:\n\n${pending.join("\n")}\n\nSave completed sets and finish anyway?` : "All sets completed. Save your workout?"; })() : "This removes the active workout and its sets permanently."} onCancel={() => setDialog(null)} onConfirm={() => void confirmAction()} confirmLabel={dialog === "reload" ? "Reload" : dialog === "finish" ? "Finish Workout" : "Discard"} />
      </KeyboardAvoidingView>
    );
  }

  return <HomeDashboard />;
}

const createStyles = (Colors: AppPalette) => StyleSheet.create({
  workoutInner: { width: "100%", maxWidth: 1100, alignSelf: "center", minWidth: 0 },
  bottomActionsInner: { flexDirection: "row", gap: 10, width: "100%", maxWidth: 1100, alignSelf: "center" },
  bottomActions: { padding: 12, flexShrink: 0, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  bottomButton: { flex: 1, minWidth: 0, paddingHorizontal: 8, minHeight: 48, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  unit: { color: Colors.textMuted, fontSize: 10 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    minWidth: 0,
  },

  workoutContent: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 24,
  },

  workoutToolbar: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },

  workoutToolbarTitle: { color: Colors.textMuted, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  quickAddButton: { minHeight: 40, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  quickAddText: { color: Colors.accent, fontSize: 12, fontWeight: "900" },

  exerciseCard: {
    marginBottom: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 7,
    backgroundColor: Colors.surface,
  },

  exerciseHeaderButton: {
    minHeight: 58,
    marginBottom: 10,
    borderRadius: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  exerciseHeaderButtonPressed: {
    opacity: 0.65,
  },

  exerciseHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  exerciseName: {
    flex: 1,
    minWidth: 0,
    color: Colors.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  exerciseMenuHint: {
    marginLeft: 12,
    color: Colors.accent,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
  },

  optionsPanel: {
    marginBottom: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 7,
    backgroundColor: Colors.background,
  },

  optionsHeader: {
    minHeight: 42,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 4,
  },

  optionsTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "800",
  },

  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  closeButtonText: {
    color: Colors.textMuted,
    fontSize: 28,
    lineHeight: 30,
  },

  optionButton: {
    minHeight: 46,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  optionText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "600",
  },

  optionValue: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "800",
  },

  restOption: { paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  restControls: { marginTop: 8, flexDirection: "row", gap: 6 },
  restChoice: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border, borderRadius: 5 },
  restChoiceSelected: { borderColor: Colors.accent, backgroundColor: Colors.surface },
  restChoiceText: { color: Colors.text, fontSize: 11, fontWeight: "800" },

  disabledOption: {
    opacity: 0.3,
  },

  disabledText: {
    color: Colors.textMuted,
  },

  deleteButton: {
    minHeight: 46,
    paddingHorizontal: 10,
    justifyContent: "center",
  },

  deleteText: {
    color: "#E05252",
    fontSize: 14,
    fontWeight: "700",
  },

  input: {
    width: "100%",
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 5,
    backgroundColor: Colors.background,
    color: Colors.text,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },

  empty: {
    paddingVertical: 40,
    alignItems: "center",
  },

  emptyText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
});
