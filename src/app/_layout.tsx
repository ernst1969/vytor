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
import { clearLocalSessionIfCurrent, clearLocalSessionIfUserCurrent, getCurrentSession } from "@/services/api";
import { checkStartupSession } from "@/services/session-startup";

function AppNavigator() {
  const { dark, colors } = useAppTheme();
  const router = useRouter();
  const segments = useSegments();

  const [checkingUser, setCheckingUser] = useState(true);

  useEffect(() => {
    async function checkUser() {
      try {
        const result = await checkStartupSession({
          readUserId: () => AsyncStorage.getItem("vytor_user_id"),
          getSession: getCurrentSession,
          clearIfUserCurrent: clearLocalSessionIfUserCurrent,
          clearIfTokenCurrent: clearLocalSessionIfCurrent,
        });
        if (result === "create-user") router.replace("/create-user");
        if (result === "login") router.replace("/login");
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
