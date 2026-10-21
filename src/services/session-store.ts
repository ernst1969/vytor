import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "vytor_session_token_v2";
const LEGACY_TOKEN_KEY = "vytor_session_token";
const USER_ID_KEY = "vytor_user_id";
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

let operation = Promise.resolve<unknown>(undefined);

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const next = operation.then(task, task);
  operation = next.then(() => undefined, () => undefined);
  return next;
}

function webStorage() {
  return typeof sessionStorage === "undefined" ? null : sessionStorage;
}

async function readNativeToken() {
  const current = await SecureStore.getItemAsync(TOKEN_KEY);
  if (current) return TOKEN_PATTERN.test(current) ? current : null;

  const legacy = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
  if (!legacy || !TOKEN_PATTERN.test(legacy)) {
    if (legacy) await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
    return null;
  }

  // Crash-safe migration: verify the secure write before removing plaintext.
  await SecureStore.setItemAsync(TOKEN_KEY, legacy, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (await SecureStore.getItemAsync(TOKEN_KEY) !== legacy) {
    throw new Error("Secure session storage verification failed");
  }
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
  return legacy;
}

export function getSessionToken() {
  return serialized(async () => {
    if (Platform.OS === "web") {
      const token = webStorage()?.getItem(TOKEN_KEY) ?? null;
      return token && TOKEN_PATTERN.test(token) ? token : null;
    }
    return readNativeToken();
  });
}

export function storeSessionCredentials(userId: number, token?: string) {
  return serialized(async () => {
    if (!Number.isSafeInteger(userId) || userId < 1 || (token !== undefined && !TOKEN_PATTERN.test(token))) {
      throw new Error("Invalid session credentials");
    }
    if (token) {
      if (Platform.OS === "web") {
        const storage = webStorage();
        if (!storage) throw new Error("Session storage is unavailable");
        storage.setItem(TOKEN_KEY, token);
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
        if (await SecureStore.getItemAsync(TOKEN_KEY) !== token) throw new Error("Secure session storage verification failed");
        await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
      }
    }
    await AsyncStorage.setItem(USER_ID_KEY, String(userId));
  });
}

export function clearSessionCredentials() {
  return serialized(async () => {
    webStorage()?.removeItem(TOKEN_KEY);
    if (Platform.OS !== "web") await SecureStore.deleteItemAsync(TOKEN_KEY);
    await AsyncStorage.multiRemove([USER_ID_KEY, LEGACY_TOKEN_KEY]);
  });
}
