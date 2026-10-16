import { useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Layout, type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/context/theme-context";
import { useWorkout } from "@/context/workout-context";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { request, getSettings, logoutUser, updateSettings, type UserSettings } from "@/services/api";

type Panel = "rest" | "appearance" | "feedback" | "password" | "delete";
const themeLabel = (theme: UserSettings["theme"]) => theme.charAt(0) + theme.slice(1).toLowerCase();
const restLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default function SettingsScreen() {
  const { colors: Colors, setPreference } = useAppTheme();
  const styles = createStyles(Colors);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { applySettings } = useWorkout();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Panel | null>(null);
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [feedback, setFeedback] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState<"logout" | "delete" | "password" | null>(null);

  async function load() {
    try { setSettings(await getSettings()); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not load settings"); }
  }
  useEffect(() => {
    let active = true;
    getSettings().then((value) => { if (active) setSettings(value); }).catch((cause) => { if (active) setMessage(cause instanceof Error ? cause.message : "Could not load settings"); });
    return () => { active = false; };
  }, []);

  function toggle(panel: Panel) {
    if (saving) return;
    setMessage("");
    setCurrentPassword("");
    setPassword("");
    if (panel === "rest" && settings) {
      setMinutes(String(Math.floor(settings.restSeconds / 60)));
      setSeconds(String(settings.restSeconds % 60).padStart(2, "0"));
    }
    setExpanded(expanded === panel ? null : panel);
  }

  async function save(change: Partial<UserSettings>) {
    if (!settings || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const updated = await updateSettings(change);
      setSettings(updated);
      applySettings(updated);
      setPreference(updated.theme);
      setExpanded(null);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not save settings"); }
    finally { setSaving(false); }
  }

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

  function action(label: string, onPress: () => void, disabled = false, destructive = false) {
    return <Pressable accessibilityRole="button" disabled={saving || disabled} onPress={onPress} style={[styles.action, destructive && styles.destructiveAction, (saving || disabled) && styles.disabled]}><Text style={styles.actionText}>{saving ? "Saving…" : label}</Text></Pressable>;
  }

  function panel(id: Panel, title: string, detail: string, children: ReactNode, destructive = false) {
    const open = expanded === id;
    return <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open, disabled: saving }} disabled={saving} onPress={() => toggle(id)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.rowText}><Text style={[styles.rowTitle, destructive && styles.dangerText]}>{title}</Text><Text style={styles.detail}>{detail}</Text></View>
        <Text style={styles.chevron}>{open ? "−" : "+"}</Text>
      </Pressable>
      {open && <View style={styles.panel}>{children}</View>}
    </View>;
  }

  if (!settings) return <View style={styles.center}>{message ? <><Text accessibilityRole="alert" style={styles.helper}>{message}</Text>{action("Retry", () => { setMessage(""); void load(); })}</> : <ActivityIndicator color={Colors.accent} />}</View>;

  return <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ width: "100%", maxWidth: Layout.contentWidth, alignSelf: "center", paddingLeft: Layout.pagePadding + insets.left, paddingRight: Layout.pagePadding + insets.right, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
    <Text style={styles.title}>Settings</Text>
    <Text style={styles.section}>TRAINING</Text>
    {panel("rest", "Rest timer", restLabel(settings.restSeconds), <>
      <Text style={styles.helper}>Default pause between sets. Individual exercises can use their own timer.</Text>
      <View style={styles.timeRow}>
        <View style={styles.timeField}><Text style={styles.fieldLabel}>Minutes</Text><TextInput accessibilityLabel="Rest minutes" keyboardType="number-pad" maxLength={2} value={minutes} onChangeText={(value) => { if (/^\d*$/.test(value)) setMinutes(value); }} style={styles.timeInput} /></View>
        <Text style={styles.colon}>:</Text>
        <View style={styles.timeField}><Text style={styles.fieldLabel}>Seconds</Text><TextInput accessibilityLabel="Rest seconds" keyboardType="number-pad" maxLength={2} value={seconds} onChangeText={(value) => { if (/^\d*$/.test(value)) setSeconds(value); }} style={styles.timeInput} /></View>
      </View>
      {action("Save timer", () => {
        const total = Number(minutes) * 60 + Number(seconds);
        if (!minutes || !seconds || Number(seconds) > 59 || total > 3600) { setMessage("Choose a duration from 0:00 to 60:00. Seconds must be below 60."); return; }
        void save({ restSeconds: total });
      })}
    </>)}
    {panel("appearance", "Appearance", themeLabel(settings.theme), <View style={styles.themeOptions}>
      {(["SYSTEM", "LIGHT", "DARK"] as const).map((theme) => <Pressable key={theme} accessibilityRole="button" accessibilityState={{ selected: settings.theme === theme }} disabled={saving} onPress={() => void save({ theme })} style={[styles.themeOption, settings.theme === theme && styles.selected]}><Text style={styles.rowTitle}>{themeLabel(theme)}</Text>{settings.theme === theme && <Text style={styles.check}>✓</Text>}</Pressable>)}
    </View>)}

    <Text style={styles.section}>SUPPORT</Text>
    {panel("feedback", "Send feedback", "Share an idea or report a problem", <>
      <Text style={styles.helper}>Your message and account ID are stored for the Vytor team. Avoid sensitive information. Deleting your account also deletes feedback.</Text>
      <TextInput accessibilityLabel="Feedback" multiline maxLength={5000} style={[styles.field, styles.feedback]} value={feedback} onChangeText={setFeedback} placeholder="What would you like to share?" placeholderTextColor={Colors.textMuted} />
      {action("Send feedback", () => {
        setSaving(true); setMessage("");
        void request("/feedback", "POST", { message: feedback }).then(() => { setFeedback(""); setExpanded(null); setMessage("Feedback sent"); }).catch((cause) => setMessage(cause.message)).finally(() => setSaving(false));
      }, !feedback.trim())}
    </>)}

    <Text style={styles.section}>ACCOUNT</Text>
    {panel("password", "Change password", "Update your sign-in password", <>
      <TextInput accessibilityLabel="Current password" style={styles.field} secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" placeholderTextColor={Colors.textMuted} />
      <TextInput accessibilityLabel="New password" style={styles.field} secureTextEntry value={password} onChangeText={setPassword} placeholder="New password (8–72 characters)" placeholderTextColor={Colors.textMuted} />
      {action("Change password", () => setDialog("password"), !currentPassword || password.length < 8)}
    </>)}
    <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setMessage(""); setDialog("logout"); }} style={({ pressed }) => [styles.logout, pressed && styles.pressed, saving && styles.disabled]}><Text style={styles.rowTitle}>Log out</Text><Text style={styles.chevron}>›</Text></Pressable>
    <Text style={[styles.section, styles.dangerSection]}>DANGER ZONE</Text>
    {panel("delete", "Delete account", "Permanently delete your account and data", <>
      <Text style={styles.helper}>This deletes your profile, workouts, templates, friendships and feedback. Enter your password to continue.</Text>
      <TextInput accessibilityLabel="Password to delete account" style={styles.field} secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" placeholderTextColor={Colors.textMuted} />
      {action("Delete account", () => setDialog("delete"), !currentPassword, true)}
    </>, true)}
    {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
    <ConfirmDialog visible={dialog !== null} busy={saving} title={dialog === "delete" ? "Delete account permanently?" : dialog === "password" ? "Change password?" : "Log out?"} message={dialog === "delete" ? "Your profile, sessions, workouts, templates, friendships and feedback will be deleted permanently." : dialog === "password" ? "All sessions will be ended. Sign in again with your new password." : "Log out of this device?"} onCancel={() => setDialog(null)} onConfirm={() => void accountAction()} />
  </ScrollView>;
}

