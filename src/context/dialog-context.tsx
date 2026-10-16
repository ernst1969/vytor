import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useAppTheme } from "@/context/theme-context";
type Button = { text?: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void };
type Dialog = { title: string; message: string; buttons: Button[] };
const DialogContext = createContext({ alert: (_title: string, _message: string, _buttons?: Button[]) => {} });
export function AppDialogProvider({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const alert = useCallback((title: string, message: string, buttons?: Button[]) => setDialog({ title, message, buttons: buttons?.length ? buttons : [{ text: "OK" }] }), []);
  function close() { const cancel = dialog?.buttons.find((button) => button.style === "cancel"); setDialog(null); cancel?.onPress?.(); }
  return <DialogContext.Provider value={{ alert }}>{children}<Modal visible={dialog !== null} transparent animationType="fade" onRequestClose={close}>
    <View style={{ flex: 1, backgroundColor: "#0009", justifyContent: "center", padding: 24 }}><View accessibilityViewIsModal style={{ backgroundColor: colors.surface, padding: 24, borderRadius: 16, maxHeight: "80%" }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>{dialog?.title}</Text>
      <ScrollView><Text style={{ color: colors.textMuted, marginVertical: 20 }}>{dialog?.message}</Text></ScrollView>
      {dialog?.buttons.map((button, index) => <Pressable key={index} accessibilityRole="button" style={{ minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 8, marginTop: 8, backgroundColor: button.style === "cancel" ? colors.background : colors.accent }} onPress={() => { setDialog(null); button.onPress?.(); }}><Text style={{ color: button.style === "cancel" ? colors.text : "#fff", fontWeight: "700" }}>{button.text ?? "OK"}</Text></Pressable>)}
    </View></View>
  </Modal></DialogContext.Provider>;
}
export const useAppDialog = () => useContext(DialogContext);
