import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from "expo-router";
import { useColorScheme } from "react-native";

import { WorkoutProvider } from "@/context/workout-context";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <WorkoutProvider>
      <ThemeProvider
        value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
      >
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </WorkoutProvider>
  );
}