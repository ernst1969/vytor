import { Redirect } from "expo-router";

export default function Index() {
  // The actual home screen lives inside the tabs route group.
  // This redirects the app's "/" route into that group.
  return <Redirect href="/(tabs)" />;
}