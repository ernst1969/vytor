import { useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import { useWorkout } from "@/context/workout-context";
import { getSettings, logoutUser, updateSettings, type UserSettings } from "@/services/api";

const REST_OPTIONS = [0, 60, 90, 120, 180];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { applySettings } = useWorkout();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings).catch((error) =>
      Alert.alert("Could not load settings", error instanceof Error ? error.message : "Something went wrong."),
    );
  }, []);

  async function save(change: Partial<UserSettings>) {
    if (!settings || saving) return;
    const previous = settings;
    setSettings({ ...settings, ...change });
    setSaving(true);
    try {
      const updated = await updateSettings(change);
      setSettings(updated);
      applySettings(updated);
    } catch (error) {
      setSettings(previous);
      Alert.alert("Could not save settings", error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    Alert.alert("Log out", "Are you sure you want to log out of this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          void logoutUser()
            .then(() => router.replace("/login"))
            .catch(() => Alert.alert("Logout failed", "Something went wrong while logging out."));
        },
      },
    ]);
  }

  if (!settings) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }}>
      <Text style={styles.title}>Settings</Text>

      <SettingGroup label="WEIGHT UNIT">
        {(["KG", "LBS"] as const).map((value) => <Option key={value} label={value} selected={settings.preferredWeightUnit === value} onPress={() => save({ preferredWeightUnit: value })} />)}
      </SettingGroup>
      <SettingGroup label="DISTANCE UNIT">
        {(["KM", "MI"] as const).map((value) => <Option key={value} label={value} selected={settings.preferredDistanceUnit === value} onPress={() => save({ preferredDistanceUnit: value })} />)}
      </SettingGroup>
      <SettingGroup label="REST TIMER">
        {REST_OPTIONS.map((value) => <Option key={value} label={value === 0 ? "Off" : `${value} sec`} selected={settings.restSeconds === value} onPress={() => save({ restSeconds: value })} />)}
      </SettingGroup>
      <SettingGroup label="APPEARANCE">
        {(["SYSTEM", "LIGHT", "DARK"] as const).map((value) => <Option key={value} label={value.charAt(0) + value.slice(1).toLowerCase()} selected={settings.theme === value} onPress={() => save({ theme: value })} />)}
      </SettingGroup>

      <Pressable onPress={handleLogout} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

function SettingGroup({ label, children }: { label: string; children: ReactNode }) {
  return <View style={styles.group}><Text style={styles.label}>{label}</Text><View style={styles.options}>{children}</View></View>;
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background },
  title: { fontSize: 32, fontWeight: "800", marginBottom: 28, color: Colors.text },
  group: { marginBottom: 24 },
  label: { color: Colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.3, marginBottom: 10 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10 },
  optionSelected: { borderColor: Colors.accent, backgroundColor: "#392A20" },
  optionText: { color: Colors.textMuted, fontWeight: "700" },
  optionTextSelected: { color: Colors.text },
  logoutButton: { height: 52, marginTop: 10, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.textMuted },
  logoutText: { fontSize: 17, fontWeight: "700", color: Colors.text },
  pressed: { opacity: 0.65 },
});
