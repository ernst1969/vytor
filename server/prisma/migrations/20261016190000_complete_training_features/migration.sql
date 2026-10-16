BEGIN;
ALTER TABLE "FriendRequest" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "FriendRequest" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Exercise" ADD COLUMN "ownerId" INTEGER, ADD COLUMN "category" TEXT, ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkoutTemplate" ADD COLUMN "configuration" JSONB;
ALTER TABLE "Workout" ADD COLUMN "suspended" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "notes" TEXT NOT NULL DEFAULT '', ADD COLUMN "draft" JSONB, ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
-- Keep older unfinished workouts as resumable drafts, without inventing completion dates.
UPDATE "Workout" SET "suspended" = true
WHERE "endedAt" IS NULL AND "id" NOT IN (
 SELECT DISTINCT ON ("userId") "id" FROM "Workout" WHERE "endedAt" IS NULL
 ORDER BY "userId", "startedAt" DESC, "id" DESC
);
CREATE UNIQUE INDEX "Workout_one_active_per_user" ON "Workout"("userId") WHERE "endedAt" IS NULL AND "suspended" = false;
CREATE TABLE "ExercisePreference" (
 "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "exerciseId" INTEGER NOT NULL REFERENCES "Exercise"("id") ON DELETE CASCADE,
 "notes" TEXT NOT NULL DEFAULT '', "restSeconds" INTEGER,
 "weightUnit" "WeightUnit" NOT NULL DEFAULT 'KG', "distanceUnit" "DistanceUnit" NOT NULL DEFAULT 'KM',
 PRIMARY KEY ("userId", "exerciseId")
);
CREATE TABLE "Feedback" ("id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "message" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);

COMMIT;
