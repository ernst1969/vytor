type DatedWorkout = { id: number; endedAt: string | null };

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Calendar arithmetic preserves local day boundaries across daylight-saving changes.
export function recentWorkoutDays<T extends DatedWorkout>(workouts: T[], now = new Date()) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 + index);
    return { date, workout: undefined as T | undefined };
  });
  const byDay = new Map(days.map((day) => [dayKey(day.date), day]));
  for (const workout of workouts) {
    if (!workout.endedAt) continue;
    const ended = new Date(workout.endedAt);
    if (!Number.isFinite(ended.getTime()) || ended > now) continue;
    const day = byDay.get(dayKey(ended));
    if (!day) continue;
    const previous = day.workout;
    if (!previous || ended.getTime() > new Date(previous.endedAt!).getTime() ||
        (ended.getTime() === new Date(previous.endedAt!).getTime() && workout.id > previous.id)) {
      day.workout = workout;
    }
  }
  return days;
}
