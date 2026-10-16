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

export function rankTier(xp: number) {
  const thresholds = [{ name: "Bronze", xp: 0 }, { name: "Silver", xp: 1000 }, { name: "Gold", xp: 5000 }, { name: "Platinum", xp: 15000 }, { name: "Diamond", xp: 40000 }];
  const index = thresholds.findLastIndex((tier) => xp >= tier.xp);
  return { tier: thresholds[Math.max(0, index)]!.name, nextTierXp: thresholds[index + 1]?.xp ?? null };
}
