import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { Colors } from "@/constants/theme";
import { useWorkout } from "@/context/workout-context";
import { checkBackend } from "../../services/api";

type LayoutPosition = {
  y: number;
};

export default function HomeScreen() {
  const {
    isActive,
    exercises,
    addSet,
    updateSet,
    completeSet,
    updateWeightUnit,
    updateDistanceUnit,
    deleteExercise,
    moveExercise,
  } = useWorkout();

  const router = useRouter();

  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  );

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
    deleteExercise(exerciseId);
    closeExerciseMenu();
  }

  function moveExerciseUp(exerciseId: string) {
    moveExercise(exerciseId, "up");
    closeExerciseMenu();
  }

  function moveExerciseDown(exerciseId: string) {
    moveExercise(exerciseId, "down");
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
      <View style={styles.container}>
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

                <View style={styles.columnHeader}>
                  <Text style={styles.setHeader}>
                    SET
                  </Text>

                  <Text style={styles.previousHeader}>
                    LAST
                  </Text>

                  <Text style={styles.inputHeader}>
                    WEIGHT
                  </Text>

                  <Text style={styles.inputHeader}>
                    REPS
                  </Text>

                  <View style={styles.actionHeader} />
                </View>

                {exercise.sets.map((set) => {
                  const previousSet =
                    exercise.previousSets?.find(
                      (previous) =>
                        previous.setNumber ===
                        set.setNumber,
                    );

                  const hasPrevious =
                    previousSet !== undefined &&
                    (previousSet.weight !== null ||
                      previousSet.reps !== null);

                  const previousText = hasPrevious
                    ? `${previousSet?.weight ?? "—"}×${
                        previousSet?.reps ?? "—"
                      }`
                    : "—";

                  return (
                    <View
                      key={set.id}
                      style={styles.setRow}
                      onLayout={(event) =>
                        handleSetLayout(
                          set.id,
                          event.nativeEvent.layout.y,
                        )
                      }
                    >
                      <Text style={styles.setNumber}>
                        {set.setNumber}
                      </Text>

                      <Text style={styles.previousValue}>
                        {previousText}
                      </Text>

                      <TextInput
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
                        placeholder={exercise.weightUnit.toLowerCase()}
                        placeholderTextColor={
                          Colors.textMuted
                        }
                      />

                      <TextInput
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
                        placeholder="reps"
                        placeholderTextColor={
                          Colors.textMuted
                        }
                      />

                      <Pressable
                        style={[
                          styles.finishSetButton,
                          set.completed &&
                            styles.finishSetButtonCompleted,
                        ]}
                        onPress={() =>
                          completeSet(
                            exercise.id,
                            set.id,
                          )
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
      </View>
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

const styles = StyleSheet.create({
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