import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import cors from "cors";
import { createHash, randomBytes } from "node:crypto";
import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";

import { levelForXp, progressForXp, workoutXp } from "./progression.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

app.use(cors());
app.use(express.json());

// --------------------------------------------------
// Types
// --------------------------------------------------

type WeightUnit = "KG" | "LBS";
type DistanceUnit = "KM" | "MI";

type AuthenticatedRequest = Request & {
  userId?: number;
};

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function convertWeightToKg(
  value: number,
  unit: WeightUnit,
) {
  if (unit === "LBS") {
    return value / 2.2046226218;
  }

  return value;
}

function convertKgToWeightUnit(
  value: number,
  unit: WeightUnit,
) {
  if (unit === "LBS") {
    return value * 2.2046226218;
  }

  return value;
}

function convertDistanceToKm(
  value: number,
  unit: DistanceUnit,
) {
  if (unit === "MI") {
    return value / 0.6213711922;
  }

  return value;
}

function convertKmToDistanceUnit(
  value: number,
  unit: DistanceUnit,
) {
  if (unit === "MI") {
    return value * 0.6213711922;
  }

  return value;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return token;
}

async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const authorization = req.header("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!session || session.expiresAt <= new Date()) {
    return res.status(401).json({ error: "Session expired" });
  }

  req.userId = session.userId;
  next();
}

function authUserId(req: Request) {
  return (req as AuthenticatedRequest).userId!;
}

async function getProgress(userId: number) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { xp: true },
  });
  const rank = await prisma.user.count({
    where: { xp: { gt: user.xp } },
  }) + 1;
  const progress = progressForXp(user.xp);

  return {
    ...progress,
    rank,
  };
}

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

    const existingUser =
      await prisma.user.findUnique({
        where: {
          username: trimmedUsername,
        },
      });

    if (existingUser) {
      return res.status(409).json({
        error: "Username already exists",
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username: trimmedUsername,
        passwordHash,
      },
    });

    const token = await createSession(user.id);

    res.status(201).json({
      id: user.id,
      username: user.username,
      token,
    });
  } catch (error) {
    console.error(
      "Failed to create user:",
      error,
    );

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

    const user =
      await prisma.user.findUnique({
        where: {
          username: trimmedUsername,
        },
      });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        error: "Invalid username or password",
      });
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.passwordHash,
      );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid username or password",
      });
    }

    const token = await createSession(user.id);

    res.json({
      id: user.id,
      username: user.username,
      token,
    });
  } catch (error) {
    console.error(
      "Failed to log in:",
      error,
    );

    res.status(500).json({
      error: "Failed to log in",
    });
  }
});

app.use("/api", requireAuth);

app.post("/api/logout", async (req: AuthenticatedRequest, res) => {
  const authorization = req.header("authorization");
  const token = authorization?.slice(7);

  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }

  res.json({ success: true });
});

app.get("/api/leaderboard", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: [{ xp: "desc" }, { createdAt: "asc" }],
    take: 100,
    select: { id: true, username: true, xp: true },
  });

  res.json(
    users.map((user, index) => {
      const previous = users[index - 1];
      const rank = previous?.xp === user.xp
        ? users.findIndex((candidate) => candidate.xp === user.xp) + 1
        : index + 1;
      return { ...user, level: levelForXp(user.xp), rank };
    }),
  );
});

app.get("/api/settings", async (req: AuthenticatedRequest, res) => {
  const settings = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: {
      preferredWeightUnit: true,
      preferredDistanceUnit: true,
      restSeconds: true,
      theme: true,
    },
  });

  res.json(settings);
});

app.patch("/api/settings", async (req: AuthenticatedRequest, res) => {
  const weightUnit = ["KG", "LBS"].includes(req.body.preferredWeightUnit)
    ? req.body.preferredWeightUnit
    : undefined;
  const distanceUnit = ["KM", "MI"].includes(req.body.preferredDistanceUnit)
    ? req.body.preferredDistanceUnit
    : undefined;
  const theme = ["SYSTEM", "LIGHT", "DARK"].includes(req.body.theme)
    ? req.body.theme
    : undefined;
  const restSeconds = Number(req.body.restSeconds);

  if (req.body.restSeconds !== undefined &&
      (!Number.isInteger(restSeconds) || restSeconds < 0 || restSeconds > 600)) {
    return res.status(400).json({ error: "Rest duration must be between 0 and 600 seconds" });
  }

  const settings = await prisma.user.update({
    where: { id: req.userId! },
    data: {
      ...(weightUnit ? { preferredWeightUnit: weightUnit } : {}),
      ...(distanceUnit ? { preferredDistanceUnit: distanceUnit } : {}),
      ...(theme ? { theme } : {}),
      ...(req.body.restSeconds !== undefined ? { restSeconds } : {}),
    },
    select: {
      preferredWeightUnit: true,
      preferredDistanceUnit: true,
      restSeconds: true,
      theme: true,
    },
  });

  res.json(settings);
});

