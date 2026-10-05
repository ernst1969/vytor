/*
  Warnings:

  - The values [MILES] on the enum `DistanceUnit` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `measurement` on the `Exercise` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ExerciseMeasurementType" AS ENUM ('WEIGHT_REPS', 'REPS', 'DISTANCE_TIME', 'TIME', 'WEIGHT_DISTANCE');

-- AlterEnum
BEGIN;
CREATE TYPE "DistanceUnit_new" AS ENUM ('KM', 'MI');
ALTER TABLE "public"."WorkoutExercise" ALTER COLUMN "distanceUnit" DROP DEFAULT;
ALTER TABLE "WorkoutExercise" ALTER COLUMN "distanceUnit" TYPE "DistanceUnit_new" USING ("distanceUnit"::text::"DistanceUnit_new");
ALTER TYPE "DistanceUnit" RENAME TO "DistanceUnit_old";
ALTER TYPE "DistanceUnit_new" RENAME TO "DistanceUnit";
DROP TYPE "public"."DistanceUnit_old";
ALTER TABLE "WorkoutExercise" ALTER COLUMN "distanceUnit" SET DEFAULT 'KM';
COMMIT;

-- AlterTable
ALTER TABLE "Exercise" DROP COLUMN "measurement",
ADD COLUMN     "measurementType" "ExerciseMeasurementType" NOT NULL DEFAULT 'WEIGHT_REPS';

-- DropEnum
DROP TYPE "ExerciseMeasurement";
