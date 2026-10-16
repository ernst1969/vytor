export function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map((value) => String(value).padStart(2, "0")).join(":");
}
// Right-aligned digit entry: 123 -> 00:01:23. Reject invalid clock segments.
export function parseTime(value: string): number | null {
  const raw = value.replace(/:/g, "");
  if (!/^\d+$/.test(raw)) return null;
  const digits = raw.replace(/^0+(?=\d)/, "");
  if (!/^\d{1,6}$/.test(digits)) return null;
  const padded = digits.padStart(6, "0");
  const [hours, minutes, seconds] = [Number(padded.slice(0, 2)), Number(padded.slice(2, 4)), Number(padded.slice(4))];
  return minutes < 60 && seconds < 60 ? hours * 3600 + minutes * 60 + seconds : null;
}