// --------------------------------------------------
// User search / public users
// --------------------------------------------------

app.get(
  "/api/users/search",
  async (req, res) => {
    try {
      const query =
        typeof req.query.query === "string"
          ? req.query.query.trim()
          : "";

      const currentUserId = authUserId(req);

      if (!Number.isInteger(currentUserId)) {
        return res.status(400).json({
          error: "Valid userId is required",
        });
      }

      if (!query) {
        return res.json([]);
      }

      const users =
        await prisma.user.findMany({
          where: {
            id: {
              not: currentUserId,
            },
            username: {
              contains: query,
              mode: "insensitive",
            },
          },
          orderBy: {
            username: "asc",
          },
          take: 20,
          select: {
            id: true,
            username: true,
          },
        });

      res.json(users);
    } catch (error) {
      console.error(
        "Failed to search users:",
        error,
      );

      res.status(500).json({
        error: "Failed to search users",
      });
    }
  },
);

app.get(
  "/api/users/:id/public",
  async (req, res) => {
    try {
      const userId = Number(
        req.params.id,
      );

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          error: "Invalid user ID",
        });
      }

      const user =
        await prisma.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            id: true,
            username: true,
            createdAt: true,
          },
        });

      if (!user) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      const viewerId = (req as AuthenticatedRequest).userId!;
      const [progress, recentWorkouts, relationship] = await Promise.all([
        getProgress(userId),
        prisma.workout.findMany({
          where: { userId, endedAt: { not: null } },
          orderBy: { endedAt: "desc" },
          take: 14,
          select: { id: true, startedAt: true, endedAt: true },
        }),
        prisma.friendRequest.findFirst({
          where: {
            OR: [
              { requesterId: viewerId, recipientId: userId },
              { requesterId: userId, recipientId: viewerId },
            ],
          },
          select: { id: true, requesterId: true, status: true },
        }),
      ]);

      res.json({
        ...user,
        ...progress,
        recentWorkouts,
        friendship: relationship
          ? {
              requestId: relationship.id,
              status: relationship.status,
              direction: relationship.requesterId === viewerId ? "OUTGOING" : "INCOMING",
            }
          : null,
      });
    } catch (error) {
      console.error(
        "Failed to load public user:",
        error,
      );

      res.status(500).json({
        error: "Failed to load user",
      });
    }
  },
);

app.get(
  "/api/users/:id",
  async (req, res) => {
    try {
      const id = Number(
        req.params.id,
      );

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          error: "Invalid user ID",
        });
      }


      if (id !== authUserId(req)) {
        return res.status(403).json({ error: "You cannot access this user" });
      }

      const user =
        await prisma.user.findUnique({
          where: {
            id,
          },
        });

      if (!user) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      const progress = await getProgress(id);

      res.json({
        id: user.id,
        username: user.username,
        ...progress,
      });
    } catch (error) {
      console.error(
        "Failed to get user:",
        error,
      );

      res.status(500).json({
        error: "Failed to get user",
      });
    }
  },
);

// --------------------------------------------------
// Friends
// --------------------------------------------------

app.get(
  "/api/friends/:userId",
  async (req, res) => {
    try {
      const userId = Number(
        req.params.userId,
      );

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          error: "Invalid user ID",
        });
      }


      if (userId !== authUserId(req)) {
        return res.status(403).json({ error: "You cannot access these friends" });
      }

      const requests =
        await prisma.friendRequest.findMany({
          where: {
            status: "ACCEPTED",
            OR: [
              {
                requesterId: userId,
              },
              {
                recipientId: userId,
              },
            ],
          },
          include: {
            requester: {
              select: {
                id: true,
                username: true,
              },
            },
            recipient: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        });

      const friends = requests.map(
        (request) =>
          request.requesterId === userId
            ? request.recipient
            : request.requester,
      );

      res.json(friends);
    } catch (error) {
      console.error(
        "Failed to load friends:",
        error,
      );

      res.status(500).json({
        error: "Failed to load friends",
      });
    }
  },
);

