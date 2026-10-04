import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { createUser } from "@/services/api";

export default function CreateUserScreen() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreateUser() {
    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 2) {
      Alert.alert(
        "Username too short",
        "Your username needs to be at least 2 characters."
      );
      return;
    }

    try {
      setLoading(true);

      const user = await createUser(trimmedUsername);

      await AsyncStorage.setItem("vytor_user_id", String(user.id));

      // The root navigation will notice the stored user
      // and send the user to the Home screen.
    } catch (error) {
      Alert.alert(
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
        Let's get you set up before your first workout.
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
});