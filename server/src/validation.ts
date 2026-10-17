export function validTemplateConfiguration(value: unknown, ids: number[]) {
  if (value === undefined || value === null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, entry]) => {
    if (!ids.includes(Number(key)) || !entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const item = entry as Record<string, unknown>;
    if (item.targetReps !== undefined && (!Array.isArray(item.targetReps) || item.targetReps.length < 1 || item.targetReps.length > 30 || item.targetReps.some((rep) => !Number.isSafeInteger(rep) || rep < 0 || rep > 999))) return false;
    if (item.setTypes !== undefined && (!Array.isArray(item.setTypes) || !Array.isArray(item.targetReps) || item.setTypes.length !== item.targetReps.length || item.setTypes.some((type) => !["WARMUP", "REGULAR", "DROP"].includes(type)))) return false;
    if (item.restSeconds !== undefined && (typeof item.restSeconds !== "number" || !Number.isInteger(item.restSeconds) || item.restSeconds < 0 || item.restSeconds > 3600)) return false;
    if (item.notes !== undefined && (typeof item.notes !== "string" || item.notes.length > 2000)) return false;
    if (item.weightUnit !== undefined && !["KG", "LBS"].includes(String(item.weightUnit))) return false;
    if (item.distanceUnit !== undefined && !["KM", "MI"].includes(String(item.distanceUnit))) return false;
    return true;
  });
}