app.get(
  "/api/friends/:userId/requests",
  async (req, res) => {
    try {
      const userId = Number(
        req.params.userId,
      );

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          error: "Invalid user ID",
        });
      }

      if (userId !== authUserId(req)) {
        return res.status(403).json({ error: "You cannot access these requests" });
      }

      const requests =
        await prisma.friendRequest.findMany({
          where: {
            recipientId: userId,
            status: "PENDING",
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            requester: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        });

      res.json(
        requests.map((request) => ({
          id: request.id,
          user: request.requester,
          createdAt:
            request.createdAt,
        })),
      );
    } catch (error) {
      console.error(
        "Failed to load friend requests:",
        error,
      );

      res.status(500).json({
        error:
          "Failed to load friend requests",
      });
    }
  },
);

app.post(
  "/api/friends/request",
  async (req, res) => {
    try {
      const requesterId = Number(
        req.body.requesterId,
      );

      const recipientId = Number(
        req.body.recipientId,
      );

      if (
        !Number.isInteger(requesterId) ||
        !Number.isInteger(recipientId)
      ) {
        return res.status(400).json({
          error:
            "Valid requesterId and recipientId are required",
        });
      }


      if (requesterId !== authUserId(req)) {
        return res.status(403).json({ error: "You cannot send this request" });
      }

      if (requesterId === recipientId) {
        return res.status(400).json({
          error:
            "You cannot add yourself as a friend",
        });
      }

      const [requester, recipient] =
        await Promise.all([
          prisma.user.findUnique({
            where: {
              id: requesterId,
            },
          }),

          prisma.user.findUnique({
            where: {
              id: recipientId,
            },
          }),
        ]);

      if (!requester || !recipient) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      const existing =
        await prisma.friendRequest.findFirst({
          where: {
            OR: [
              {
                requesterId,
                recipientId,
              },
              {
                requesterId:
                  recipientId,
                recipientId:
                  requesterId,
              },
            ],
          },
        });

      if (existing) {
        if (
          existing.status ===
          "ACCEPTED"
        ) {
          return res.status(409).json({
            error:
              "You are already friends",
          });
        }

        if (
          existing.status ===
            "PENDING" &&
          existing.requesterId ===
            requesterId
        ) {
          return res.status(409).json({
            error:
              "Friend request already sent",
          });
        }

        if (
          existing.status ===
            "PENDING" &&
          existing.requesterId ===
            recipientId
        ) {
          return res.status(409).json({
            error:
              "This user has already sent you a friend request",
          });
        }

        await prisma.friendRequest.update({
          where: {
            id: existing.id,
          },
          data: {
            requesterId,
            recipientId,
            status: "PENDING",
          },
        });

        return res.json({
          success: true,
        });
      }

      const request =
        await prisma.friendRequest.create({
          data: {
            requesterId,
            recipientId,
            status: "PENDING",
          },
        });

      res.status(201).json(request);
    } catch (error) {
      console.error(
        "Failed to send friend request:",
        error,
      );

      res.status(500).json({
        error:
          "Failed to send friend request",
      });
    }
  },
);

app.post(
  "/api/friends/requests/:id/accept",
  async (req, res) => {
    try {
      const requestId = Number(
        req.params.id,
      );

      const userId = Number(
        req.body.userId,
      );

      if (
        !Number.isInteger(requestId) ||
        !Number.isInteger(userId)
      ) {
        return res.status(400).json({
          error:
            "Invalid request ID or user ID",
        });
      }

      if (userId !== authUserId(req)) {
        return res.status(403).json({ error: "You cannot accept this request" });
      }

      const request =
        await prisma.friendRequest.findUnique({
          where: {
            id: requestId,
          },
        });

      if (!request) {
        return res.status(404).json({
          error:
            "Friend request not found",
        });
      }

      if (
        request.recipientId !==
        userId
      ) {
        return res.status(403).json({
          error:
            "You cannot accept this request",
        });
      }

      if (
        request.status !== "PENDING"
      ) {
        return res.status(400).json({
          error:
            "This request is no longer pending",
        });
      }

      const updated =
        await prisma.friendRequest.update({
          where: {
            id: requestId,
          },
          data: {
            status: "ACCEPTED",
          },
        });

      res.json(updated);
    } catch (error) {
      console.error(
        "Failed to accept friend request:",
        error,
      );

      res.status(500).json({
        error:
          "Failed to accept friend request",
      });
    }
  },
);

app.post(
  "/api/friends/requests/:id/reject",
  async (req, res) => {
    try {
      const requestId = Number(
        req.params.id,
      );

      const userId = Number(
        req.body.userId,
      );

      if (
        !Number.isInteger(requestId) ||
        !Number.isInteger(userId)
      ) {
        return res.status(400).json({
          error:
            "Invalid request ID or user ID",
        });
      }

      if (userId !== authUserId(req)) {
        return res.status(403).json({ error: "You cannot reject this request" });
      }

      const request =
        await prisma.friendRequest.findUnique({
          where: {
            id: requestId,
          },
        });

      if (!request) {
        return res.status(404).json({
          error:
            "Friend request not found",
        });
      }

      if (
        request.recipientId !==
        userId
      ) {
        return res.status(403).json({
          error:
            "You cannot reject this request",
        });
      }

      await prisma.friendRequest.update({
        where: {
          id: requestId,
        },
        data: {
          status: "REJECTED",
        },
      });

      res.json({
        success: true,
      });
    } catch (error) {
      console.error(
        "Failed to reject friend request:",
        error,
      );

      res.status(500).json({
        error:
          "Failed to reject friend request",
      });
    }
  },
);

