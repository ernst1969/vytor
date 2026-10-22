import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SessionCredentialStore, type LegacyValidation, type SessionIdentity } from "@/services/session-store-core";

const TOKEN_KEY = "vytor_session_token_v2";
const LEGACY_TOKEN_KEY = "vytor_session_token";
const USER_ID_KEY = "vytor_user_id";
function webStorage() {
  return typeof sessionStorage === "undefined" ? null : sessionStorage;
}

const store = new SessionCredentialStore({
  readSecure: async () => Platform.OS === "web"
    ? webStorage()?.getItem(TOKEN_KEY) ?? null
    : SecureStore.getItemAsync(TOKEN_KEY),
  writeSecure: async (token) => {
    if (Platform.OS === "web") {
      const storage = webStorage();
      if (!storage) throw new Error("Session storage is unavailable");
      storage.setItem(TOKEN_KEY, token);
      return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  deleteSecure: async () => {
    if (Platform.OS === "web") webStorage()?.removeItem(TOKEN_KEY);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
  readLegacy: () => Platform.OS === "web" ? Promise.resolve(null) : AsyncStorage.getItem(LEGACY_TOKEN_KEY),
  deleteLegacy: () => AsyncStorage.removeItem(LEGACY_TOKEN_KEY),
  readUserId: () => AsyncStorage.getItem(USER_ID_KEY),
  writeUserId: (userId) => AsyncStorage.setItem(USER_ID_KEY, userId),
  deleteUserId: () => AsyncStorage.removeItem(USER_ID_KEY),
});

export function getSessionToken(validateLegacy: (token: string) => Promise<LegacyValidation>) {
  return store.getToken(validateLegacy);
}

export function storeSessionCredentials(userId: number, token?: string) {
  return store.store(userId, token);
}

export function getSessionIdentity() {
  return store.getIdentity();
}

export function clearSessionCredentials() {
  return store.clear();
}

export function clearSessionCredentialsIfCurrent(expectedToken: string) {
  return store.clearIfCurrent(expectedToken);
}

export function clearSessionCredentialsIfUserCurrent(expectedUserId: string) {
  return store.clearIfUserId(expectedUserId);
}

export function clearSessionCredentialsIfIdentityCurrent(expected: SessionIdentity) {
  return store.clearIfIdentity(expected);
}
