import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AppState } from "react-native";

// One timeout at the next local midnight, only while the screen is focused.
// Resume also refreshes the date after suspended timers or a time-zone change.
export function useLocalDay() {
  const [now, setNow] = useState(() => new Date());
  const refresh = useCallback(() => setNow(new Date()), []);
  useFocusEffect(useCallback(() => {
    let timer: ReturnType<typeof setTimeout>;
    function update() {
      clearTimeout(timer);
      const current = new Date();
      setNow(current);
      const midnight = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
      timer = setTimeout(update, midnight.getTime() - current.getTime() + 50);
    }
    update();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
      else clearTimeout(timer);
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, []));
  return { now, refresh };
}
