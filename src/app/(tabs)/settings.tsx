import { useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/context/theme-context";
import { useWorkout } from "@/context/workout-context";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatTime, parseTime } from "@/utils/duration";
import { request, getSettings, logoutUser, updateSettings, type UserSettings } from "@/services/api";


export default function SettingsScreen() {
  const { colors: Colors, setPreference } = useAppTheme();
  const styles = createStyles(Colors);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { applySettings } = useWorkout();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [restInput, setRestInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState<"logout" | "delete" | "password" | null>(null);
  async function accountAction() {
    if (saving) return;
    setSaving(true);
    try {
      if (dialog === "delete") await request("/account", "DELETE", { password: currentPassword });
      if (dialog === "password") await request("/account/password", "PUT", { currentPassword, password });
      await logoutUser();
      router.replace("/login");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not update account"); }
    finally { setSaving(false); setDialog(null); }
  }


  useEffect(() => {
    getSettings().then(setSettings).catch((error) =>
      setMessage(error instanceof Error ? error.message : "Could not load settings"),
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
      setPreference(updated.theme);
    } catch (error) {
      setSettings(previous);
      setMessage(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }


  if (!settings) {
    return <View style={styles.center}>{message ? <><Text accessibilityRole="alert" style={styles.label}>{message}</Text><Pressable style={styles.option} onPress={() => { setMessage(""); void getSettings().then(setSettings).catch((cause) => setMessage(cause.message)); }}><Text style={styles.optionText}>Retry</Text></Pressable></> : <ActivityIndicator color={Colors.accent} />}</View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.label}>Units are chosen in each exercise’s options.</Text>
      <Text style={styles.label}>DEFAULT REST TIMER (mm:ss, up to 60 minutes)</Text>
      <TextInput accessibilityLabel="Default rest duration" style={styles.field} placeholder={formatTime(settings.restSeconds)} placeholderTextColor={Colors.textMuted} value={restInput} onChangeText={setRestInput} keyboardType="number-pad" />
      <Pressable style={styles.option} disabled={saving} onPress={() => { const seconds = parseTime(restInput); if (seconds === null || seconds > 3600) { setMessage("Enter a valid timer up to 01:00:00"); return; } void save({ restSeconds: seconds }); }}><Text style={styles.optionText}>Save timer</Text></Pressable>
      <SettingGroup label="APPEARANCE">
        {(["SYSTEM", "LIGHT", "DARK"] as const).map((value) => <Option key={value} label={value.charAt(0) + value.slice(1).toLowerCase()} selected={settings.theme === value} onPress={() => save({ theme: value })} />)}
      </SettingGroup>

      {!!message && <Text accessibilityRole="alert" style={styles.label}>{message}</Text>}
      <Text style={styles.label}>FEEDBACK</Text>
      <Text style={styles.label}>Your message and account ID are stored for the Vytor team. Avoid sensitive information. Deleting your account also deletes feedback.</Text>
      <TextInput accessibilityLabel="Feedback" multiline maxLength={5000} style={styles.field} value={feedback} onChangeText={setFeedback} placeholder="Your feedback" placeholderTextColor={Colors.textMuted} />
      <Pressable disabled={saving} style={styles.option} onPress={() => { setSaving(true); void request("/feedback", "POST", { message: feedback }).then(() => { setFeedback(""); setMessage("Feedback delivered to the team inbox"); }).catch((cause) => setMessage(cause.message)).finally(() => setSaving(false)); }}><Text style={styles.optionText}>Send feedback</Text></Pressable>
      <Text style={[styles.label, { marginTop: 24 }]}>ACCOUNT</Text>
      <TextInput accessibilityLabel="Current password" style={styles.field} secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" placeholderTextColor={Colors.textMuted} />
      <TextInput accessibilityLabel="New password" style={styles.field} secureTextEntry value={password} onChangeText={setPassword} placeholder="New password (8–72 characters)" placeholderTextColor={Colors.textMuted} />
      <Pressable disabled={saving} style={styles.option} onPress={() => setDialog("password")}><Text style={styles.optionText}>Change password</Text></Pressable>
      <Pressable disabled={saving} style={styles.option} onPress={() => setDialog("delete")}><Text style={styles.optionText}>Delete account</Text></Pressable>
      <ConfirmDialog visible={dialog !== null} busy={saving} title={dialog === "delete" ? "Delete account permanently?" : dialog === "password" ? "Change password?" : "Log out?"} message={dialog === "delete" ? "Your profile, sessions, workouts, templates, friendships and feedback will be deleted. Enter your current password first." : dialog === "password" ? "All sessions will be ended. Sign in again with your new password." : "Log out of this device?"} onCancel={() => setDialog(null)} onConfirm={() => void accountAction()} />
      <Pressable onPress={() => setDialog("logout")} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

function SettingGroup({ label, children }: { label: string; children: ReactNode }) {
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  return <View style={styles.group}><Text style={styles.label}>{label}</Text><View style={styles.options}>{children}</View></View>;
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text></Pressable>;
}

const createStyles = (Colors: AppPalette) => StyleSheet.create({
  field: { color: Colors.text, backgroundColor: Colors.surface, minHeight: 48, padding: 12, marginBottom: 12, borderRadius: 8 },
  container: { flex: 1, paddingHorizontal: 20, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background },
  title: { fontSize: 32, fontWeight: "800", marginBottom: 28, color: Colors.text },
  group: { marginBottom: 24 },
  label: { color: Colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.3, marginBottom: 10 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10 },
  optionSelected: { borderColor: Colors.accent, backgroundColor: Colors.surface },
  optionText: { color: Colors.textMuted, fontWeight: "700" },
  optionTextSelected: { color: Colors.text },
  logoutButton: { height: 52, marginTop: 10, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.textMuted },
  logoutText: { fontSize: 17, fontWeight: "700", color: Colors.text },
  pressed: { opacity: 0.65 },
});