app.delete(
  "/api/friends/requests/:id",
  async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const deleted = await prisma.friendRequest.deleteMany({
      where: { id, requesterId: req.userId!, status: "PENDING" },
    });

    if (!deleted.count) {
      return res.status(404).json({ error: "Outgoing friend request not found" });
    }

    res.json({ success: true });
  },
);

app.get(
  "/api/friends/:userId/feed",
  async (req, res) => {
    try {
      const userId = Number(
        req.params.userId,
      );

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          error: "Invalid user ID",
        });
      }

      if (userId !== authUserId(req)) {
        return res.status(403).json({ error: "You cannot access this feed" });
      }

      const friendships =
        await prisma.friendRequest.findMany({
          where: {
            status: "ACCEPTED",
            OR: [
              {
                requesterId: userId,
              },
              {
                recipientId: userId,
              },
            ],
          },
        });

      const friendIds =
        friendships.map(
          (friendship) =>
            friendship.requesterId ===
            userId
              ? friendship.recipientId
              : friendship.requesterId,
        );

      if (friendIds.length === 0) {
        return res.json([]);
      }

      const sevenDaysAgo =
        new Date(
          Date.now() -
            7 *
              24 *
              60 *
              60 *
              1000,
        );

      const workouts =
        await prisma.workout.findMany({
          where: {
            userId: {
              in: friendIds,
            },
            endedAt: {
              gte: sevenDaysAgo,
            },
          },
          orderBy: {
            endedAt: "desc",
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
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

      res.json(workouts);
    } catch (error) {
      console.error(
        "Failed to load friends feed:",
        error,
      );

      res.status(500).json({
        error:
          "Failed to load friends feed",
      });
    }
  },
);

app.delete(
  "/api/friends/:friendId",
  async (req: AuthenticatedRequest, res) => {
    const friendId = Number(req.params.friendId);

    if (!Number.isInteger(friendId)) {
      return res.status(400).json({ error: "Invalid friend ID" });
    }

    await prisma.friendRequest.deleteMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: req.userId!, recipientId: friendId },
          { requesterId: friendId, recipientId: req.userId! },
        ],
      },
    });

    res.json({ success: true });
  },
);

// --------------------------------------------------
// Exercises
// --------------------------------------------------

app.get(
  "/api/exercises",
  async (_req, res) => {
    try {
      const exercises =
        await prisma.exercise.findMany({
          orderBy: {
            name: "asc",
          },
        });

      res.json(exercises);
    } catch (error) {
      console.error(
        "Failed to get exercises:",
        error,
      );

      res.status(500).json({
        error:
          "Failed to get exercises",
      });
    }
  },
);

// --------------------------------------------------
// Workout Templates
// --------------------------------------------------

