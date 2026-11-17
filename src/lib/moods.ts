export interface MoodOption {
  label: string;
  /** 1 (heavy) to 5 (light), used only for the trend line. */
  score: number;
  color: string;
}

export const MOODS: readonly MoodOption[] = [
  { label: "Hopeful", score: 5, color: "#7fb8a8" },
  { label: "Grateful", score: 5, color: "#8fc2a0" },
  { label: "Calm", score: 4, color: "#6fb0b8" },
  { label: "Okay", score: 3, color: "#a8a0d8" },
  { label: "Tired", score: 2, color: "#9a9fc0" },
  { label: "Anxious", score: 2, color: "#d5a67e" },
  { label: "Low", score: 1, color: "#c58f9c" },
  { label: "Overwhelmed", score: 1, color: "#d4857f" },
];

export const FOCUS_AREAS: readonly string[] = ["Work", "Relationships", "Health", "Money", "Sleep", "Self-worth", "A decision", "Something else"];

export const moodMeta = (mood: string): MoodOption | undefined => MOODS.find((m) => m.label.toLowerCase() === mood.trim().toLowerCase());

export interface CheckinSummary {
  topMood: string | null;
  topFocus: string | null;
  scores: number[];
}

/** Summarise the most recent check-ins (newest first) from real data. */
export function summarizeCheckins(items: readonly { mood: string; focus_area: string }[], window = 14): CheckinSummary {
  const recent = items.slice(0, window);
  const top = (values: string[]): string | null => {
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    let best: string | null = null;
    let bestCount = 0;
    for (const [value, count] of counts) {
      if (count > bestCount) {
        best = value;
        bestCount = count;
      }
    }
    return best;
  };
  const scores = recent
    .map((c) => moodMeta(c.mood)?.score)
    .filter((s): s is number => typeof s === "number")
    .reverse();
  return { topMood: top(recent.map((c) => c.mood)), topFocus: top(recent.map((c) => c.focus_area)), scores };
}
