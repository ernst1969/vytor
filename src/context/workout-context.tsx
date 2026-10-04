import { createContext, useContext, useState, type ReactNode } from "react";

type WorkoutContextValue = {
  startedAt: number | null;
  isActive: boolean;
  startWorkout: () => void;
  finishWorkout: () => void;
};

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);

  function startWorkout() {
    // The workout state survives tab navigation because it lives above the
    // individual tab screens.
    setStartedAt(Date.now());
  }

  function finishWorkout() {
    // Clearing startedAt ends the workout everywhere in the app.
    setStartedAt(null);
  }

  return (
    <WorkoutContext.Provider
      value={{
        startedAt,
        isActive: startedAt !== null,
        startWorkout,
        finishWorkout,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const context = useContext(WorkoutContext);

  if (!context) {
    throw new Error("useWorkout must be used inside WorkoutProvider");
  }

  return context;
}