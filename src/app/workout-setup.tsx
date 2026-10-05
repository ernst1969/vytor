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

import { Colors } from "@/constants/theme";
import { useWorkout, type WorkoutExercise } from "@/context/workout-context";
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

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await getWorkoutTemplates();
      setTemplates(data);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  }

async function startTemplate(template: WorkoutTemplate) {
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
    await startWorkout(exercises, template.id);
    router.replace("/workout");
  } catch (error) {
    console.error("Failed to start workout:", error);
  }
}

function startFreestyle() {
  router.replace("/exercise-picker?mode=freestyle");
}

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading workouts...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>START WORKOUT</Text>

      <Text style={styles.subtitle}>
        Choose a template or start from scratch.
      </Text>

      <Pressable
        style={styles.freestyleButton}
        onPress={startFreestyle}
      >
        <Text style={styles.freestyleText}>FREESTYLE</Text>
        <Text style={styles.cardDescription}>
          Build your workout as you go
        </Text>
      </Pressable>

      <Text style={styles.sectionTitle}>TEMPLATES</Text>

      {templates.length === 0 ? (
        <Text style={styles.emptyText}>
          No workout templates found.
        </Text>
      ) : (
        templates.map((template) => (
          <Pressable
            key={template.id}
            style={styles.templateCard}
            onPress={() => startTemplate(template)}
          >
            <Text style={styles.templateName}>{template.name}</Text>

            <Text style={styles.exerciseCount}>
              {template.exercises.length} exercises
            </Text>

            <View style={styles.exerciseList}>
              {template.exercises
                .sort((a, b) => a.order - b.order)
                .map((item) => (
                  <Text
                    key={item.id}
                    style={styles.exerciseName}
                  >
                    • {item.exercise.name}
                  </Text>
                ))}
            </View>

            <Text style={styles.startTemplate}>
              START →
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  content: {
    padding: 20,
    paddingBottom: 40,
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

  title: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 1,
    color: Colors.text,
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
    marginBottom: 28,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: Colors.textMuted,
    marginTop: 30,
    marginBottom: 12,
  },

  freestyleButton: {
    padding: 20,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.accent,
  },

  freestyleText: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.accent,
    letterSpacing: 1,
    marginBottom: 6,
  },

  templateCard: {
    padding: 20,
    marginBottom: 14,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  templateName: {
    fontSize: 21,
    fontWeight: "800",
    color: Colors.text,
  },

  exerciseCount: {
    marginTop: 5,
    fontSize: 13,
    color: Colors.textMuted,
  },

  exerciseList: {
    marginTop: 14,
    gap: 5,
  },

  exerciseName: {
    fontSize: 15,
    color: Colors.textMuted,
  },

  startTemplate: {
    marginTop: 18,
    fontSize: 15,
    fontWeight: "900",
    color: Colors.accent,
    letterSpacing: 1,
  },

  emptyText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
});