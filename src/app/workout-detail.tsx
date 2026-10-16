import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/context/theme-context";
import { formatTime } from "@/utils/duration";
import { SafeAreaView } from "react-native-safe-area-context";
import { getWorkoutDetail } from "@/services/api";

type WorkoutSet = {
  id: number;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  distance: number | null;
  durationSeconds: number | null;
  setType?: "WARMUP" | "REGULAR" | "DROP";
};

type WorkoutExercise = {
  id: number;
  order: number;
  weightUnit: "KG" | "LBS";
  distanceUnit: "KM" | "MI";
  exercise: {
    id: number;
    name: string;
    description?: string | null;
  };
  sets: WorkoutSet[];
};

type Workout = {
  id: number;
  progress?: { xp: number; level: number; levelStartXp: number; nextLevelXp: number };
  highlights?: string[];
  notes?: string;
  xpEvent?: { points: number };
  startedAt: string;
  endedAt: string | null;
  template?: {
    id: number;
    name: string;
  } | null;
  exercises: WorkoutExercise[];
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(
    undefined,
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  );
}

function formatDuration(
  startedAt: string,
  endedAt: string | null,
) {
  if (!endedAt) return "In progress";

  const minutes = Math.max(
    0,
    Math.round(
      (new Date(endedAt).getTime() -
        new Date(startedAt).getTime()) /
        60000,
    ),
  );

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return remaining === 0
    ? `${hours}h`
    : `${hours}h ${remaining}m`;
}

