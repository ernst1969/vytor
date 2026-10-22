import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { build } from "../server/node_modules/esbuild/lib/main.js";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}

const tokenA = "a".repeat(64);
const tokenB = "b".repeat(64);

function harness() {
  const listeners = new Set<(change: { reason: string; accountId?: string }) => void>();
  const state = {
    token: tokenA,
    userId: "1",
    routes: [] as string[],
    deleteCalls: [] as Array<{ password: string; binding: { accountId: string; token: string | null } }>,
    passwordCalls: [] as unknown[],
    deleteNetworkCalls: 0,
    captureGate: null as ReturnType<typeof deferred<void>> | null,
    deleteGate: null as ReturnType<typeof deferred<{ data: unknown; sessionCleared: boolean }>> | null,
    emit(change: { reason: string; accountId?: string }) { for (const listener of listeners) listener(change); },
  };
  const binding = () => ({ accountId: state.userId, token: state.token });
  const api = {
    onSessionChange(listener: (change: { reason: string; accountId?: string }) => void) { listeners.add(listener); return () => listeners.delete(listener); },
    async captureCurrentSessionRequestBinding() { return binding(); },
    async captureSessionRequestBinding(expectedAccountId: string) {
      if (state.captureGate) await state.captureGate.promise;
      if (state.userId !== expectedAccountId) throw new Error("Session changed before the request could be prepared");
      return binding();
    },
    async isSessionRequestBindingCurrent(expected: { accountId: string; token: string | null }) {
      return expected.accountId === state.userId && expected.token === state.token;
    },
    async getSettings() { return { preferredWeightUnit: "KG", preferredDistanceUnit: "KM", restSeconds: 90, theme: "SYSTEM" }; },
    async updateSettings(value: unknown) { return value; },
    async request() { return {}; },
    async logoutUser() { return false; },
    async changePassword(...args: unknown[]) { state.passwordCalls.push(args); return { data: {}, sessionCleared: false }; },
    async deleteAccount(password: string, expected: { accountId: string; token: string | null }) {
      state.deleteCalls.push({ password, binding: expected });
      if (expected.accountId !== state.userId || expected.token !== state.token) throw new Error("Session changed before the request could be sent");
      state.deleteNetworkCalls += 1;
      if (state.deleteGate) return state.deleteGate.promise;
      return { data: { success: true }, sessionCleared: true };
    },
  };
  return { state, api };
}

let settingsModule: Promise<any> | null = null;
async function loadSettingsScreen() {
  if (settingsModule) return settingsModule;
  settingsModule = (async () => {
    const result = await build({
      absWorkingDir: process.cwd(), entryPoints: ["src/app/(tabs)/settings.tsx"], bundle: true,
      platform: "node", format: "cjs", write: false, jsx: "automatic", external: ["react"],
      plugins: [{
        name: "settings-account-action-mocks",
        setup(buildApi) {
          const modules: Record<string, string> = {
            "expo-router": `export const useRouter = () => ({ replace: (path) => globalThis.__vytorSettingsTest.state.routes.push(path) });`,
            "react-native-safe-area-context": `export const useSafeAreaInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 });`,
            "react-native": `
              import React from "react";
              const host = (name) => (props) => React.createElement(name, props, props.children);
              export const ActivityIndicator = host("ActivityIndicator");
              export const Pressable = host("Pressable");
              export const ScrollView = host("ScrollView");
              export const Text = host("Text");
              export const TextInput = host("TextInput");
              export const View = host("View");
              export const StyleSheet = { create: (styles) => styles };
            `,
            "@/constants/theme": `export const Layout = { contentWidth: 720, pagePadding: 16 };`,
            "@/context/theme-context": `export const useAppTheme = () => ({ colors: { background: "#000", surface: "#111", border: "#222", text: "#fff", textMuted: "#aaa", accent: "#f80", onAccent: "#000", destructive: "#f00" }, setPreference() {} });`,
            "@/context/workout-context": `export const useWorkout = () => ({ applySettings() {} });`,
            "@/components/confirm-dialog": `
              import React from "react";
              export const ConfirmDialog = (props) => React.createElement("ConfirmDialog", props);
            `,
            "@/services/api": `
              const api = () => globalThis.__vytorSettingsTest.api;
              export const captureCurrentSessionRequestBinding = (...a) => api().captureCurrentSessionRequestBinding(...a);
              export const captureSessionRequestBinding = (...a) => api().captureSessionRequestBinding(...a);
              export const changePassword = (...a) => api().changePassword(...a);
              export const deleteAccount = (...a) => api().deleteAccount(...a);
              export const getSettings = (...a) => api().getSettings(...a);
              export const isSessionRequestBindingCurrent = (...a) => api().isSessionRequestBindingCurrent(...a);
              export const logoutUser = (...a) => api().logoutUser(...a);
              export const onSessionChange = (...a) => api().onSessionChange(...a);
              export const request = (...a) => api().request(...a);
              export const updateSettings = (...a) => api().updateSettings(...a);
            `,
          };
          buildApi.onResolve({ filter: /.*/ }, (args) => modules[args.path] ? { path: args.path, namespace: "settings-mock" } : undefined);
          buildApi.onLoad({ filter: /.*/, namespace: "settings-mock" }, (args) => ({ contents: modules[args.path], loader: "js" }));
        },
      }],
    });
    const module = { exports: {} as any };
    const require = createRequire(import.meta.url);
    new Function("require", "module", "exports", result.outputFiles[0].text)(require, module, module.exports);
    return module.exports;
  })();
  return settingsModule;
}

