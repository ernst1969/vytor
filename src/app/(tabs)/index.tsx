import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import { useWorkout } from "@/context/workout-context";
import { checkBackend } from "../../services/api";

export default function HomeScreen() {
  const { isActive } = useWorkout();
  const router = useRouter();

  const [backendStatus, setBackendStatus] = useState("Checking...");

  useEffect(() => {
    checkBackend()
      .then(() => setBackendStatus("Connected"))
      .catch(() => setBackendStatus("Disconnected"));
  }, []);

  if (isActive) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Workout</Text>

        <Text style={styles.subtitle}>Active workout</Text>

        <Text style={styles.backendStatus}>
          Backend: {backendStatus}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vytor</Text>

      <Text style={styles.subtitle}>Ready to train?</Text>

      <Pressable
        style={styles.startButton}
        onPress={() => router.push("/workout-setup")}
      >
        <Text style={styles.startButtonText}>START WORKOUT</Text>
      </Pressable>

      <Text style={styles.backendStatus}>
        Backend: {backendStatus}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
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
    fontSize: 18,
    marginBottom: 32,
    color: Colors.textMuted,
  },

  startButton: {
    width: "100%",
    maxWidth: 360,
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: Colors.accent,
  },

  startButtonText: {
    color: Colors.background,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 1,
  },

  backendStatus: {
    marginTop: 24,
    fontSize: 14,
    color: Colors.textMuted,
  },
});