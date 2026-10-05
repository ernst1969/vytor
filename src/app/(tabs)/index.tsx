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

import {
  KeyboardAwareScrollView,
} from "react-native-keyboard-aware-scroll-view";

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
  } = useWorkout();

  const router = useRouter();

  const [backendStatus, setBackendStatus] =
    useState("Checking...");

  const scrollViewRef =
    useRef<KeyboardAwareScrollView | null>(null);

  const exercisePositions =
    useRef<Record<string, LayoutPosition>>({});

  const setPositions =
    useRef<Record<string, LayoutPosition>>({});

  useEffect(() => {
    checkBackend()
      .then(() => setBackendStatus("Connected"))
      .catch(() =>
        setBackendStatus("Disconnected"),
      );
  }, []);

  function handleExerciseLayout(
    exerciseId: string,
    y: number,
  ) {
    exercisePositions.current[exerciseId] = {
      y,
    };
  }

  function handleSetLayout(
    setId: string,
    y: number,
  ) {
    setPositions.current[setId] = {
      y,
    };
  }

  function scrollToSet(
    exerciseId: string,
    setId: string,
  ) {
    setTimeout(() => {
      const exercisePosition =
        exercisePositions.current[
          exerciseId
        ];

      const setPosition =
        setPositions.current[setId];

      if (
        !exercisePosition ||
        !setPosition
      ) {
        return;
      }

      const screenHeight =
        Dimensions.get("window").height;

      // Approximate Android keyboard height.
      const keyboardHeight = 300;

      // Visible area above the keyboard.
      const visibleHeight =
        screenHeight - keyboardHeight;

      // Put the focused set around
      // the middle of the visible area.
      const targetCenter =
        visibleHeight / 2;

      const setHeight = 46;

      const setY =
        exercisePosition.y +
        setPosition.y;

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

  if (isActive) {
    return (
      <View style={styles.container}>
        <KeyboardAwareScrollView
          ref={scrollViewRef}
          contentContainerStyle={
            styles.workoutContent
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          enableOnAndroid
          enableAutomaticScroll={false}
          enableResetScrollToCoords={false}
          showsVerticalScrollIndicator={false}
        >
          {exercises.map(
            (exercise, exerciseIndex) => (
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
                <Text style={styles.exerciseName}>
                  {String(
                    exerciseIndex + 1,
                  ).padStart(2, "0")}{" "}
                  {exercise.name}
                </Text>

                <View
                  style={styles.columnHeader}
                >
                  <Text
                    style={styles.setHeader}
                  >
                    SET
                  </Text>

                  <Text
                    style={styles.previousHeader}
                  >
                    LAST
                  </Text>

                  <Text
                    style={styles.inputHeader}
                  >
                    WEIGHT
                  </Text>

                  <Text
                    style={styles.inputHeader}
                  >
                    REPS
                  </Text>

                  <View
                    style={styles.actionHeader}
                  />
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
                    (previousSet.weight !==
                      null ||
                      previousSet.reps !==
                        null);

                  const previousText =
                    hasPrevious
                      ? `${previousSet.weight ?? "—"}×${
                          previousSet.reps ?? "—"
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
                      <Text
                        style={styles.setNumber}
                      >
                        {set.setNumber}
                      </Text>

                      <Text
                        style={
                          styles.previousValue
                        }
                      >
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
                        placeholder="kg"
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
                  onPress={() =>
                    addSet(exercise.id)
                  }
                >
                  <Text
                    style={styles.addSetText}
                  >
                    + SET
                  </Text>
                </Pressable>
              </View>
            ),
          )}

          {exercises.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No exercises yet.
              </Text>
            </View>
          )}
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
          <Text
            style={styles.startButtonText}
          >
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
    paddingBottom: 400,
  },

  exerciseCard: {
    marginBottom: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 7,
    backgroundColor: Colors.surface,
  },

  exerciseName: {
    marginBottom: 12,
    color: Colors.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
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

  empty: {
    paddingVertical: 40,
    alignItems: "center",
  },

  emptyText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
});