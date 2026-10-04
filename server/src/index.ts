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

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Vytor backend is running",
  });
});

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Vytor backend running on port ${PORT}`);
});