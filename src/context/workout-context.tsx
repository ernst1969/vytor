import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import {
  createWorkout,
  finishWorkout as finishWorkoutApi,
} from "@/services/api";

export type WorkoutSet = {
  id: string;
  setNumber: number;
  weight: string;
  reps: string;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: number;
  name: string;
  sets: WorkoutSet[];
  workoutExerciseId?: number;
};

type WorkoutContextValue = {
  startedAt: number | null;
  isActive: boolean;
  exercises: WorkoutExercise[];

  startWorkout: (
    exercises: WorkoutExercise[],
    templateId?: number | null,
  ) => Promise<void>;

  finishWorkout: () => Promise<void>;

  addSet: (exerciseId: string) => void;

  updateSet: (
    exerciseId: string,
    setId: string,
    field: "weight" | "reps",
    value: string,
  ) => void;

  addExercise: (exercise: WorkoutExercise) => void;
};

const WorkoutContext =
  createContext<WorkoutContextValue | null>(null);

export function WorkoutProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [startedAt, setStartedAt] =
    useState<number | null>(null);

  const [exercises, setExercises] = useState<
    WorkoutExercise[]
  >([]);

  const [workoutId, setWorkoutId] =
    useState<number | null>(null);

  async function startWorkout(
    newExercises: WorkoutExercise[],
    templateId: number | null = null,
  ) {
    try {
      const storedUserId =
        await AsyncStorage.getItem("vytor_user_id");

      if (!storedUserId) {
        throw new Error("No logged-in user found");
      }

      const userId = Number(storedUserId);

      if (!Number.isInteger(userId)) {
        throw new Error("Invalid user ID");
      }

      const workout = await createWorkout(
        userId,
        templateId,
        newExercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
        })),
      );

      const databaseExercises =
        workout.exercises ?? [];

      const exercisesWithDatabaseIds =
        newExercises.map((exercise, index) => ({
          ...exercise,
          workoutExerciseId:
            databaseExercises[index]?.id,
        }));

      setExercises(exercisesWithDatabaseIds);
      setWorkoutId(workout.id);
      setStartedAt(Date.now());
    } catch (error) {
      console.error("Failed to start workout:", error);
      throw error;
    }
  }

  async function finishWorkout() {
    if (!workoutId) {
      setStartedAt(null);
      setExercises([]);
      return;
    }

    try {
      await finishWorkoutApi(
        workoutId,
        exercises
          .filter(
            (exercise) =>
              exercise.workoutExerciseId !== undefined,
          )
          .map((exercise) => ({
            workoutExerciseId:
              exercise.workoutExerciseId!,
            sets: exercise.sets.map((set) => ({
              setNumber: set.setNumber,
              weight: set.weight,
              reps: set.reps,
            })),
          })),
      );

      setStartedAt(null);
      setExercises([]);
      setWorkoutId(null);
    } catch (error) {
      console.error("Failed to finish workout:", error);
    }
  }

  function addSet(exerciseId: string) {
    setExercises((currentExercises) =>
      currentExercises.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        const nextSetNumber =
          exercise.sets.length + 1;

        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              id: `${exercise.id}-set-${Date.now()}`,
              setNumber: nextSetNumber,
              weight: "",
              reps: "",
            },
          ],
        };
      }),
    );
  }

  function updateSet(
    exerciseId: string,
    setId: string,
    field: "weight" | "reps",
    value: string,
  ) {
    setExercises((currentExercises) =>
      currentExercises.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.map((set) => {
            if (set.id !== setId) {
              return set;
            }

            return {
              ...set,
              [field]: value,
            };
          }),
        };
      }),
    );
  }

  function addExercise(
    exercise: WorkoutExercise,
  ) {
    setExercises((currentExercises) => [
      ...currentExercises,
      exercise,
    ]);
  }

  return (
    <WorkoutContext.Provider
      value={{
        startedAt,
        isActive: startedAt !== null,
        exercises,
        startWorkout,
        finishWorkout,
        addSet,
        updateSet,
        addExercise,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const context = useContext(WorkoutContext);

  if (!context) {
    throw new Error(
      "useWorkout must be used inside WorkoutProvider",
    );
  }

  return context;
}