app.get(
  "/api/templates",
  async (req, res) => {
    try {
      const templates =
        await prisma.workoutTemplate.findMany({
          where: {
            OR: [{ userId: null }, { userId: authUserId(req) }],
          },
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
      console.error(
        "Failed to get workout templates:",
        error,
      );

      res.status(500).json({
        error:
          "Failed to get workout templates",
      });
    }
  },
);

app.post("/api/templates", async (req, res) => {
  try {
    const { name, exerciseIds } = req.body;
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!trimmedName) {
      return res.status(400).json({ error: "Template name is required" });
    }

    if (!Array.isArray(exerciseIds) || exerciseIds.length === 0) {
      return res.status(400).json({ error: "Select at least one exercise" });
    }

    const uniqueIds = [...new Set(exerciseIds.map(Number))];
    if (uniqueIds.some((id) => !Number.isInteger(id))) {
      return res.status(400).json({ error: "Invalid exercise ID" });
    }

    const count = await prisma.exercise.count({ where: { id: { in: uniqueIds } } });
    if (count !== uniqueIds.length) {
      return res.status(400).json({ error: "One or more exercises do not exist" });
    }

    const template = await prisma.workoutTemplate.create({
      data: {
        name: trimmedName,
        userId: authUserId(req),
        exercises: {
          create: uniqueIds.map((exerciseId, order) => ({ exerciseId, order })),
        },
      },
      include: {
        exercises: { orderBy: { order: "asc" }, include: { exercise: true } },
      },
    });

    res.status(201).json(template);
  } catch (error) {
    console.error("Failed to create workout template:", error);
    res.status(500).json({ error: "Failed to create workout template" });
  }
});

app.put("/api/templates/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, exerciseIds } = req.body;
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!Number.isInteger(id) || !trimmedName || !Array.isArray(exerciseIds) || exerciseIds.length === 0) {
      return res.status(400).json({ error: "Name and at least one exercise are required" });
    }

    const existing = await prisma.workoutTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Template not found" });
    if (existing.userId !== authUserId(req)) {
      return res.status(403).json({ error: "Only personal templates can be edited" });
    }

    const uniqueIds = [...new Set(exerciseIds.map(Number))];
    if (uniqueIds.some((exerciseId) => !Number.isInteger(exerciseId))) {
      return res.status(400).json({ error: "Invalid exercise ID" });
    }

    const count = await prisma.exercise.count({ where: { id: { in: uniqueIds } } });
    if (count !== uniqueIds.length) {
      return res.status(400).json({ error: "One or more exercises do not exist" });
    }

    const template = await prisma.$transaction(async (tx) => {
      await tx.workoutTemplateExercise.deleteMany({ where: { templateId: id } });
      return tx.workoutTemplate.update({
        where: { id },
        data: {
          name: trimmedName,
          exercises: { create: uniqueIds.map((exerciseId, order) => ({ exerciseId, order })) },
        },
        include: {
          exercises: { orderBy: { order: "asc" }, include: { exercise: true } },
        },
      });
    });

    res.json(template);
  } catch (error) {
    console.error("Failed to update workout template:", error);
    res.status(500).json({ error: "Failed to update workout template" });
  }
});

app.delete("/api/templates/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid template ID" });

    const existing = await prisma.workoutTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Template not found" });
    if (existing.userId !== authUserId(req)) {
      return res.status(403).json({ error: "Only personal templates can be deleted" });
    }

    await prisma.$transaction([
      prisma.workout.updateMany({ where: { templateId: id }, data: { templateId: null } }),
      prisma.workoutTemplate.delete({ where: { id } }),
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete workout template:", error);
    res.status(500).json({ error: "Failed to delete workout template" });
  }
});

// --------------------------------------------------
// Create workout
// --------------------------------------------------

