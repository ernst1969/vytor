import { View } from "react-native";
import { useAppTheme } from "@/context/theme-context";

export function ProgressBar({ current, total }: { current: number; total: number }) {
  const { colors } = useAppTheme();
  const fraction = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;
  return <View accessibilityRole="progressbar" accessibilityLabel="Level progress" accessibilityValue={{ min: 0, max: Math.max(0, total), now: Math.max(0, Math.min(current, total)) }} style={{ height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: colors.border }}>
    <View style={{ width: `${fraction * 100}%`, height: "100%", backgroundColor: colors.accent }} />
  </View>;
}
