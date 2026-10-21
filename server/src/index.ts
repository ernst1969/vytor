import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import cors from "cors";
import { createHash, randomBytes } from "node:crypto";
import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";

import { authLimits, accountPasswordLimits, proxyTrust, registrationAllowed, requestIdentity, logError, tooMany } from "./security.js";
import { workoutValidation, boundedTree, object, WORKOUT_LIMITS, validSets } from "./workout-validation.js";

import { validTemplateConfiguration } from "./validation.js";
import { levelForXp, progressForXp, workoutXp, rankTier } from "./progression.js";

class WorkoutConflictError extends Error {}
class WorkoutFrequencyError extends Error { constructor(public readonly retryAfter: number) { super("Workout frequency limit"); } }

const loginTimingHash = bcrypt.hashSync("vytor-nonexistent-account-timing", 12);
const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const configuredWebOrigin = process.env.WEB_ORIGIN?.replace(/\/$/, "") || "";

if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required in production");
}
if (process.env.NODE_ENV === "production" && configuredWebOrigin) {
  const url = new URL(configuredWebOrigin);
  if (url.protocol !== "https:" || url.origin !== configuredWebOrigin) throw new Error("WEB_ORIGIN must be one exact HTTPS origin without path, query, credentials or fragment");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
}, { schema: process.env.DATABASE_SCHEMA ?? "public" });

const prisma = new PrismaClient({
  adapter,
});

// Native mobile clients do not require browser CORS access.
app.use(cors(process.env.NODE_ENV === "production" ? { origin: configuredWebOrigin || false } : undefined));
app.disable("x-powered-by");
if (process.env.NODE_ENV === "production" && !process.env.TRUSTED_PROXY_IP) throw new Error("TRUSTED_PROXY_IP must identify the Caddy container in production");
app.set("trust proxy", proxyTrust(process.env.TRUSTED_PROXY_IP));
app.use(requestIdentity);
app.use(express.json({ limit: "3mb" }));
app.use((req, res, next) => {
  if (req.body !== undefined && (!object(req.body) || !boundedTree(req.body, 3_000_000))) return res.status(400).json({ error: "Invalid request body", code: "INVALID_INPUT" });
  req.body ??= {};
  next();
});
app.use(authLimits());
for (const parameter of ["id", "userId", "exerciseId", "friendId"]) app.param(parameter, (_req, res, next, value) => {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 2_147_483_647) return res.status(400).json({ error: `Invalid ${parameter}` });
  next();
});

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

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
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
    ...rankTier(user.xp),
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

    if (!registrationAllowed(process.env.NODE_ENV, process.env.REGISTRATION_INVITE_CODE_SHA256, req.body.inviteCode)) {
      return res.status(403).json({ error: "Registration requires a valid private-beta invitation", code: "REGISTRATION_CLOSED" });
    }

    if (!username || typeof username !== "string") {
      return res.status(400).json({
        error: "Username is required",
      });
    }

    if (!password || typeof password !== "string" || Buffer.byteLength(password) > 72) {
      return res.status(400).json({
        error: "Password is required",
      });
    }

    const trimmedUsername = username.trim();

    if (!/^[a-zA-Z0-9_]{2,24}$/.test(trimmedUsername)) {
      return res.status(400).json({
        error: "Username must be 2–24 letters, numbers, or underscores",
      });
    }

    if (password.length < 8 || Buffer.byteLength(password) > 72) {
      return res.status(400).json({
        error: "Password must be at least 8 characters",
      });
    }

    const existingUser =
      await prisma.user.findFirst({
        where: { username: { equals: trimmedUsername, mode: "insensitive" } },
      });

    if (existingUser) {
      return res.status(409).json({
        error: "Registration could not be completed",
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
    if ((error as { code?: string }).code === "P2002") return res.status(409).json({ error: "Registration could not be completed", code: "CONFLICT" });
    logError(
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

    if (!password || typeof password !== "string" || Buffer.byteLength(password) > 72) {
      return res.status(400).json({
        error: "Password is required",
      });
    }

    const trimmedUsername = username.trim();
    if (!/^[a-zA-Z0-9_]{2,24}$/.test(trimmedUsername)) return res.status(401).json({ error: "Invalid username or password" });

    const user =
      await prisma.user.findFirst({
        where: { username: { equals: trimmedUsername, mode: "insensitive" } },
      });

    const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? loginTimingHash);
    if (!user || !user.passwordHash || !passwordMatches) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = await createSession(user.id);

    res.json({
      id: user.id,
      username: user.username,
      token,
    });
  } catch (error) {
    logError(
      "Failed to log in:",
      error,
    );

    res.status(500).json({
      error: "Failed to log in",
    });
  }
});

