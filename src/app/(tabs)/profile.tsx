import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import { getUser, getWorkoutHistory } from "@/services/api";

type WorkoutSet = {
  id: number;
  setNumber: number;
  weight: number | null;
  reps: number | null;
};

type WorkoutExercise = {
  id: number;
  order: number;
  exercise: {
    id: number;
    name: string;
    description?: string | null;
  };
  sets: WorkoutSet[];
};

type Workout = {
  id: number;
  startedAt: string;
  endedAt: string | null;
  template?: {
    id: number;
    name: string;
  } | null;
  exercises: WorkoutExercise[];
};

type User = {
  id: number;
  username: string;
};

function formatDate(dateString: string) {
  const date = new Date(dateString);

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDuration(
  startedAt: string,
  endedAt: string | null,
) {
  if (!endedAt) {
    return "In progress";
  }

  const durationMs =
    new Date(endedAt).getTime() -
    new Date(startedAt).getTime();

  const minutes = Math.max(
    0,
    Math.round(durationMs / 60000),
  );

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function getWorkoutTitle(workout: Workout) {
  if (workout.template?.name) {
    return workout.template.name;
  }

  if (workout.exercises.length === 0) {
    return "Workout";
  }

  if (workout.exercises.length === 1) {
    return workout.exercises[0].exercise.name;
  }

  return `${workout.exercises[0].exercise.name} + ${
    workout.exercises.length - 1
  } more`;
}

function getSetCount(workout: Workout) {
  return workout.exercises.reduce(
    (total, exercise) => total + exercise.sets.length,
    0,
  );
}

function getLast14Days() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);

    date.setDate(today.getDate() - (13 - index));

    return date;
  });
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<User | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setError(null);

      const storedUserId =
        await AsyncStorage.getItem("vytor_user_id");

      const userId = Number(storedUserId);

      if (!Number.isInteger(userId)) {
        throw new Error("No valid logged-in user found.");
      }

      const [userData, workoutData] = await Promise.all([
        getUser(userId),
        getWorkoutHistory(userId),
      ]);

      setUser(userData);

      setWorkouts(
        Array.isArray(workoutData)
          ? workoutData
          : [],
      );
    } catch (err) {
      console.error(
        "Failed to load profile:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not load your profile.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  function handleRefresh() {
    setRefreshing(true);
    loadProfile();
  }

  const activityDays = getLast14Days();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={Colors.accent}
        />
      </View>
    );
  }

  if (error || !user) {
    return (
      <View
        style={[
          styles.errorContainer,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <Text style={styles.errorTitle}>
          Could not load profile
        </Text>

        <Text style={styles.errorText}>
          {error ?? "Something went wrong."}
        </Text>

        <Pressable
          style={styles.retryButton}
          onPress={loadProfile}
        >
          <Text style={styles.retryButtonText}>
            Try again
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 40,
        },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={Colors.accent}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.username.charAt(0).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.username}>
          {user.username}
        </Text>
      </View>

      {/* Level / Rank */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>LEVEL</Text>

          <Text style={styles.statValue}>12</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>RANK</Text>

          <Text style={styles.statValue}>#42</Text>
        </View>
      </View>

      {/* Recent workouts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          RECENT WORKOUTS
        </Text>

        <View style={styles.activityGrid}>
          {activityDays.map((day) => {
            const workedOut = workouts.some(
              (workout) =>
                isSameDay(
                  new Date(
                    workout.endedAt ??
                      workout.startedAt,
                  ),
                  day,
                ),
            );

            return (
              <View
                key={day.toISOString()}
                style={[
                  styles.activityDay,
                  workedOut &&
                    styles.activityDayCompleted,
                ]}
              >
                {workedOut && (
                  <View style={styles.activityDot} />
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.activityLabels}>
          <Text style={styles.activityLabel}>
            {activityDays[0].toLocaleDateString(
              undefined,
              {
                month: "short",
                day: "numeric",
              },
            )}
          </Text>

          <Text style={styles.activityLabel}>
            Today
          </Text>
        </View>
      </View>

      {/* Workout feed */}
      <View style={styles.section}>
        <View style={styles.feedHeader}>
          <Text style={styles.sectionTitle}>
            WORKOUTS
          </Text>

          <Text style={styles.workoutCount}>
            {workouts.length}
          </Text>
        </View>

        {workouts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              No workouts yet
            </Text>

            <Text style={styles.emptyText}>
              Complete your first workout and it will
              appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.feed}>
            {workouts.map((workout) => (
              <Pressable
                key={workout.id}
                style={({ pressed }) => [
                  styles.workoutCard,
                  pressed &&
                    styles.workoutCardPressed,
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/workout-detail",
                    params: {
                      workoutId: String(
                        workout.id,
                      ),
                    },
                  })
                }
              >
                <View style={styles.workoutCardMain}>
                  <Text style={styles.workoutTitle}>
                    {getWorkoutTitle(workout)}
                  </Text>

                  <Text style={styles.workoutDate}>
                    {formatDate(
                      workout.endedAt ??
                        workout.startedAt,
                    )}
                    {" · "}
                    {formatDuration(
                      workout.startedAt,
                      workout.endedAt,
                    )}
                  </Text>

                  <Text style={styles.workoutSummary}>
                    {workout.exercises.length}{" "}
                    {workout.exercises.length === 1
                      ? "exercise"
                      : "exercises"}
                    {" · "}
                    {getSetCount(workout)}{" "}
                    {getSetCount(workout) === 1
                      ? "set"
                      : "sets"}
                  </Text>
                </View>

                <Text style={styles.chevron}>
                  ›
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  content: {
    paddingHorizontal: 20,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },

  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: Colors.background,
  },

  errorTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },

  errorText: {
    color: Colors.textMuted,
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
  },

  retryButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },

  retryButtonText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: "700",
  },

  profileHeader: {
    alignItems: "center",
    marginBottom: 26,
  },

  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  avatarText: {
    color: Colors.text,
    fontSize: 36,
    fontWeight: "700",
  },

  username: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: "700",
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    minHeight: 88,
    marginBottom: 30,
  },

  statCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  statDivider: {
    width: 1,
    height: 42,
    backgroundColor: Colors.border,
  },

  statLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 5,
  },

  statValue: {
    color: Colors.text,
    fontSize: 25,
    fontWeight: "700",
  },

  section: {
    marginBottom: 30,
  },

  sectionTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 14,
  },

  activityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  activityDay: {
    width: 40,
    height: 40,
    backgroundColor: Colors.surface,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  activityDayCompleted: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },

  activityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.background,
  },

  activityLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },

  activityLabel: {
    color: Colors.textMuted,
    fontSize: 11,
  },

  feedHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  workoutCount: {
    color: Colors.textMuted,
    fontSize: 13,
    marginLeft: 8,
    marginBottom: 14,
  },

  feed: {
    gap: 10,
  },

  workoutCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 17,
  },

  workoutCardPressed: {
    opacity: 0.7,
  },

  workoutCardMain: {
    flex: 1,
  },

  workoutTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },

  workoutDate: {
    color: Colors.textMuted,
    fontSize: 13,
    marginBottom: 5,
  },

  workoutSummary: {
    color: Colors.textMuted,
    fontSize: 12,
  },

  chevron: {
    color: Colors.textMuted,
    fontSize: 30,
    fontWeight: "300",
    marginLeft: 12,
  },

  emptyState: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
  },

  emptyTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },

  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
});