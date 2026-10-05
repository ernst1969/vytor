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
  updateWorkoutExerciseSettings,
  type DistanceUnit,
  type ExerciseMeasurementType,
  type WeightUnit,
} from "@/services/api";

export type WorkoutSet = {
  id: string;
  setNumber: number;
  weight: string;
  reps: string;
  distance: string;
  durationSeconds: string;
  completed: boolean;
};

export type PreviousWorkoutSet = {
  setNumber: number;
  weight: number | null;
  reps: number | null;
  distance: number | null;
  durationSeconds: number | null;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: number;
  name: string;
  description?: string | null;
  measurementType: ExerciseMeasurementType;
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
  sets: WorkoutSet[];
  workoutExerciseId?: number;
  previousSets?: PreviousWorkoutSet[];
};

type UpdateSetField =
  | "weight"
  | "reps"
  | "distance"
  | "durationSeconds";

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
    field: UpdateSetField,
    value: string,
  ) => void;

  updateWeightUnit: (
    exerciseId: string,
    unit: WeightUnit,
  ) => void;

  updateDistanceUnit: (
    exerciseId: string,
    unit: DistanceUnit,
  ) => void;

  addExercise: (
    exercise: WorkoutExercise,
  ) => Promise<void>;

  deleteExercise: (
    exerciseId: string,
  ) => void;

  moveExercise: (
    exerciseId: string,
    direction: "up" | "down",
  ) => void;

  replaceExercise: (
    exerciseId: string,
    exercise: WorkoutExercise,
  ) => Promise<void>;
};

const WorkoutContext =
  createContext<WorkoutContextValue | null>(null);

const KG_PER_LB = 0.45359237;
const KM_PER_MI = 1.609344;

function convertWeight(
  value: string,
  from: WeightUnit,
  to: WeightUnit,
) {
  if (!value) {
    return value;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || from === to) {
    return value;
  }

  if (from === "KG" && to === "LBS") {
    return String(
      Number(
        (number / KG_PER_LB).toFixed(2),
      ),
    );
  }

  return String(
    Number(
      (number * KG_PER_LB).toFixed(2),
    ),
  );
}

function convertDistance(
  value: string,
  from: DistanceUnit,
  to: DistanceUnit,
) {
  if (!value) {
    return value;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || from === to) {
    return value;
  }

  if (from === "KM" && to === "MI") {
    return String(
      Number(
        (number / KM_PER_MI).toFixed(2),
      ),
    );
  }

  return String(
    Number(
      (number * KM_PER_MI).toFixed(2),
    ),
  );
}