app.get("/api/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

app.use("/api", requireAuth);
app.use("/api", accountPasswordLimits());
app.use("/api", workoutValidation);

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
      (!Number.isInteger(restSeconds) || restSeconds < 0 || restSeconds > 3600)) {
    return res.status(400).json({ error: "Rest duration must be between 0 and 3600 seconds" });
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
            displayName: true,
            avatarData: true,
          },
        });

      res.json(users);
    } catch (error) {
      logError(
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
            displayName: true,
            avatarData: true,
          },
        });

      if (!user) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      const viewerId = (req as AuthenticatedRequest).userId!;
      const [progress, relationship] = await Promise.all([
        getProgress(userId),
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
      const mayViewActivity = viewerId === userId || relationship?.status === "ACCEPTED";
      const recentWorkouts = mayViewActivity ? await prisma.workout.findMany({
        where: { userId, endedAt: { not: null } },
        orderBy: { endedAt: "desc" },
        take: 14,
        select: { id: true, startedAt: true, endedAt: true },
      }) : [];

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
      logError(
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
        displayName: user.displayName,
        avatarData: user.avatarData,
        ...progress,
      });
    } catch (error) {
      logError(
        "Failed to get user:",
        error,
      );

      res.status(500).json({
        error: "Failed to get user",
      });
    }
  },
);

