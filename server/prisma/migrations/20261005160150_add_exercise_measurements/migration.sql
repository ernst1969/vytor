-- CreateEnum
CREATE TYPE "ExerciseMeasurement" AS ENUM ('WEIGHT_REPS', 'BODYWEIGHT_REPS', 'REPS', 'DISTANCE', 'DURATION', 'DISTANCE_DURATION', 'WEIGHT_DISTANCE');

-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('KG', 'LBS');

-- CreateEnum
CREATE TYPE "DistanceUnit" AS ENUM ('KM', 'MILES');

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "measurement" "ExerciseMeasurement" NOT NULL DEFAULT 'WEIGHT_REPS';

-- AlterTable
ALTER TABLE "WorkoutExercise" ADD COLUMN     "distanceUnit" "DistanceUnit" NOT NULL DEFAULT 'KM',
ADD COLUMN     "weightUnit" "WeightUnit" NOT NULL DEFAULT 'KG';

-- AlterTable
ALTER TABLE "WorkoutSet" ADD COLUMN     "distance" DOUBLE PRECISION,
ADD COLUMN     "durationSeconds" INTEGER;
