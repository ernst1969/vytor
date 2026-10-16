import { Tabs, useSegments } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  Alert,
  type ColorValue,
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
    cancelActiveWorkout,
    finishWorkout,
    restEndsAt,
  } = useWorkout();

  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const [now, setNow] = useState<number>(() => Date.now());
  const [isFinishing, setIsFinishing] = useState(false);

  const isHomeTab =
    segments.length === 1 && segments[0] === "(tabs)";

  useEffect(() => {
    if (!startedAt) {
      return;
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => clearInterval(interval);
  }, [startedAt, restEndsAt]);

  async function finishConfirmedWorkout() {
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

  function handleFinishWorkout() {
    if (isFinishing) return;

    Alert.alert(
      "Finish workout?",
      "Completed sets will be saved and count toward your progress.",
      [
        { text: "Keep training", style: "cancel" },
        {
          text: "Finish",
          onPress: () => void finishConfirmedWorkout(),
        },
      ],
    );
  }

  function handleCancelWorkout() {
    Alert.alert("Cancel workout", "Discard this active workout?", [
      { text: "Keep training", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          void cancelActiveWorkout().catch((error) =>
            Alert.alert("Could not cancel workout", error instanceof Error ? error.message : "Something went wrong."),
          );
        },
      },
    ]);
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
      <View style={styles.headerSide}>
        {isHomeTab && (
          <Pressable onPress={handleCancelWorkout} hitSlop={12}>
            <Text style={styles.cancelButton}>×</Text>
          </Pressable>
        )}
      </View>

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

type TabIconName = SymbolViewProps["name"];

function TabIcon({ name, color, size }: { name: TabIconName; color: ColorValue; size: number }) {
  return <SymbolView name={name} tintColor={color} size={size} />;
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
            tabBarIcon: ({ color, size }) => (
              <TabIcon name={{ ios: "house.fill", android: "home", web: "home" }} color={color} size={size} />
            ),
          }}
        />

        <Tabs.Screen
          name="friends"
          options={{
            title: "Friends",
            tabBarIcon: ({ color, size }) => (
              <TabIcon name={{ ios: "person.2.fill", android: "groups", web: "groups" }} color={color} size={size} />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <TabIcon name={{ ios: "person.crop.circle.fill", android: "account_circle", web: "account_circle" }} color={color} size={size} />
            ),
          }}
        />

        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <TabIcon name={{ ios: "gearshape.fill", android: "settings", web: "settings" }} color={color} size={size} />
            ),
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

  cancelButton: {
    color: Colors.textMuted,
    fontSize: 30,
    fontWeight: "300",
  },
});
