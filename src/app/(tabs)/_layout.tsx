import { Tabs, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import { useWorkout } from "@/context/workout-context";

function WorkoutHeader() {
  const { startedAt, finishWorkout } = useWorkout();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  // null means the timer has not received its first timestamp yet.
  const [now, setNow] = useState<number | null>(null);

  // The Home tab is the only place where the Finish button is shown.
  const isHomeTab =
    segments.length === 1 && segments[0] === "(tabs)";

  useEffect(() => {
    if (!startedAt) {
      // Reset the timer when the workout ends.
      setNow(null);
      return;
    }

    // Set the current time immediately so the timer starts at 00:00:00.
    setNow(Date.now());

    // Keep the timer updating once per second.
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt || now === null) {
    return null;
  }

  // Prevent the timer from ever displaying a negative value.
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - startedAt) / 1000),
  );

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  // Format the timer as HH:MM:SS.
  const timer = [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");

  return (
    <View
      style={[
        styles.workoutHeader,
        {
          // Reserve space for Android's status bar / display cutout.
          paddingTop: insets.top,
          height: 64 + insets.top,
        },
      ]}
    >
      <View style={styles.headerSide} />

      <Text style={styles.timer}>{timer}</Text>

      <View style={styles.headerSide}>
        {isHomeTab && (
          <Pressable
            style={styles.finishButton}
            onPress={finishWorkout}
            hitSlop={12}
          >
            <Text style={styles.checkmark}>✓</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <WorkoutHeader />

      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
            borderTopWidth: 2,

            // Keep the tab bar above Android's system navigation area.
            height: 70 + insets.bottom,
            paddingBottom: insets.bottom,
          },

          tabBarActiveTintColor: Colors.text,
          tabBarInactiveTintColor: Colors.textMuted,
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
          }}
        />

        <Tabs.Screen
          name="friends"
          options={{
            title: "Friends",
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
          }}
        />

        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  workoutHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
  },

  headerSide: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  timer: {
    color: Colors.text,
    fontSize: 22,

    // Keeps the timer digits aligned as they change.
    fontVariant: ["tabular-nums"],
  },

  finishButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  checkmark: {
    color: Colors.accent,
    fontSize: 30,
    fontWeight: "600",
  },
});