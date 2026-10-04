import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  useSegments,
} from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View, useColorScheme } from "react-native";

import { WorkoutProvider } from "@/context/workout-context";
import { getUser } from "@/services/api";

function AppNavigator() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  const [checkingUser, setCheckingUser] = useState(true);

  useEffect(() => {
    async function checkUser() {
      try {
        const storedUserId = await AsyncStorage.getItem("vytor_user_id");

        if (!storedUserId) {
          router.replace("/create-user");
          return;
        }

        const userId = Number(storedUserId);

        if (!Number.isInteger(userId)) {
          await AsyncStorage.removeItem("vytor_user_id");
          router.replace("/create-user");
          return;
        }

        try {
          await getUser(userId);
        } catch {
          // The local user no longer exists on the server.
          await AsyncStorage.removeItem("vytor_user_id");
          router.replace("/create-user");
          return;
        }
      } finally {
        setCheckingUser(false);
      }
    }

    checkUser();
  }, [router]);

  useEffect(() => {
    if (checkingUser) {
      return;
    }

    const firstSegment = segments[0];

    if (!firstSegment) {
      return;
    }
  }, [checkingUser, segments]);

  if (checkingUser) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor:
            colorScheme === "dark"
              ? DarkTheme.colors.background
              : DefaultTheme.colors.background,
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider
      value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <WorkoutProvider>
      <AppNavigator />
    </WorkoutProvider>
  );
}