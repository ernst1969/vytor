import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatTime, parseTime } from "@/utils/duration";
import { type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/context/theme-context";
import { useWorkout } from "@/context/workout-context";
import { checkBackend } from "../../services/api";

type LayoutPosition = {
  y: number;
};

export default function HomeScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  const {
    notes, setNotes, syncStatus, reloadActiveWorkout, updateExerciseNotes, setTimer, savePreset, finishWorkout, cancelActiveWorkout,
    isActive,
    exercises,
    addSet,
    deleteSet,
    setSetType,
    addDropSet,
    updateExerciseRest,
    restSeconds,
    updateSet,
    completeSet,
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


  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  );
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  const scrollViewRef =
    useRef<KeyboardAwareScrollView | null>(null);

  const exercisePositions =
    useRef<Record<string, LayoutPosition>>({});

  const setPositions =
    useRef<Record<string, LayoutPosition>>({});

  useEffect(() => {
    checkBackend()
      .then(() => setBackendStatus("Connected"))
      .catch(() => setBackendStatus("Disconnected"));
  }, []);

  function handleExerciseLayout(exerciseId: string, y: number) {
    exercisePositions.current[exerciseId] = { y };
  }

  function handleSetLayout(setId: string, y: number) {
    setPositions.current[setId] = { y };
  }

  function scrollToSet(exerciseId: string, setId: string) {
    setTimeout(() => {
      const exercisePosition =
        exercisePositions.current[exerciseId];

      const setPosition = setPositions.current[setId];

      if (!exercisePosition || !setPosition) {
        return;
      }

      const screenHeight = Dimensions.get("window").height;
      const keyboardHeight = 300;
      const visibleHeight = screenHeight - keyboardHeight;
      const targetCenter = visibleHeight / 2;
      const setHeight = 46;

      const setY =
        exercisePosition.y + setPosition.y;

      const targetY =
        setY -
        targetCenter +
        setHeight / 2;

      scrollViewRef.current?.scrollToPosition(
        0,
        Math.max(0, targetY),
        true,
      );
    }, 150);
  }

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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={styles.workoutToolbar}>
          <Pressable accessibilityLabel="Open saved workouts and templates" onPress={() => router.push("/workout-setup")}><Text style={styles.workoutToolbarTitle}>ACTIVE WORKOUT · PRESETS ›</Text></Pressable>
          <Pressable style={styles.quickAddButton} onPress={() => router.push("/exercise-picker")}>
            <Text style={styles.quickAddText}>+ EXERCISE</Text>
          </Pressable>
        </View>
        <KeyboardAwareScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.workoutContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          enableOnAndroid
          enableAutomaticScroll={false}
          enableResetScrollToCoords={false}
          showsVerticalScrollIndicator={false}
        >
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
                onLayout={(event) =>
                  handleExerciseLayout(
                    exercise.id,
                    event.nativeEvent.layout.y,
                  )
                }
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
                    <Text style={styles.exerciseName}>
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
                <View style={styles.columnHeader}>
                  <Text style={styles.setHeader}>{/boxing|muay|kickboxing/i.test(exercise.name) ? "SESSION" : "SET"}</Text>
                  <Text style={styles.previousHeader}>LAST</Text>
                  {(exercise.measurementType === "WEIGHT_REPS" || exercise.measurementType === "WEIGHT_DISTANCE") && (
                    <Text style={styles.inputHeader}>WEIGHT</Text>
                  )}
                  {(exercise.measurementType === "REPS" || exercise.measurementType === "WEIGHT_REPS") && (
                    <Text style={styles.inputHeader}>REPS</Text>
                  )}
                  {(exercise.measurementType === "DISTANCE_TIME" || exercise.measurementType === "WEIGHT_DISTANCE") && (
                    <Text style={styles.inputHeader}>DISTANCE</Text>
                  )}
                  {(exercise.measurementType === "TIME" || exercise.measurementType === "DISTANCE_TIME") && (
                    <Text style={styles.inputHeader}>TIME</Text>
                  )}
                  <View style={styles.actionHeader} />
                </View>

                {exercise.sets.map((set, setIndex) => {
                  const previousSet =
                    exercise.previousSets?.find(
                      (previous) =>
                        previous.setNumber ===
                        set.setNumber,
                    );

                  const previousValues = previousSet
                    ? [previousSet.weight === null ? null : Number((previousSet.weight * (exercise.weightUnit === "LBS" ? 2.2046226218 : 1)).toFixed(2)), previousSet.reps, previousSet.distance === null ? null : Number((previousSet.distance * (exercise.distanceUnit === "MI" ? 0.6213711922 : 1)).toFixed(2)), previousSet.durationSeconds === null ? null : formatTime(previousSet.durationSeconds)]
                        .filter((value) => value !== null)
                    : [];
                  const previousText = previousValues.length ? previousValues.join("/") : "—";

                  return (
                    <View key={set.id} style={set.setType === "DROP" ? { marginLeft: 12, borderLeftWidth: 2, borderLeftColor: Colors.accent, paddingLeft: 4 } : undefined}>
                    <View style={styles.setRow} onLayout={(event) => handleSetLayout(set.id, event.nativeEvent.layout.y)}>
                      <Pressable style={styles.setNumberButton} onPress={() => setSelectedSetId(selectedSetId === set.id ? null : set.id)}>
                        <Text style={[styles.setNumber, set.setType !== "REGULAR" && styles.specialSetNumber]}>
                          {set.setType === "WARMUP" ? "W" : set.setType === "DROP" || exercise.sets[setIndex + 1]?.setType === "DROP" ? "D" : exercise.sets.slice(0, setIndex + 1).filter((item) => item.setType === "REGULAR").length}
                        </Text>
                      </Pressable>

                      <Text style={styles.previousValue}>
                        {previousText}
                      </Text>

                      {(exercise.measurementType === "WEIGHT_REPS" || exercise.measurementType === "WEIGHT_DISTANCE") && <TextInput
                        style={styles.input}
                        value={set.weight}
                        onFocus={() =>
                          scrollToSet(
                            exercise.id,
                            set.id,
                          )
                        }
                        onChangeText={(value) =>
                          updateSet(
                            exercise.id,
                            set.id,
                            "weight",
                            value,
                          )
                        }
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={
                          Colors.textMuted
                        }
                      />}
                      {(exercise.measurementType === "WEIGHT_REPS" || exercise.measurementType === "WEIGHT_DISTANCE") && <Text style={styles.unit}>{exercise.weightUnit === "KG" ? "kg" : "lb"}</Text>}

                      {(exercise.measurementType === "REPS" || exercise.measurementType === "WEIGHT_REPS") && <TextInput
                        style={styles.input}
                        value={set.reps}
                        onFocus={() =>
                          scrollToSet(
                            exercise.id,
                            set.id,
                          )
                        }
                        onChangeText={(value) =>
                          updateSet(
                            exercise.id,
                            set.id,
                            "reps",
                            value,
                          )
                        }
                        keyboardType="number-pad"
                        placeholder={set.targetReps || "reps"}
                        placeholderTextColor={
                          Colors.textMuted
                        }
                      />}

                      {(exercise.measurementType === "DISTANCE_TIME" || exercise.measurementType === "WEIGHT_DISTANCE") && <TextInput
                        style={styles.input}
                        value={set.distance}
                        onFocus={() => scrollToSet(exercise.id, set.id)}
                        onChangeText={(value) => updateSet(exercise.id, set.id, "distance", value)}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={Colors.textMuted}
                      />}

                      {(exercise.measurementType === "DISTANCE_TIME" || exercise.measurementType === "WEIGHT_DISTANCE") && <Text style={styles.unit}>{exercise.distanceUnit.toLowerCase()}</Text>}
                      {(exercise.measurementType === "TIME" || exercise.measurementType === "DISTANCE_TIME") && <TextInput
                        style={styles.input}
                        value={set.durationSeconds ? formatTime(Number(set.durationSeconds)) : ""}
                        onFocus={() => scrollToSet(exercise.id, set.id)}
                        onChangeText={(value) => { const seconds = parseTime(value); if (value === "") updateSet(exercise.id, set.id, "durationSeconds", ""); else if (seconds !== null) updateSet(exercise.id, set.id, "durationSeconds", String(seconds)); else setError("Minutes and seconds must be below 60"); }}
                        keyboardType="number-pad"
                        placeholder="00:00:00"
                        placeholderTextColor={Colors.textMuted}
                      />}

                      <Pressable
                        style={[
                          styles.finishSetButton,
                          set.completed &&
                            styles.finishSetButtonCompleted,
                        ]}
                        onPress={() =>
                          completeSet(exercise.id, set.id) || setError("Enter valid non-negative values for this set first")
                        }
                      >
                        <Text
                          style={[
                            styles.finishSetText,
                            set.completed &&
                              styles.finishSetTextCompleted,
                          ]}
                        >
                          ✓
                        </Text>
                      </Pressable>
                    </View>
                    {selectedSetId === set.id && (
                      <View style={styles.setOptions}>
                        {(exercise.measurementType === "REPS" || exercise.measurementType === "WEIGHT_REPS") && <TextInput accessibilityLabel="Target reps" keyboardType="number-pad" placeholder="Target reps" placeholderTextColor={Colors.textMuted} value={set.targetReps ?? ""} onChangeText={(value) => { if (/^\d{0,3}$/.test(value)) updateSet(exercise.id, set.id, "targetReps", value); }} style={[styles.input, { minWidth: 110 }]} />}
                        <Pressable style={styles.setOption} onPress={() => { addSet(exercise.id, set.id); setSelectedSetId(null); }}><Text style={styles.setOptionText}>Add another Set</Text></Pressable>
                        <Pressable style={styles.setOption} onPress={() => setSetType(exercise.id, set.id, "WARMUP")}><Text style={styles.setOptionText}>Warm-up</Text></Pressable>
                        <Pressable style={styles.setOption} onPress={() => setSetType(exercise.id, set.id, "REGULAR")}><Text style={styles.setOptionText}>Regular</Text></Pressable>
                        <Pressable style={styles.setOption} onPress={() => { addDropSet(exercise.id, set.id); setSelectedSetId(null); }}><Text style={styles.setOptionText}>+ Drop set</Text></Pressable>
                        <Pressable style={styles.setOption} onPress={() => { deleteSet(exercise.id, set.id); setSelectedSetId(null); }}><Text style={styles.deleteText}>Delete set</Text></Pressable>
                      </View>
                    )}
                    </View>
                  );
                })}

                <Pressable
                  style={styles.addSetButton}
                  onPress={() => addSet(exercise.id)}
                >
                  <Text style={styles.addSetText}>
                    + SET
                  </Text>
                </Pressable>
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

          <Pressable
            style={styles.addExerciseButton}
            onPress={() =>
              router.push("/exercise-picker")
            }
          >
            <Text style={styles.addExerciseText}>
              + ADD EXERCISE
            </Text>
          </Pressable>
        </KeyboardAwareScrollView>
        <View style={styles.bottomActions}>
          <Pressable accessibilityRole="button" disabled={busy} style={styles.bottomButton} onPress={() => setDialog("discard")}><Text style={styles.deleteText}>End / Discard</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy} style={[styles.bottomButton, { backgroundColor: Colors.accent }]} onPress={() => setDialog("finish")}><Text style={{ color: "#fff", fontWeight: "800" }}>Finish Workout</Text></Pressable>
        </View>
        <ConfirmDialog visible={dialog !== null} busy={busy} title={dialog === "reload" ? "Reload server workout?" : dialog === "finish" ? "Finish workout?" : "Discard workout?"} message={dialog === "reload" ? "Unsynced changes on this device will be replaced with the server workout. Continue?" : dialog === "finish" ? (() => { const pending = exercises.flatMap((item) => item.sets.filter((set) => !set.completed).map((set) => `□ ${item.name}: ${set.setType.toLowerCase()} ${set.setNumber}`)); return pending.length ? `These sets are unfinished and will not be recorded:\n\n${pending.join("\n")}\n\nSave completed sets and finish anyway?` : "All sets completed. Save your workout?"; })() : "This removes the active workout and its sets permanently."} onCancel={() => setDialog(null)} onConfirm={() => void confirmAction()} confirmLabel={dialog === "reload" ? "Reload" : dialog === "finish" ? "Finish Workout" : "Discard"} />
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.startContent}>
        <Text style={styles.title}>
          Vytor
        </Text>

        <Text style={styles.subtitle}>
          Ready to train?
        </Text>

        <Pressable
          style={styles.startButton}
          onPress={() =>
            router.push("/workout-setup")
          }
        >
          <Text style={styles.startButtonText}>
            START WORKOUT
          </Text>
        </Pressable>

        <Text style={styles.backendStatus}>
          Backend: {backendStatus}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (Colors: AppPalette) => StyleSheet.create({
  bottomActions: { flexDirection: "row", gap: 10, padding: 12, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  bottomButton: { flex: 1, minHeight: 48, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  unit: { color: Colors.textMuted, fontSize: 10 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  startContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 12,
    color: Colors.text,
  },

  subtitle: {
    fontSize: 18,
    marginBottom: 32,
    color: Colors.textMuted,
  },

  startButton: {
    width: "100%",
    maxWidth: 360,
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: Colors.accent,
  },

  startButtonText: {
    color: Colors.background,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 1,
  },

  backendStatus: {
    marginTop: 24,
    fontSize: 14,
    color: Colors.textMuted,
  },

  workoutContent: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 120,
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
    padding: 12,
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

  columnHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },

  setHeader: {
    width: 28,
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center",
  },

  previousHeader: {
    width: 62,
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center",
  },

  inputHeader: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center",
  },

  actionHeader: {
    width: 44,
  },

  setRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    minHeight: 46,
  },

  setNumber: {
    width: 28,
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  setNumberButton: { width: 28, minHeight: 42, alignItems: "center", justifyContent: "center" },
  specialSetNumber: { color: Colors.accent },
  setOptions: { marginLeft: 28, marginBottom: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  setOption: { minHeight: 34, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border, borderRadius: 5 },
  setOptionText: { color: Colors.text, fontSize: 11, fontWeight: "700" },

  previousValue: {
    width: 62,
    color: Colors.textMuted,
    opacity: 0.45,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  input: {
    flex: 1,
    height: 42,
    marginHorizontal: 3,
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 5,
    backgroundColor: Colors.background,
    color: Colors.text,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },

  finishSetButton: {
    width: 44,
    height: 42,
    marginLeft: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 5,
    backgroundColor: Colors.background,
  },

  finishSetText: {
    color: Colors.accent,
    fontSize: 21,
    fontWeight: "900",
  },

  finishSetButtonCompleted: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },

  finishSetTextCompleted: {
    color: Colors.background,
  },

  addSetButton: {
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  addSetText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },

  addExerciseButton: {
    marginTop: 4,
    marginBottom: 24,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },

  addExerciseText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
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