app.post(
  "/api/workouts",
  async (req, res) => {
    try {
      const {
        userId,
        templateId,
        exercises,
      } = req.body;

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          error:
            "Valid userId is required",
        });
      }

      if (userId !== authUserId(req)) {
        return res.status(403).json({ error: "You cannot create this workout" });
      }

      if (
        templateId !== undefined &&
        templateId !== null &&
        !Number.isInteger(
          templateId,
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid templateId",
        });
      }

      if (
        !Array.isArray(exercises) ||
        exercises.length === 0
      ) {
        return res.status(400).json({
          error:
            "At least one exercise is required",
        });
      }

      const user =
        await prisma.user.findUnique({
          where: {
            id: userId,
          },
        });

      if (!user) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      const activeWorkout = await prisma.workout.findFirst({
        where: { userId, endedAt: null },
      });

      if (activeWorkout) {
        return res.status(409).json({
          error: "An active workout already exists",
        });
      }

      for (const exercise of exercises) {
        if (
          !Number.isInteger(
            Number(exercise.exerciseId),
          )
        ) {
          return res.status(400).json({
            error:
              "Invalid exercise ID",
          });
        }
      }

      const workout =
        await prisma.workout.create({
          data: {
            userId,
            templateId:
              templateId ?? null,

            exercises: {
              create: exercises.map(
                (
                  exercise: {
                    exerciseId: number;
                    weightUnit?:
                      | WeightUnit;
                    distanceUnit?:
                      | DistanceUnit;
                  },
                  index: number,
                ) => ({
                  exerciseId:
                    exercise.exerciseId,

                  order: index,

                  weightUnit:
                    exercise.weightUnit ??
                    "KG",

                  distanceUnit:
                    exercise.distanceUnit ??
                    "KM",
                }),
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
      console.error(
        "Failed to create workout:",
        error,
      );

      res.status(500).json({
        error:
          "Failed to create workout",
      });
    }
  },
);

// --------------------------------------------------
// Update exercise settings in active workout
// --------------------------------------------------

app.patch(
  "/api/workout-exercises/:id/settings",
  async (req, res) => {
    try {
      const workoutExerciseId =
        Number(req.params.id);

      if (
        !Number.isInteger(
          workoutExerciseId,
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid workout exercise ID",
        });
      }

      const existing =
        await prisma.workoutExercise.findUnique({
          where: {
            id: workoutExerciseId,
          },

          include: {
            workout: true,
          },
        });

      if (!existing) {
        return res.status(404).json({
          error:
            "Workout exercise not found",
        });
      }

      if (existing.workout.userId !== authUserId(req)) {
        return res.status(403).json({ error: "You cannot update this exercise" });
      }

      if (existing.workout.endedAt) {
        return res.status(400).json({
          error:
            "Workout has already ended",
        });
      }

      const weightUnit =
        req.body.weightUnit === "LBS"
          ? "LBS"
          : req.body.weightUnit ===
              "KG"
            ? "KG"
            : undefined;

      const distanceUnit =
        req.body.distanceUnit === "MI"
          ? "MI"
          : req.body.distanceUnit ===
              "KM"
            ? "KM"
            : undefined;

      if (
        weightUnit === undefined &&
        distanceUnit === undefined
      ) {
        return res.status(400).json({
          error:
            "At least one valid unit is required",
        });
      }

      const updated =
        await prisma.workoutExercise.update({
          where: {
            id: workoutExerciseId,
          },

          data: {
            ...(weightUnit
              ? {
                  weightUnit,
                }
              : {}),

            ...(distanceUnit
              ? {
                  distanceUnit,
                }
              : {}),
          },
        });

      res.json(updated);
    } catch (error) {
      console.error(
        "Failed to update workout exercise settings:",
        error,
      );

      res.status(500).json({
        error:
          "Failed to update workout exercise settings",
      });
    }
  },
);

// --------------------------------------------------
// Finish workout
// --------------------------------------------------

app.post(
  "/api/workouts/:id/finish",
  async (req, res) => {
    try {
      const workoutId = Number(
        req.params.id,
      );

      const { exercises } =
        req.body;

      if (!Number.isInteger(workoutId)) {
        return res.status(400).json({
          error:
            "Invalid workout ID",
        });
      }

      if (!Array.isArray(exercises)) {
        return res.status(400).json({
          error:
            "Exercises must be an array",
        });
      }

      const workout =
        await prisma.workout.findUnique({
          where: {
            id: workoutId,
          },

          include: {
            exercises: { include: { exercise: true } },
          },
        });

      if (!workout || workout.userId !== (req as AuthenticatedRequest).userId) {
        return res.status(404).json({
          error: "Workout not found",
        });
      }

      if (workout.endedAt) {
        return res.status(400).json({
          error:
            "Workout has already ended",
        });
      }

      const validatedSets: {
        workoutExerciseId: number;
        setNumber: number;
        weight: number | null;
        distance: number | null;
        reps: number | null;
        durationSeconds: number | null;
      }[] = [];

      for (const exercise of exercises) {
        const workoutExerciseId =
          Number(
            exercise.workoutExerciseId,
          );

        if (
          !Number.isInteger(
            workoutExerciseId,
          )
        ) {
          continue;
        }

        const workoutExercise =
          workout.exercises.find(
            (item) =>
              item.id ===
              workoutExerciseId,
          );

        if (!workoutExercise) {
          continue;
        }

        if (
          !Array.isArray(
            exercise.sets,
          )
        ) {
          continue;
        }

        const weightUnit =
          exercise.weightUnit ??
          workoutExercise.weightUnit;

        const distanceUnit =
          exercise.distanceUnit ??
          workoutExercise.distanceUnit;

        for (const set of exercise.sets) {
          const setNumber = Number(
            set.setNumber,
          );

          if (
            !Number.isInteger(
              setNumber,
            ) ||
            setNumber < 1
          ) {
            continue;
          }

          const weightText =
            typeof set.weight ===
            "string"
              ? set.weight.trim()
              : set.weight;

          const distanceText =
            typeof set.distance ===
            "string"
              ? set.distance.trim()
              : set.distance;

          const repsText =
            typeof set.reps ===
            "string"
              ? set.reps.trim()
              : set.reps;

          const durationText =
            typeof set.durationSeconds ===
            "string"
              ? set.durationSeconds.trim()
              : set.durationSeconds;

          let weight:
            | number
            | null = null;

          let distance:
            | number
            | null = null;

          let reps:
            | number
            | null = null;

          let durationSeconds:
            | number
            | null = null;

          // ------------------------------
          // Weight
          // ------------------------------

          if (
            weightText !== "" &&
            weightText !== null &&
            weightText !== undefined
          ) {
            const enteredWeight =
              Number(weightText);

            if (
              !Number.isFinite(
                enteredWeight,
              ) ||
              enteredWeight < 0
            ) {
              return res.status(400).json({
                error:
                  "Invalid weight",
              });
            }

            weight =
              convertWeightToKg(
                enteredWeight,
                weightUnit,
              );
          }

          // ------------------------------
          // Distance
          // ------------------------------

          if (
            distanceText !== "" &&
            distanceText !== null &&
            distanceText !== undefined
          ) {
            const enteredDistance =
              Number(distanceText);

            if (
              !Number.isFinite(
                enteredDistance,
              ) ||
              enteredDistance < 0
            ) {
              return res.status(400).json({
                error:
                  "Invalid distance",
              });
            }

            distance =
              convertDistanceToKm(
                enteredDistance,
                distanceUnit,
              );
          }

          // ------------------------------
          // Reps
          // ------------------------------

          if (
            repsText !== "" &&
            repsText !== null &&
            repsText !== undefined
          ) {
            reps = Number(
              repsText,
            );

            if (
              !Number.isInteger(
                reps,
              ) ||
              reps < 0
            ) {
              return res.status(400).json({
                error:
                  "Invalid reps",
              });
            }
          }

          // ------------------------------
          // Duration
          // ------------------------------

          if (
            durationText !== "" &&
            durationText !== null &&
            durationText !== undefined
          ) {
            durationSeconds =
              Number(
                durationText,
              );

            if (
              !Number.isInteger(
                durationSeconds,
              ) ||
              durationSeconds < 0
            ) {
              return res.status(400).json({
                error:
                  "Invalid duration",
              });
            }
          }

          const measurement = workoutExercise.exercise.measurementType;
          const hasRequiredValues =
            (measurement === "WEIGHT_REPS" && weight !== null && reps !== null) ||
            (measurement === "REPS" && reps !== null) ||
            (measurement === "DISTANCE_TIME" && distance !== null && durationSeconds !== null) ||
            (measurement === "TIME" && durationSeconds !== null) ||
            (measurement === "WEIGHT_DISTANCE" && weight !== null && distance !== null);

          if (!hasRequiredValues) {
            return res.status(400).json({ error: `Set ${setNumber} is incomplete` });
          }

          validatedSets.push({
            workoutExerciseId,
            setNumber,
            weight,
            distance,
            reps,
            durationSeconds,
          });
        }
      }

      const completedSetCount = validatedSets.length;
      const earnedXp = workoutXp(completedSetCount);

      const finishedWorkout = await prisma.$transaction(async (transaction) => {
        for (const set of validatedSets) {
          await transaction.workoutSet.upsert({
            where: {
              workoutExerciseId_setNumber: {
                workoutExerciseId: set.workoutExerciseId,
                setNumber: set.setNumber,
              },
            },
            update: set,
            create: set,
          });
        }

        const result = await transaction.workout.update({
          where: { id: workoutId },
          data: { endedAt: new Date() },
          include: {
            template: true,
            exercises: {
              orderBy: { order: "asc" },
              include: {
                exercise: true,
                sets: { orderBy: { setNumber: "asc" } },
              },
            },
          },
        });

        await transaction.xpEvent.create({
          data: { userId: workout.userId, workoutId, points: earnedXp },
        });
        await transaction.user.update({
          where: { id: workout.userId },
          data: { xp: { increment: earnedXp } },
        });

        return result;
      });

      return res.json(
        { ...finishedWorkout, earnedXp },
      );
    } catch (error) {
      console.error(
        "Failed to finish workout:",
        error,
      );

      return res.status(500).json({
        error:
          "Failed to finish workout",
      });
    }
  },
);

// --------------------------------------------------
// Add exercise to active workout
// --------------------------------------------------

app.post(
  "/api/workouts/:id/exercises",
  async (req, res) => {
    try {
      const workoutId = Number(
        req.params.id,
      );

      const exerciseId = Number(
        req.body.exerciseId,
      );

      const weightUnit =
        req.body.weightUnit ===
        "LBS"
          ? "LBS"
          : "KG";

      const distanceUnit =
        req.body.distanceUnit ===
        "MI"
          ? "MI"
          : "KM";

      if (!Number.isInteger(workoutId)) {
        return res.status(400).json({
          error:
            "Invalid workout ID",
        });
      }

      if (
        !Number.isInteger(
          exerciseId,
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid exercise ID",
        });
      }

      const workout =
        await prisma.workout.findUnique({
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

      if (workout.userId !== authUserId(req)) {
        return res.status(403).json({ error: "You cannot update this workout" });
      }

      if (workout.endedAt) {
        return res.status(400).json({
          error:
            "Workout has already ended",
        });
      }

      const exercise =
        await prisma.exercise.findUnique({
          where: {
            id: exerciseId,
          },
        });

      if (!exercise) {
        return res.status(404).json({
          error:
            "Exercise not found",
        });
      }

      const existingExercise =
        workout.exercises.find(
          (item) =>
            item.exerciseId ===
            exercise.id,
        );

      if (existingExercise) {
        return res.json(
          existingExercise,
        );
      }

      const nextOrder =
        workout.exercises.reduce(
          (highest, item) =>
            Math.max(
              highest,
              item.order,
            ),
          -1,
        ) + 1;

      const workoutExercise =
        await prisma.workoutExercise.create({
          data: {
            workoutId,
            exerciseId:
              exercise.id,
            order: nextOrder,
            weightUnit,
            distanceUnit,
          },
        });

      return res.json(
        workoutExercise,
      );
    } catch (error) {
      console.error(
        "Failed to add exercise to workout:",
        error,
      );

      return res.status(500).json({
        error:
          "Failed to add exercise to workout",
      });
    }
  },
);

app.delete(
  "/api/workout-exercises/:id",
  async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.workoutExercise.findFirst({
      where: { id, workout: { userId: req.userId!, endedAt: null } },
    });

    if (!existing) {
      return res.status(404).json({ error: "Active workout exercise not found" });
    }

    await prisma.workoutExercise.delete({ where: { id } });
    res.json({ success: true });
  },
);

app.patch(
  "/api/workouts/:id/exercises/order",
  async (req: AuthenticatedRequest, res) => {
    const workoutId = Number(req.params.id);
    const exerciseIds = req.body.exerciseIds;
    const workout = await prisma.workout.findFirst({
      where: { id: workoutId, userId: req.userId!, endedAt: null },
      include: { exercises: true },
    });

    if (!workout || !Array.isArray(exerciseIds)) {
      return res.status(400).json({ error: "Invalid active workout or exercise order" });
    }

    const currentIds = workout.exercises.map((item) => item.id).sort();
    const nextIds = exerciseIds.map(Number).sort();

    if (JSON.stringify(currentIds) !== JSON.stringify(nextIds)) {
      return res.status(400).json({ error: "Exercise order must contain every workout exercise" });
    }

    await prisma.$transaction(
      exerciseIds.map((id: number, order: number) =>
        prisma.workoutExercise.update({ where: { id }, data: { order } }),
      ),
    );

    res.json({ success: true });
  },
);

app.get(
  "/api/workouts/active/current",
  async (req: AuthenticatedRequest, res) => {
    const workout = await prisma.workout.findFirst({
      where: { userId: req.userId!, endedAt: null },
      orderBy: { startedAt: "desc" },
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } },
        },
      },
    });

    res.json(workout);
  },
);

