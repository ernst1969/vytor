import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import cors from "cors";
import "dotenv/config";
import express from "express";

const app = express();

const PORT = 3000;

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

app.use(cors());
app.use(express.json());

// --------------------------------------------------
// Health
// --------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Vytor backend is running",
  });
});

// --------------------------------------------------
// Users
// --------------------------------------------------

app.post("/api/users", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== "string") {
      return res.status(400).json({
        error: "Username is required",
      });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({
        error: "Password is required",
      });
    }

    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 2) {
      return res.status(400).json({
        error: "Username must be at least 2 characters",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        username: trimmedUsername,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        error: "Username already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username: trimmedUsername,
        passwordHash,
      },
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
    });
  } catch (error) {
    console.error("Failed to create user:", error);

    res.status(500).json({
      error: "Failed to create user",
    });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== "string") {
      return res.status(400).json({
        error: "Username is required",
      });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({
        error: "Password is required",
      });
    }

    const trimmedUsername = username.trim();

    const user = await prisma.user.findUnique({
      where: {
        username: trimmedUsername,
      },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        error: "Invalid username or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid username or password",
      });
    }

    res.json({
      id: user.id,
      username: user.username,
    });
  } catch (error) {
    console.error("Failed to log in:", error);

    res.status(500).json({
      error: "Failed to log in",
    });
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: "Invalid user ID",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json({
      id: user.id,
      username: user.username,
    });
  } catch (error) {
    console.error("Failed to get user:", error);

    res.status(500).json({
      error: "Failed to get user",
    });
  }
});

// --------------------------------------------------
// Exercises
// --------------------------------------------------

app.get("/api/exercises", async (_req, res) => {
  try {
    const exercises = await prisma.exercise.findMany({
      orderBy: {
        name: "asc",
      },
    });

    res.json(exercises);
  } catch (error) {
    console.error("Failed to get exercises:", error);

    res.status(500).json({
      error: "Failed to get exercises",
    });
  }
});

// --------------------------------------------------
// Workout Templates
// --------------------------------------------------

app.get("/api/templates", async (_req, res) => {
  try {
    const templates = await prisma.workoutTemplate.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        exercises: {
          orderBy: {
            order: "asc",
          },
          include: {
            exercise: true,
          },
        },
      },
    });

    res.json(templates);
  } catch (error) {
    console.error("Failed to get workout templates:", error);

    res.status(500).json({
      error: "Failed to get workout templates",
    });
  }
});

// --------------------------------------------------
// Workouts
// --------------------------------------------------

app.post("/api/workouts", async (req, res) => {
  try {
    const { userId, templateId, exercises } = req.body;

    if (!Number.isInteger(userId)) {
      return res.status(400).json({
        error: "Valid userId is required",
      });
    }

    if (templateId !== undefined && templateId !== null) {
      if (!Number.isInteger(templateId)) {
        return res.status(400).json({
          error: "Invalid templateId",
        });
      }
    }

    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({
        error: "At least one exercise is required",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const workout = await prisma.workout.create({
      data: {
        userId,
        templateId: templateId ?? null,

        exercises: {
          create: exercises.map(
            (
              exercise: {
                exerciseId: number;
              },
              index: number
            ) => ({
              exerciseId: exercise.exerciseId,
              order: index,
            })
          ),
        },
      },

      include: {
        exercises: {
          orderBy: {
            order: "asc",
          },
          include: {
            exercise: true,
            sets: {
              orderBy: {
                setNumber: "asc",
              },
            },
          },
        },
      },
    });

    res.status(201).json(workout);
  } catch (error) {
    console.error("Failed to create workout:", error);

    res.status(500).json({
      error: "Failed to create workout",
    });
  }
});

app.post("/api/workouts/:id/finish", async (req, res) => {
  try {
    const workoutId = Number(req.params.id);
    const { exercises } = req.body;

    if (!Number.isInteger(workoutId)) {
      return res.status(400).json({
        error: "Invalid workout ID",
      });
    }

    if (!Array.isArray(exercises)) {
      return res.status(400).json({
        error: "Exercises must be an array",
      });
    }

    const workout = await prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        exercises: true,
      },
    });

    if (!workout) {
      return res.status(404).json({
        error: "Workout not found",
      });
    }

    if (workout.endedAt) {
      return res.status(400).json({
        error: "Workout has already ended",
      });
    }

    for (const exercise of exercises) {
      const workoutExerciseId = Number(
        exercise.workoutExerciseId,
      );

      if (!Number.isInteger(workoutExerciseId)) {
        continue;
      }

      const workoutExercise =
        workout.exercises.find(
          (item) => item.id === workoutExerciseId,
        );

      if (!workoutExercise) {
        continue;
      }

      if (!Array.isArray(exercise.sets)) {
        continue;
      }

      for (const set of exercise.sets) {
        const setNumber = Number(set.setNumber);

        if (!Number.isInteger(setNumber) || setNumber < 1) {
          continue;
        }

        const weightText =
          typeof set.weight === "string"
            ? set.weight.trim()
            : set.weight;

        const repsText =
          typeof set.reps === "string"
            ? set.reps.trim()
            : set.reps;

        const weight =
          weightText === "" ||
          weightText === null ||
          weightText === undefined
            ? null
            : Number(weightText);

        const reps =
          repsText === "" ||
          repsText === null ||
          repsText === undefined
            ? null
            : Number(repsText);

        if (
          weight !== null &&
          (!Number.isFinite(weight) || weight < 0)
        ) {
          return res.status(400).json({
            error: "Invalid weight",
          });
        }

        if (
          reps !== null &&
          (!Number.isInteger(reps) || reps < 0)
        ) {
          return res.status(400).json({
            error: "Invalid reps",
          });
        }

        await prisma.workoutSet.upsert({
          where: {
            workoutExerciseId_setNumber: {
              workoutExerciseId,
              setNumber,
            },
          },
          update: {
            weight,
            reps,
          },
          create: {
            workoutExerciseId,
            setNumber,
            weight,
            reps,
          },
        });
      }
    }

    const finishedWorkout =
      await prisma.workout.update({
        where: { id: workoutId },
        data: {
          endedAt: new Date(),
        },
        include: {
          template: true,
          exercises: {
            orderBy: {
              order: "asc",
            },
            include: {
              exercise: true,
              sets: {
                orderBy: {
                  setNumber: "asc",
                },
              },
            },
          },
        },
      });

    return res.json(finishedWorkout);
  } catch (error) {
    console.error("Failed to finish workout:", error);

    return res.status(500).json({
      error: "Failed to finish workout",
    });
  }
});

