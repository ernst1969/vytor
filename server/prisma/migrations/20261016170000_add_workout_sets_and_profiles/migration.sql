CREATE TYPE "WorkoutSetType" AS ENUM ('WARMUP', 'REGULAR', 'DROP');

ALTER TABLE "User"
ADD COLUMN "displayName" TEXT,
ADD COLUMN "avatarData" TEXT;

ALTER TABLE "WorkoutExercise" ADD COLUMN "restSeconds" INTEGER;

ALTER TABLE "WorkoutSet"
ADD COLUMN "setType" "WorkoutSetType" NOT NULL DEFAULT 'REGULAR';