app.delete(
  "/api/workouts/:id",
  async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const deleted = await prisma.workout.deleteMany({
      where: { id, userId: req.userId!, endedAt: null },
    });

    if (!deleted.count) {
      return res.status(404).json({ error: "Active workout not found" });
    }

    res.json({ success: true });
  },
);

// --------------------------------------------------
// Workout history
// --------------------------------------------------

app.get(
  "/api/workouts/:userId",
  async (req, res) => {
    try {
      const userId = Number(
        req.params.userId,
      );

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          error: "Invalid user ID",
        });
      }

      if (userId !== authUserId(req)) {
        return res.status(403).json({ error: "You cannot access these workouts" });
      }

      const workouts =
        await prisma.workout.findMany({
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
        error:
          "Failed to load workout history",
      });
    }
  },
);

// --------------------------------------------------
// Previous exercise workout
// --------------------------------------------------

app.get(
  "/api/exercises/:exerciseId/last-workout",
  async (req, res) => {
    try {
      const exerciseId = Number(
        req.params.exerciseId,
      );

      const userId = Number(
        req.query.userId,
      );

      if (
        !Number.isInteger(
          exerciseId,
        ) ||
        !Number.isInteger(userId)
      ) {
        return res.status(400).json({
          error:
            "Invalid exercise ID or user ID",
        });
      }

      if (userId !== authUserId(req)) {
        return res.status(403).json({ error: "You cannot access this workout" });
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
          previousExercise
            .exercise.name,

        measurementType:
          previousExercise
            .exercise
            .measurementType,

        workoutId:
          previousExercise.workoutId,

        completedAt:
          previousExercise.workout
            .endedAt,

        weightUnit:
          previousExercise
            .weightUnit,

        distanceUnit:
          previousExercise
            .distanceUnit,

        sets:
          previousExercise.sets.map(
            (set) => ({
              setNumber:
                set.setNumber,

              weight:
                set.weight,

              distance:
                set.distance,

              reps:
                set.reps,

              durationSeconds:
                set.durationSeconds,
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

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Vytor backend running on port ${PORT}`,
    );
  },
);
