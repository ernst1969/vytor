import { draftSignature, recoverySource } from "@/utils/recovery";
import { useAppTheme } from "@/context/theme-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";

import {
  request,
  onSessionChange,
  saveWorkoutDraft,
  addExerciseToWorkout,
  cancelWorkout,
  createWorkout,
  deleteWorkoutExercise,
  finishWorkout as finishWorkoutApi,
  getActiveWorkout,
  getSettings,
  getLastExerciseWorkout,
  updateWorkoutExerciseOrder,
  type DistanceUnit,
  type ExerciseMeasurementType,
  type WeightUnit,
  type WorkoutSetType,
} from "@/services/api";

export type WorkoutSet = {
  id: string;
  setNumber: number;
  weight: string;
  reps: string;
  distance: string;
  durationSeconds: string;
  completed: boolean;
  setType: WorkoutSetType;
  targetReps?: string;
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
  restSeconds?: number;
  notes?: string;
  sets: WorkoutSet[];
  workoutExerciseId?: number;
  previousSets?: PreviousWorkoutSet[];
};

type UpdateSetField =
  | "weight"
  | "reps"
  | "distance"
  | "durationSeconds"
  | "targetReps";

type WorkoutContextValue = {
  notes: string;
  setNotes: (notes: string) => void;
  syncStatus: string;
  reloadActiveWorkout: () => Promise<void>;
  updateExerciseNotes: (id: string, notes: string) => void;
  setTimer: (seconds: number) => void;
  savePreset: () => Promise<void>;
  startedAt: number | null;
  isActive: boolean;
  exercises: WorkoutExercise[];
  restEndsAt: number | null;
  restSeconds: number;
  preferredWeightUnit: WeightUnit;
  preferredDistanceUnit: DistanceUnit;
  applySettings: (settings: {
    preferredWeightUnit: WeightUnit;
    preferredDistanceUnit: DistanceUnit;
    restSeconds: number;
  }) => void;

  startWorkout: (
    exercises: WorkoutExercise[],
    templateId?: number | null,
  ) => Promise<void>;

  finishWorkout: () => Promise<number | undefined>;
  cancelActiveWorkout: () => Promise<void>;

  addSet: (exerciseId: string, afterId?: string) => void;
  deleteSet: (exerciseId: string, setId: string) => void;
  setSetType: (exerciseId: string, setId: string, type: WorkoutSetType) => void;
  addDropSet: (exerciseId: string, setId: string) => void;
  updateExerciseRest: (exerciseId: string, seconds: number) => void;

  completeSet: (
    exerciseId: string,
    setId: string,
  ) => boolean;

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
  ) => Promise<void>;

  moveExercise: (
    exerciseId: string,
    direction: "up" | "down",
  ) => Promise<void>;

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
  if (!value.trim()) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) && number >= 0
    ? number
    : null;
}