export default function WorkoutDetailScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  const { workoutId } = useLocalSearchParams<{
    workoutId: string;
  }>();

  const [workout, setWorkout] =
    useState<Workout | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    async function loadWorkout() {
      try {
        const id = Number(workoutId);
        if (!Number.isInteger(id) || id < 1) throw new Error("Could not identify this workout.");
        const found = await getWorkoutDetail(id);
        setWorkout(found);
      } catch (err) {
        console.error(
          "Failed to load workout:",
          err,
        );

        setError(
          err instanceof Error
            ? err.message
            : "Could not load workout.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadWorkout();
  }, [workoutId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={Colors.accent}
        />
      </View>
    );
  }

  if (error || !workout) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          Workout unavailable
        </Text>

        <Text style={styles.errorText}>
          {error ?? "This workout could not be found."}
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  const setCount = workout.exercises.reduce(
    (total, exercise) =>
      total + exercise.sets.length,
    0,
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={styles.back}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.title}>
          {workout.template?.name ?? "Workout"}
        </Text>

        <Text style={styles.date}>
          {formatDate(
            workout.endedAt ?? workout.startedAt,
          )}
        </Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {formatDuration(
                workout.startedAt,
                workout.endedAt,
              )}
            </Text>

            <Text style={styles.statLabel}>
              DURATION
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {workout.exercises.length}
            </Text>

            <Text style={styles.statLabel}>
              EXERCISES
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {setCount}
            </Text>

            <Text style={styles.statLabel}>
              SETS
            </Text>
          </View>
        </View>

        <View style={styles.exerciseCard}>
          <Text style={styles.exerciseName}>+{workout.xpEvent?.points ?? 0} XP</Text>
          <Text style={styles.noSets}>Workout complete · 100 base XP</Text>
          {workout.progress && <><Text style={styles.noSets}>Level {workout.progress.level} · {workout.progress.xp} total XP</Text><View accessibilityRole="progressbar" accessibilityValue={{ min: workout.progress.levelStartXp, max: workout.progress.nextLevelXp, now: workout.progress.xp }} style={{ height: 10, backgroundColor: Colors.border, borderRadius: 5, marginTop: 12 }}><View style={{ height: 10, borderRadius: 5, backgroundColor: Colors.accent, width: `${Math.min(100, Math.max(0, (workout.progress.xp - workout.progress.levelStartXp) / (workout.progress.nextLevelXp - workout.progress.levelStartXp) * 100))}%` }} /></View></>}
          {workout.highlights?.map((highlight) => <Text key={highlight} style={[styles.noSets, { color: Colors.accent, marginTop: 8 }]}>★ {highlight}</Text>)}
        </View>
        {!!workout.notes && <Text style={[styles.date, { marginTop: 16 }]}>{workout.notes}</Text>}
        <Text style={styles.sectionTitle}>
          EXERCISES
        </Text>

        <View style={styles.exercises}>
          {workout.exercises.map((exercise) => (
            <View
              key={exercise.id}
              style={styles.exerciseCard}
            >
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseName}>
                  {exercise.exercise.name}
                </Text>

                <Text style={styles.exerciseSetCount}>
                  {exercise.sets.length}{" "}
                  {exercise.sets.length === 1
                    ? "set"
                    : "sets"}
                </Text>
              </View>

              <Text style={styles.noSets}>+{exercise.sets.filter((set) => set.setType !== "WARMUP").length * 10} set XP</Text>
              {exercise.sets.some((set) => set.weight !== null && set.reps !== null) && <Text style={styles.noSets}>Estimated 1RM: {Math.max(...exercise.sets.map((set) => (set.weight ?? 0) * (1 + (set.reps ?? 0) / 30))).toFixed(1)} kg (Epley)</Text>}
              {exercise.sets.length === 0 ? (
                <Text style={styles.noSets}>
                  No recorded sets
                </Text>
              ) : (
                <View style={styles.sets}>
                  <View style={styles.setHeader}>
                    <Text style={styles.setHeaderText}>
                      SET
                    </Text>

                    <Text style={styles.setHeaderText}>DETAILS</Text>
                  </View>

                  {exercise.sets.map((set) => (
                    <View
                      key={set.id}
                      style={styles.setRow}
                    >
                      <Text style={styles.setValue}>
                        {set.setNumber}
                      </Text>

                      <Text style={styles.setValue}>
                        {[
                          set.weight !== null ? `${Number((set.weight * (exercise.weightUnit === "LBS" ? 2.2046226218 : 1)).toFixed(2))} ${exercise.weightUnit === "LBS" ? "lb" : "kg"}` : null,
                          set.reps !== null ? `${set.reps} reps` : null,
                          set.distance !== null ? `${Number((set.distance * (exercise.distanceUnit === "MI" ? 0.6213711922 : 1)).toFixed(2))} ${exercise.distanceUnit === "MI" ? "mi" : "km"}` : null,
                          set.durationSeconds !== null ? formatTime(set.durationSeconds) : null,
                        ].filter(Boolean).join(" · ") || "—"}
                        {set.setType && set.setType !== "REGULAR" ? ` (${set.setType.toLowerCase()})` : ""}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (Colors: AppPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: Colors.background,
  },

  back: {
    marginBottom: 22,
  },

  backText: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: "600",
  },

  title: {
    color: Colors.text,
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 7,
  },

  date: {
    color: Colors.textMuted,
    fontSize: 14,
    marginBottom: 24,
  },

  stats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 18,
    marginBottom: 30,
  },

  stat: {
    flex: 1,
    alignItems: "center",
  },

  statValue: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 5,
  },

  statLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  divider: {
    width: 1,
    height: 35,
    backgroundColor: Colors.border,
  },

  sectionTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 14,
  },

  exercises: {
    gap: 12,
  },

  exerciseCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 17,
  },

  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  exerciseName: {
    flex: 1,
    color: Colors.text,
    fontSize: 17,
    fontWeight: "700",
  },

  exerciseSetCount: {
    color: Colors.textMuted,
    fontSize: 12,
    marginLeft: 12,
  },

  sets: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  setHeader: {
    flexDirection: "row",
    paddingVertical: 9,
  },

  setHeaderText: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "center",
  },

  setRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 11,
  },

  setValue: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    textAlign: "center",
  },

  noSets: {
    color: Colors.textMuted,
    fontSize: 13,
  },

  errorTitle: {
    color: Colors.text,
    fontSize: 21,
    fontWeight: "700",
    marginBottom: 8,
  },

  errorText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 22,
  },

  backButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
  },

  backButtonText: {
    color: Colors.background,
    fontWeight: "700",
  },
});
