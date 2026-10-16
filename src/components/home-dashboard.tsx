import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Layout, type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/context/theme-context";
import { getUser, getWorkoutHistory } from "@/services/api";
import { useLocalDay } from "@/hooks/use-local-day";
import { localCalendarDay, workoutStreak } from "@/utils/workout-streak";
import { ProgressBar } from "@/components/progress-bar";

const motivations = [
  "Show up. Put in the work.", "One workout at a time.", "Consistency beats motivation.",
  "Earn your progress.", "Get stronger every day.", "The work adds up.",
  "Make today count.", "Progress starts with showing up.",
];
type UserProgress = { level: number; xp: number; rank: number; levelStartXp: number; nextLevelXp: number };
type HistoryWorkout = {
  id: number; startedAt: string; endedAt: string | null; template?: { name: string } | null;
  exercises: { exercise: { name: string } }[];
};

export function HomeDashboard() {
  const { colors, dark } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [motivation] = useState(() => motivations[Math.floor(Math.random() * motivations.length)]);
  const [user, setUser] = useState<UserProgress | null>(null);
  const [workouts, setWorkouts] = useState<HistoryWorkout[]>([]);
  const { now, refresh: refreshDay } = useLocalDay();
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("vytor_user_id");
      if (!stored) throw new Error("Sign in to see your progress.");
      const [progress, history] = await Promise.all([getUser(Number(stored)), getWorkoutHistory(Number(stored))]);
      setUser(progress);
      setWorkouts((Array.isArray(history) ? history as HistoryWorkout[] : []).filter((workout) => workout.endedAt && Number.isFinite(new Date(workout.endedAt).getTime()) && new Date(workout.endedAt) <= new Date())
        .sort((a, b) => new Date(b.endedAt!).getTime() - new Date(a.endedAt!).getTime()));
      refreshDay();
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load your progress."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [refreshDay]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const streak = workoutStreak(workouts, now);
  const monthCount = workouts.filter((workout) => {
    const completed = new Date(workout.endedAt!);
    return completed.getFullYear() === now.getFullYear() && completed.getMonth() === now.getMonth();
  }).length;
  const workoutDate = (endedAt: string) => {
    const completed = new Date(endedAt);
    const days = localCalendarDay(now) - localCalendarDay(completed);
    return days === 0 ? "Today" : days === 1 ? "Yesterday" : days < 7 ? `${days} days ago` : completed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return <View style={styles.backdrop}>
    {dark && <Svg width="100%" height="100%" pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Defs><RadialGradient id="home-glow" cx="50%" cy="45%" r="75%"><Stop offset="0" stopColor="#343834" stopOpacity={0.28} /><Stop offset="1" stopColor="#080A09" stopOpacity={0.45} /></RadialGradient></Defs>
      <Rect width="100%" height="100%" fill="url(#home-glow)" />
    </Svg>}
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 50, paddingBottom: Math.max(insets.bottom, 24), paddingLeft: Layout.pagePadding + insets.left, paddingRight: Layout.pagePadding + insets.right }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.accent} />}>
    <View style={styles.brand}>
      <Text accessibilityRole="header" style={styles.wordmark}>VYTOR</Text>
      <View style={styles.brandLine} />
    </View>
    <View style={styles.intro}>
      <Text style={styles.heading}>Ready to train?</Text>
      <Text testID="home-motivation" style={styles.motivation}>{motivation}</Text>
    </View>
    <Pressable accessibilityRole="button" onPress={() => router.push("/workout-setup")} style={({ pressed }) => [styles.start, pressed && styles.pressed]}>
      {dark && <Svg width="100%" height="100%" pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Defs><LinearGradient id="start-fill" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#EC9A40" /><Stop offset="1" stopColor="#DF872C" /></LinearGradient></Defs>
        <Rect width="100%" height="100%" fill="url(#start-fill)" />
      </Svg>}
      <Text style={styles.startText}>START WORKOUT</Text>
    </Pressable>

    <View style={styles.progressCard}>
      {user ? <>
        <View style={styles.progressHeading}><Text style={styles.level}>Level {user.level}</Text><Text style={styles.xp}>{user.xp - user.levelStartXp} / {user.nextLevelXp - user.levelStartXp} XP</Text></View>
        <ProgressBar current={user.xp - user.levelStartXp} total={user.nextLevelXp - user.levelStartXp} />
        <View style={styles.metrics}>
          <View style={[styles.metric, styles.monthMetric]}><Text style={styles.monthValue}>{monthCount}</Text><Text style={styles.metricLabel}>Workouts</Text><Text style={styles.metricSubLabel}>this month</Text></View>
          <View style={styles.metricDivider} />
          <View accessible accessibilityLabel={`${streak} day workout streak`} style={styles.metric}>
            <SymbolView name={{ ios: "flame.fill", android: "local_fire_department", web: "local_fire_department" }} size={26} tintColor={colors.accent} />
            <Text testID="home-streak" style={styles.metricValue}>{streak}</Text><Text style={styles.metricCaption}>Day streak</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <SymbolView name={{ ios: "trophy.fill", android: "emoji_events", web: "emoji_events" }} size={26} tintColor={colors.accent} />
            <Text style={styles.metricValue}>#{user.rank}</Text><Text style={styles.metricCaption}>Global rank</Text>
          </View>
        </View>
      </> : <View style={styles.loading}>{loading ? <ActivityIndicator color={colors.accent} accessibilityLabel="Loading progress" /> : <Text style={styles.motivation}>Progress unavailable</Text>}</View>}
    </View>
    {!!error && <View style={styles.error}><Text accessibilityRole="alert" style={styles.motivation}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View>}

    <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>Recent Workouts</Text>
      {workouts.length > 3 && <Pressable accessibilityRole="button" onPress={() => setShowAll((value) => !value)} style={styles.seeAll}><Text style={styles.seeAllText}>{showAll ? "Show less" : "See all"}</Text></Pressable>}
    </View>
    <View style={styles.historyCard}>
      {loading && !user ? <View style={styles.empty}><ActivityIndicator color={colors.accent} /></View> : workouts.length ? (showAll ? workouts : workouts.slice(0, 3)).map((workout, index) => {
        const duration = Math.max(0, Math.round((new Date(workout.endedAt!).getTime() - new Date(workout.startedAt).getTime()) / 60000));
        const title = workout.template?.name || workout.exercises[0]?.exercise.name || "Workout";
        return <Pressable key={workout.id} accessibilityRole="button" accessibilityLabel={`Open ${title}`} style={({ pressed }) => [styles.historyRow, index > 0 && styles.rowDivider, pressed && styles.pressed]} onPress={() => router.push({ pathname: "/workout-detail", params: { workoutId: String(workout.id) } })}>
          <View style={styles.historyText}><Text style={styles.workoutTitle}>{title}</Text><Text style={styles.date}>{workoutDate(workout.endedAt!)} · {duration} min</Text></View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>;
      }) : <View style={styles.empty}><Text style={styles.workoutTitle}>{error ? "History unavailable" : "No workouts yet"}</Text><Text style={styles.motivation}>{error ? "Try loading your workouts again." : "Your completed workouts will appear here."}</Text></View>}
    </View>
  </ScrollView></View>;
}

