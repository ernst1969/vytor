import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";

export default function SettingsScreen() {
  const router = useRouter();

  async function handleLogout() {
    Alert.alert(
      "Log out",
      "Are you sure you want to log out of this device?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log out",
          style: "destructive",
          async onPress() {
            try {
              await AsyncStorage.removeItem("vytor_user_id");
              router.replace("/create-user");
            } catch {
              Alert.alert(
                "Logout failed",
                "Something went wrong while logging out."
              );
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && styles.logoutButtonPressed,
        ]}
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: Colors.background,
  },

  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 32,
    color: Colors.text,
  },

  logoutButton: {
    height: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },

  logoutButtonPressed: {
    opacity: 0.6,
  },

  logoutText: {
    fontSize: 17,
    fontWeight: "bold",
    color: Colors.text,
  },
});