function stringToInteger(value: string) {
  if (!value.trim()) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Number.isInteger(number) && number >= 0 ? number : null;
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
      setType: set.setType ?? "REGULAR",
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
  const { setPreference } = useAppTheme();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [startedAt, setStartedAt] =
    useState<number | null>(null);

  const [exercises, setExercises] =
    useState<WorkoutExercise[]>([]);

  const [workoutId, setWorkoutId] =
    useState<number | null>(null);

  const [restEndsAt, setRestEndsAt] =
    useState<number | null>(null);
  const [restSeconds, setRestSeconds] = useState(90);
  const [preferredWeightUnit, setPreferredWeightUnit] = useState<WeightUnit>("KG");
  const [preferredDistanceUnit, setPreferredDistanceUnit] = useState<DistanceUnit>("KM");
  const [hydrated, setHydrated] = useState(false);
  const [notes, setNotes] = useState("");
  const [syncStatus, setSyncStatus] = useState("Saved");
  const revision = useRef(0);
  const syncing = useRef(false);
  const latestDraft = useRef({ exercises, restEndsAt });
  const syncedDraft = useRef("");
  useEffect(() => onSessionChange(() => { setHydrated(false); setStartedAt(null); setWorkoutId(null); setExercises([]); setNotes(""); revision.current = 0; syncedDraft.current = ""; setSessionVersion((value) => value + 1); }), []);
  latestDraft.current = { exercises, restEndsAt };

  async function reloadActiveWorkout(preserveLocal = false) {
    const account = await AsyncStorage.getItem("vytor_user_id");
    const snapshot = preserveLocal && account ? await AsyncStorage.getItem(`vytor_active_workout_${account}`) : null;
    const active = await getActiveWorkout();
    if (account !== await AsyncStorage.getItem("vytor_user_id")) return;
    if (!active) { setStartedAt(null); setWorkoutId(null); setExercises([]); return; }
    revision.current = active.revision;
    setNotes(active.notes ?? "");
    setWorkoutId(active.id);
    setStartedAt(new Date(active.startedAt).getTime());
    const serverExercises: WorkoutExercise[] = active.exercises.map((item: any) => {
      const saved = active.draft?.exercises?.find((entry: WorkoutExercise) => entry.workoutExerciseId === item.id);
      return saved ? normalizeExercise({ ...saved, exerciseId: item.exercise.id, name: item.exercise.name, description: item.exercise.description, measurementType: item.exercise.measurementType, weightUnit: item.weightUnit, distanceUnit: item.distanceUnit, restSeconds: item.restSeconds ?? saved.restSeconds }) : normalizeExercise({
        id: `exercise-${item.id}`, workoutExerciseId: item.id, exerciseId: item.exercise.id,
        name: item.exercise.name, description: item.exercise.description, measurementType: item.exercise.measurementType,
        weightUnit: item.weightUnit, distanceUnit: item.distanceUnit, restSeconds: item.restSeconds ?? undefined,
        sets: [{ id: `set-${item.id}-1`, setNumber: 1, weight: "", reps: "", distance: "", durationSeconds: "", completed: false, setType: "REGULAR" }],
      });
    });
    let local = null;
    try { local = snapshot ? JSON.parse(snapshot) : null; } catch { /* Corrupt cache is ignored. */ }
    const source = recoverySource(active, local);
    if ((source === "local" || source === "conflict") && local) {
      setExercises(local.exercises.map(normalizeExercise)); setNotes(local.notes ?? ""); setRestEndsAt(local.restEndsAt ?? null);
      syncedDraft.current = local.syncedSignature ?? "";
      setSyncStatus(source === "conflict" ? "Conflict: reload required" : "Offline changes ready to sync");
      return;
    }
    setExercises(serverExercises);
    setRestEndsAt(active.draft?.restEndsAt ?? null);
    syncedDraft.current = JSON.stringify({ exercises: serverExercises, restEndsAt: active.draft?.restEndsAt ?? null, notes: active.notes ?? "" });
    setSyncStatus("Saved");
  }

  async function savePreset() {
    const { createWorkoutTemplate } = await import("@/services/api");
    await createWorkoutTemplate(`Workout ${new Date().toLocaleDateString()}`, exercises.map((item) => item.exerciseId), Object.fromEntries(exercises.map((item) => [String(item.exerciseId), { targetReps: item.sets.map((set) => Number(set.targetReps || set.reps) || 0), setTypes: item.sets.map((set) => set.setType), notes: item.notes, restSeconds: item.restSeconds, weightUnit: item.weightUnit, distanceUnit: item.distanceUnit }])));
  }

  function updateExerciseNotes(id: string, value: string) {
    setExercises((items) => items.map((item) => item.id === id ? { ...item, notes: value } : item));
  }
  function setTimer(seconds: number) { setRestEndsAt(seconds ? Date.now() + seconds * 1000 : null); }

  useEffect(() => {
    if (!hydrated || !workoutId) return;
    let disposed = false;
    async function sync() {
      const signature = draftSignature({ ...latestDraft.current, notes });
      if (disposed || syncing.current || syncStatus.startsWith("Conflict") || signature === syncedDraft.current) return;
      syncing.current = true;
      const syncAccount = accountId;
      try {
        setSyncStatus("Syncing…");
        const result = await saveWorkoutDraft(workoutId!, revision.current, latestDraft.current, notes);
        if (syncAccount !== await AsyncStorage.getItem("vytor_user_id")) return;
        revision.current = result.revision;
        syncedDraft.current = signature;
        if (!disposed) setSyncStatus("Saved");
        if (syncAccount && syncAccount === await AsyncStorage.getItem("vytor_user_id")) await AsyncStorage.mergeItem(`vytor_active_workout_${syncAccount}`, JSON.stringify({ revision: result.revision, syncedSignature: signature }));
      } catch (error) {
        if (!disposed) setSyncStatus([404, 409].includes((error as { status?: number }).status ?? 0) ? "Conflict: reload required" : "Offline: saved on this device");
      } finally { syncing.current = false; }
    }
    const timeout = setTimeout(() => void sync(), 800);
    const retry = setInterval(() => void sync(), 15000);
    return () => { disposed = true; clearTimeout(timeout); clearInterval(retry); };
  // The current draft changes initiate synchronization; retries handle reconnects.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, restEndsAt, notes, hydrated, workoutId, syncStatus.startsWith("Conflict")]);

  useEffect(() => {
    async function hydrate() {
      const userId = await AsyncStorage.getItem("vytor_user_id");
      setAccountId(userId);
      if (!userId) { setHydrated(true); return; }
      try {
        const settings = await getSettings();
        applySettings(settings);
        setPreference(settings.theme);
        await reloadActiveWorkout(true);
      } catch {
        const snapshot = await AsyncStorage.getItem(`vytor_active_workout_${userId}`);
        if (snapshot) {
          try {
            const data = JSON.parse(snapshot);
            setStartedAt(data.startedAt); setWorkoutId(data.workoutId);
            setExercises(data.exercises.map(normalizeExercise)); setRestEndsAt(data.restEndsAt);
            setNotes(data.notes ?? ""); revision.current = data.revision ?? 0;
            setSyncStatus("Offline: saved on this device");
          } catch { /* Invalid cache is ignored. */ }
        }
      } finally { setHydrated(true); }
    }
    void hydrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionVersion]);

  useEffect(() => {
    if (!hydrated || !accountId) return;
    const key = `vytor_active_workout_${accountId}`;
    if (!startedAt || !workoutId) { void AsyncStorage.removeItem(key); return; }
    void AsyncStorage.setItem(key, JSON.stringify({ startedAt, workoutId, exercises, restEndsAt, notes, revision: revision.current, syncedSignature: syncedDraft.current }));
  }, [exercises, hydrated, restEndsAt, startedAt, workoutId, notes, accountId]);


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
            sets: exercise.sets.map((set, index) => ({ ...set, targetReps: set.targetReps || (previous?.sets?.[index]?.reps ? String(previous.sets[index].reps) : "") })),
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

  function applySettings(settings: {
    preferredWeightUnit: WeightUnit;
    preferredDistanceUnit: DistanceUnit;
    restSeconds: number;
  }) {
    setPreferredWeightUnit(settings.preferredWeightUnit);
    setPreferredDistanceUnit(settings.preferredDistanceUnit);
    setRestSeconds(settings.restSeconds);
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
          (exercise) => ({
            ...exercise,
            workoutExerciseId:
              databaseExercises.find((item: { exerciseId: number }) => item.exerciseId === exercise.exerciseId)?.id,
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

      revision.current = workout.revision ?? 0;
      setNotes("");
      setSyncStatus("Saved");
      setWorkoutId(workout.id);
      setRestEndsAt(null);
      setStartedAt(Date.now());
    } catch (error) {
      console.error(
        "Failed to start workout:",
        error,
      );

      if ((error as { status?: number }).status === 409) { await reloadActiveWorkout(); return; }
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

    if (syncing.current) throw new Error("Workout is syncing. Please try again in a moment.");
    if (syncStatus.startsWith("Conflict")) throw new Error("Resolve the device conflict before finishing.");
    syncing.current = true;
    try {
      const saved = await saveWorkoutDraft(workoutId, revision.current, { exercises, restEndsAt }, notes);
      revision.current = saved.revision;
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
                  setType: set.setType,
                };
              }),
          }))
          .filter(
            (exercise) =>
              exercise.sets.length > 0,
          );

      const finished = await finishWorkoutApi(workoutId, workoutExercises, revision.current);

      setStartedAt(null);
      setExercises([]);
      setWorkoutId(null);
      setRestEndsAt(null);
      setNotes("");
      return finished.id as number;
    } catch (error) {
      console.error(
        "Failed to finish workout:",
        error,
      );

      throw error;
    } finally { syncing.current = false; }
  }

  async function cancelActiveWorkout() {
    if (workoutId) await cancelWorkout(workoutId);
    setStartedAt(null);
    setExercises([]);
    setWorkoutId(null);
    setRestEndsAt(null);
  }

  function addSet(exerciseId: string, afterId?: string) {
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

            const position = afterId ? exercise.sets.findIndex((set) => set.id === afterId) + 1 : exercise.sets.length;
            return {
              ...exercise,
              sets: [
                ...exercise.sets.slice(0, position),
                {
                  id: `${exercise.id}-set-${Date.now()}`,
                  setNumber:
                    nextSetNumber,
                  weight: "",
                  reps: "",
                  distance: "",
                  durationSeconds: "",
                  completed: false,
                  setType: "REGULAR" as const,
                },
                ...exercise.sets.slice(position),
              ].map((set, index) => ({ ...set, setNumber: index + 1 })),
            };
          },
        ),
    );
  }

  function deleteSet(exerciseId: string, setId: string) {
    setExercises((current) => current.map((exercise) => {
      if (exercise.id !== exerciseId) return exercise;
      return {
        ...exercise,
        sets: exercise.sets
          .filter((set) => set.id !== setId)
          .map((set, index) => ({ ...set, setNumber: index + 1 })),
      };
    }));
  }

  function setSetType(exerciseId: string, setId: string, type: WorkoutSetType) {
    setExercises((current) => current.map((exercise) =>
      exercise.id === exerciseId
        ? { ...exercise, sets: exercise.sets.map((set) => set.id === setId ? { ...set, setType: type } : set) }
        : exercise,
    ));
  }

  function addDropSet(exerciseId: string, setId: string) {
    setExercises((current) => current.map((exercise) => {
      if (exercise.id !== exerciseId) return exercise;
      const index = exercise.sets.findIndex((set) => set.id === setId);
      const source = exercise.sets[index];
      if (index < 0 || !source) return exercise;
      const next = [...exercise.sets];
      next.splice(index + 1, 0, {
        ...source,
        id: `${exercise.id}-drop-${Date.now()}`,
        completed: false,
        setType: "DROP",
      });
      return { ...exercise, sets: next.map((set, setIndex) => ({ ...set, setNumber: setIndex + 1 })) };
    }));
  }

  function updateExerciseRest(exerciseId: string, seconds: number) {
    const normalized = Math.max(0, Math.min(3600, Math.round(seconds)));
    setExercises((current) => current.map((item) =>
      item.id === exerciseId ? { ...item, restSeconds: normalized } : item,
    ));

  }

  function completeSet(
    exerciseId: string,
    setId: string,
  ) {
    const exercise = exercises.find((item) => item.id === exerciseId);
    const targetSet = exercise?.sets.find((item) => item.id === setId);

    if (!exercise || !targetSet) return false;

    if (!targetSet.completed) {
      const values = getRelevantSetValues(exercise, targetSet);
      const valid =
        (exercise.measurementType === "WEIGHT_REPS" && values.weight !== null && values.reps !== null) ||
        (exercise.measurementType === "REPS" && values.reps !== null) ||
        (exercise.measurementType === "DISTANCE_TIME" && values.distance !== null && values.durationSeconds !== null) ||
        (exercise.measurementType === "TIME" && values.durationSeconds !== null) ||
        (exercise.measurementType === "WEIGHT_DISTANCE" && values.weight !== null && values.distance !== null);

      if (!valid) return false;
    }

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
                          (exercise.restSeconds ?? restSeconds) * 1000
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

    return true;
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
                        completed: field === "targetReps" ? set.completed : false,
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
        normalized.weightUnit,
        normalized.distanceUnit,
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

  async function deleteExercise(exerciseId: string) {
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (exercise?.workoutExerciseId) await deleteWorkoutExercise(exercise.workoutExerciseId);
    setExercises((current) => current.filter((item) => item.id !== exerciseId));
  }

  async function moveExercise(exerciseId: string, direction: "up" | "down") {
    const index = exercises.findIndex((item) => item.id === exerciseId);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= exercises.length) return;
    const reordered = [...exercises];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved!);
    if (workoutId) await updateWorkoutExerciseOrder(workoutId, reordered.map((item) => item.workoutExerciseId!));
    setExercises(reordered);
  }

  async function replaceExercise(exerciseId: string, exercise: WorkoutExercise) {
    const old = exercises.find((item) => item.id === exerciseId);
    if (!old?.workoutExerciseId || !workoutId) throw new Error("Active exercise was not found");
    if (syncing.current) throw new Error("Workout is syncing. Try again in a moment.");
    syncing.current = true;
    try {
      const normalized = normalizeExercise(exercise);
      const saved = await request(`/workout-exercises/${old.workoutExerciseId}/replace`, "PATCH", { exerciseId: exercise.exerciseId, weightUnit: normalized.weightUnit, distanceUnit: normalized.distanceUnit, revision: revision.current });
      revision.current = saved.revision;
      const userId = Number(await AsyncStorage.getItem("vytor_user_id"));
      const [replacement] = await loadPreviousSets([{ ...normalized, workoutExerciseId: saved.id }], userId);
      setExercises((items) => items.map((item) => item.id === exerciseId ? replacement! : item));
    } finally { syncing.current = false; }
  }

  return (
    <WorkoutContext.Provider
      value={{
        notes, setNotes, syncStatus, reloadActiveWorkout, updateExerciseNotes, setTimer, savePreset,
        startedAt,
        isActive:
          startedAt !== null,
        exercises,
        restEndsAt,
        restSeconds,
        preferredWeightUnit,
        preferredDistanceUnit,
        applySettings,
        startWorkout,
        finishWorkout,
        cancelActiveWorkout,
        addSet,
        deleteSet,
        setSetType,
        addDropSet,
        updateExerciseRest,
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
