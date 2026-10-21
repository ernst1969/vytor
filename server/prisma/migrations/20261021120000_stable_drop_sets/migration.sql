ALTER TABLE "WorkoutSet" ADD COLUMN "dropSetOfId" INTEGER;

-- Preserve the only relationship representable by historical rows: a DROP set belongs
-- to the nearest preceding non-DROP set in the same exercise.
UPDATE "WorkoutSet" AS child
SET "dropSetOfId" = (
  SELECT candidate."id"
  FROM "WorkoutSet" AS candidate
  WHERE candidate."workoutExerciseId" = child."workoutExerciseId"
    AND candidate."setNumber" < child."setNumber"
    AND candidate."setType" <> 'DROP'
  ORDER BY candidate."setNumber" DESC
  LIMIT 1
)
WHERE child."setType" = 'DROP';

CREATE INDEX "WorkoutSet_dropSetOfId_idx" ON "WorkoutSet"("dropSetOfId");
ALTER TABLE "WorkoutSet"
ADD CONSTRAINT "WorkoutSet_dropSetOfId_fkey"
FOREIGN KEY ("dropSetOfId") REFERENCES "WorkoutSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
