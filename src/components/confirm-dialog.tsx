import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useAppTheme } from "@/context/theme-context";
export function ConfirmDialog({ title, message, visible, busy, onCancel, onConfirm, confirmLabel = "Confirm" }: { title: string; message: string; visible: boolean; busy?: boolean; onCancel: () => void; onConfirm: () => void; confirmLabel?: string }) {
  const { colors: Colors } = useAppTheme();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0009" }}>
      <View accessibilityViewIsModal style={{ padding: 24, borderRadius: 16, backgroundColor: Colors.surface, maxHeight: "80%" }}>
        <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "800", color: Colors.text }}>{title}</Text>
        <ScrollView><Text style={{ color: Colors.textMuted, marginVertical: 20 }}>{message}</Text></ScrollView>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onConfirm} style={{ minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accent, borderRadius: 8 }}><Text style={{ color: Colors.onAccent, fontWeight: "800" }}>{busy ? "Saving…" : confirmLabel}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}><Text style={{ color: Colors.text }}>Cancel</Text></Pressable>
      </View>
    </View>
  </Modal>;
}
