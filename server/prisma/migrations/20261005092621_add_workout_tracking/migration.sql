-- AlterTable
ALTER TABLE "Workout" ADD COLUMN     "templateId" INTEGER,
ALTER COLUMN "startedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Exercise" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplateExercise" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "exerciseId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "WorkoutTemplateExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExercise" (
    "id" SERIAL NOT NULL,
    "workoutId" INTEGER NOT NULL,
    "exerciseId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "WorkoutExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSet" (
    "id" SERIAL NOT NULL,
    "workoutExerciseId" INTEGER NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "reps" INTEGER,

    CONSTRAINT "WorkoutSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");

-- CreateIndex
CREATE INDEX "WorkoutTemplateExercise_templateId_order_idx" ON "WorkoutTemplateExercise"("templateId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutTemplateExercise_templateId_exerciseId_key" ON "WorkoutTemplateExercise"("templateId", "exerciseId");

-- CreateIndex
CREATE INDEX "WorkoutExercise_workoutId_order_idx" ON "WorkoutExercise"("workoutId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutExercise_workoutId_exerciseId_key" ON "WorkoutExercise"("workoutId", "exerciseId");

-- CreateIndex
CREATE INDEX "WorkoutSet_workoutExerciseId_idx" ON "WorkoutSet"("workoutExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSet_workoutExerciseId_setNumber_key" ON "WorkoutSet"("workoutExerciseId", "setNumber");

-- CreateIndex
CREATE INDEX "Workout_userId_startedAt_idx" ON "Workout"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "WorkoutTemplateExercise" ADD CONSTRAINT "WorkoutTemplateExercise_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplateExercise" ADD CONSTRAINT "WorkoutTemplateExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSet" ADD CONSTRAINT "WorkoutSet_workoutExerciseId_fkey" FOREIGN KEY ("workoutExerciseId") REFERENCES "WorkoutExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
