import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ExerciseSeed = {
  name: string;
  description: string;
  measurement:
    | "WEIGHT_REPS"
    | "BODYWEIGHT_REPS"
    | "REPS"
    | "DISTANCE_TIME"
    | "TIME"
    | "WEIGHT_DISTANCE";
};

const exercises: ExerciseSeed[] = [
  {
    name: "Barbell Back Squat",
    description: "A barbell squat performed with the bar resting across the upper back.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Front Squat",
    description: "A squat performed with the barbell held across the front of the shoulders.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Hack Squat",
    description: "A squat performed using a hack squat machine.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Leg Press",
    description: "A lower-body press performed on a leg press machine.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Bulgarian Split Squat",
    description: "A unilateral squat with the rear foot elevated.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Walking Lunge",
    description: "Alternating lunges performed while moving forward.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Reverse Lunge",
    description: "A lunge performed by stepping backward.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Forward Lunge",
    description: "A lunge performed by stepping forward.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Step-Up",
    description: "A unilateral leg exercise performed by stepping onto an elevated platform.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Goblet Squat",
    description: "A squat performed while holding a dumbbell or kettlebell at the chest.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Romanian Deadlift",
    description: "A hip-hinge movement emphasizing the hamstrings and glutes.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Deadlift",
    description: "A compound lift where a loaded barbell is lifted from the floor.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Sumo Deadlift",
    description: "A deadlift performed with a wide stance and toes turned outward.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Stiff-Leg Deadlift",
    description: "A deadlift variation emphasizing the hamstrings.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Hip Thrust",
    description: "A glute-focused hip extension exercise.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Glute Bridge",
    description: "A floor-based hip extension exercise targeting the glutes.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Good Morning",
    description: "A hip-hinge movement performed with a barbell across the shoulders.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Leg Extension",
    description: "A quadriceps isolation exercise performed on a machine.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Lying Leg Curl",
    description: "A hamstring isolation exercise performed lying on a leg curl machine.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Seated Leg Curl",
    description: "A hamstring isolation exercise performed on a seated machine.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Nordic Hamstring Curl",
    description: "A bodyweight hamstring exercise emphasizing eccentric strength.",
    measurement: "BODYWEIGHT_REPS",
  },
  {
    name: "Standing Calf Raise",
    description: "A calf raise performed standing.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Seated Calf Raise",
    description: "A calf raise performed seated.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Donkey Calf Raise",
    description: "A calf raise variation performed with the torso inclined forward.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Bench Press",
    description: "A barbell horizontal pressing exercise for the chest, shoulders and triceps.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Incline Bench Press",
    description: "A bench press performed on an incline bench.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Decline Barbell Bench Press",
    description: "A bench press performed on a decline bench.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Bench Press",
    description: "A horizontal press performed with dumbbells.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Incline Dumbbell Bench Press",
    description: "An incline chest press performed with dumbbells.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Fly",
    description: "A chest isolation exercise performed with dumbbells.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Cable Fly",
    description: "A chest fly performed using cable machines.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Pec Deck",
    description: "A chest fly performed on a pec deck machine.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Push-Up",
    description: "A bodyweight horizontal pushing exercise.",
    measurement: "BODYWEIGHT_REPS",
  },
  {
    name: "Weighted Dip",
    description: "A dip performed with additional external weight.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Chest Press Machine",
    description: "A horizontal pressing exercise performed on a machine.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Pull-Up",
    description: "A vertical pulling exercise performed using bodyweight.",
    measurement: "BODYWEIGHT_REPS",
  },
  {
    name: "Chin-Up",
    description: "A supinated-grip bodyweight vertical pull.",
    measurement: "BODYWEIGHT_REPS",
  },
  {
    name: "Lat Pulldown",
    description: "A vertical pulling exercise performed on a cable machine.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Close-Grip Lat Pulldown",
    description: "A close-grip variation of the lat pulldown.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Barbell Row",
    description: "A bent-over horizontal pulling exercise using a barbell.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Pendlay Row",
    description: "A strict barbell row performed from the floor between repetitions.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Row",
    description: "A unilateral horizontal pulling exercise with a dumbbell.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Seated Cable Row",
    description: "A horizontal pulling exercise performed using a cable machine.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Chest-Supported Row",
    description: "A row performed with the torso supported against a pad.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "T-Bar Row",
    description: "A horizontal pulling exercise performed using a T-bar setup.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Machine Row",
    description: "A horizontal pulling exercise performed on a rowing machine.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Straight-Arm Pulldown",
    description: "A lat-focused cable movement performed with mostly straight arms.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Face Pull",
    description: "A cable exercise targeting the rear delts and upper back.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Overhead Press",
    description: "A vertical pressing exercise performed with a barbell.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Shoulder Press",
    description: "A vertical shoulder press performed with dumbbells.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Arnold Press",
    description: "A dumbbell shoulder press with rotation.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Machine Shoulder Press",
    description: "A shoulder press performed using a machine.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Lateral Raise",
    description: "A shoulder isolation exercise targeting the lateral delts.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Cable Lateral Raise",
    description: "A lateral raise performed using a cable.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Rear Delt Fly",
    description: "A rear-delt isolation exercise.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Reverse Pec Deck",
    description: "A rear-delt fly performed on a pec deck machine.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Barbell Curl",
    description: "A barbell biceps curl.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Curl",
    description: "A biceps curl performed with dumbbells.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Hammer Curl",
    description: "A neutral-grip dumbbell curl.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Incline Dumbbell Curl",
    description: "A biceps curl performed on an incline bench.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Preacher Curl",
    description: "A biceps curl performed with the upper arm supported.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Cable Curl",
    description: "A biceps curl performed using a cable machine.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Concentration Curl",
    description: "A unilateral dumbbell curl performed with the arm braced against the leg.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "EZ-Bar Curl",
    description: "A biceps curl performed using an EZ-bar.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Close-Grip Bench Press",
    description: "A close-grip bench press emphasizing the triceps.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Skull Crusher",
    description: "A lying triceps extension.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Cable Triceps Pushdown",
    description: "A cable isolation exercise targeting the triceps.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Overhead Triceps Extension",
    description: "A triceps extension performed overhead.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Triceps Extension",
    description: "A triceps extension performed using a dumbbell.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Triceps Dip",
    description: "A bodyweight dip emphasizing the triceps.",
    measurement: "BODYWEIGHT_REPS",
  },
  {
    name: "Cable Overhead Extension",
    description: "An overhead triceps extension performed with a cable.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Wrist Curl",
    description: "A forearm exercise emphasizing the wrist flexors.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Reverse Wrist Curl",
    description: "A forearm exercise emphasizing the wrist extensors.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Barbell Shrug",
    description: "A loaded shrug targeting the upper trapezius.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Shrug",
    description: "A shrug performed using dumbbells.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Farmer's Carry",
    description: "A loaded carry performed while walking with weights.",
    measurement: "WEIGHT_DISTANCE",
  },
  {
    name: "Cable Crunch",
    description: "A weighted abdominal crunch performed using a cable.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Weighted Crunch",
    description: "A crunch performed with additional resistance.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Hanging Leg Raise",
    description: "An abdominal exercise performed while hanging from a bar.",
    measurement: "BODYWEIGHT_REPS",
  },
  {
    name: "Captain's Chair Leg Raise",
    description: "A leg raise performed using a captain's chair.",
    measurement: "BODYWEIGHT_REPS",
  },
  {
    name: "Ab Wheel Rollout",
    description: "A core exercise performed with an ab wheel.",
    measurement: "BODYWEIGHT_REPS",
  },
  {
    name: "Plank",
    description: "An isometric core exercise.",
    measurement: "TIME",
  },
  {
    name: "Side Plank",
    description: "An isometric lateral core exercise.",
    measurement: "TIME",
  },
  {
    name: "Russian Twist",
    description: "A rotational core exercise.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Cable Woodchop",
    description: "A rotational movement performed using a cable.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Pallof Press",
    description: "An anti-rotation core exercise performed with a cable or band.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Decline Sit-Up",
    description: "A sit-up performed on a decline bench.",
    measurement: "BODYWEIGHT_REPS",
  },
  {
    name: "Back Extension",
    description: "A posterior-chain exercise performed on a back extension bench.",
    measurement: "BODYWEIGHT_REPS",
  },
  {
    name: "Hyperextension",
    description: "A lower-back and posterior-chain extension exercise.",
    measurement: "BODYWEIGHT_REPS",
  },
  {
    name: "Clean",
    description: "An Olympic lift moving a barbell from the floor to the shoulders.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Power Clean",
    description: "A power-focused variation of the clean.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Hang Clean",
    description: "A clean variation beginning from the hang position.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Snatch",
    description: "An Olympic lift moving the barbell from the floor overhead in one motion.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Kettlebell Swing",
    description: "A ballistic hip-hinge exercise using a kettlebell.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Turkish Get-Up",
    description: "A full-body movement transitioning from lying to standing while holding a weight.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Kettlebell Goblet Squat",
    description: "A goblet squat performed using a kettlebell.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Kettlebell Clean & Press",
    description: "A kettlebell clean immediately followed by an overhead press.",
    measurement: "WEIGHT_REPS",
  },
  {
    name: "Sled Push",
    description: "A loaded sled pushed over a measured distance.",
    measurement: "DISTANCE_TIME",
  },
  {
    name: "Sled Pull",
    description: "A loaded sled pulled over a measured distance.",
    measurement: "DISTANCE_TIME",
  },
  {
    name: "Battle Rope",
    description: "A conditioning exercise using heavy ropes.",
    measurement: "TIME",
  },
];

