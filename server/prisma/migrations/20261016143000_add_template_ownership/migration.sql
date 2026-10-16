-- Existing seeded templates remain global and read-only. New templates belong to a user.
ALTER TABLE "WorkoutTemplate" ADD COLUMN "userId" INTEGER;

CREATE INDEX "WorkoutTemplate_userId_name_idx" ON "WorkoutTemplate"("userId", "name");

ALTER TABLE "WorkoutTemplate"
ADD CONSTRAINT "WorkoutTemplate_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Repair measurement types in databases that were seeded before the catalog was classified.
UPDATE "Exercise" SET "measurementType" = 'REPS' WHERE "name" IN (
  'Nordic Hamstring Curl', 'Push-Up', 'Pull-Up', 'Chin-Up', 'Triceps Dip',
  'Hanging Leg Raise', 'Captain''s Chair Leg Raise', 'Ab Wheel Rollout',
  'Decline Sit-Up', 'Back Extension', 'Hyperextension'
);

UPDATE "Exercise" SET "measurementType" = 'TIME' WHERE "name" IN (
  'Plank', 'Side Plank', 'Battle Rope', 'Boxing', 'Boxing Sparring',
  'Heavy Bag', 'Shadow Boxing', 'Speed Bag', 'Mitt Work', 'Muay Thai',
  'Muay Thai Sparring', 'Kickboxing', 'Kickboxing Sparring', 'MMA',
  'MMA Sparring', 'Brazilian Jiu-Jitsu', 'Wrestling', 'Judo', 'Karate',
  'Taekwondo', 'Stair Climber', 'Elliptical', 'Jump Rope', 'Assault Bike',
  'VersaClimber'
);

UPDATE "Exercise" SET "measurementType" = 'DISTANCE_TIME' WHERE "name" IN (
  'Sled Push', 'Sled Pull', 'Running', 'Treadmill Running', 'Outdoor Walking',
  'Incline Walking', 'Cycling', 'Stationary Bike', 'Rowing', 'Swimming', 'Ski Erg'
);

UPDATE "Exercise" SET "measurementType" = 'WEIGHT_DISTANCE' WHERE "name" = 'Farmer''s Carry';
