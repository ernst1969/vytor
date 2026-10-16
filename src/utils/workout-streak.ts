type CompletedWorkout = { endedAt: string | null };

// Use UTC only to number local calendar dates; elapsed hours would fail across DST.
export function localCalendarDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

export function workoutStreak(workouts: readonly CompletedWorkout[], now = new Date()): number {
  const days = [...new Set(workouts.flatMap((workout) => {
    if (!workout.endedAt) return [];
    const ended = new Date(workout.endedAt);
    return Number.isFinite(ended.getTime()) && ended <= now ? [localCalendarDay(ended)] : [];
  }))].sort((a, b) => a - b);
  if (!days.length || localCalendarDay(now) - days[days.length - 1] > 3) return 0;
  let streak = 1;
  for (let index = 1; index < days.length; index++) {
    streak = days[index] - days[index - 1] <= 3 ? streak + 1 : 1;
  }
  return streak;
}
