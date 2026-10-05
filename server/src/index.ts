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

    if (!Number.isInteger(workoutId)) {
      return res.status(400).json({
        error: "Invalid workout ID",
      });
    }

    const workout = await prisma.workout.findUnique({
      where: {
        id: workoutId,
      },
    });

    if (!workout) {
      return res.status(404).json({
        error: "Workout not found",
      });
    }

    const exercises = Array.isArray(req.body?.exercises)
      ? req.body.exercises
      : [];

    for (const exercise of exercises) {
      const workoutExerciseId = Number(exercise.workoutExerciseId);

      if (!Number.isInteger(workoutExerciseId)) {
        continue;
      }

      const sets = Array.isArray(exercise.sets)
        ? exercise.sets
        : [];

      for (const set of sets) {
        const setNumber = Number(set.setNumber);

        if (!Number.isInteger(setNumber)) {
          continue;
        }

        const weight =
          set.weight === "" ||
          set.weight === null ||
          set.weight === undefined
            ? null
            : Number(set.weight);

        const reps =
          set.reps === "" ||
          set.reps === null ||
          set.reps === undefined
            ? null
            : Number(set.reps);

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

    const finishedWorkout = await prisma.workout.update({
      where: {
        id: workoutId,
      },
      data: {
        endedAt: new Date(),
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

    return res.json(finishedWorkout);
  } catch (error) {
    console.error("Failed to finish workout:", error);

    return res.status(500).json({
      error: "Failed to finish workout",
    });
  }
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Vytor backend running on port ${PORT}`);
});