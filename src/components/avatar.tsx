import { useState } from "react";
import { Image, Text, View } from "react-native";
import { useAppTheme } from "@/context/theme-context";
export function Avatar({ uri, name, size = 44 }: { uri?: string | null; name: string; size?: number }) {
  const { colors } = useAppTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return <View accessibilityLabel={`${name} profile picture`} style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: "center", alignItems: "center" }}>
    {uri && failedUri !== uri ? <Image source={{ uri }} onError={() => setFailedUri(uri)} style={{ width: size, height: size, borderRadius: size / 2 }} /> : <Text style={{ color: colors.text, fontSize: size * 0.4, fontWeight: "700" }}>{name.trim().charAt(0).toUpperCase() || "?"}</Text>}
  </View>;
}