app.patch("/api/users/:id/profile", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id !== authUserId(req)) {
      return res.status(403).json({ error: "You cannot edit this profile" });
    }

    const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
    const displayName = typeof req.body.displayName === "string" ? req.body.displayName.trim() : "";
    const avatarData = req.body.avatarData === null || typeof req.body.avatarData === "string"
      ? req.body.avatarData
      : undefined;

    if (!/^[a-zA-Z0-9_]{2,24}$/.test(username)) {
      return res.status(400).json({ error: "Username must be 2–24 letters, numbers, or underscores" });
    }
    if (displayName.length > 50) {
      return res.status(400).json({ error: "Display name is too long" });
    }
    if (typeof avatarData === "string" && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(avatarData) || avatarData.length > 2_500_000)) {
      return res.status(400).json({ error: "Profile image is invalid or too large" });
    }

    const duplicate = await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" }, id: { not: id } } });
    if (duplicate) return res.status(409).json({ error: "Username already exists" });

    const user = await prisma.user.update({
      where: { id },
      data: {
        username,
        displayName: displayName || null,
        ...(avatarData !== undefined ? { avatarData } : {}),
      },
      select: { id: true, username: true, displayName: true, avatarData: true },
    });
    res.json(user);
  } catch (error) {
    logError("Failed to update profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

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
                displayName: true,
                avatarData: true,
              },
            },
            recipient: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarData: true,
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
      logError(
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
                displayName: true,
                avatarData: true,
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
      logError(
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

app.post("/api/friends/request", async (req, res) => {
  const requesterId = Number(req.body.requesterId);
  const recipientId = Number(req.body.recipientId);
  if (!Number.isSafeInteger(requesterId) || !Number.isSafeInteger(recipientId) || recipientId < 1) return res.status(400).json({ error: "Valid requesterId and recipientId are required" });
  if (requesterId !== authUserId(req)) return res.status(403).json({ error: "You cannot send this request" });
  if (requesterId === recipientId) return res.status(400).json({ error: "You cannot add yourself as a friend" });
  if (!await prisma.user.findUnique({ where: { id: recipientId } })) return res.status(404).json({ error: "User not found" });
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${Math.min(requesterId, recipientId)}::int, ${Math.max(requesterId, recipientId)}::int)`;
    const requests = await tx.friendRequest.findMany({ where: { OR: [{ requesterId, recipientId }, { requesterId: recipientId, recipientId: requesterId }] } });
    const accepted = requests.find((item) => item.status === "ACCEPTED");
    if (accepted) return { status: 409, body: { error: "You are already friends" } };
    const pending = requests.find((item) => item.status === "PENDING");
    if (pending) return { status: 409, body: { error: pending.requesterId === requesterId ? "Friend request already sent" : "This user has already sent you a friend request" } };
    const existing = requests.find((item) => item.requesterId === requesterId) ?? requests[0];
    const request = existing
      ? await tx.friendRequest.update({ where: { id: existing.id }, data: { requesterId, recipientId, status: "PENDING" } })
      : await tx.friendRequest.create({ data: { requesterId, recipientId, status: "PENDING" } });
    return { status: existing ? 200 : 201, body: request };
  });
  // Send only after commit so accepting immediately can always see the request.
  res.status(result.status).json(result.body);
});

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
        await prisma.friendRequest.updateMany({
          where: { id: requestId, recipientId: userId, status: "PENDING" },
          data: {
            status: "ACCEPTED",
          },
        });
      if (!updated.count) return res.status(409).json({ error: "This request is no longer pending" });
      res.json({ success: true });
    } catch (error) {
      logError(
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

      const updated = await prisma.friendRequest.updateMany({
        where: { id: requestId, recipientId: userId, status: "PENDING" },
        data: {
          status: "REJECTED",
        },
      });
      if (!updated.count) return res.status(409).json({ error: "This request is no longer pending" });

      res.json({
        success: true,
      });
    } catch (error) {
      logError(
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
                displayName: true,
                avatarData: true,
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
      logError(
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
  async (req, res) => {
    try {
      const exercises =
        await prisma.exercise.findMany({
          where: { archived: false, OR: [{ ownerId: null }, { ownerId: authUserId(req) }] },
          include: { preferences: { where: { userId: authUserId(req) } } },
          orderBy: {
            name: "asc",
          },
        });

      res.json(exercises);
    } catch (error) {
      logError(
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
            OR: [{ userId: null, name: { not: "Starter Workout" } }, { userId: authUserId(req) }],
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
                exercise: { include: { preferences: { where: { userId: authUserId(req) } } } },
              },
            },
          },
        });

      res.json(templates);
    } catch (error) {
      logError(
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

    if (!Array.isArray(exerciseIds) || exerciseIds.length === 0 || exerciseIds.length > WORKOUT_LIMITS.exercises) {
      return res.status(400).json({ error: "Select at least one exercise" });
    }

    if (exerciseIds.some((id: unknown) => typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || id > 2_147_483_647)) return res.status(400).json({ error: "Invalid exercise ID" });
    const uniqueIds = [...new Set<number>(exerciseIds)];
    if (uniqueIds.some((id) => !Number.isSafeInteger(id) || id < 1 || id > 2_147_483_647)) {
      return res.status(400).json({ error: "Invalid exercise ID" });
    }

    if (trimmedName.length > 60 || !validTemplateConfiguration(req.body.configuration, uniqueIds)) return res.status(400).json({ error: "Invalid template configuration" });
    const count = await prisma.exercise.count({ where: { id: { in: uniqueIds }, archived: false, OR: [{ ownerId: null }, { ownerId: authUserId(req) }] } });
    if (count !== uniqueIds.length) {
      return res.status(400).json({ error: "One or more exercises do not exist" });
    }

    const template = await prisma.workoutTemplate.create({
      data: {
        name: trimmedName,
        configuration: req.body.configuration ?? undefined,
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
    logError("Failed to create workout template:", error);
    res.status(500).json({ error: "Failed to create workout template" });
  }
});

app.put("/api/templates/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, exerciseIds } = req.body;
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!Number.isInteger(id) || !trimmedName || !Array.isArray(exerciseIds) || exerciseIds.length === 0 || exerciseIds.length > WORKOUT_LIMITS.exercises) {
      return res.status(400).json({ error: "Name and at least one exercise are required" });
    }

    const existing = await prisma.workoutTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Template not found" });
    if (existing.userId !== authUserId(req)) {
      return res.status(403).json({ error: "Only personal templates can be edited" });
    }

    if (exerciseIds.some((id: unknown) => typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || id > 2_147_483_647)) return res.status(400).json({ error: "Invalid exercise ID" });
    const uniqueIds = [...new Set<number>(exerciseIds)];
    if (uniqueIds.some((exerciseId) => !Number.isInteger(exerciseId))) {
      return res.status(400).json({ error: "Invalid exercise ID" });
    }

    if (trimmedName.length > 60 || !validTemplateConfiguration(req.body.configuration, uniqueIds)) return res.status(400).json({ error: "Invalid template configuration" });
    const count = await prisma.exercise.count({ where: { id: { in: uniqueIds }, archived: false, OR: [{ ownerId: null }, { ownerId: authUserId(req) }] } });
    if (count !== uniqueIds.length) {
      return res.status(400).json({ error: "One or more exercises do not exist" });
    }

    const template = await prisma.$transaction(async (tx) => {
      await tx.workoutTemplateExercise.deleteMany({ where: { templateId: id } });
      return tx.workoutTemplate.update({
        where: { id },
        data: {
          name: trimmedName,
          configuration: req.body.configuration ?? undefined,
          exercises: { create: uniqueIds.map((exerciseId, order) => ({ exerciseId, order })) },
        },
        include: {
          exercises: { orderBy: { order: "asc" }, include: { exercise: true } },
        },
      });
    });

    res.json(template);
  } catch (error) {
    logError("Failed to update workout template:", error);
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
    logError("Failed to delete workout template:", error);
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

      if (templateId && !await prisma.workoutTemplate.findFirst({ where: { id: templateId, OR: [{ userId: null }, { userId }] } })) {
        return res.status(403).json({ error: "Template is not accessible" });
      }
      const ids = exercises.map((item: { exerciseId: number }) => Number(item.exerciseId));
      const available = await prisma.exercise.count({ where: { id: { in: ids }, archived: false, OR: [{ ownerId: null }, { ownerId: userId }] } });
      if (available !== ids.length) return res.status(400).json({ error: "Select accessible, distinct exercises" });

      const activeWorkout = await prisma.workout.findFirst({
        where: { userId, endedAt: null, suspended: false },
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
      logError(
        "Failed to create workout:",
        error,
      );
      if ((error as { code?: string }).code === "P2002") return res.status(409).json({ error: "An active workout already exists. Resume it from Home." });

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

      if (existing.workout.endedAt || existing.workout.suspended) {
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

      const restSeconds = Number(req.body.restSeconds);
      const hasRestSeconds = req.body.restSeconds !== undefined;
      if (hasRestSeconds && (!Number.isInteger(restSeconds) || restSeconds < 0 || restSeconds > 3600)) {
        return res.status(400).json({ error: "Rest duration must be between 0 and 3600 seconds" });
      }

      if (
        weightUnit === undefined &&
        distanceUnit === undefined &&
        !hasRestSeconds
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
            ...(hasRestSeconds ? { restSeconds } : {}),
          },
        });

      res.json(updated);
    } catch (error) {
      logError(
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

      if (workout.endedAt || workout.suspended) {
        return res.status(400).json({ error: "Workout has already ended" });
      }
      if (!Number.isInteger(req.body.revision)) return res.status(400).json({ error: "Draft revision is required" });
      if (req.body.revision !== workout.revision) return res.status(409).json({ error: "Workout changed on another device. Reload before finishing." });

      const validatedSets: {
        workoutExerciseId: number;
        setNumber: number;
        weight: number | null;
        distance: number | null;
        reps: number | null;
        durationSeconds: number | null;
        setType: "WARMUP" | "REGULAR" | "DROP";
        dropSetOfNumber: number | null;
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

        if (!workoutExercise) return res.status(400).json({ error: "Invalid workout exercise" });

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
        if (!["KG", "LBS"].includes(weightUnit) || !["KM", "MI"].includes(distanceUnit)) return res.status(400).json({ error: "Invalid exercise units" });

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
            setType: ["WARMUP", "DROP"].includes(set.setType) ? set.setType : "REGULAR",
            dropSetOfNumber: null,
          });
        }

        const exerciseSets = validatedSets.filter((set) => set.workoutExerciseId === workoutExerciseId);
        for (const [index, set] of exerciseSets.entries()) {
          const payloadSet = exercise.sets.find((candidate: { setNumber?: unknown }) => Number(candidate.setNumber) === set.setNumber);
          if (set.setType !== "DROP") continue;
          const explicitSourceId = typeof payloadSet?.dropSetOfId === "string" ? payloadSet.dropSetOfId : null;
          const explicitSource = explicitSourceId
            ? exercise.sets.find((candidate: { id?: unknown }) => candidate.id === explicitSourceId)
            : null;
          const fallback = [...exerciseSets.slice(0, index)].reverse().find((candidate) => candidate.setType !== "DROP");
          const sourceNumber = explicitSource ? Number(explicitSource.setNumber) : fallback?.setNumber;
          const source = exerciseSets.find((candidate) => candidate.setNumber === sourceNumber && candidate.setType !== "DROP");
          if (!source) return res.status(400).json({ error: `Drop set ${set.setNumber} has no valid origin set` });
          set.dropSetOfNumber = source.setNumber;
        }
      }

      if (!validatedSets.length) return res.status(400).json({ error: "Complete at least one set before finishing" });
      if (new Set(validatedSets.map((set) => `${set.workoutExerciseId}:${set.setNumber}`)).size !== validatedSets.length) return res.status(400).json({ error: "Duplicate sets" });
      // Validate again using persisted units when the finish payload omits them.
      if (exercises.some((entry: any) => {
        const existing = workout.exercises.find((item) => item.id === entry.workoutExerciseId);
        return !existing || !validSets(entry.sets, false, entry.weightUnit ?? existing.weightUnit, entry.distanceUnit ?? existing.distanceUnit);
      })) return res.status(400).json({ error: "Workout measurements exceed safety limits" });
      const completedSetCount = validatedSets.filter((set) => set.setType !== "WARMUP").length;
      const earnedXp = workoutXp(completedSetCount);

      const finishedWorkout = await prisma.$transaction(async (transaction) => {
        // Serialize all XP awards for one user across devices; survive process restarts.
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${workout.userId}::int)`;
        const current = await transaction.workout.findUnique({ where: { id: workoutId } });
        if (!current || current.endedAt || current.revision !== workout.revision || current.suspended) throw new WorkoutConflictError();
        const recent = await transaction.xpEvent.findMany({ where: { userId: workout.userId, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } }, orderBy: { createdAt: "desc" }, take: 12 });
        const latest = recent[0];
        if (latest && Date.now() - latest.createdAt.getTime() < 60_000) throw new WorkoutFrequencyError(Math.ceil((60_000 - (Date.now() - latest.createdAt.getTime())) / 1000));
        if (recent.length >= 12) throw new WorkoutFrequencyError(Math.ceil((recent[11]!.createdAt.getTime() + 60 * 60_000 - Date.now()) / 1000));
        const persistedSetIds = new Map<string, number>();
        for (const set of validatedSets) {
          const { dropSetOfNumber: _dropSetOfNumber, ...values } = set;
          const persisted = await transaction.workoutSet.upsert({
            where: {
              workoutExerciseId_setNumber: {
                workoutExerciseId: set.workoutExerciseId,
                setNumber: set.setNumber,
              },
            },
            update: { ...values, dropSetOfId: null },
            create: values,
          });
          persistedSetIds.set(`${set.workoutExerciseId}:${set.setNumber}`, persisted.id);
        }
        for (const set of validatedSets) {
          if (set.dropSetOfNumber === null) continue;
          await transaction.workoutSet.update({
            where: { workoutExerciseId_setNumber: { workoutExerciseId: set.workoutExerciseId, setNumber: set.setNumber } },
            data: { dropSetOfId: persistedSetIds.get(`${set.workoutExerciseId}:${set.dropSetOfNumber}`)! },
          });
        }

        const result = await transaction.workout.update({
          where: { id: workoutId, revision: workout.revision, endedAt: null, suspended: false },
          data: { endedAt: new Date(), draft: Prisma.DbNull },
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
        { ...finishedWorkout, earnedXp, progress: await getProgress(workout.userId) },
      );
    } catch (error) {
      if (error instanceof WorkoutConflictError) return res.status(409).json({ error: "Workout changed or was already finished. Reload it." });
      if (error instanceof WorkoutFrequencyError) return tooMany(res, error.retryAfter);
      if (["P2025", "P2002"].includes((error as { code?: string }).code ?? "")) return res.status(409).json({ error: "Workout changed or was already finished. Reload it." });
      logError(
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
      const revision = Number(req.body.revision);

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
      if (!Number.isInteger(revision) || revision < 0) return res.status(400).json({ error: "Draft revision is required" });

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

      if (workout.endedAt || workout.suspended) {
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

      if (!exercise || exercise.archived || (exercise.ownerId !== null && exercise.ownerId !== authUserId(req))) {
        return res.status(404).json({
          error:
            "Exercise not found",
        });
      }

      const workoutExercise = await prisma.$transaction(async (tx) => {
        const locked = await tx.workout.updateMany({ where: { id: workoutId, userId: authUserId(req), endedAt: null, suspended: false, revision }, data: { revision: { increment: 1 } } });
        if (!locked.count) return null;
        const current = await tx.workout.findFirst({ where: { id: workoutId, userId: authUserId(req), endedAt: null, suspended: false }, include: { exercises: true } });
        if (!current) return null;
        const duplicate = current.exercises.find((item) => item.exerciseId === exercise.id);
        if (duplicate || current.exercises.length >= WORKOUT_LIMITS.exercises) throw new WorkoutConflictError();
        const created = await tx.workoutExercise.create({ data: { workoutId, exerciseId: exercise.id, order: current.exercises.reduce((n, item) => Math.max(n, item.order + 1), 0), weightUnit, distanceUnit } });
        return { ...created, revision: revision + 1 };
      });
      if (!workoutExercise) return res.status(409).json({ error: "Workout changed on another device. Reload before adding an exercise." });

      return res.json(
        workoutExercise,
      );
    } catch (error) {
      if (error instanceof WorkoutConflictError || (error as { code?: string }).code === "P2002") return res.status(409).json({ error: "Workout changed or already contains this exercise. Reload it." });
      logError(
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

app.patch("/api/workout-exercises/:id/replace", async (req, res) => {
  const current = await prisma.workoutExercise.findFirst({ where: { id: Number(req.params.id), workout: { userId: authUserId(req), endedAt: null, suspended: false } }, include: { workout: true } });
  if (!current) return res.status(404).json({ error: "Active exercise not found" });
  if (!Number.isInteger(req.body.revision)) return res.status(400).json({ error: "Draft revision is required" });
  const exerciseId = req.body.exerciseId;
  const exercise = Number.isSafeInteger(exerciseId) ? await prisma.exercise.findFirst({ where: { id: exerciseId, archived: false, OR: [{ ownerId: null }, { ownerId: authUserId(req) }] } }) : null;
  if (!exercise || !["KG", "LBS"].includes(req.body.weightUnit) || !["KM", "MI"].includes(req.body.distanceUnit)) return res.status(400).json({ error: "Invalid replacement exercise" });
  const existing = await prisma.workoutExercise.findFirst({ where: { workoutId: current.workoutId, exerciseId, id: { not: current.id } } });
  if (existing) return res.status(409).json({ error: "Exercise is already in this workout" });
  const draft = current.workout.draft as { exercises?: { workoutExerciseId: number }[] } | null;
  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.workout.updateMany({ where: { id: current.workoutId, endedAt: null, suspended: false, revision: req.body.revision }, data: { revision: { increment: 1 }, draft: draft ? { ...draft, exercises: draft.exercises?.filter((item) => item.workoutExerciseId !== current.id) ?? [] } : Prisma.DbNull } });
    if (!changed.count) return null;
    await tx.workoutSet.deleteMany({ where: { workoutExerciseId: current.id } });
    return tx.workoutExercise.update({ where: { id: current.id }, data: { exerciseId, weightUnit: req.body.weightUnit, distanceUnit: req.body.distanceUnit, restSeconds: null }, include: { exercise: true } });
  });
  if (!result) return res.status(409).json({ error: "Workout changed on another device. Reload before replacing." });
  res.json({ ...result, revision: req.body.revision + 1 });
});

app.delete(
  "/api/workout-exercises/:id",
  async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const revision = Number(req.body.revision);
    const existing = await prisma.workoutExercise.findFirst({
      where: { id, workout: { userId: req.userId!, endedAt: null, suspended: false } }, include: { workout: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Active workout exercise not found" });
    }

    const draft = existing.workout.draft as { exercises?: { workoutExerciseId: number }[] } | null;
    const deleted = await prisma.$transaction(async (tx) => {
      const changed = await tx.workout.updateMany({ where: { id: existing.workoutId, userId: req.userId!, endedAt: null, suspended: false, revision }, data: { revision: { increment: 1 }, draft: draft ? { ...draft, exercises: draft.exercises?.filter((item) => item.workoutExerciseId !== id) ?? [] } : Prisma.DbNull } });
      if (!changed.count) return false;
      await tx.workoutExercise.delete({ where: { id } });
      return true;
    });
    if (!deleted) return res.status(409).json({ error: "Workout changed on another device. Reload before deleting." });
    res.json({ success: true, revision: revision + 1 });
  },
);

app.patch(
  "/api/workouts/:id/exercises/order",
  async (req: AuthenticatedRequest, res) => {
    const workoutId = Number(req.params.id);
    const exerciseIds = req.body.exerciseIds;
    const revision = Number(req.body.revision);
    const workout = await prisma.workout.findFirst({
      where: { id: workoutId, userId: req.userId!, endedAt: null, suspended: false },
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

    const changed = await prisma.$transaction(async (tx) => {
      const locked = await tx.workout.updateMany({ where: { id: workoutId, userId: req.userId!, endedAt: null, suspended: false, revision }, data: { revision: { increment: 1 } } });
      if (!locked.count) return false;
      for (const [order, id] of exerciseIds.entries()) await tx.workoutExercise.update({ where: { id }, data: { order } });
      return true;
    });
    if (!changed) return res.status(409).json({ error: "Workout changed on another device. Reload before reordering." });
    res.json({ success: true, revision: revision + 1 });
  },
);

app.get("/api/workouts/drafts/suspended", async (req, res) => {
  res.json(await prisma.workout.findMany({ where: { userId: authUserId(req), endedAt: null, suspended: true }, orderBy: [{ startedAt: "desc" }, { id: "desc" }], select: { id: true, startedAt: true, notes: true, template: { select: { name: true } }, _count: { select: { exercises: true } } } }));
});
app.post("/api/workouts/:id/resume", async (req, res) => {
  const id = Number(req.params.id);
  const result = await prisma.$transaction(async (tx) => {
    // Serialize switches per account, including simultaneous resume actions.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${authUserId(req)}::int)`;
    const target = await tx.workout.findFirst({ where: { id, userId: authUserId(req), endedAt: null } });
    if (!target) return null;
    await tx.workout.updateMany({ where: { userId: authUserId(req), endedAt: null, suspended: false, id: { not: id } }, data: { suspended: true, revision: { increment: 1 } } });
    return tx.workout.update({ where: { id }, data: { suspended: false, revision: { increment: 1 } } });
  });
  if (!result) return res.status(404).json({ error: "Unfinished workout not found" });
  res.json({ success: true });
});

app.get(
  "/api/workouts/active/current",
  async (req: AuthenticatedRequest, res) => {
    const workout = await prisma.workout.findFirst({
      where: { userId: req.userId!, endedAt: null, suspended: false },
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
      where: { id, userId: req.userId!, endedAt: null, suspended: false },
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
      logError(
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
      logError(
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


// Versioned drafts: a stale device cannot silently overwrite another device.
app.put("/api/workouts/:id/draft", async (req, res) => {
  const { revision, draft, notes } = req.body;
  if (!Number.isInteger(revision) || !draft || !Array.isArray(draft.exercises) || draft.exercises.length > 100 || draft.exercises.some((item: any) => !item || !Number.isSafeInteger(item.workoutExerciseId) || item.workoutExerciseId < 1) || JSON.stringify(draft).length > 500000 || typeof notes !== "string" || notes.length > 5000) {
    return res.status(400).json({ error: "Invalid workout draft" });
  }
  const active = await prisma.workout.findFirst({ where: { id: Number(req.params.id), userId: authUserId(req), endedAt: null, suspended: false }, include: { exercises: true } });
  if (!active) return res.status(404).json({ error: "Active workout not found" });
  const ids = draft.exercises.map((item: { workoutExerciseId?: number }) => item.workoutExerciseId);
  if (ids.length !== active.exercises.length || new Set(ids).size !== ids.length || active.exercises.some((item) => !ids.includes(item.id) || draft.exercises.find((entry: any) => entry.workoutExerciseId === item.id)?.exerciseId !== item.exerciseId)) return res.status(409).json({ error: "Exercise list changed on another device. Reload before syncing." });
  for (const item of draft.exercises) {
    if (!item || !["KG", "LBS"].includes(item.weightUnit) || !["KM", "MI"].includes(item.distanceUnit) || !Array.isArray(item.sets) || item.sets.length > 100 || (item.restSeconds != null && (!Number.isInteger(item.restSeconds) || item.restSeconds < 0 || item.restSeconds > 3600))) return res.status(400).json({ error: "Invalid draft exercise" });
  }
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.workout.updateMany({ where: { id: active.id, userId: authUserId(req), endedAt: null, suspended: false, revision }, data: { draft, notes, revision: { increment: 1 } } });
    if (!result.count) return result;
    for (const item of draft.exercises) {
      await tx.workoutExercise.update({ where: { id: item.workoutExerciseId }, data: { weightUnit: item.weightUnit, distanceUnit: item.distanceUnit, ...(item.restSeconds === undefined ? {} : { restSeconds: item.restSeconds }) } });
      const exerciseId = active.exercises.find((entry) => entry.id === item.workoutExerciseId)!.exerciseId;
      const data = { notes: typeof item.notes === "string" ? item.notes.slice(0, 2000) : "", restSeconds: item.restSeconds ?? null, weightUnit: item.weightUnit, distanceUnit: item.distanceUnit };
      await tx.exercisePreference.upsert({ where: { userId_exerciseId: { userId: authUserId(req), exerciseId } }, update: data, create: { ...data, userId: authUserId(req), exerciseId } });
    }
    return result;
  });
  if (!updated.count) return res.status(409).json({ error: "Workout changed on another device. Reload before syncing." });
  res.json({ revision: revision + 1 });
});

app.get("/api/workouts/detail/:id", async (req, res) => {
  const workout = await prisma.workout.findUnique({
    where: { id: Number(req.params.id) },
    include: { template: true, xpEvent: true, exercises: { orderBy: { order: "asc" }, include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } } } },
  });
  if (!workout) return res.status(404).json({ error: "Workout not found" });
  const viewer = authUserId(req);
  const friendship = viewer === workout.userId || await prisma.friendRequest.findFirst({ where: { status: "ACCEPTED", OR: [{ requesterId: viewer, recipientId: workout.userId }, { requesterId: workout.userId, recipientId: viewer }] } });
  if (!friendship) return res.status(403).json({ error: "Only you and accepted friends can view workout details" });
  const progress = await getProgress(workout.userId);
  const previous = await prisma.workoutExercise.findMany({
    where: { exerciseId: { in: workout.exercises.map((item) => item.exerciseId) }, workout: { userId: workout.userId, endedAt: { not: null }, startedAt: { lt: workout.startedAt } } },
    include: { sets: true },
  });
  const highlights = workout.exercises.flatMap((item) => {
    const history = previous.filter((entry) => entry.exerciseId === item.exerciseId).flatMap((entry) => entry.sets);
    return item.sets.flatMap((set) => {
      if (set.weight === null || set.reps === null || set.setType === "WARMUP") return [];
      const sameWeight = history.filter((entry) => entry.weight !== null && Math.abs(entry.weight - set.weight!) < 0.01 && entry.reps !== null);
      const sameReps = history.filter((entry) => entry.reps === set.reps && entry.weight !== null);
      const result: string[] = [];
      if (sameWeight.length && set.reps > Math.max(...sameWeight.map((entry) => entry.reps!))) result.push(`${item.exercise.name}: more reps at the same weight`);
      if (sameReps.length && set.weight > Math.max(...sameReps.map((entry) => entry.weight!))) result.push(`${item.exercise.name}: more weight at the same reps`);
      return result;
    });
  });
  res.json({ ...workout, draft: undefined, progress, highlights: [...new Set(highlights)] });
});

app.put("/api/exercises/:id/preferences", async (req, res) => {
  const exerciseId = Number(req.params.id);
  const exercise = await prisma.exercise.findFirst({ where: { id: exerciseId, OR: [{ ownerId: null }, { ownerId: authUserId(req) }] } });
  if (!exercise) return res.status(404).json({ error: "Exercise not found" });
  const { notes, restSeconds, weightUnit, distanceUnit } = req.body;
  if (typeof notes !== "string" || notes.length > 2000 || !Number.isInteger(restSeconds) || restSeconds < 0 || restSeconds > 3600 || !["KG", "LBS"].includes(weightUnit) || !["KM", "MI"].includes(distanceUnit)) return res.status(400).json({ error: "Invalid exercise preferences" });
  const data = { notes, restSeconds, weightUnit, distanceUnit };
  res.json(await prisma.exercisePreference.upsert({ where: { userId_exerciseId: { userId: authUserId(req), exerciseId } }, update: data, create: { ...data, userId: authUserId(req), exerciseId } }));
});

app.post("/api/exercises", async (req, res) => {
  const { name, measurementType, category, description } = req.body;
  if (typeof name !== "string" || !name.trim() || name.length > 100 || !["WEIGHT_REPS", "REPS", "TIME", "DISTANCE_TIME", "WEIGHT_DISTANCE"].includes(measurementType) || (category !== undefined && (typeof category !== "string" || category.length > 100)) || (description !== undefined && (typeof description !== "string" || description.length > 2000))) return res.status(400).json({ error: "Invalid exercise" });
  if (await prisma.exercise.findUnique({ where: { name: name.trim() } })) return res.status(409).json({ error: "Exercise name already exists" });
  res.status(201).json(await prisma.exercise.create({ data: { name: name.trim(), measurementType, category, description, ownerId: authUserId(req) } }));
});
app.patch("/api/exercises/:id", async (req, res) => {
  const exercise = await prisma.exercise.findFirst({ where: { id: Number(req.params.id), ownerId: authUserId(req) } });
  if (!exercise) return res.status(403).json({ error: "Only your own exercises can be edited" });
  const { name, description, category } = req.body;
  if (typeof name !== "string" || !name.trim() || name.length > 100 || typeof description !== "string" || description.length > 2000 || typeof category !== "string" || category.length > 100) return res.status(400).json({ error: "Invalid exercise" });
  res.json(await prisma.exercise.update({ where: { id: exercise.id }, data: { name: name.trim(), description, category } }));
});
app.delete("/api/exercises/:id", async (req, res) => {
  const updated = await prisma.exercise.updateMany({ where: { id: Number(req.params.id), ownerId: authUserId(req) }, data: { archived: true } });
  if (!updated.count) return res.status(403).json({ error: "Only your own exercises can be deleted" });
  res.json({ success: true });
});
app.post("/api/feedback", async (req, res) => {
  const message = req.body.message;
  if (typeof message !== "string" || message.trim().length < 5 || message.length > 5000) return res.status(400).json({ error: "Feedback must contain 5–5000 characters" });
  await prisma.feedback.create({ data: { userId: authUserId(req), message: message.trim() } });
  res.status(201).json({ success: true });
});
app.put("/api/account/password", async (req, res) => {
  const { currentPassword, password } = req.body;
  if (typeof currentPassword !== "string" || Buffer.byteLength(currentPassword) > 72 || typeof password !== "string" || password.length < 8 || Buffer.byteLength(password) > 72) return res.status(400).json({ error: "Password must contain 8–72 characters" });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: authUserId(req) } });
  if (!user.passwordHash || !await bcrypt.compare(currentPassword, user.passwordHash)) return res.status(403).json({ error: "Current password is incorrect" });
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([prisma.user.update({ where: { id: user.id }, data: { passwordHash } }), prisma.session.deleteMany({ where: { userId: user.id } })]);
  res.json({ success: true });
});
app.delete("/api/account", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: authUserId(req) } });
  if (typeof req.body.password !== "string" || Buffer.byteLength(req.body.password) > 72 || !user.passwordHash || !await bcrypt.compare(req.body.password, user.passwordHash)) return res.status(403).json({ error: "Password is incorrect" });
  await prisma.$transaction(async (tx) => {
    await tx.workout.deleteMany({ where: { userId: user.id } });
    await tx.workoutTemplate.deleteMany({ where: { userId: user.id } });
    const customExercises = await tx.exercise.findMany({ where: { ownerId: user.id }, select: { id: true, _count: { select: { workoutExercises: true, workoutTemplateExercises: true } } } });
    for (const exercise of customExercises) {
      if (exercise._count.workoutExercises || exercise._count.workoutTemplateExercises) {
        await tx.exercise.update({ where: { id: exercise.id }, data: { ownerId: null, archived: true, name: `Deleted exercise ${exercise.id}`, description: null, category: null } });
      } else {
        await tx.exercise.delete({ where: { id: exercise.id } });
      }
    }
    await tx.user.delete({ where: { id: user.id } });
  });
  res.json({ success: true });
});
app.use((error: { code?: string; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  const inputError = ["entity.parse.failed", "entity.too.large", "request.aborted", "encoding.unsupported", "charset.unsupported"].includes(error.type ?? "") || error.code === "P2000";
  if (inputError) return res.status(400).json({ error: "Invalid request body or size limit exceeded", code: "INVALID_INPUT" });
  if (error.code === "P2002") return res.status(409).json({ error: "The request conflicts with existing data", code: "CONFLICT" });
  logError("api_error", error, res.locals.requestId);
  res.status(500).json({ error: "The request could not be completed", code: "INTERNAL_ERROR", requestId: res.locals.requestId });
});

const httpServer = app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Vytor backend running on port ${PORT}`,
    );
  },
);
httpServer.requestTimeout = 30_000;
httpServer.headersTimeout = 10_000;
httpServer.keepAliveTimeout = 5_000;

async function shutdown(signal: string) {
  console.log(JSON.stringify({ event: "shutdown", signal }));
  httpServer.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
