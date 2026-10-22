import { draftSignature, isLocalWorkoutSnapshot, recoverySource } from "@/utils/recovery";
import { useAppTheme } from "@/context/theme-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AppState,
} from "react-native";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { WorkoutDraftSyncCoordinator } from "@/services/workout-draft-sync";
import {
  isAccountDeleted,
  purgeMarkedDeletedAccountData,
  removeDeletedAccountLocalData,
  workoutDraftKey,
} from "@/services/account-local-data";

import {
  request,
  onSessionChange,
  saveWorkoutDraft,
  addExerciseToWorkout,
  cancelWorkout,
  captureSessionRequestBinding,
  createWorkoutTemplate,
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
  type SessionChange,
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
  dropSetOfId?: string;
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
  activeWorkoutId: number | null;
  workoutRevision: number;
  notes: string;
  setNotes: (notes: string) => void;
  syncStatus: string;
  reloadActiveWorkout: () => Promise<void>;
  flushWorkoutDraft: () => Promise<void>;
  updateExerciseNotes: (id: string, notes: string) => void;
  setTimer: (seconds: number) => void;
  savePreset: () => Promise<boolean>;
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

type WorkoutOperationIdentity = {
  accountId: string;
  workoutId: number | null;
  sessionGeneration: number;
  workoutGeneration: number;
};

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
  if (!exercise || typeof exercise !== "object" || !Array.isArray(exercise.sets)) throw new Error("Invalid workout exercise cache");
  if (exercise.sets.some((set) => !set || typeof set !== "object" || !Number.isSafeInteger(set.setNumber) || set.setNumber < 1)) throw new Error("Invalid workout set cache");
  return {
    ...exercise,

    measurementType:
      exercise.measurementType ??
      "WEIGHT_REPS",

    weightUnit:
      exercise.weightUnit ?? "KG",

    distanceUnit:
      exercise.distanceUnit ?? "KM",

    sets: exercise.sets.map((set, index) => ({
      ...set,
      id: typeof set.id === "string" ? set.id : `${exercise.id}-set-${set.setNumber || index + 1}`,
      weight: set.weight ?? "",
      reps: set.reps ?? "",
      distance: set.distance ?? "",
      durationSeconds:
        set.durationSeconds ?? "",
      completed:
        set.completed ?? false,
      setType: set.setType ?? "REGULAR",
      dropSetOfId: typeof set.dropSetOfId === "string" ? set.dropSetOfId : undefined,
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
  const draftSync = useRef(new WorkoutDraftSyncCoordinator<{ exercises: WorkoutExercise[]; restEndsAt: number | null; notes: string }>());
  const latestDraft = useRef({ exercises, restEndsAt, notes });
  const syncedDraft = useRef("");
  const localWrites = useRef<Promise<void>>(Promise.resolve());
  const storageGeneration = useRef(0);
  const sessionGeneration = useRef(0);
  const workoutGeneration = useRef(0);
  const reloadGeneration = useRef(0);
  const mutationOwner = useRef<symbol | null>(null);
  const accountIdRef = useRef<string | null>(null);
  const workoutIdRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const syncStatusRef = useRef(syncStatus);
  startedAtRef.current = startedAt;
  hydratedRef.current = hydrated;
  syncStatusRef.current = syncStatus;

  function replaceWorkoutIdentity(nextWorkoutId: number | null) {
    workoutGeneration.current += 1;
    workoutIdRef.current = nextWorkoutId;
    setWorkoutId(nextWorkoutId);
  }

  function setSyncLabel(label: string) {
    syncStatusRef.current = label;
    setSyncStatus(label);
  }

  function captureOperationIdentity(): WorkoutOperationIdentity | null {
    const currentAccount = accountIdRef.current;
    if (!currentAccount) return null;
    return {
      accountId: currentAccount,
      workoutId: workoutIdRef.current,
      sessionGeneration: sessionGeneration.current,
      workoutGeneration: workoutGeneration.current,
    };
  }

  function isSessionIdentityCurrent(identity: WorkoutOperationIdentity) {
    return identity.accountId === accountIdRef.current
      && identity.sessionGeneration === sessionGeneration.current;
  }

  function isWorkoutIdentityCurrent(identity: WorkoutOperationIdentity) {
    return isSessionIdentityCurrent(identity)
      && identity.workoutId === workoutIdRef.current
      && identity.workoutGeneration === workoutGeneration.current;
  }

  async function canWriteAccount(account: string) {
    return !(await isAccountDeleted(account, AsyncStorage));
  }

  async function cleanupCompletedDraft(identity: WorkoutOperationIdentity, signature: string) {
    await queueLocalWrite(async () => {
      const key = workoutDraftKey(identity.accountId);
      if (!(await canWriteAccount(identity.accountId))) {
        await AsyncStorage.removeItem(key);
        return;
      }
      const value = await AsyncStorage.getItem(key);
      if (!value) return;
      try {
        const snapshot = JSON.parse(value);
        if (isLocalWorkoutSnapshot(snapshot)
          && snapshot.workoutId === identity.workoutId
          && draftSignature(snapshot) === signature) {
          await AsyncStorage.removeItem(key);
        }
      } catch { /* Never delete a newer or unverifiable recovery snapshot. */ }
    });
  }

  function recordMutationError(identity: WorkoutOperationIdentity, error: unknown) {
    if (isWorkoutIdentityCurrent(identity) && (error as { status?: number }).status === 409) {
      setSyncLabel("Conflict: reload required");
    }
  }

  async function flushForOperation(identity: WorkoutOperationIdentity) {
    try {
      await flushWorkoutDraft();
    } catch (error) {
      if (!isWorkoutIdentityCurrent(identity)) return false;
      throw error;
    }
    return isWorkoutIdentityCurrent(identity);
  }

  useEffect(() => onSessionChange((change: SessionChange) => {
    const oldAccount = accountIdRef.current;
    if (change.reason === "account-deleted" && change.accountId && change.accountId !== oldAccount) {
      void queueLocalWrite(() => removeDeletedAccountLocalData(change.accountId!, AsyncStorage));
      return;
    }
    const oldWorkoutId = workoutIdRef.current;
    const oldStartedAt = startedAtRef.current;
    const oldDraft = latestDraft.current;
    const oldRevision = revision.current;
    const oldSyncedSignature = syncedDraft.current;
    const oldSignature = draftSignature(oldDraft);
    sessionGeneration.current += 1;
    reloadGeneration.current += 1;
    storageGeneration.current += 1;
    workoutGeneration.current += 1;
    mutationOwner.current = null;
    syncing.current = false;
    accountIdRef.current = null;
    workoutIdRef.current = null;
    void queueLocalWrite(async () => {
      if (change?.reason === "account-deleted" && change.accountId === oldAccount) {
        await removeDeletedAccountLocalData(oldAccount, AsyncStorage);
        return;
      }
      if (!oldAccount || !oldWorkoutId || !oldStartedAt) return;
      if (!(await canWriteAccount(oldAccount))) return;
      const key = workoutDraftKey(oldAccount);
      if (oldSignature === oldSyncedSignature) {
        await AsyncStorage.removeItem(key);
        return;
      }
      await AsyncStorage.setItem(key, JSON.stringify({
        startedAt: oldStartedAt,
        workoutId: oldWorkoutId,
        exercises: oldDraft.exercises,
        restEndsAt: oldDraft.restEndsAt,
        notes: oldDraft.notes,
        revision: oldRevision,
        syncedSignature: oldSyncedSignature,
      }));
    });
    setAccountId(null); setHydrated(false); setStartedAt(null); setWorkoutId(null); setExercises([]); setRestEndsAt(null); setNotes(""); revision.current = 0; syncedDraft.current = ""; setSyncLabel("Saved"); setSessionVersion((value) => value + 1);
  }), []);
  latestDraft.current = { exercises, restEndsAt, notes };

  function queueLocalWrite(task: () => Promise<void>) {
    localWrites.current = localWrites.current.catch(() => undefined).then(task);
    void localWrites.current.catch(() => undefined);
    return localWrites.current;
  }

  async function flushWorkoutDraft() {
    const statusIdentity = captureOperationIdentity();
    return draftSync.current.flush({
      awaitLocalWrite: () => localWrites.current,
      read: () => {
        const account = accountIdRef.current;
        const activeWorkoutId = workoutIdRef.current;
        if (!account || !activeWorkoutId) return null;
        const draft = latestDraft.current;
        return {
          accountId: account,
          workoutId: activeWorkoutId,
          generation: workoutGeneration.current,
          hydrated: hydratedRef.current,
          revision: revision.current,
          draft,
          signature: draftSignature(draft),
          syncedSignature: syncedDraft.current,
          conflict: syncStatusRef.current.startsWith("Conflict"),
        };
      },
      save: (snapshot) => saveWorkoutDraft(
        snapshot.workoutId,
        snapshot.revision,
        { exercises: snapshot.draft.exercises, restEndsAt: snapshot.draft.restEndsAt },
        snapshot.draft.notes,
      ),
      accept: (snapshot, nextRevision) => {
        revision.current = nextRevision;
        syncedDraft.current = snapshot.signature;
      },
      persistAccepted: (snapshot, nextRevision) => queueLocalWrite(async () => {
        if (snapshot.accountId !== accountIdRef.current || snapshot.generation !== workoutGeneration.current) return;
        if (!(await canWriteAccount(snapshot.accountId))) return;
        const key = workoutDraftKey(snapshot.accountId);
        const currentDraft = latestDraft.current;
        const currentSignature = draftSignature(currentDraft);
        if (currentSignature === snapshot.signature) {
          await AsyncStorage.removeItem(key);
          return;
        }
        await AsyncStorage.setItem(key, JSON.stringify({
          startedAt: startedAtRef.current,
          workoutId: snapshot.workoutId,
          exercises: currentDraft.exercises,
          restEndsAt: currentDraft.restEndsAt,
          notes: currentDraft.notes,
          revision: nextRevision,
          syncedSignature: snapshot.signature,
        }));
      }),
      status: (status) => {
        if (!statusIdentity || !isWorkoutIdentityCurrent(statusIdentity)) return;
        const labels = {
          syncing: "Syncing…",
          saved: "Saved to server",
          pending: "Locally saved · sync pending",
          conflict: "Conflict: reload required",
          error: "Sync failed · saved on this device",
          "local-error": "Local backup failed",
        } as const;
        setSyncLabel(labels[status]);
      },
    });
  }

  async function reloadActiveWorkout(preserveLocal = false, expectedSessionGeneration = sessionGeneration.current) {
    const requestGeneration = ++reloadGeneration.current;
    const account = accountIdRef.current;
    const current = () => requestGeneration === reloadGeneration.current
      && expectedSessionGeneration === sessionGeneration.current
      && account !== null
      && account === accountIdRef.current;
    if (!account || !current() || await isAccountDeleted(account, AsyncStorage)) return;
    if (!current()) return;
    const snapshot = preserveLocal ? await AsyncStorage.getItem(workoutDraftKey(account)) : null;
    if (!current()) return;
    let local: (ReturnType<typeof JSON.parse> & { exercises: WorkoutExercise[] }) | null = null;
    try {
      const parsed = snapshot ? JSON.parse(snapshot) : null;
      if (isLocalWorkoutSnapshot(parsed)) {
        local = { ...parsed, exercises: (parsed.exercises as WorkoutExercise[]).map(normalizeExercise) };
      }
    } catch { /* Corrupt cache is ignored without mutating valid server state. */ }
    const active = await getActiveWorkout();
    if (!current()) return;
    if (!active) {
      if (local) {
        setStartedAt(local.startedAt); replaceWorkoutIdentity(local.workoutId); setExercises(local.exercises);
        setRestEndsAt(typeof local.restEndsAt === "number" ? local.restEndsAt : null); setNotes(local.notes ?? "");
        revision.current = local.revision; syncedDraft.current = local.syncedSignature ?? "";
        setSyncLabel("Conflict: server workout unavailable");
        return;
      }
      setStartedAt(null); replaceWorkoutIdentity(null); setExercises([]); setRestEndsAt(null); setNotes(""); return;
    }
    replaceWorkoutIdentity(active.id);
    revision.current = active.revision;
    setNotes(active.notes ?? "");
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
    const source = recoverySource(active, local);
    if ((source === "local" || source === "conflict") && local) {
      setStartedAt(local.startedAt); replaceWorkoutIdentity(local.workoutId); revision.current = local.revision;
      setExercises(local.exercises); setNotes(typeof local.notes === "string" ? local.notes : ""); setRestEndsAt(typeof local.restEndsAt === "number" && Number.isFinite(local.restEndsAt) ? local.restEndsAt : null);
      syncedDraft.current = local.syncedSignature ?? "";
      setSyncLabel(source === "conflict" ? "Conflict: reload required" : "Locally saved · sync pending");
      return;
    }
    setExercises(serverExercises);
    setRestEndsAt(active.draft?.restEndsAt ?? null);
    syncedDraft.current = JSON.stringify({ exercises: serverExercises, restEndsAt: active.draft?.restEndsAt ?? null, notes: active.notes ?? "" });
    setSyncLabel("Saved to server");
  }

  async function savePreset() {
    const identity = captureOperationIdentity();
    if (!identity) throw new Error("No logged-in user found");
    const sourceExercises = latestDraft.current.exercises;
    const name = `Workout ${new Date().toLocaleDateString()}`;
    const exerciseIds = sourceExercises.map((item) => item.exerciseId);
    const configuration = Object.fromEntries(sourceExercises.map((item) => [String(item.exerciseId), {
      targetReps: item.sets.map((set) => Number(set.targetReps || set.reps) || 0),
      setTypes: item.sets.map((set) => set.setType),
      notes: item.notes,
      restSeconds: item.restSeconds,
      weightUnit: item.weightUnit,
      distanceUnit: item.distanceUnit,
    }]));
    try {
      const binding = await captureSessionRequestBinding(identity.accountId);
      if (!isSessionIdentityCurrent(identity)) return false;
      await createWorkoutTemplate(name, exerciseIds, configuration, binding);
    } catch (error) {
      if (!isSessionIdentityCurrent(identity)) return false;
      throw error;
    }
    return isSessionIdentityCurrent(identity);
  }

  function updateExerciseNotes(id: string, value: string) {
    setExercises((items) => items.map((item) => item.id === id ? { ...item, notes: value } : item));
  }
  function setTimer(seconds: number) { setRestEndsAt(seconds ? Date.now() + seconds * 1000 : null); }

  useEffect(() => {
    if (!hydrated || !workoutId) return;
    const sync = () => void flushWorkoutDraft().catch(() => undefined);
    const timeout = setTimeout(sync, 800);
    const retry = setInterval(sync, 15000);
    return () => { clearTimeout(timeout); clearInterval(retry); };
  // The current draft changes initiate synchronization; retries handle reconnects.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, restEndsAt, notes, hydrated, workoutId, syncStatus.startsWith("Conflict")]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void flushWorkoutDraft().catch(() => undefined);
    });
    return () => subscription.remove();
  // The listener must always flush the refs holding the newest draft.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, workoutId]);

  useEffect(() => {
    async function hydrate() {
      const generation = sessionGeneration.current;
      const isCurrent = (expectedAccount?: string | null) => generation === sessionGeneration.current
        && (expectedAccount === undefined || expectedAccount === accountIdRef.current);
      await purgeMarkedDeletedAccountData(AsyncStorage);
      if (!isCurrent()) return;
      const userId = await AsyncStorage.getItem("vytor_user_id");
      if (!isCurrent()) return;
      if (userId && await isAccountDeleted(userId, AsyncStorage)) {
        if (!isCurrent()) return;
        accountIdRef.current = null;
        setAccountId(null);
        setHydrated(true);
        return;
      }
      if (!isCurrent()) return;
      accountIdRef.current = userId;
      setAccountId(userId);
      if (!userId) { if (isCurrent(null)) setHydrated(true); return; }
      try {
        const settings = await getSettings();
        if (!isCurrent(userId)) return;
        applySettings(settings);
        setPreference(settings.theme);
        await reloadActiveWorkout(true, generation);
      } catch {
        if (!isCurrent(userId)) return;
        const snapshot = await AsyncStorage.getItem(workoutDraftKey(userId));
        if (!isCurrent(userId)) return;
        if (snapshot) {
          try {
            const data = JSON.parse(snapshot);
            if (!isLocalWorkoutSnapshot(data)) throw new Error("Invalid workout cache");
            const restoredExercises = (data.exercises as WorkoutExercise[]).map(normalizeExercise);
            if (!isCurrent(userId)) return;
            setStartedAt(data.startedAt); replaceWorkoutIdentity(data.workoutId);
            setExercises(restoredExercises); setRestEndsAt(typeof data.restEndsAt === "number" && Number.isFinite(data.restEndsAt) ? data.restEndsAt : null);
            setNotes(data.notes ?? ""); revision.current = data.revision ?? 0;
            setSyncLabel("Sync failed · saved on this device");
          } catch { /* Invalid cache is ignored. */ }
        }
      } finally { if (isCurrent(userId)) setHydrated(true); }
    }
    void hydrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionVersion]);

  useEffect(() => {
    if (!hydrated || !accountId) return;
    const key = workoutDraftKey(accountId);
    const generation = storageGeneration.current;
    // Absence in React state can mean logout, startup failure or account switch.
    // Only confirmed finish/discard/delete and a confirmed server save may remove
    // an account-scoped recovery draft.
    if (!startedAt || !workoutId) return;
    const value = JSON.stringify({ startedAt, workoutId, exercises, restEndsAt, notes, revision: revision.current, syncedSignature: syncedDraft.current });
    void queueLocalWrite(async () => {
      if (generation === storageGeneration.current && await canWriteAccount(accountId)) {
        await AsyncStorage.setItem(key, value);
      }
    });
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
    const identity = captureOperationIdentity();
    if (!identity) {
      throw new Error(
        "No logged-in user found",
      );
    }
    const userId = Number(identity.accountId);

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
      if (!isWorkoutIdentityCurrent(identity)) return;

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
      if (!isWorkoutIdentityCurrent(identity)) return;

      setExercises(
        exercisesWithPreviousData,
      );

      revision.current = workout.revision ?? 0;
      setNotes("");
      setSyncLabel("Saved to server");
      replaceWorkoutIdentity(workout.id);
      setRestEndsAt(null);
      setStartedAt(Date.now());
    } catch (error) {
      if (!isWorkoutIdentityCurrent(identity)) return;
      console.error(
        "Failed to start workout:",
        error,
      );

      if ((error as { status?: number }).status === 409 && isWorkoutIdentityCurrent(identity)) {
        await reloadActiveWorkout(false, identity.sessionGeneration);
        return;
      }
      throw error;
    }
  }

  async function finishWorkout() {
    const identity = captureOperationIdentity();
    if (!identity?.workoutId) {
      setStartedAt(null);
      setExercises([]);
      setRestEndsAt(null);
      return;
    }

    if (!(await flushForOperation(identity))) return;
    if (syncing.current) throw new Error("Workout is being updated. Please try again in a moment.");
    if (syncStatusRef.current.startsWith("Conflict")) throw new Error("Resolve the device conflict before finishing.");
    const owner = Symbol("finish-workout");
    mutationOwner.current = owner;
    syncing.current = true;
    try {
      const currentDraft = latestDraft.current;
      const completedSignature = draftSignature(currentDraft);
      const operationRevision = revision.current;
      const workoutExercises =
        currentDraft.exercises
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
                  id: set.id,
                  dropSetOfId: set.dropSetOfId,
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

      const finished = await finishWorkoutApi(identity.workoutId, workoutExercises, operationRevision);
      await cleanupCompletedDraft(identity, completedSignature);
      if (!isWorkoutIdentityCurrent(identity)) return;

      setStartedAt(null);
      setExercises([]);
      replaceWorkoutIdentity(null);
      setRestEndsAt(null);
      setNotes("");
      return finished.id as number;
    } catch (error) {
      if (!isWorkoutIdentityCurrent(identity)) return;
      recordMutationError(identity, error);
      console.error(
        "Failed to finish workout:",
        error,
      );

      throw error;
    } finally {
      if (mutationOwner.current === owner) {
        mutationOwner.current = null;
        syncing.current = false;
      }
    }
  }

  async function cancelActiveWorkout() {
    const identity = captureOperationIdentity();
    if (!identity?.workoutId) return;
    const completedSignature = draftSignature(latestDraft.current);
    try {
      await cancelWorkout(identity.workoutId);
    } catch (error) {
      if (!isWorkoutIdentityCurrent(identity)) return;
      recordMutationError(identity, error);
      throw error;
    }
    await cleanupCompletedDraft(identity, completedSignature);
    if (!isWorkoutIdentityCurrent(identity)) return;
    setStartedAt(null);
    setExercises([]);
    replaceWorkoutIdentity(null);
    setRestEndsAt(null);
    setNotes("");
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
          .filter((set) => set.id !== setId && set.dropSetOfId !== setId)
          .map((set, index) => ({ ...set, setNumber: index + 1 })),
      };
    }));
  }

  function setSetType(exerciseId: string, setId: string, type: WorkoutSetType) {
    setExercises((current) => current.map((exercise) =>
      exercise.id === exerciseId
        ? { ...exercise, sets: exercise.sets.map((set, index) => {
            if (set.id !== setId) return set;
            const source = [...exercise.sets.slice(0, index)].reverse().find((candidate) => candidate.setType !== "DROP");
            return { ...set, setType: type, dropSetOfId: type === "DROP" ? source?.id : undefined };
          }) }
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
        dropSetOfId: source.dropSetOfId ?? source.id,
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

    const identity = captureOperationIdentity();
    if (!identity?.workoutId) {
      setExercises(
        (current) => [
          ...current,
          normalized,
        ],
      );
      return;
    }

    if (!(await flushForOperation(identity))) return;

    let databaseExercise: { id: number; revision: number };
    try {
      databaseExercise = await addExerciseToWorkout(
        identity.workoutId,
        normalized.exerciseId,
        revision.current,
        normalized.weightUnit,
        normalized.distanceUnit,
      );
    } catch (error) {
      if (!isWorkoutIdentityCurrent(identity)) return;
      recordMutationError(identity, error);
      throw error;
    }
    if (!isWorkoutIdentityCurrent(identity)) return;

    const userId = Number(identity.accountId);

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

    if (!isWorkoutIdentityCurrent(identity)) return;
    revision.current = databaseExercise.revision;

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
    const identity = captureOperationIdentity();
    if (exercise?.workoutExerciseId) {
      if (!identity?.workoutId) return;
      if (!(await flushForOperation(identity))) return;
      let result: { revision: number };
      try {
        result = await deleteWorkoutExercise(exercise.workoutExerciseId, revision.current);
      } catch (error) {
        if (!isWorkoutIdentityCurrent(identity)) return;
        recordMutationError(identity, error);
        throw error;
      }
      if (!isWorkoutIdentityCurrent(identity)) return;
      revision.current = result.revision;
    }
    if (identity && !isWorkoutIdentityCurrent(identity)) return;
    setExercises((current) => current.filter((item) => item.id !== exerciseId));
  }

  async function moveExercise(exerciseId: string, direction: "up" | "down") {
    const index = exercises.findIndex((item) => item.id === exerciseId);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= exercises.length) return;
    const reordered = [...exercises];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved!);
    const identity = captureOperationIdentity();
    if (identity?.workoutId) {
      if (!(await flushForOperation(identity))) return;
      let result: { revision: number };
      try {
        result = await updateWorkoutExerciseOrder(identity.workoutId, reordered.map((item) => item.workoutExerciseId!), revision.current);
      } catch (error) {
        if (!isWorkoutIdentityCurrent(identity)) return;
        recordMutationError(identity, error);
        throw error;
      }
      if (!isWorkoutIdentityCurrent(identity)) return;
      revision.current = result.revision;
    }
    if (identity && !isWorkoutIdentityCurrent(identity)) return;
    setExercises(reordered);
  }

  async function replaceExercise(exerciseId: string, exercise: WorkoutExercise) {
    const old = exercises.find((item) => item.id === exerciseId);
    const identity = captureOperationIdentity();
    if (!old?.workoutExerciseId || !identity?.workoutId) throw new Error("Active exercise was not found");
    if (!(await flushForOperation(identity))) return;
    if (syncing.current) throw new Error("Workout is being updated. Try again in a moment.");
    const owner = Symbol("replace-exercise");
    mutationOwner.current = owner;
    syncing.current = true;
    try {
      const normalized = normalizeExercise(exercise);
      const saved = await request(`/workout-exercises/${old.workoutExerciseId}/replace`, "PATCH", { exerciseId: exercise.exerciseId, weightUnit: normalized.weightUnit, distanceUnit: normalized.distanceUnit, revision: revision.current });
      if (!isWorkoutIdentityCurrent(identity)) return;
      const userId = Number(identity.accountId);
      const [replacement] = await loadPreviousSets([{ ...normalized, workoutExerciseId: saved.id }], userId);
      if (!isWorkoutIdentityCurrent(identity)) return;
      revision.current = saved.revision;
      setExercises((items) => items.map((item) => item.id === exerciseId ? replacement! : item));
    } catch (error) {
      if (!isWorkoutIdentityCurrent(identity)) return;
      recordMutationError(identity, error);
      throw error;
    } finally {
      if (mutationOwner.current === owner) {
        mutationOwner.current = null;
        syncing.current = false;
      }
    }
  }

  return (
    <WorkoutContext.Provider
      value={{
        activeWorkoutId: workoutId, workoutRevision: revision.current,
        notes, setNotes, syncStatus, reloadActiveWorkout, flushWorkoutDraft, updateExerciseNotes, setTimer, savePreset,
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
