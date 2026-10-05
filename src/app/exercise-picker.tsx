import AsyncStorage from "@react-native-async-storage/async-storage";
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

import { Colors } from "@/constants/theme";
import {
    useWorkout,
    type WorkoutExercise,
} from "@/context/workout-context";
import {
    createWorkout,
    getExercises,
} from "@/services/api";

type Exercise = {
  id: number;
  name: string;
  description?: string | null;
};

export default function ExercisePickerScreen() {
  const router = useRouter();

  const { addExercise } = useWorkout();

  const { mode } = useLocalSearchParams<{
    mode?: string;
  }>();

  const [exercises, setExercises] = useState<Exercise[]>([]);
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
      console.error("Failed to load exercises:", error);
    } finally {
      setLoading(false);
    }
  }

  async function selectExercise(exercise: Exercise) {
    const newExercise: WorkoutExercise = {
      id: `exercise-${exercise.id}-${Date.now()}-${Math.random()}`,
      exerciseId: exercise.id,
      name: exercise.name,
      sets: [
        {
          id: `set-${exercise.id}-${Date.now()}-${Math.random()}`,
          setNumber: 1,
          weight: "",
          reps: "",
        },
      ],
    };

    // Starting a brand-new freestyle workout.
    if (mode === "freestyle") {
      try {
        const storedUserId =
          await AsyncStorage.getItem("vytor_user_id");

        if (!storedUserId) {
          throw new Error("No logged-in user found");
        }

        const userId = Number(storedUserId);

        if (!Number.isInteger(userId)) {
          throw new Error("Invalid user ID");
        }

        const workout = await createWorkout(
          userId,
          null,
          [
            {
              exerciseId: exercise.id,
            },
          ],
        );

        const databaseExercise =
          workout.exercises?.[0];

        addExercise({
          ...newExercise,
          workoutExerciseId: databaseExercise?.id,
        });

        router.replace("/workout");
      } catch (error) {
        console.error(
          "Failed to start freestyle workout:",
          error,
        );
      }

      return;
    }

    // Adding an exercise to an already active workout.
    addExercise(newExercise);
    router.back();
  }

  const filteredExercises = exercises.filter(
    (exercise) =>
      exercise.name
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading exercises...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <Text style={styles.title}>ADD EXERCISE</Text>

        <View style={styles.headerSpacer} />
      </View>

      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search exercises..."
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      >
        {filteredExercises.map((exercise) => (
          <Pressable
            key={exercise.id}
            style={styles.exerciseRow}
            onPress={() => selectExercise(exercise)}
          >
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>
                {exercise.name}
              </Text>

              {exercise.description ? (
                <Text style={styles.description}>
                  {exercise.description}
                </Text>
              ) : null}
            </View>

            <Text style={styles.plus}>+</Text>
          </Pressable>
        ))}

        {filteredExercises.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No exercises found.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
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
    width: 44,
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
    fontSize: 30,
    fontWeight: "500",
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