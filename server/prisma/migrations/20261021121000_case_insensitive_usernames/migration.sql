DO $$
BEGIN
  IF EXISTS (
    SELECT lower("username")
    FROM "User"
    GROUP BY lower("username")
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Case-insensitive username collisions must be resolved before this migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "User_username_ci_key" ON "User" (lower("username"));
