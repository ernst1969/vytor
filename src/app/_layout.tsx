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
import { ActivityIndicator, View } from "react-native";

import { AppDialogProvider } from "@/context/dialog-context";
import { AppThemeProvider, useAppTheme } from "@/context/theme-context";
import { WorkoutProvider } from "@/context/workout-context";
import { getUser } from "@/services/api";

function AppNavigator() {
  const { dark, colors } = useAppTheme();
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
        } catch (error) {
          const status = (error as { status?: number }).status;

          if (status === 401 || status === 404) {
            await AsyncStorage.multiRemove(["vytor_user_id", "vytor_session_token"]);
            router.replace("/login");
            return;
          }
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
            colors.background,
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider
      value={{ ...(dark ? DarkTheme : DefaultTheme), colors: { ...(dark ? DarkTheme : DefaultTheme).colors, background: colors.background, card: colors.surface, text: colors.text, primary: colors.accent, border: colors.border } }}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider><AppDialogProvider><WorkoutProvider>
      <AppNavigator />
    </WorkoutProvider></AppDialogProvider></AppThemeProvider>
  );
}
