import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { Colors } from "@/constants/theme";
import { loginUser } from "@/services/api";

export default function LoginScreen() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 2) {
      Alert.alert(
        "Invalid username",
        "Please enter your username."
      );
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        "Invalid password",
        "Please enter your password."
      );
      return;
    }

    try {
      setLoading(true);

      const user = await loginUser(
        trimmedUsername,
        password
      );

      await AsyncStorage.setItem(
        "vytor_user_id",
        String(user.id)
      );

      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert(
        "Could not log in",
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
      <Text style={styles.title}>Welcome Back</Text>

      <Text style={styles.subtitle}>
        Log in to continue your Vytor journey.
      </Text>

      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Username"
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
        onPress={handleLogin}
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
          <Text style={styles.buttonText}>Log In</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => router.replace("/create-user")}
        disabled={loading}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryText}>
          Don't have an account? Create one
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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

  secondaryButton: {
    alignItems: "center",
    marginTop: 24,
  },

  secondaryText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
});