function stringToNumber(value: string) {
  if (!value) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function stringToInteger(value: string) {
  if (!value) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.max(
    0,
    Math.round(number),
  );
}

function normalizeExercise(
  exercise: WorkoutExercise,
): WorkoutExercise {
  return {
    ...exercise,

    measurementType:
      exercise.measurementType ??
      "WEIGHT_REPS",

    weightUnit:
      exercise.weightUnit ?? "KG",

    distanceUnit:
      exercise.distanceUnit ?? "KM",

    sets: exercise.sets.map((set) => ({
      ...set,
      weight: set.weight ?? "",
      reps: set.reps ?? "",
      distance: set.distance ?? "",
      durationSeconds:
        set.durationSeconds ?? "",
      completed:
        set.completed ?? false,
    })),
  };
}

function getRelevantSetValues(
  exercise: WorkoutExercise,
  set: WorkoutSet,
) {
  const result = {
    weight: null as number | null,
    reps: null as number | null,
    distance: null as number | null,
    durationSeconds: null as number | null,
  };

  switch (exercise.measurementType) {
    case "WEIGHT_REPS":
      result.weight =
        stringToNumber(set.weight);
      result.reps =
        stringToInteger(set.reps);
      break;

    case "REPS":
      result.reps =
        stringToInteger(set.reps);
      break;

    case "DISTANCE_TIME":
      result.distance =
        stringToNumber(set.distance);
      result.durationSeconds =
        stringToInteger(
          set.durationSeconds,
        );
      break;

    case "TIME":
      result.durationSeconds =
        stringToInteger(
          set.durationSeconds,
        );
      break;

    case "WEIGHT_DISTANCE":
      result.weight =
        stringToNumber(set.weight);
      result.distance =
        stringToNumber(set.distance);
      break;
  }

  return result;
}

export function WorkoutProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [startedAt, setStartedAt] =
    useState<number | null>(null);

  const [exercises, setExercises] =
    useState<WorkoutExercise[]>([]);

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
    const storedUserId =
      await AsyncStorage.getItem(
        "vytor_user_id",
      );

    if (!storedUserId) {
      throw new Error(
        "No logged-in user found",
      );
    }

    const userId = Number(storedUserId);

    if (!Number.isInteger(userId)) {
      throw new Error("Invalid user ID");
    }

    const normalizedExercises =
      newExercises.map(
        normalizeExercise,
      );

    try {
      const workout =
        await createWorkout(
          userId,
          templateId,
          normalizedExercises.map(
            (exercise) => ({
              exerciseId:
                exercise.exerciseId,
              weightUnit:
                exercise.weightUnit,
              distanceUnit:
                exercise.distanceUnit,
            }),
          ),
        );

      const databaseExercises =
        workout.exercises ?? [];

      const exercisesWithIds =
        normalizedExercises.map(
          (exercise, index) => ({
            ...exercise,
            workoutExerciseId:
              databaseExercises[index]?.id,
          }),
        );

      const exercisesWithPreviousData =
        await loadPreviousSets(
          exercisesWithIds,
          userId,
        );

      setExercises(
        exercisesWithPreviousData,
      );

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
      const workoutExercises =
        exercises
          .filter(
            (exercise) =>
              exercise.workoutExerciseId !==
              undefined,
          )
          .map((exercise) => ({
            workoutExerciseId:
              exercise.workoutExerciseId!,

            weightUnit:
              exercise.weightUnit,

            distanceUnit:
              exercise.distanceUnit,

            sets: exercise.sets
              .filter(
                (set) => set.completed,
              )
              .map((set) => {
                const values =
                  getRelevantSetValues(
                    exercise,
                    set,
                  );

                return {
                  setNumber:
                    set.setNumber,
                  weight:
                    values.weight,
                  reps:
                    values.reps,
                  distance:
                    values.distance,
                  durationSeconds:
                    values.durationSeconds,
                };
              }),
          }))
          .filter(
            (exercise) =>
              exercise.sets.length > 0,
          );

      await finishWorkoutApi(
        workoutId,
        workoutExercises,
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
    setExercises(
      (currentExercises) =>
        currentExercises.map(
          (exercise) => {
            if (
              exercise.id !==
              exerciseId
            ) {
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
                  setNumber:
                    nextSetNumber,
                  weight: "",
                  reps: "",
                  distance: "",
                  durationSeconds: "",
                  completed: false,
                },
              ],
            };
          },
        ),
    );
  }

  function completeSet(
    exerciseId: string,
    setId: string,
  ) {
    setExercises(
      (currentExercises) =>
        currentExercises.map(
          (exercise) => {
            if (
              exercise.id !==
              exerciseId
            ) {
              return exercise;
            }

            return {
              ...exercise,
              sets: exercise.sets.map(
                (set) => {
                  if (
                    set.id !==
                    setId
                  ) {
                    return set;
                  }

                  const completed =
                    !set.completed;

                  setRestEndsAt(
                    completed
                      ? Date.now() +
                          90 * 1000
                      : null,
                  );

                  return {
                    ...set,
                    completed,
                  };
                },
              ),
            };
          },
        ),
    );
  }

  function updateSet(
    exerciseId: string,
    setId: string,
    field: UpdateSetField,
    value: string,
  ) {
    setExercises(
      (currentExercises) =>
        currentExercises.map(
          (exercise) => {
            if (
              exercise.id !==
              exerciseId
            ) {
              return exercise;
            }

            return {
              ...exercise,
              sets: exercise.sets.map(
                (set) =>
                  set.id === setId
                    ? {
                        ...set,
                        [field]: value,
                      }
                    : set,
              ),
            };
          },
        ),
    );
  }

  function updateWeightUnit(
    exerciseId: string,
    unit: WeightUnit,
  ) {
    const exercise =
      exercises.find(
        (item) =>
          item.id === exerciseId,
      );

    if (
      !exercise ||
      exercise.weightUnit === unit
    ) {
      return;
    }

    const nextSets =
      exercise.sets.map((set) => ({
        ...set,
        weight: convertWeight(
          set.weight,
          exercise.weightUnit,
          unit,
        ),
      }));

    setExercises(
      (currentExercises) =>
        currentExercises.map(
          (item) =>
            item.id === exerciseId
              ? {
                  ...item,
                  weightUnit: unit,
                  sets: nextSets,
                }
              : item,
        ),
    );

    if (exercise.workoutExerciseId) {
      void updateWorkoutExerciseSettings(
        exercise.workoutExerciseId,
        {
          weightUnit: unit,
        },
      ).catch((error) => {
        console.error(
          "Failed to save weight unit:",
          error,
        );
      });
    }
  }

  function updateDistanceUnit(
    exerciseId: string,
    unit: DistanceUnit,
  ) {
    const exercise =
      exercises.find(
        (item) =>
          item.id === exerciseId,
      );

    if (
      !exercise ||
      exercise.distanceUnit === unit
    ) {
      return;
    }

    const nextSets =
      exercise.sets.map((set) => ({
        ...set,
        distance: convertDistance(
          set.distance,
          exercise.distanceUnit,
          unit,
        ),
      }));

    setExercises(
      (currentExercises) =>
        currentExercises.map(
          (item) =>
            item.id === exerciseId
              ? {
                  ...item,
                  distanceUnit: unit,
                  sets: nextSets,
                }
              : item,
        ),
    );

    if (exercise.workoutExerciseId) {
      void updateWorkoutExerciseSettings(
        exercise.workoutExerciseId,
        {
          distanceUnit: unit,
        },
      ).catch((error) => {
        console.error(
          "Failed to save distance unit:",
          error,
        );
      });
    }
  }

  async function addExercise(
    exercise: WorkoutExercise,
  ) {
    const normalized =
      normalizeExercise(exercise);

    if (!workoutId) {
      setExercises(
        (current) => [
          ...current,
          normalized,
        ],
      );
      return;
    }

    const databaseExercise =
      await addExerciseToWorkout(
        workoutId,
        normalized.exerciseId,
        {
          weightUnit:
            normalized.weightUnit,
          distanceUnit:
            normalized.distanceUnit,
        },
      );

    const storedUserId =
      await AsyncStorage.getItem(
        "vytor_user_id",
      );

    const userId = Number(
      storedUserId,
    );

    let previousSets:
      | PreviousWorkoutSet[]
      | undefined = [];

    if (Number.isInteger(userId)) {
      try {
        const previous =
          await getLastExerciseWorkout(
            normalized.exerciseId,
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

    setExercises(
      (current) => [
        ...current,
        {
          ...normalized,
          workoutExerciseId:
            databaseExercise.id,
          previousSets,
        },
      ],
    );
  }

  function deleteExercise(
    exerciseId: string,
  ) {
    setExercises(
      (current) =>
        current.filter(
          (exercise) =>
            exercise.id !==
            exerciseId,
        ),
    );
  }

  function moveExercise(
    exerciseId: string,
    direction: "up" | "down",
  ) {
    setExercises(
      (current) => {
        const index =
          current.findIndex(
            (exercise) =>
              exercise.id ===
              exerciseId,
          );

        if (index === -1) {
          return current;
        }

        const newIndex =
          direction === "up"
            ? index - 1
            : index + 1;

        if (
          newIndex < 0 ||
          newIndex >= current.length
        ) {
          return current;
        }

        const reordered = [
          ...current,
        ];

        const [
          movedExercise,
        ] = reordered.splice(
          index,
          1,
        );

        reordered.splice(
          newIndex,
          0,
          movedExercise,
        );

        return reordered;
      },
    );
  }

  async function replaceExercise(
    exerciseId: string,
    exercise: WorkoutExercise,
  ) {
    const normalized =
      normalizeExercise(exercise);

    const oldExercise =
      exercises.find(
        (item) =>
          item.id === exerciseId,
      );

    if (!oldExercise) {
      throw new Error(
        "Exercise to replace was not found",
      );
    }

    if (!workoutId) {
      setExercises(
        (current) => {
          const index =
            current.findIndex(
              (item) =>
                item.id ===
                exerciseId,
            );

          if (index === -1) {
            return current;
          }

          const next = [...current];

          next[index] =
            normalized;

          return next;
        },
      );

      return;
    }

    const databaseExercise =
      await addExerciseToWorkout(
        workoutId,
        normalized.exerciseId,
        {
          weightUnit:
            normalized.weightUnit,
          distanceUnit:
            normalized.distanceUnit,
        },
      );

    const storedUserId =
      await AsyncStorage.getItem(
        "vytor_user_id",
      );

    const userId = Number(
      storedUserId,
    );

    let previousSets:
      | PreviousWorkoutSet[]
      | undefined = [];

    if (Number.isInteger(userId)) {
      try {
        const previous =
          await getLastExerciseWorkout(
            normalized.exerciseId,
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

    setExercises(
      (current) => {
        const index =
          current.findIndex(
            (item) =>
              item.id ===
              exerciseId,
          );

        if (index === -1) {
          return current;
        }

        const next = [...current];

        next[index] = {
          ...normalized,
          workoutExerciseId:
            databaseExercise.id,
          previousSets,
        };

        return next;
      },
    );
  }

  return (
    <WorkoutContext.Provider
      value={{
        startedAt,
        isActive:
          startedAt !== null,
        exercises,
        restEndsAt,
        startWorkout,
        finishWorkout,
        addSet,
        completeSet,
        updateSet,
        updateWeightUnit,
        updateDistanceUnit,
        addExercise,
        deleteExercise,
        moveExercise,
        replaceExercise,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const context =
    useContext(WorkoutContext);

  if (!context) {
    throw new Error(
      "useWorkout must be used inside WorkoutProvider",
    );
  }

  return context;
}