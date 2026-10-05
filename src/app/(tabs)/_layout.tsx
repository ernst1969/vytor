import { Tabs, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import { useWorkout } from "@/context/workout-context";

function WorkoutHeader() {
  const {
    startedAt,
    finishWorkout,
    restEndsAt,
  } = useWorkout();

  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const [now, setNow] = useState<number | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  const isHomeTab =
    segments.length === 1 && segments[0] === "(tabs)";

  useEffect(() => {
    if (!startedAt) {
      setNow(null);
      return;
    }

    setNow(Date.now());

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => clearInterval(interval);
  }, [startedAt, restEndsAt]);

  async function handleFinishWorkout() {
    if (isFinishing) return;

    try {
      setIsFinishing(true);
      console.log("Finish button pressed");
      await finishWorkout();
      console.log("Workout finished successfully");
    } catch (error) {
      console.error(
        "Failed to finish workout:",
        error,
      );

      Alert.alert(
        "Could not finish workout",
        error instanceof Error
          ? error.message
          : "Something went wrong while saving your workout.",
      );
    } finally {
      setIsFinishing(false);
    }
  }

  if (!startedAt || now === null) {
    return null;
  }

  const isResting =
    restEndsAt !== null &&
    restEndsAt > now;

  let timer: string;

  if (isResting) {
    const remainingSeconds = Math.max(
      0,
      Math.ceil(
        (restEndsAt - now) / 1000,
      ),
    );

    const minutes = Math.floor(
      remainingSeconds / 60,
    );

    const seconds =
      remainingSeconds % 60;

    timer = `${String(minutes).padStart(
      2,
      "0",
    )}:${String(seconds).padStart(
      2,
      "0",
    )}`;
  } else {
    const elapsedSeconds = Math.max(
      0,
      Math.floor(
        (now - startedAt) / 1000,
      ),
    );

    const hours = Math.floor(
      elapsedSeconds / 3600,
    );

    const minutes = Math.floor(
      (elapsedSeconds % 3600) / 60,
    );

    const seconds =
      elapsedSeconds % 60;

    timer = [hours, minutes, seconds]
      .map((value) =>
        String(value).padStart(2, "0"),
      )
      .join(":");
  }

  return (
    <View
      style={[
        styles.workoutHeader,
        {
          paddingTop: insets.top,
          height: 64 + insets.top,
        },
      ]}
    >
      <View style={styles.headerSide} />

      <View style={styles.timerContainer}>
        <Text style={styles.timerLabel}>
          {isResting ? "REST" : "WORKOUT"}
        </Text>

        <Text style={styles.timer}>
          {timer}
        </Text>
      </View>

      <View style={styles.headerSide}>
        {isHomeTab && (
          <Pressable
            style={styles.finishButton}
            onPress={handleFinishWorkout}
            disabled={isFinishing}
            hitSlop={12}
          >
            <Text
              style={[
                styles.checkmark,
                isFinishing &&
                  styles.checkmarkDisabled,
              ]}
            >
              ✓
            </Text>
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

  timerContainer: {
  alignItems: "center",
  justifyContent: "center",
},

timerLabel: {
  color: Colors.textMuted,
  fontSize: 9,
  fontWeight: "800",
  letterSpacing: 1.5,
  marginBottom: 1,
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

  checkmarkDisabled: {
    opacity: 0.4,
  },
});