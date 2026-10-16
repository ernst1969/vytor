import { useAppDialog } from "@/context/dialog-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";


import { type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/context/theme-context";
import { createUser } from "@/services/api";

export default function CreateUserScreen() {
  const { alert } = useAppDialog();
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  const router = useRouter();
  const [password, setPassword] = useState("");

  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreateUser() {
    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 2) {
      alert(
        "Username too short",
        "Your username needs to be at least 2 characters."
      );
      return;
    }

    try {
      setLoading(true);

const user = await createUser(trimmedUsername, password);

      await AsyncStorage.setItem("vytor_user_id", String(user.id));

      router.replace("/(tabs)");
    } catch (error) {
      alert(
        "Could not create user",
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Vytor</Text>

      <Text style={styles.subtitle}>
        Let&apos;s get you set up before your first workout.
      </Text>

      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Choose a username"
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={30}
        style={styles.input}
        editable={!loading}
      />

      <TextInput
  value={password}
  onChangeText={setPassword}
  placeholder="Password"
  placeholderTextColor={Colors.textMuted}
  secureTextEntry
  autoCapitalize="none"
  autoCorrect={false}
  style={styles.input}
  editable={!loading}
/>

      <Pressable
        onPress={handleCreateUser}
        disabled={loading}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          loading && styles.buttonDisabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={Colors.background} />
        ) : (
          <Text style={styles.buttonText}>Create User</Text>
        )}
      </Pressable>

      <Pressable
  onPress={() => router.replace("/login")}
  disabled={loading}
  style={styles.secondaryButton}
>
  <Text style={styles.secondaryText}>
    Already have an account? Log in
  </Text>
</Pressable>
    </View>
  );
}

const createStyles = (Colors: AppPalette) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: Colors.background,
  },

  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 12,
    color: Colors.text,
  },

  secondaryButton: {
  alignItems: "center",
  marginTop: 24,
},

secondaryText: {
  fontSize: 15,
  color: Colors.textMuted,
},

  subtitle: {
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 32,
    color: Colors.textMuted,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: Colors.textMuted,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 17,
    color: Colors.text,
    marginBottom: 16,
  },

  button: {
    height: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accent,
  },

  buttonPressed: {
    opacity: 0.8,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    fontSize: 17,
    fontWeight: "bold",
    color: Colors.background,
  },
});
