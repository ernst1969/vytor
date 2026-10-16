import { Avatar } from "@/components/avatar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
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

import { Layout, type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/context/theme-context";
import { ProgressBar } from "@/components/progress-bar";
import { MuscleOverview } from "@/components/muscle-overview";
import { useLocalDay } from "@/hooks/use-local-day";
import { recentWorkoutDays } from "@/utils/recent-workouts";
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
    category?: string | null;
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
  displayName: string | null;
  avatarData: string | null;
  xp: number;
  tier: string;
  nextTierXp: number | null;
  level: number;
  rank: number;
  levelStartXp: number;
  nextLevelXp: number;
};

export default function ProfileScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  const insets = useSafeAreaInsets();

  const { now } = useLocalDay();
  const [user, setUser] = useState<User | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = recentWorkoutDays(workouts, now);

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

  useFocusEffect(useCallback(() => { void loadProfile(); }, [loadProfile]));

  function handleRefresh() {
    setRefreshing(true);
    loadProfile();
  }


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
          paddingTop: insets.top + 24,
          paddingLeft: Layout.pagePadding + insets.left,
          paddingRight: Layout.pagePadding + insets.right,
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
          <Avatar uri={user.avatarData} name={user.displayName || user.username} size={88} />
        </View>

        <Text style={styles.username}>
          {user.displayName || user.username}
        </Text>
        <Text style={styles.handle}>@{user.username}</Text>
        <Pressable style={styles.editProfileButton} onPress={() => router.push("/edit-profile")}>
          <Text style={styles.editProfileText}>EDIT PROFILE</Text>
        </Pressable>
      </View>

      {/* Level / Rank */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>PROGRESS</Text>

          <Text style={styles.statValue}>Level {user.level}</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>GLOBAL RANK</Text>

          <Text style={styles.statValue}>#{user.rank}</Text>
        </View>
      </View>

      <View style={{ marginBottom: 12 }}><ProgressBar current={user.xp - user.levelStartXp} total={user.nextLevelXp - user.levelStartXp} /></View>
      <Text style={styles.xpText}>
        {user.xp - user.levelStartXp} / {user.nextLevelXp - user.levelStartXp} XP to next level
      </Text>

      <Text style={styles.xpText}>{user.tier}{user.nextTierXp ? ` · next tier at ${user.nextTierXp} XP` : " · highest tier"}</Text>
      {/* Workout feed */}
      <View style={styles.section}>
        <View style={styles.feedHeader}>
          <Text style={styles.sectionTitle}>
            RECENT WORKOUTS
          </Text>

          <Text style={styles.workoutCount}>
            {days.filter((day) => day.workout).length}
          </Text>
        </View>

        <View style={styles.workoutGrid}>
          {[0, 1].map((row) => (
            <View key={row} style={styles.workoutGridRow}>
              {Array.from({ length: 7 }, (_, column) => {
                const index = row * 7 + column;
                const { date, workout } = days[index];
                return workout ? (
                  <Pressable
                    key={date.toISOString()}
                    accessibilityRole="button"
                    accessibilityLabel={`Open workout from ${date.toLocaleDateString()}`}
                    style={({ pressed }) => [styles.workoutTile, pressed && { opacity: 0.7 }]}
                    onPress={() => router.push({ pathname: "/workout-detail", params: { workoutId: String(workout.id) } })}
                  >
                    <MuscleOverview exercises={workout.exercises.map((entry) => ({ name: entry.exercise.name, category: entry.exercise.category, sets: entry.sets.length }))} />
                  </Pressable>
                ) : <View key={date.toISOString()} accessibilityLabel={`No workout on ${date.toLocaleDateString()}`} style={styles.workoutTile} />;
              })}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (Colors: AppPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  content: {
    width: "100%",
    maxWidth: Layout.contentWidth,
    alignSelf: "center",
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

  avatarImage: { width: "100%", height: "100%", borderRadius: 46 },

  username: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: "700",
  },

  handle: { marginTop: 4, color: Colors.textMuted, fontSize: 14 },
  editProfileButton: { marginTop: 14, minHeight: 44, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border, borderRadius: Layout.radius, backgroundColor: Colors.surface },
  editProfileText: { color: Colors.text, fontSize: 11, fontWeight: "900", letterSpacing: 0.7 },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    minHeight: 88,
    marginBottom: 16,
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
    fontSize: 22,
    fontWeight: "700",
  },

  xpText: {
    color: Colors.textMuted,
    textAlign: "center",
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },

  workoutGrid: { gap: 7, marginTop: 2 },
  workoutGridRow: { flexDirection: "row", gap: 7 },
  workoutTile: { flex: 1, minWidth: 0, aspectRatio: 0.7, overflow: "hidden", borderRadius: 7, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },

  section: {
    marginBottom: 30,
  },

  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 14,
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

});
