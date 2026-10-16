import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/context/theme-context";
import {
    useWorkout,
    type WorkoutExercise,
} from "@/context/workout-context";
import {
  request,
  deleteWorkoutTemplate,
  getWorkoutTemplates,
  type WorkoutTemplate,
} from "@/services/api";

export default function WorkoutSetupScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  const router = useRouter();
  const { reloadActiveWorkout, startWorkout, preferredWeightUnit, preferredDistanceUnit } = useWorkout();

  const [templates, setTemplates] = useState<
    WorkoutTemplate[]
  >([]);

  const [suspended, setSuspended] = useState<{ id: number; startedAt: string; template?: { name: string } | null; _count: { exercises: number } }[]>([]);
  const [resumeTarget, setResumeTarget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkoutTemplate | null>(null);

  async function loadTemplates() {
    try {
      const [data, drafts] = await Promise.all([getWorkoutTemplates(), request("/workouts/drafts/suspended")]);
      setSuspended(drafts);
      setTemplates(data); setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load templates");
      console.error(
        "Failed to load workout templates:",
        error,
      );
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadTemplates();
    }, []),
  );

  async function startTemplate(
    template: WorkoutTemplate,
  ) {
    if (processing) return;
    setProcessing(true);
    const exercises: WorkoutExercise[] =
      template.exercises
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          id: `exercise-${item.exercise.id}-${Date.now()}-${Math.random()}`,
          exerciseId: item.exercise.id,
          name: item.exercise.name,
          description: item.exercise.description,
          measurementType: item.exercise.measurementType,
          notes: template.configuration?.[String(item.exercise.id)]?.notes ?? item.exercise.preferences?.[0]?.notes,
          restSeconds: template.configuration?.[String(item.exercise.id)]?.restSeconds ?? item.exercise.preferences?.[0]?.restSeconds,
          weightUnit: template.configuration?.[String(item.exercise.id)]?.weightUnit ?? item.exercise.preferences?.[0]?.weightUnit ?? preferredWeightUnit,
          distanceUnit: template.configuration?.[String(item.exercise.id)]?.distanceUnit ?? item.exercise.preferences?.[0]?.distanceUnit ?? preferredDistanceUnit,
          sets: (template.configuration?.[String(item.exercise.id)]?.targetReps ?? [0]).map((target, index) => ({
            id: `set-${item.exercise.id}-${index}-${Date.now()}`, setNumber: index + 1,
            weight: "", reps: "", targetReps: target ? String(target) : "", distance: "", durationSeconds: "", completed: false, setType: template.configuration?.[String(item.exercise.id)]?.setTypes?.[index] ?? "REGULAR",
          })),
        }));

    try {
      await startWorkout(
        exercises,
        template.id,
      );

      router.replace("/");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not start workout");
      console.error(
        "Failed to start workout:",
        error,
      );
    } finally { setProcessing(false); }
  }

  function startFreestyle() {
    router.push("/exercise-picker?mode=freestyle");
  }

  async function confirmDelete() {
    if (!deleteTarget || processing) return;
    setProcessing(true);
    try { await deleteWorkoutTemplate(deleteTarget.id); setDeleteTarget(null); await loadTemplates(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete template"); setDeleteTarget(null); }
    finally { setProcessing(false); }
  }

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
      >
        <View style={styles.center}>
          <ActivityIndicator size="large" />

          <Text style={styles.loadingText}>
            Loading workouts...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <Text style={styles.title}>
            START WORKOUT
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
        >
          {suspended.length > 0 && <><Text style={styles.sectionTitle}>PAUSED WORKOUTS</Text>{suspended.map((draft) => <Pressable key={draft.id} style={styles.templateCard} onPress={() => setResumeTarget(draft.id)}><Text style={styles.cardTitle}>{draft.template?.name ?? "Workout"} · {new Date(draft.startedAt).toLocaleDateString()} · {draft._count.exercises} exercises ›</Text></Pressable>)}</>}
          <Text style={styles.sectionTitle}>
            FREESTYLE
          </Text>

          <Pressable
            style={styles.freestyleButton}
            onPress={startFreestyle}
          >
            <View>
              <Text style={styles.cardTitle}>
                FREESTYLE
              </Text>

              <Text style={styles.cardSubtitle}>
                Choose your exercises
              </Text>
            </View>

            <Text style={styles.arrow}>→</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>
            TEMPLATES
          </Text>

          <Pressable
            style={styles.createButton}
            onPress={() => router.push("/template-editor")}
          >
            <Text style={styles.createButtonText}>+ CREATE TEMPLATE</Text>
          </Pressable>

          {!!error && <><Text accessibilityRole="alert" style={styles.deleteText}>{error}</Text><Pressable style={styles.actionButton} onPress={() => void loadTemplates()}><Text style={styles.actionText}>Retry</Text></Pressable></>}
          {!templates.length && <Text style={styles.cardSubtitle}>No saved presets yet. Create a template or save your active workout.</Text>}
          {templates.map((template) => (
            <View
              key={template.id}
              style={styles.templateCard}
            >
              <Pressable
                style={styles.templateInfo}
                onPress={() => startTemplate(template)}
              >
                <Text style={styles.cardTitle}>
                  {template.name}
                </Text>

                <Text style={styles.cardSubtitle}>
                  {template.exercises.length} exercises
                </Text>

                <Text style={styles.exerciseList}>
                  {template.exercises
                    .sort(
                      (a, b) => a.order - b.order,
                    )
                    .map(
                      (item) =>
                        item.exercise.name,
                    )
                    .join("  •  ")}
                </Text>
              </Pressable>

              <View style={styles.templateActions}>
                {template.userId !== null && (
                  <>
                    <Pressable
                      style={styles.actionButton}
                      onPress={() => router.push({ pathname: "/template-editor", params: { templateId: template.id } })}
                    >
                      <Text style={styles.actionText}>⚙ EDIT</Text>
                    </Pressable>
                    <Pressable style={styles.actionButton} onPress={() => setDeleteTarget(template)}>
                      <Text style={styles.deleteText}>DELETE</Text>
                    </Pressable>
                  </>
                )}
                <Pressable style={styles.startTemplateButton} onPress={() => startTemplate(template)}>
                  <Text style={styles.arrow}>→</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
      <ConfirmDialog visible={deleteTarget !== null} busy={processing} title="Delete template?" message={`Delete “${deleteTarget?.name ?? ""}”? Existing workouts are preserved.`} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} confirmLabel="Delete" />
      <ConfirmDialog visible={resumeTarget !== null} busy={processing} title="Resume this workout?" message="Your currently active workout will be paused and retained. Unsynced edits on another device must be synchronized before switching." onCancel={() => setResumeTarget(null)} onConfirm={() => { if (!resumeTarget || processing) return; setProcessing(true); void request(`/workouts/${resumeTarget}/resume`, "POST").then(reloadActiveWorkout).then(() => router.replace("/")).catch((cause) => setError(cause.message)).finally(() => { setProcessing(false); setResumeTarget(null); }); }} confirmLabel="Resume" />
    </SafeAreaView>
  );
}

const createStyles = (Colors: AppPalette) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },

  loadingText: {
    marginTop: 12,
    color: Colors.textMuted,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  backText: {
    color: Colors.text,
    fontSize: 38,
    lineHeight: 38,
  },

  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 1,
    color: Colors.text,
  },

  headerSpacer: {
    width: 44,
  },

  content: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  sectionTitle: {
    marginTop: 14,
    marginBottom: 10,
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  freestyleButton: {
    minHeight: 76,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 7,
    backgroundColor: Colors.surface,
  },

  templateCard: {
    minHeight: 92,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 7,
    backgroundColor: Colors.surface,
  },

  templateInfo: {
    flex: 1,
    paddingRight: 12,
  },

  createButton: {
    minHeight: 48,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 7,
  },

  createButtonText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  templateActions: {
    alignItems: "flex-end",
    gap: 3,
  },

  actionButton: {
    minWidth: 54,
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  actionText: { color: Colors.textMuted, fontSize: 10, fontWeight: "800" },
  deleteText: { color: "#D46A6A", fontSize: 10, fontWeight: "800" },
  startTemplateButton: { minWidth: 54, minHeight: 34, alignItems: "center", justifyContent: "center" },

  cardTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800",
  },

  cardSubtitle: {
    marginTop: 3,
    color: Colors.textMuted,
    fontSize: 13,
  },

  exerciseList: {
    marginTop: 8,
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },

  arrow: {
    color: Colors.accent,
    fontSize: 27,
    fontWeight: "600",
  },
});
