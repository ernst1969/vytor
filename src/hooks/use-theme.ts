import { useAppTheme } from "@/context/theme-context";
export function useTheme() {
  const { colors } = useAppTheme();
  return { ...colors, backgroundElement: colors.surface, backgroundSelected: colors.border, textSecondary: colors.textMuted };
}
