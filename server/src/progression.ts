export function levelForXp(xp: number) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

export function progressForXp(xp: number) {
  const level = levelForXp(xp);
  return {
    xp,
    level,
    levelStartXp: (level - 1) ** 2 * 100,
    nextLevelXp: level ** 2 * 100,
  };
}

export function workoutXp(completedSetCount: number) {
  return 100 + Math.max(0, completedSetCount) * 10;
}
