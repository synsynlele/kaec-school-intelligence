/** Suggested pacing, not a claim about classroom time actually spent. */
const WEIGHTS = [5, 10, 3, 20, 27, 17, 8] as const;
export function hqlsStageTimings(durationMinutes: number | null | undefined) {
  if (!durationMinutes || !Number.isFinite(durationMinutes) || durationMinutes < 7) return null;
  const total = Math.round(durationMinutes);
  const remaining = total - 7;
  const raw = WEIGHTS.map((weight) => remaining * weight / 90);
  const minutes = raw.map((value) => 1 + Math.floor(value));
  const order = raw.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const remainder = total - minutes.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < remainder; i++) minutes[order[i].index]++;
  let elapsed = 0;
  return minutes.map((value, index) => {
    const startMinute = elapsed;
    elapsed += value;
    return { stageNumber: index + 1, minutes: value, startMinute, endMinute: elapsed };
  });
}
export function hqlsTimingLabel(durationMinutes: number | null | undefined, stageNumber: number) {
  const timing = hqlsStageTimings(durationMinutes)?.[stageNumber - 1];
  return timing ? `Suggested: ${timing.minutes} min · ${timing.startMinute}–${timing.endMinute} min` : "Timing not specified";
}
