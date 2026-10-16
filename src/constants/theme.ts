/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
  background: "#181A19",
  surface: "#242625",
  border: "#3C3F3D",
  text: "#FFFFFF",
  textMuted: "#BFC1BE",
  accent: "#E89235",
  tint: "#E89235",
  card: "#242625",
};

export const DarkPalette = { background: "#181A19", surface: "#242625", border: "#3C3F3D", text: "#FFFFFF", textMuted: "#BFC1BE", accent: "#E89235", tint: "#E89235", card: "#242625", onAccent: "#181A19", destructive: "#EF8585" };
export const LightPalette: typeof DarkPalette = { background: "#FAF7F2", surface: "#FFFFFF", border: "#D8D1C7", text: "#231E19", textMuted: "#6F655B", accent: "#93531E", tint: "#93531E", card: "#FFFFFF", onAccent: "#FFFFFF", destructive: "#B83D3D" };
export const Layout = { pagePadding: 20, radius: 14, contentWidth: 720, sectionGap: 24 } as const;
export type AppPalette = typeof DarkPalette;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
