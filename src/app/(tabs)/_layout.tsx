import { Tabs } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  type ColorValue,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/context/theme-context";
import { formatTime } from "@/utils/duration";
import { useWorkout } from "@/context/workout-context";

function WorkoutHeader() {
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  const { startedAt, restEndsAt } = useWorkout();

  const insets = useSafeAreaInsets();

  const [now, setNow] = useState<number>(() => Date.now());


  useEffect(() => {
    if (!startedAt) {
      return;
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => clearInterval(interval);
  }, [startedAt, restEndsAt]);


  if (!startedAt || now === null) {
    return null;
  }

  const isResting =
    restEndsAt !== null &&
    restEndsAt > now;

  const timer = formatTime(isResting
    ? Math.max(0, Math.ceil((restEndsAt - now) / 1000))
    : Math.max(0, Math.floor((now - startedAt) / 1000)));

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

      <View style={styles.headerSide} />
    </View>
  );
}

type TabIconName = SymbolViewProps["name"];

function TabIcon({ name, color, size }: { name: TabIconName; color: ColorValue; size: number }) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}

export default function TabLayout() {
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
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

const createStyles = (Colors: AppPalette) => StyleSheet.create({
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
