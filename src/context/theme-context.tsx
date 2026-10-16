import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { DarkPalette, LightPalette } from "@/constants/theme";
const ThemeContext = createContext({ colors: DarkPalette, dark: true, setPreference: (_value: "SYSTEM" | "LIGHT" | "DARK") => {} });
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<"SYSTEM" | "LIGHT" | "DARK">("SYSTEM");
  useEffect(() => { void AsyncStorage.getItem("vytor_theme").then((value) => { if (value === "LIGHT" || value === "DARK") setPreference(value); }); }, []);
  const dark = preference === "DARK" || (preference === "SYSTEM" && system === "dark");
  return <ThemeContext.Provider value={{ colors: dark ? DarkPalette : LightPalette, dark, setPreference: (value) => { setPreference(value); void AsyncStorage.setItem("vytor_theme", value); } }}>{children}</ThemeContext.Provider>;
}
export const useAppTheme = () => useContext(ThemeContext);
