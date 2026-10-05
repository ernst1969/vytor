import { useRouter } from "expo-router";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { Colors } from "@/constants/theme";
import { useWorkout } from "@/context/workout-context";

export default function WorkoutScreen() {
  const router = useRouter();

  const {
    exercises,
    addSet,
    updateSet,
  } = useWorkout();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>WORKOUT</Text>

        {exercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              No exercises yet
            </Text>

            <Text style={styles.emptyText}>
              Add an exercise to get started.
            </Text>
          </View>
        ) : (
          exercises.map((exercise, exerciseIndex) => (
            <View
              key={exercise.id}
              style={styles.exerciseCard}
            >
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseNumber}>
                  {exerciseIndex + 1}
                </Text>

                <Text style={styles.exerciseName}>
                  {exercise.name}
                </Text>
              </View>

              <View style={styles.columnHeaders}>
                <Text style={styles.setHeader}>SET</Text>
                <Text style={styles.inputHeader}>WEIGHT</Text>
                <Text style={styles.inputHeader}>REPS</Text>
              </View>

              {exercise.sets.map((set) => (
                <View
                  key={set.id}
                  style={styles.setRow}
                >
                  <Text style={styles.setNumber}>
                    {set.setNumber}
                  </Text>

                  <TextInput
                    style={styles.input}
                    value={set.weight}
                    onChangeText={(value) =>
                      updateSet(
                        exercise.id,
                        set.id,
                        "weight",
                        value,
                      )
                    }
                    placeholder="kg"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                  />

                  <TextInput
                    style={styles.input}
                    value={set.reps}
                    onChangeText={(value) =>
                      updateSet(
                        exercise.id,
                        set.id,
                        "reps",
                        value,
                      )
                    }
                    placeholder="reps"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              ))}

              <Pressable
                style={styles.addSetButton}
                onPress={() => addSet(exercise.id)}
              >
                <Text style={styles.addSetText}>
                  + ADD SET
                </Text>
              </Pressable>
            </View>
          ))
        )}

        <Pressable
          style={styles.addExerciseButton}
          onPress={() => router.push("/exercise-picker")}
        >
          <Text style={styles.addExerciseText}>
            + ADD EXERCISE
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: Colors.text,
    letterSpacing: 1,
    marginBottom: 18,
  },

  exerciseCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },

  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  exerciseNumber: {
    width: 32,
    height: 32,
    textAlign: "center",
    textAlignVertical: "center",
    borderRadius: 16,
    backgroundColor: Colors.accent,
    color: Colors.background,
    fontWeight: "900",
    marginRight: 10,
  },

  exerciseName: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
  },

  columnHeaders: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  setHeader: {
    width: 44,
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textMuted,
  },

  inputHeader: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textMuted,
    textAlign: "center",
  },

  setRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  setNumber: {
    width: 44,
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textMuted,
    textAlign: "center",
  },

  input: {
    flex: 1,
    height: 46,
    marginHorizontal: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    color: Colors.text,
    fontSize: 16,
    textAlign: "center",
  },

  addSetButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  addSetText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },

  addExerciseButton: {
    marginTop: 4,
    paddingVertical: 18,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
  },

  addExerciseText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
  },

  emptyCard: {
    padding: 24,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  emptyTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },

  emptyText: {
    color: Colors.textMuted,
    fontSize: 15,
  },
});