app.post("/api/workouts/:id/exercises", async (req, res) => {
  try {
    const workoutId = Number(req.params.id);
    const { exerciseId } = req.body;

    if (!Number.isInteger(workoutId)) {
      return res.status(400).json({
        error: "Invalid workout ID",
      });
    }

    if (!Number.isInteger(Number(exerciseId))) {
      return res.status(400).json({
        error: "Invalid exercise ID",
      });
    }

    const workout = await prisma.workout.findUnique({
      where: {
        id: workoutId,
      },
      include: {
        exercises: true,
      },
    });

    if (!workout) {
      return res.status(404).json({
        error: "Workout not found",
      });
    }

    if (workout.endedAt) {
      return res.status(400).json({
        error: "Workout has already ended",
      });
    }

    const exercise = await prisma.exercise.findUnique({
      where: {
        id: Number(exerciseId),
      },
    });

    if (!exercise) {
      return res.status(404).json({
        error: "Exercise not found",
      });
    }

    const existingExercise =
      workout.exercises.find(
        (item) => item.exerciseId === exercise.id,
      );

    if (existingExercise) {
      return res.json(existingExercise);
    }

    const nextOrder =
      workout.exercises.reduce(
        (highest, item) =>
          Math.max(highest, item.order),
        -1,
      ) + 1;

    const workoutExercise =
      await prisma.workoutExercise.create({
        data: {
          workoutId,
          exerciseId: exercise.id,
          order: nextOrder,
        },
      });

    return res.json(workoutExercise);
  } catch (error) {
    console.error(
      "Failed to add exercise to workout:",
      error,
    );

    return res.status(500).json({
      error: "Failed to add exercise to workout",
    });
  }
});

app.get("/api/workouts/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId)) {
      return res.status(400).json({
        error: "Invalid user ID",
      });
    }

    const workouts = await prisma.workout.findMany({
      where: {
        userId,
        endedAt: {
          not: null,
        },
      },
      orderBy: {
        startedAt: "desc",
      },
      include: {
        template: true,
        exercises: {
          orderBy: {
            order: "asc",
          },
          include: {
            exercise: true,
            sets: {
              orderBy: {
                setNumber: "asc",
              },
            },
          },
        },
      },
    });

    return res.json(workouts);
  } catch (error) {
    console.error(
      "Failed to load workout history:",
      error,
    );

    return res.status(500).json({
      error: "Failed to load workout history",
    });
  }
});

app.get(
  "/api/exercises/:exerciseId/last-workout",
  async (req, res) => {
    try {
      const exerciseId = Number(
        req.params.exerciseId,
      );

      const userId = Number(req.query.userId);

      if (
        !Number.isInteger(exerciseId) ||
        !Number.isInteger(userId)
      ) {
        return res.status(400).json({
          error: "Invalid exercise ID or user ID",
        });
      }

      const previousExercise =
        await prisma.workoutExercise.findFirst({
          where: {
            exerciseId,
            workout: {
              userId,
              endedAt: {
                not: null,
              },
            },
          },
          orderBy: {
            workout: {
              startedAt: "desc",
            },
          },
          include: {
            exercise: true,
            workout: true,
            sets: {
              orderBy: {
                setNumber: "asc",
              },
            },
          },
        });

      if (!previousExercise) {
        return res.json(null);
      }

      return res.json({
        exerciseId:
          previousExercise.exerciseId,

        exerciseName:
          previousExercise.exercise.name,

        workoutId:
          previousExercise.workoutId,

        completedAt:
          previousExercise.workout.endedAt,

        sets: previousExercise.sets.map(
          (set) => ({
            setNumber: set.setNumber,
            weight: set.weight,
            reps: set.reps,
          }),
        ),
      });
    } catch (error) {
      console.error(
        "Failed to load previous exercise:",
        error,
      );

      return res.status(500).json({
        error:
          "Failed to load previous exercise",
      });
    }
  },
);

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Vytor backend running on port ${PORT}`);
});