import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  // --------------------------------------------------
  // Exercises
  // --------------------------------------------------

  const exercises = [
    {
      name: "Barbell Back Squat",
      description:
        "A barbell squat targeting the quads, glutes, and hamstrings.",
    },
    {
      name: "Bench Press",
      description:
        "A barbell press targeting the chest, shoulders, and triceps.",
    },
    {
      name: "Deadlift",
      description:
        "A compound pull targeting the posterior chain.",
    },
    {
      name: "Overhead Press",
      description:
        "A standing barbell press targeting the shoulders and triceps.",
    },
    {
      name: "Barbell Row",
      description:
        "A horizontal pull targeting the upper back and lats.",
    },
    {
      name: "Pull-Up",
      description:
        "A bodyweight vertical pull targeting the lats and upper back.",
    },
    {
      name: "Dips",
      description:
        "A bodyweight pressing movement targeting the chest and triceps.",
    },
    {
      name: "Romanian Deadlift",
      description:
        "A hip-hinge movement targeting the hamstrings and glutes.",
    },
    {
      name: "Leg Press",
      description:
        "A machine-based compound movement targeting the legs.",
    },
    {
      name: "Incline Bench Press",
      description:
        "An incline barbell press targeting the upper chest and shoulders.",
    },
  ];

  const createdExercises: Record<string, number> = {};

  for (const exercise of exercises) {
    const result = await prisma.exercise.upsert({
      where: {
        name: exercise.name,
      },
      update: {
        description: exercise.description,
      },
      create: exercise,
    });

    createdExercises[result.name] = result.id;
  }

  // --------------------------------------------------
  // Starter Template
  // --------------------------------------------------

  const template = await prisma.workoutTemplate.upsert({
    where: {
      id: 1,
    },
    update: {
      name: "Starter Workout",
    },
    create: {
      name: "Starter Workout",
    },
  });

  // Remove existing exercises from this template so
  // running the seed again does not create duplicates.
  await prisma.workoutTemplateExercise.deleteMany({
    where: {
      templateId: template.id,
    },
  });

  const templateExercises = [
    "Barbell Back Squat",
    "Bench Press",
    "Deadlift",
    "Overhead Press",
    "Barbell Row",
  ];

  await prisma.workoutTemplateExercise.createMany({
    data: templateExercises.map((exerciseName, index) => ({
      templateId: template.id,
      exerciseId: createdExercises[exerciseName],
      order: index,
    })),
  });

  console.log(`Seeded ${exercises.length} exercises.`);
  console.log(`Seeded template: ${template.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });