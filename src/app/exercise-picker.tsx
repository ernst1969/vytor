import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useEffect, useState } from "react";
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

import { Colors } from "@/constants/theme";
import {
  useWorkout,
  type WorkoutExercise,
} from "@/context/workout-context";
import {
  getExercises,
  type ExerciseMeasurementType,
} from "@/services/api";

type Exercise = {
  id: number;
  name: string;
  description?: string | null;
  measurementType: ExerciseMeasurementType;
};

export default function ExercisePickerScreen() {
  const router = useRouter();

  const {
    mode,
    replaceExerciseId,
  } = useLocalSearchParams<{
    mode?: string;
    replaceExerciseId?: string;
  }>();

  const {
    addExercise,
    replaceExercise,
    startWorkout,
  } = useWorkout();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercises, setSelectedExercises] =
    useState<WorkoutExercise[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadExercises();
  }, []);

  async function loadExercises() {
    try {
      const data = await getExercises();
      setExercises(data);
    } catch (error) {
      console.error(
        "Failed to load exercises:",
        error,
      );
    } finally {
      setLoading(false);
    }
  }

  function createWorkoutExercise(
    exercise: Exercise,
  ): WorkoutExercise {
    return {
      id: `exercise-${exercise.id}-${Date.now()}-${Math.random()}`,
      exerciseId: exercise.id,
      name: exercise.name,
      description: exercise.description,
      measurementType: exercise.measurementType,
      weightUnit: "KG",
      distanceUnit: "KM",
      sets: [
        {
          id: `set-${exercise.id}-${Date.now()}-${Math.random()}`,
          setNumber: 1,
          weight: "",
          reps: "",
          distance: "",
          durationSeconds: "",
          completed: false,
        },
      ],
    };
  }

  async function selectExercise(
    exercise: Exercise,
  ) {
    if (processing) {
      return;
    }

    const newExercise =
      createWorkoutExercise(exercise);

    /*
     * REPLACEMENT MODE
     */
    if (replaceExerciseId) {
      setProcessing(true);

      try {
        await replaceExercise(
          replaceExerciseId,
          newExercise,
        );

        router.back();
      } catch (error) {
        console.error(
          "Failed to replace exercise:",
          error,
        );
        setProcessing(false);
      }

      return;
    }

    /*
     * FREESTYLE MULTI-SELECT MODE
     */
    if (mode === "freestyle") {
      const alreadySelected =
        selectedExercises.some(
          (item) =>
            item.exerciseId === exercise.id,
        );

      if (alreadySelected) {
        return;
      }

      setSelectedExercises(
        (current) => [
          ...current,
          newExercise,
        ],
      );

      return;
    }

    /*
     * NORMAL ACTIVE-WORKOUT ADD MODE
     */
    setProcessing(true);

    try {
      await addExercise(newExercise);
      router.back();
    } catch (error) {
      console.error(
        "Failed to add exercise:",
        error,
      );
      setProcessing(false);
    }
  }

  async function finishSelection() {
    if (
      selectedExercises.length === 0 ||
      processing
    ) {
      return;
    }

    setProcessing(true);

    try {
      await startWorkout(
        selectedExercises,
        null,
      );

      router.replace("/");
    } catch (error) {
      console.error(
        "Failed to start freestyle workout:",
        error,
      );
      setProcessing(false);
    }
  }

  const filteredExercises =
    exercises.filter((exercise) =>
      exercise.name
        .toLowerCase()
        .includes(
          search.trim().toLowerCase(),
        ),
    );

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
    >
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>
            ←
          </Text>
        </Pressable>

        <Text style={styles.title}>
          {replaceExerciseId
            ? "Replace Exercise"
            : "Add Exercise"}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises..."
          placeholderTextColor={
            Colors.textMuted
          }
          editable={!processing}
        />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator
            color={Colors.accent}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {filteredExercises.map(
            (exercise) => {
              const selected =
                selectedExercises.some(
                  (item) =>
                    item.exerciseId ===
                    exercise.id,
                );

              return (
                <Pressable
                  key={exercise.id}
                  disabled={processing}
                  style={[
                    styles.exerciseRow,
                    selected &&
                      styles.exerciseRowSelected,
                    processing &&
                      styles.disabledRow,
                  ]}
                  onPress={() =>
                    selectExercise(
                      exercise,
                    )
                  }
                >
                  <View
                    style={
                      styles.exerciseInfo
                    }
                  >
                    <Text
                      style={
                        styles.exerciseName
                      }
                    >
                      {exercise.name}
                    </Text>

                    {exercise.description && (
                      <Text
                        style={
                          styles.description
                        }
                        numberOfLines={2}
                      >
                        {
                          exercise.description
                        }
                      </Text>
                    )}

                    <Text
                      style={
                        styles.measurement
                      }
                    >
                      {
                        exercise.measurementType
                      }
                    </Text>
                  </View>

                  <Text
                    style={
                      selected
                        ? styles.selectedText
                        : styles.addText
                    }
                  >
                    {selected ? "✓" : "+"}
                  </Text>
                </Pressable>
              );
            },
          )}

          {filteredExercises.length ===
            0 && (
            <View style={styles.empty}>
              <Text
                style={styles.emptyText}
              >
                No exercises found.
              </Text>
            </View>
          )}

          {mode === "freestyle" &&
            selectedExercises.length > 0 && (
              <Pressable
                style={[
                  styles.startButton,
                  processing &&
                    styles.disabledStartButton,
                ]}
                disabled={processing}
                onPress={finishSelection}
              >
                <Text
                  style={
                    styles.startButtonText
                  }
                >
                  {processing
                    ? "STARTING..."
                    : `START WORKOUT (${selectedExercises.length})`}
                </Text>
              </Pressable>
            )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  header: {
    minHeight: 58,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  backText: {
    color: Colors.text,
    fontSize: 28,
    lineHeight: 30,
  },

  title: {
    flex: 1,
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  headerSpacer: {
    width: 42,
  },

  searchContainer: {
    padding: 12,
  },

  searchInput: {
    height: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 7,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: 15,
  },

  content: {
    paddingHorizontal: 12,
    paddingBottom: 32,
  },

  exerciseRow: {
    minHeight: 70,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 7,
    backgroundColor: Colors.surface,
  },

  exerciseRowSelected: {
    borderColor: Colors.accent,
  },

  disabledRow: {
    opacity: 0.5,
  },

  exerciseInfo: {
    flex: 1,
  },

  exerciseName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "800",
  },

  description: {
    marginTop: 3,
    color: Colors.textMuted,
    fontSize: 12,
  },

  measurement: {
    marginTop: 4,
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  addText: {
    marginLeft: 12,
    color: Colors.accent,
    fontSize: 25,
    fontWeight: "700",
  },

  selectedText: {
    marginLeft: 12,
    color: Colors.accent,
    fontSize: 22,
    fontWeight: "900",
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  empty: {
    paddingVertical: 50,
    alignItems: "center",
  },

  emptyText: {
    color: Colors.textMuted,
    fontSize: 15,
  },

  startButton: {
    marginTop: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 7,
    backgroundColor: Colors.accent,
  },

  disabledStartButton: {
    opacity: 0.5,
  },

  startButtonText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
});