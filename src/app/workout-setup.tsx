import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import {
    useWorkout,
    type WorkoutExercise,
} from "@/context/workout-context";
import { getWorkoutTemplates } from "@/services/api";

type TemplateExercise = {
  id: number;
  order: number;
  exercise: {
    id: number;
    name: string;
  };
};

type WorkoutTemplate = {
  id: number;
  name: string;
  exercises: TemplateExercise[];
};

export default function WorkoutSetupScreen() {
  const router = useRouter();
  const { startWorkout } = useWorkout();

  const [templates, setTemplates] = useState<
    WorkoutTemplate[]
  >([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await getWorkoutTemplates();
      setTemplates(data);
    } catch (error) {
      console.error(
        "Failed to load workout templates:",
        error,
      );
    } finally {
      setLoading(false);
    }
  }

  async function startTemplate(
    template: WorkoutTemplate,
  ) {
    const exercises: WorkoutExercise[] =
      template.exercises
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          id: `exercise-${item.exercise.id}-${Date.now()}-${Math.random()}`,
          exerciseId: item.exercise.id,
          name: item.exercise.name,
          sets: [
            {
              id: `set-${item.exercise.id}-${Date.now()}-${Math.random()}`,
              setNumber: 1,
              weight: "",
              reps: "",
            },
          ],
        }));

    try {
      await startWorkout(
        exercises,
        template.id,
      );

      router.replace("/");
    } catch (error) {
      console.error(
        "Failed to start workout:",
        error,
      );
    }
  }

  function startFreestyle() {
    router.push("/exercise-picker?mode=freestyle");
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

          {templates.map((template) => (
            <Pressable
              key={template.id}
              style={styles.templateCard}
              onPress={() =>
                startTemplate(template)
              }
            >
              <View style={styles.templateInfo}>
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
              </View>

              <Text style={styles.arrow}>→</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    borderColor: Colors.accent,
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