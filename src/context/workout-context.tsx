import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import {
  addExerciseToWorkout,
  createWorkout,
  finishWorkout as finishWorkoutApi,
  getLastExerciseWorkout,
} from "@/services/api";

export type WorkoutSet = {
  id: string;
  setNumber: number;
  weight: string;
  reps: string;
  completed: boolean;
};

export type PreviousWorkoutSet = {
  setNumber: number;
  weight: number | null;
  reps: number | null;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: number;
  name: string;
  sets: WorkoutSet[];
  workoutExerciseId?: number;
  previousSets?: PreviousWorkoutSet[];
};

type WorkoutContextValue = {
  startedAt: number | null;
  isActive: boolean;
  exercises: WorkoutExercise[];
  restEndsAt: number | null;

  startWorkout: (
    exercises: WorkoutExercise[],
    templateId?: number | null,
  ) => Promise<void>;

  finishWorkout: () => Promise<void>;

  addSet: (exerciseId: string) => void;

  completeSet: (
    exerciseId: string,
    setId: string,
  ) => void;

  updateSet: (
    exerciseId: string,
    setId: string,
    field: "weight" | "reps",
    value: string,
  ) => void;

  addExercise: (
    exercise: WorkoutExercise,
  ) => Promise<void>;
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

  const [restEndsAt, setRestEndsAt] =
    useState<number | null>(null);

  async function loadPreviousSets(
    exerciseList: WorkoutExercise[],
    userId: number,
  ) {
    return Promise.all(
      exerciseList.map(async (exercise) => {
        try {
          const previous =
            await getLastExerciseWorkout(
              exercise.exerciseId,
              userId,
            );

          console.log(
            "Previous workout:",
            exercise.name,
            JSON.stringify(previous),
          );

          return {
            ...exercise,
            previousSets:
              previous?.sets ?? [],
          };
        } catch (error) {
          console.error(
            `Failed to load previous workout for ${exercise.name}:`,
            error,
          );

          return {
            ...exercise,
            previousSets: [],
          };
        }
      }),
    );
  }

  async function startWorkout(
    newExercises: WorkoutExercise[],
    templateId: number | null = null,
  ) {
    try {
      const storedUserId =
        await AsyncStorage.getItem("vytor_user_id");

      console.log(
        "Vytor stored user ID:",
        storedUserId,
      );

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

      console.log(
        "Workout created:",
        workout.id,
      );

      const databaseExercises =
        workout.exercises ?? [];

      const exercisesWithDatabaseIds =
        newExercises.map((exercise, index) => ({
          ...exercise,
          sets: exercise.sets.map((set) => ({
            ...set,
            completed: set.completed ?? false,
          })),
          workoutExerciseId:
            databaseExercises[index]?.id,
        }));

      const exercisesWithPreviousData =
        await loadPreviousSets(
          exercisesWithDatabaseIds,
          userId,
        );

      setExercises(exercisesWithPreviousData);
      setWorkoutId(workout.id);
      setRestEndsAt(null);
      setStartedAt(Date.now());
    } catch (error) {
      console.error(
        "Failed to start workout:",
        error,
      );

      throw error;
    }
  }

  async function finishWorkout() {
    if (!workoutId) {
      setStartedAt(null);
      setExercises([]);
      setRestEndsAt(null);
      return;
    }

    try {
      console.log(
        "Finishing workout:",
        workoutId,
      );

      const workoutExercises = exercises
        .filter(
          (exercise) =>
            exercise.workoutExerciseId !== undefined,
        )
        .map((exercise) => ({
          workoutExerciseId:
            exercise.workoutExerciseId!,
          sets: exercise.sets
            .filter((set) => set.completed)
            .map((set) => ({
              setNumber: set.setNumber,
              weight: set.weight,
              reps: set.reps,
            })),
        }))
        .filter(
          (exercise) => exercise.sets.length > 0,
        );

      await finishWorkoutApi(
        workoutId,
        workoutExercises,
      );

      console.log(
        "Workout saved successfully:",
        workoutId,
      );

      setStartedAt(null);
      setExercises([]);
      setWorkoutId(null);
      setRestEndsAt(null);
    } catch (error) {
      console.error(
        "Failed to finish workout:",
        error,
      );

      throw error;
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
              completed: false,
            },
          ],
        };
      }),
    );
  }

  function completeSet(
    exerciseId: string,
    setId: string,
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

            const completed = !set.completed;

            if (completed) {
              setRestEndsAt(
                Date.now() + 90 * 1000,
              );
            } else {
              setRestEndsAt(null);
            }

            return {
              ...set,
              completed,
            };
          }),
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

  async function addExercise(
    exercise: WorkoutExercise,
  ) {
    if (!workoutId) {
      setExercises((currentExercises) => [
        ...currentExercises,
        {
          ...exercise,
          sets: exercise.sets.map((set) => ({
            ...set,
            completed: set.completed ?? false,
          })),
        },
      ]);

      return;
    }

    try {
      const databaseExercise =
        await addExerciseToWorkout(
          workoutId,
          exercise.exerciseId,
        );

      const storedUserId =
        await AsyncStorage.getItem("vytor_user_id");

      const userId = Number(storedUserId);

      let previousSets:
        | PreviousWorkoutSet[]
        | undefined = [];

      if (Number.isInteger(userId)) {
        try {
          const previous =
            await getLastExerciseWorkout(
              exercise.exerciseId,
              userId,
            );

          previousSets =
            previous?.sets ?? [];
        } catch (error) {
          console.error(
            "Failed to load previous exercise:",
            error,
          );
        }
      }

      setExercises((currentExercises) => [
        ...currentExercises,
        {
          ...exercise,
          sets: exercise.sets.map((set) => ({
            ...set,
            completed: set.completed ?? false,
          })),
          workoutExerciseId:
            databaseExercise.id,
          previousSets,
        },
      ]);
    } catch (error) {
      console.error(
        "Failed to add exercise to workout:",
        error,
      );

      throw error;
    }
  }

  return (
    <WorkoutContext.Provider
      value={{
        startedAt,
        isActive: startedAt !== null,
        exercises,
        restEndsAt,
        startWorkout,
        finishWorkout,
        addSet,
        updateSet,
        completeSet,
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