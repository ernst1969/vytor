import { useAppDialog } from "@/context/dialog-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/context/theme-context";
import { getUser, updateProfile } from "@/services/api";

export default function EditProfileScreen() {
  const { alert } = useAppDialog();
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  const [userId, setUserId] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const id = Number(await AsyncStorage.getItem("vytor_user_id"));
        if (!Number.isInteger(id)) throw new Error("No logged-in user found.");
        const user = await getUser(id);
        setUserId(id);
        setUsername(user.username);
        setDisplayName(user.displayName ?? "");
        setAvatarData(user.avatarData ?? null);
      } catch (error) {
        alert("Could not load profile", error instanceof Error ? error.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [alert]);

  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.45,
      base64: true,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) {
      setAvatarData(`data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`);
    }
  }

  async function save() {
    if (!userId || saving) return;
    try {
      setSaving(true);
      await updateProfile(userId, { username, displayName, avatarData });
      router.back();
    } catch (error) {
      alert("Could not save profile", error instanceof Error ? error.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.title}>EDIT PROFILE</Text>
        <Pressable style={styles.headerButton} disabled={saving || loading} onPress={() => void save()}><Text style={styles.save}>SAVE</Text></Pressable>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View> : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.avatar} onPress={() => void choosePhoto().catch((cause) => alert("Could not choose photo", cause instanceof Error ? cause.message : "Try another image"))}>
            {avatarData ? <Image source={{ uri: avatarData }} style={styles.avatarImage} /> : <Text style={styles.avatarInitial}>{(displayName || username).charAt(0).toUpperCase()}</Text>}
          </Pressable>
          <Pressable onPress={() => void choosePhoto().catch((cause) => alert("Could not choose photo", cause instanceof Error ? cause.message : "Try another image"))}><Text style={styles.photoAction}>CHOOSE PHOTO</Text></Pressable>
          {avatarData && <Pressable onPress={() => setAvatarData(null)}><Text style={styles.removePhoto}>REMOVE PHOTO</Text></Pressable>}
          <Text style={styles.label}>DISPLAY NAME</Text>
          <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} maxLength={50} placeholder="Your name" placeholderTextColor={Colors.textMuted} />
          <Text style={styles.label}>USERNAME</Text>
          <View style={styles.usernameInput}><Text style={styles.at}>@</Text><TextInput style={styles.usernameField} value={username} onChangeText={setUsername} autoCapitalize="none" maxLength={24} placeholderTextColor={Colors.textMuted} /></View>
          <Text style={styles.help}>2–24 letters, numbers, or underscores.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (Colors: AppPalette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: { minHeight: 58, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerButton: { width: 64, minHeight: 44, alignItems: "center", justifyContent: "center" },
  back: { color: Colors.text, fontSize: 38, lineHeight: 38 },
  save: { color: Colors.accent, fontSize: 13, fontWeight: "900" },
  title: { flex: 1, color: Colors.text, fontSize: 18, fontWeight: "900", textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 24, alignItems: "stretch" },
  avatar: { width: 112, height: 112, alignSelf: "center", borderRadius: 56, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.accent },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: { color: Colors.text, fontSize: 42, fontWeight: "800" },
  photoAction: { marginTop: 14, color: Colors.accent, textAlign: "center", fontSize: 12, fontWeight: "900" },
  removePhoto: { marginTop: 10, color: "#D46A6A", textAlign: "center", fontSize: 11, fontWeight: "800" },
  label: { marginTop: 28, marginBottom: 8, color: Colors.textMuted, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  input: { height: 48, paddingHorizontal: 14, color: Colors.text, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 7 },
  usernameInput: { height: 48, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 7 },
  at: { color: Colors.textMuted, fontSize: 16 },
  usernameField: { flex: 1, height: 46, color: Colors.text, fontSize: 15 },
  help: { marginTop: 7, color: Colors.textMuted, fontSize: 11 },
});
