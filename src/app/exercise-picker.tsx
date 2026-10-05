import { useLocalSearchParams, useRouter } from "expo-router";
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
import { getExercises } from "@/services/api";

type Exercise = {
  id: number;
  name: string;
  description?: string | null;
};

export default function ExercisePickerScreen() {
  const router = useRouter();

  const { mode } = useLocalSearchParams<{
    mode?: string;
  }>();

  const {
    exercises: activeExercises,
    addExercise,
    startWorkout,
  } = useWorkout();

  const [exercises, setExercises] =
    useState<Exercise[]>([]);

  const [selectedExercises, setSelectedExercises] =
    useState<WorkoutExercise[]>([]);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

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

  async function selectExercise(
    exercise: Exercise,
  ) {
    const alreadySelected =
      selectedExercises.some(
        (item) =>
          item.exerciseId === exercise.id,
      );

    if (alreadySelected) {
      return;
    }

    const newExercise: WorkoutExercise = {
      id: `exercise-${exercise.id}-${Date.now()}-${Math.random()}`,
      exerciseId: exercise.id,
      name: exercise.name,
      sets: [
        {
          id: `set-${exercise.id}-${Date.now()}`,
          setNumber: 1,
          weight: "",
          reps: "",
        },
      ],
    };

    if (mode === "freestyle") {
      setSelectedExercises((current) => [
        ...current,
        newExercise,
      ]);

      return;
    }

    await addExercise(newExercise);
    router.back();
  }

  async function finishSelection() {
    if (selectedExercises.length === 0) {
      return;
    }

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
    }
  }

  const filteredExercises = exercises.filter(
    (exercise) =>
      exercise.name
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
      >
        <View style={styles.center}>
          <ActivityIndicator size="large" />

          <Text style={styles.loadingText}>
            Loading exercises...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <Text style={styles.title}>
            ADD EXERCISE
          </Text>

          {mode === "freestyle" ? (
            <Pressable
              style={[
                styles.doneButton,
                selectedExercises.length === 0 &&
                  styles.doneButtonDisabled,
              ]}
              disabled={
                selectedExercises.length === 0
              }
              onPress={finishSelection}
            >
              <Text
                style={[
                  styles.doneText,
                  selectedExercises.length === 0 &&
                    styles.doneTextDisabled,
                ]}
              >
                DONE
              </Text>
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {mode === "freestyle" &&
          selectedExercises.length > 0 && (
            <View style={styles.selectedBar}>
              <Text style={styles.selectedText}>
                {selectedExercises.length} selected
              </Text>

              <Text style={styles.selectedNames}>
                {selectedExercises
                  .map((item) => item.name)
                  .join("  •  ")}
              </Text>
            </View>
          )}

        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises..."
          placeholderTextColor={
            Colors.textMuted
          }
          autoCapitalize="none"
          autoCorrect={false}
        />

        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
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
                  style={[
                    styles.exerciseRow,
                    selected &&
                      styles.exerciseRowSelected,
                  ]}
                  onPress={() =>
                    selectExercise(exercise)
                  }
                >
                  <View
                    style={styles.exerciseInfo}
                  >
                    <Text
                      style={styles.exerciseName}
                    >
                      {exercise.name}
                    </Text>

                    {exercise.description ? (
                      <Text
                        style={
                          styles.description
                        }
                      >
                        {exercise.description}
                      </Text>
                    ) : null}
                  </View>

                  <Text style={styles.plus}>
                    {selected ? "✓" : "+"}
                  </Text>
                </Pressable>
              );
            },
          )}

          {filteredExercises.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No exercises found.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },

  loadingText: {
    marginTop: 12,
    color: Colors.textMuted,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    paddingHorizontal: 8,
  },

  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  backText: {
    color: Colors.text,
    fontSize: 38,
    lineHeight: 38,
  },

  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 1,
    color: Colors.text,
  },

  headerSpacer: {
    width: 72,
  },

  doneButton: {
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: Colors.accent,
  },

  doneButtonDisabled: {
    opacity: 0.35,
  },

  doneText: {
    color: Colors.background,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  doneTextDisabled: {
    color: Colors.text,
  },

  selectedBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    backgroundColor: Colors.surface,
  },

  selectedText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "800",
  },

  selectedNames: {
    marginTop: 3,
    color: Colors.textMuted,
    fontSize: 12,
  },

  searchInput: {
    marginHorizontal: 16,
    marginBottom: 12,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: 16,
  },

  list: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },

  exerciseRowSelected: {
    borderColor: Colors.accent,
  },

  exerciseInfo: {
    flex: 1,
  },

  exerciseName: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: "700",
  },

  description: {
    marginTop: 4,
    color: Colors.textMuted,
    fontSize: 13,
  },

  plus: {
    marginLeft: 12,
    color: Colors.accent,
    fontSize: 25,
    fontWeight: "700",
  },

  empty: {
    padding: 30,
    alignItems: "center",
  },

  emptyText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
});