const createStyles = (colors: AppPalette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1 },
  content: { width: "100%", maxWidth: Layout.contentWidth, alignSelf: "center" },
  brand: { alignItems: "center", marginBottom: 64 },
  wordmark: { color: colors.text, fontSize: 22, fontWeight: "800", letterSpacing: 10, paddingLeft: 10 },
  brandLine: { backgroundColor: colors.accent, width: 34, height: 4, marginTop: 10, borderRadius: 2 },
  intro: { alignItems: "center", marginBottom: 24, gap: 8 },
  heading: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.5, textAlign: "center" },
  motivation: { color: colors.textMuted, fontSize: 16, lineHeight: 23, textAlign: "center" },
  start: { overflow: "hidden", backgroundColor: colors.accent, minHeight: 52, borderRadius: 10, alignItems: "center", justifyContent: "center", padding: 14, marginBottom: 32 },
  startText: { color: colors.onAccent, fontWeight: "800", fontSize: 15, letterSpacing: 1 },
  progressCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Layout.radius, padding: 12, paddingTop: 20, minHeight: 192 },
  progressHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  level: { color: colors.text, fontSize: 15, fontWeight: "800" },
  xp: { color: colors.textMuted, fontSize: 12, fontVariant: ["tabular-nums"] },
  metrics: { flexDirection: "row", alignItems: "center", marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border, marginHorizontal: -12, paddingHorizontal: 12 },
  metric: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, minWidth: 0, minHeight: 88 },
  monthMetric: { alignItems: "flex-start", paddingLeft: 2 },
  monthValue: { color: colors.text, fontWeight: "800", fontSize: 26, marginBottom: 2 },
  metricValue: { color: colors.text, fontWeight: "800", fontSize: 20 },
  metricCaption: { color: colors.textMuted, fontSize: 11, textAlign: "center" },
  metricLabel: { color: colors.text, fontSize: 12, textAlign: "center" },
  metricSubLabel: { color: colors.textMuted, fontSize: 12 },
  metricDivider: { width: 1, height: 86, backgroundColor: colors.border },
  loading: { minHeight: 166, alignItems: "center", justifyContent: "center" },
  error: { marginTop: 16, alignItems: "center" },
  retry: { minHeight: 44, justifyContent: "center", paddingHorizontal: 20 },
  retryText: { color: colors.accent, fontWeight: "700" },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 6, minHeight: 32 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800", flexShrink: 1 },
  seeAll: { minHeight: 44, justifyContent: "center", paddingLeft: 10 },
  seeAllText: { color: colors.text, fontSize: 12 },
  historyCard: { borderWidth: 1, borderColor: colors.border, borderRadius: Layout.radius, backgroundColor: colors.surface, overflow: "hidden" },
  historyRow: { minHeight: 70, flexDirection: "row", alignItems: "center", paddingVertical: 12, marginHorizontal: 12, gap: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  historyText: { flex: 1, minWidth: 0 },
  workoutTitle: { color: colors.text, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  chevron: { color: colors.textMuted, fontSize: 24 },
  empty: { minHeight: 112, padding: 20, alignItems: "center", justifyContent: "center", gap: 8 },
  pressed: { opacity: 0.7 },
});