async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

async function mount(h: ReturnType<typeof harness>) {
  (globalThis as any).__vytorSettingsTest = h;
  const module = await loadSettingsScreen();
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(module.default)); });
  await settle();
  return renderer;
}

function press(renderer: TestRenderer.ReactTestRenderer, label: string, last = false) {
  const buttons = renderer.root.findAllByType("Pressable").filter((candidate) =>
    candidate.findAllByType("Text").some((text) => text.children.join("") === label));
  const button = last ? buttons.at(-1) : buttons[0];
  assert.ok(button, `button ${label} exists`);
  button.props.onPress();
}

function enterDeletePassword(renderer: TestRenderer.ReactTestRenderer, password = "same-password") {
  const input = renderer.root.findAllByType("TextInput").find((candidate) => candidate.props.accessibilityLabel === "Password to delete account");
  assert.ok(input);
  input.props.onChangeText(password);
}

test("Settings normal delete binds A, blocks duplicate confirmation and navigates only after clearing A", async () => {
  const h = harness();
  const renderer = await mount(h);
  await act(async () => { press(renderer, "Delete account"); });
  await act(async () => { enterDeletePassword(renderer); });
  await act(async () => { press(renderer, "Delete account", true); });
  await settle();
  const confirm = renderer.root.findByType("ConfirmDialog");
  await act(async () => { confirm.props.onConfirm(); confirm.props.onConfirm(); });
  await settle();
  assert.equal(h.state.deleteCalls.length, 1);
  assert.deepEqual(h.state.deleteCalls[0]?.binding, { accountId: "1", token: tokenA });
  assert.equal(h.state.deleteNetworkCalls, 1);
  assert.deepEqual(h.state.routes, ["/login"]);
  await act(async () => { renderer.unmount(); });
});

test("Settings A confirmation cannot start a delete under B with the same password", async () => {
  const h = harness();
  const renderer = await mount(h);
  await act(async () => { press(renderer, "Delete account"); });
  await act(async () => { enterDeletePassword(renderer); });
  await act(async () => { press(renderer, "Delete account", true); });
  await settle();
  h.state.userId = "2";
  h.state.token = tokenB;
  await act(async () => { renderer.root.findByType("ConfirmDialog").props.onConfirm(); });
  await settle();
  assert.equal(h.state.deleteNetworkCalls, 0);
  assert.deepEqual(h.state.routes, []);
  assert.equal(h.state.userId, "2");
  await act(async () => { renderer.unmount(); });
});

test("Settings rejects a session switch during confirmation identity capture", async () => {
  const h = harness();
  const gate = deferred<void>();
  h.state.captureGate = gate;
  const renderer = await mount(h);
  await act(async () => { press(renderer, "Delete account"); });
  await act(async () => { enterDeletePassword(renderer); });
  await act(async () => { press(renderer, "Delete account", true); });
  h.state.userId = "2";
  h.state.token = tokenB;
  gate.resolve();
  await settle();
  assert.equal(renderer.root.findByType("ConfirmDialog").props.visible, false);
  assert.equal(h.state.deleteCalls.length, 0);
  assert.deepEqual(h.state.routes, []);
  await act(async () => { renderer.unmount(); });
});

test("Settings does not navigate B after an in-flight A deletion succeeds", async () => {
  const h = harness();
  const gate = deferred<{ data: unknown; sessionCleared: boolean }>();
  h.state.deleteGate = gate;
  const renderer = await mount(h);
  await act(async () => { press(renderer, "Delete account"); });
  await act(async () => { enterDeletePassword(renderer); });
  await act(async () => { press(renderer, "Delete account", true); });
  await settle();
  await act(async () => { renderer.root.findByType("ConfirmDialog").props.onConfirm(); });
  await act(async () => {
    h.state.userId = "2";
    h.state.token = tokenB;
    h.state.emit({ reason: "login", accountId: "2" });
    gate.resolve({ data: { success: true }, sessionCleared: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(h.state.deleteNetworkCalls, 1);
  assert.deepEqual(h.state.deleteCalls[0]?.binding, { accountId: "1", token: tokenA });
  assert.deepEqual(h.state.routes, []);
  assert.equal(h.state.userId, "2");
  await act(async () => { renderer.unmount(); });
});
