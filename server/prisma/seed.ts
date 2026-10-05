import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

type ExerciseSeed = {
  name: string;
  description: string;
  measurementType:
    | "WEIGHT_REPS"
    | "REPS"
    | "DISTANCE_TIME"
    | "TIME"
    | "WEIGHT_DISTANCE";
};

const exercises: ExerciseSeed[] = [
  {
    name: "Barbell Back Squat",
    description: "A barbell squat performed with the bar resting across the upper back.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Front Squat",
    description: "A squat performed with the barbell held across the front of the shoulders.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Hack Squat",
    description: "A squat performed using a hack squat machine.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Leg Press",
    description: "A lower-body press performed on a leg press machine.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Bulgarian Split Squat",
    description: "A unilateral squat with the rear foot elevated.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Walking Lunge",
    description: "Alternating lunges performed while moving forward.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Reverse Lunge",
    description: "A lunge performed by stepping backward.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Forward Lunge",
    description: "A lunge performed by stepping forward.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Step-Up",
    description: "A unilateral leg exercise performed by stepping onto an elevated platform.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Goblet Squat",
    description: "A squat performed while holding a dumbbell or kettlebell at the chest.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Romanian Deadlift",
    description: "A hip-hinge movement emphasizing the hamstrings and glutes.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Deadlift",
    description: "A compound lift where a loaded barbell is lifted from the floor.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Sumo Deadlift",
    description: "A deadlift performed with a wide stance and toes turned outward.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Stiff-Leg Deadlift",
    description: "A deadlift variation emphasizing the hamstrings.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Hip Thrust",
    description: "A glute-focused hip extension exercise.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Glute Bridge",
    description: "A floor-based hip extension exercise targeting the glutes.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Good Morning",
    description: "A hip-hinge movement performed with a barbell across the shoulders.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Leg Extension",
    description: "A quadriceps isolation exercise performed on a machine.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Lying Leg Curl",
    description: "A hamstring isolation exercise performed lying on a leg curl machine.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Seated Leg Curl",
    description: "A hamstring isolation exercise performed on a seated machine.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Nordic Hamstring Curl",
    description: "A bodyweight hamstring exercise emphasizing eccentric strength.",
    measurementType: "REPS",
  },
  {
    name: "Standing Calf Raise",
    description: "A calf raise performed standing.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Seated Calf Raise",
    description: "A calf raise performed seated.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Donkey Calf Raise",
    description: "A calf raise variation performed with the torso inclined forward.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Bench Press",
    description: "A barbell horizontal pressing exercise for the chest, shoulders and triceps.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Incline Bench Press",
    description: "A bench press performed on an incline bench.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Decline Barbell Bench Press",
    description: "A bench press performed on a decline bench.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Bench Press",
    description: "A horizontal press performed with dumbbells.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Incline Dumbbell Bench Press",
    description: "An incline chest press performed with dumbbells.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Fly",
    description: "A chest isolation exercise performed with dumbbells.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Cable Fly",
    description: "A chest fly performed using cable machines.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Pec Deck",
    description: "A chest fly performed on a pec deck machine.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Push-Up",
    description: "A bodyweight horizontal pushing exercise.",
    measurementType: "REPS",
  },
  {
    name: "Weighted Dip",
    description: "A dip performed with additional external weight.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Chest Press Machine",
    description: "A horizontal pressing exercise performed on a machine.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Pull-Up",
    description: "A vertical pulling exercise performed using bodyweight.",
    measurementType: "REPS",
  },
  {
    name: "Chin-Up",
    description: "A supinated-grip bodyweight vertical pull.",
    measurementType: "REPS",
  },
  {
    name: "Lat Pulldown",
    description: "A vertical pulling exercise performed on a cable machine.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Close-Grip Lat Pulldown",
    description: "A close-grip variation of the lat pulldown.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Barbell Row",
    description: "A bent-over horizontal pulling exercise using a barbell.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Pendlay Row",
    description: "A strict barbell row performed from the floor between repetitions.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Row",
    description: "A unilateral horizontal pulling exercise with a dumbbell.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Seated Cable Row",
    description: "A horizontal pulling exercise performed using a cable machine.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Chest-Supported Row",
    description: "A row performed with the torso supported against a pad.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "T-Bar Row",
    description: "A horizontal pulling exercise performed using a T-bar setup.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Machine Row",
    description: "A horizontal pulling exercise performed on a rowing machine.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Straight-Arm Pulldown",
    description: "A lat-focused cable movement performed with mostly straight arms.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Face Pull",
    description: "A cable exercise targeting the rear delts and upper back.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Overhead Press",
    description: "A vertical pressing exercise performed with a barbell.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Shoulder Press",
    description: "A vertical shoulder press performed with dumbbells.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Arnold Press",
    description: "A dumbbell shoulder press with rotation.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Machine Shoulder Press",
    description: "A shoulder press performed using a machine.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Lateral Raise",
    description: "A shoulder isolation exercise targeting the lateral delts.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Cable Lateral Raise",
    description: "A lateral raise performed using a cable.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Rear Delt Fly",
    description: "A rear-delt isolation exercise.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Reverse Pec Deck",
    description: "A rear-delt fly performed on a pec deck machine.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Barbell Curl",
    description: "A barbell biceps curl.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Curl",
    description: "A biceps curl performed with dumbbells.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Hammer Curl",
    description: "A neutral-grip dumbbell curl.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Incline Dumbbell Curl",
    description: "A biceps curl performed on an incline bench.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Preacher Curl",
    description: "A biceps curl performed with the upper arm supported.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Cable Curl",
    description: "A biceps curl performed using a cable machine.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Concentration Curl",
    description: "A unilateral dumbbell curl performed with the arm braced against the leg.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "EZ-Bar Curl",
    description: "A biceps curl performed using an EZ-bar.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Close-Grip Bench Press",
    description: "A close-grip bench press emphasizing the triceps.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Skull Crusher",
    description: "A lying triceps extension.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Cable Triceps Pushdown",
    description: "A cable isolation exercise targeting the triceps.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Overhead Triceps Extension",
    description: "A triceps extension performed overhead.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Triceps Extension",
    description: "A triceps extension performed using a dumbbell.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Triceps Dip",
    description: "A bodyweight dip emphasizing the triceps.",
    measurementType: "REPS",
  },
  {
    name: "Cable Overhead Extension",
    description: "An overhead triceps extension performed with a cable.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Wrist Curl",
    description: "A forearm exercise emphasizing the wrist flexors.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Reverse Wrist Curl",
    description: "A forearm exercise emphasizing the wrist extensors.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Barbell Shrug",
    description: "A loaded shrug targeting the upper trapezius.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Dumbbell Shrug",
    description: "A shrug performed using dumbbells.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Farmer's Carry",
    description: "A loaded carry performed while walking with weights.",
    measurementType: "WEIGHT_DISTANCE",
  },
  {
    name: "Cable Crunch",
    description: "A weighted abdominal crunch performed using a cable.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Weighted Crunch",
    description: "A crunch performed with additional resistance.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Hanging Leg Raise",
    description: "An abdominal exercise performed while hanging from a bar.",
    measurementType: "REPS",
  },
  {
    name: "Captain's Chair Leg Raise",
    description: "A leg raise performed using a captain's chair.",
    measurementType: "REPS",
  },
  {
    name: "Ab Wheel Rollout",
    description: "A core exercise performed with an ab wheel.",
    measurementType: "REPS",
  },
  {
    name: "Plank",
    description: "An isometric core exercise.",
    measurementType: "TIME",
  },
  {
    name: "Side Plank",
    description: "An isometric lateral core exercise.",
    measurementType: "TIME",
  },
  {
    name: "Russian Twist",
    description: "A rotational core exercise.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Cable Woodchop",
    description: "A rotational movement performed using a cable.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Pallof Press",
    description: "An anti-rotation core exercise performed with a cable or band.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Decline Sit-Up",
    description: "A sit-up performed on a decline bench.",
    measurementType: "REPS",
  },
  {
    name: "Back Extension",
    description: "A posterior-chain exercise performed on a back extension bench.",
    measurementType: "REPS",
  },
  {
    name: "Hyperextension",
    description: "A lower-back and posterior-chain extension exercise.",
    measurementType: "REPS",
  },
  {
    name: "Clean",
    description: "An Olympic lift moving a barbell from the floor to the shoulders.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Power Clean",
    description: "A power-focused variation of the clean.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Hang Clean",
    description: "A clean variation beginning from the hang position.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Snatch",
    description: "An Olympic lift moving the barbell from the floor overhead in one motion.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Kettlebell Swing",
    description: "A ballistic hip-hinge exercise using a kettlebell.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Turkish Get-Up",
    description: "A full-body movement transitioning from lying to standing while holding a weight.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Kettlebell Goblet Squat",
    description: "A goblet squat performed using a kettlebell.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Kettlebell Clean & Press",
    description: "A kettlebell clean immediately followed by an overhead press.",
    measurementType: "WEIGHT_REPS",
  },
  {
    name: "Sled Push",
    description: "A loaded sled pushed over a measured distance.",
    measurementType: "DISTANCE_TIME",
  },
  {
    name: "Sled Pull",
    description: "A loaded sled pulled over a measured distance.",
    measurementType: "DISTANCE_TIME",
  },
  {
    name: "Battle Rope",
    description: "A conditioning exercise using heavy ropes.",
    measurementType: "TIME",
  },

    // Combat Sports
  {
    name: "Boxing",
    description: "Boxing training focused on punches, movement, and conditioning.",
    measurementType: "TIME",
  },
  {
    name: "Boxing Sparring",
    description: "Live boxing practice against a training partner.",
    measurementType: "TIME",
  },
  {
    name: "Heavy Bag",
    description: "Boxing and striking conditioning performed on a heavy bag.",
    measurementType: "TIME",
  },
  {
    name: "Shadow Boxing",
    description: "Boxing practice performed without a partner or equipment.",
    measurementType: "TIME",
  },
  {
    name: "Speed Bag",
    description: "Boxing training performed on a speed bag.",
    measurementType: "TIME",
  },
  {
    name: "Mitt Work",
    description: "Boxing training performed with focus mitts and a training partner.",
    measurementType: "TIME",
  },
  {
    name: "Muay Thai",
    description: "Muay Thai training focused on striking, movement, and conditioning.",
    measurementType: "TIME",
  },
  {
    name: "Muay Thai Sparring",
    description: "Live Muay Thai practice against a training partner.",
    measurementType: "TIME",
  },
  {
    name: "Kickboxing",
    description: "Kickboxing training focused on striking, movement, and conditioning.",
    measurementType: "TIME",
  },
  {
    name: "Kickboxing Sparring",
    description: "Live kickboxing practice against a training partner.",
    measurementType: "TIME",
  },
  {
    name: "MMA",
    description: "Mixed martial arts training combining striking, grappling, and conditioning.",
    measurementType: "TIME",
  },
  {
    name: "MMA Sparring",
    description: "Live mixed martial arts practice against a training partner.",
    measurementType: "TIME",
  },
  {
    name: "Brazilian Jiu-Jitsu",
    description: "Brazilian Jiu-Jitsu training focused on grappling and ground fighting.",
    measurementType: "TIME",
  },
  {
    name: "Wrestling",
    description: "Wrestling training focused on takedowns, control, and grappling.",
    measurementType: "TIME",
  },
  {
    name: "Judo",
    description: "Judo training focused on throws, grappling, and control.",
    measurementType: "TIME",
  },
  {
    name: "Karate",
    description: "Karate training focused on striking, movement, and technique.",
    measurementType: "TIME",
  },
  {
    name: "Taekwondo",
    description: "Taekwondo training focused on striking, movement, and conditioning.",
    measurementType: "TIME",
  },

  // Cardio
  {
    name: "Running",
    description: "Running performed for cardiovascular conditioning.",
    measurementType: "DISTANCE_TIME",
  },
  {
    name: "Treadmill Running",
    description: "Running performed on a treadmill.",
    measurementType: "DISTANCE_TIME",
  },
  {
    name: "Outdoor Walking",
    description: "Walking performed outdoors for cardiovascular activity.",
    measurementType: "DISTANCE_TIME",
  },
  {
    name: "Incline Walking",
    description: "Walking performed at an incline for increased cardiovascular demand.",
    measurementType: "DISTANCE_TIME",
  },
  {
    name: "Cycling",
    description: "Outdoor cycling performed for cardiovascular conditioning.",
    measurementType: "DISTANCE_TIME",
  },
  {
    name: "Stationary Bike",
    description: "Cycling performed on a stationary exercise bike.",
    measurementType: "DISTANCE_TIME",
  },
  {
    name: "Rowing",
    description: "Cardiovascular training performed on a rowing machine.",
    measurementType: "DISTANCE_TIME",
  },
  {
    name: "Swimming",
    description: "Swimming performed for cardiovascular conditioning.",
    measurementType: "DISTANCE_TIME",
  },
  {
    name: "Stair Climber",
    description: "Cardiovascular training performed on a stair-climbing machine.",
    measurementType: "TIME",
  },
  {
    name: "Elliptical",
    description: "Low-impact cardiovascular training performed on an elliptical machine.",
    measurementType: "TIME",
  },
  {
    name: "Jump Rope",
    description: "Jump rope training for cardiovascular conditioning and coordination.",
    measurementType: "TIME",
  },
  {
    name: "Assault Bike",
    description: "High-intensity cardiovascular training on an air resistance bike.",
    measurementType: "TIME",
  },
  {
    name: "Ski Erg",
    description: "Cardiovascular and full-body conditioning performed on a SkiErg.",
    measurementType: "DISTANCE_TIME",
  },
  {
    name: "VersaClimber",
    description: "Full-body cardiovascular training performed on a vertical climbing machine.",
    measurementType: "TIME",
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
        measurementType: exercise.measurement,
      },
      create: {
        name: exercise.name,
        description: exercise.description,
        measurementType: exercise.measurement,
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