const createStyles = (Colors: AppPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 12, color: Colors.text },
  section: { color: Colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginTop: 24, marginBottom: 10 },
  card: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, marginBottom: 10, overflow: "hidden" },
  row: { minHeight: 76, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: Colors.text, fontSize: 16, fontWeight: "700" },
  detail: { color: Colors.textMuted, fontSize: 13, marginTop: 5, lineHeight: 18 },
  chevron: { color: Colors.textMuted, fontSize: 24 },
  panel: { padding: 16, paddingTop: 4, gap: 12 },
  helper: { color: Colors.textMuted, fontSize: 13, lineHeight: 20 },
  field: { color: Colors.text, backgroundColor: Colors.background, minHeight: 48, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  feedback: { minHeight: 120, textAlignVertical: "top" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  timeField: { flex: 1, minWidth: 0 },
  fieldLabel: { color: Colors.textMuted, fontSize: 12, marginBottom: 6 },
  timeInput: { color: Colors.text, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, minHeight: 56, fontSize: 24, fontVariant: ["tabular-nums"], textAlign: "center", padding: 8 },
  colon: { color: Colors.textMuted, fontSize: 24, paddingTop: 20 },
  action: { minHeight: 48, paddingHorizontal: 16, justifyContent: "center", alignItems: "center", borderRadius: 10, backgroundColor: Colors.accent },
  actionText: { color: Colors.onAccent, fontWeight: "800", fontSize: 14 },
  destructiveAction: { backgroundColor: "#B83D3D" },
  dangerText: { color: Colors.destructive },
  dangerSection: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: Colors.border },
  disabled: { opacity: 0.45 },
  themeOptions: { gap: 8 },
  themeOption: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selected: { borderColor: Colors.accent },
  check: { color: Colors.accent, fontSize: 20 },
  logout: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, marginBottom: 10, minHeight: 76, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  message: { color: Colors.text, fontSize: 13, lineHeight: 20, marginTop: 16 },
  pressed: { opacity: 0.65 },
});