async function main() {
  console.log(`Seeding ${exercises.length} exercises...`);

  for (const exercise of exercises) {
    await prisma.exercise.upsert({
      where: {
        name: exercise.name,
      },
      update: {
        description: exercise.description,
        measurement: exercise.measurement,
      },
      create: {
        name: exercise.name,
        description: exercise.description,
        measurement: exercise.measurement,
      },
    });
  }

  const starterExercises = [
    "Barbell Back Squat",
    "Bench Press",
    "Deadlift",
    "Overhead Press",
    "Barbell Row",
  ];

  let starterTemplate = await prisma.workoutTemplate.findFirst({
    where: {
      name: "Starter Workout",
    },
  });

  if (!starterTemplate) {
    starterTemplate = await prisma.workoutTemplate.create({
      data: {
        name: "Starter Workout",
      },
    });
  }

  await prisma.workoutTemplateExercise.deleteMany({
    where: {
      templateId: starterTemplate.id,
    },
  });

  for (let index = 0; index < starterExercises.length; index++) {
    const exercise = await prisma.exercise.findUnique({
      where: {
        name: starterExercises[index],
      },
    });

    if (!exercise) continue;

    await prisma.workoutTemplateExercise.create({
      data: {
        templateId: starterTemplate.id,
        exerciseId: exercise.id,
        order: index,
      },
    });
  }

  console.log("Seed complete.");
  console.log(`Exercises available: ${exercises.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });