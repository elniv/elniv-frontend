export interface ParsedActivity {
  type: "breathing" | "ripples" | "journal";
  label: string;
  icon: string;
}

export const ACTIVITY_MAP: Record<string, { label: string; icon: string }> = {
  breathing: {
    label: "Try Gentle Breathing",
    icon: "🌬️",
  },
  ripples: {
    label: "Try Zen Water Ripples",
    icon: "🌊",
  },
  journal: {
    label: "Try Mindful Journal",
    icon: "📖",
  },
};

export function parseMessageActivities(content: string): { cleanContent: string; activities: ParsedActivity[] } {
  const activities: ParsedActivity[] = [];
  const regex = /\[ACTIVITY:\s*(breathing|ripples|journal)\s*\]/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const rawType = match[1];
    if (!rawType) continue;
    const type = rawType.trim().toLowerCase() as "breathing" | "ripples" | "journal";
    const def = ACTIVITY_MAP[type];
    if (def && !activities.some((a) => a.type === type)) {
      activities.push({
        type,
        label: def.label,
        icon: def.icon,
      });
    }
  }

  const cleanContent = content.replace(/\[ACTIVITY:\s*[^\]]+\]/gi, "").trim();

  return { cleanContent, activities };
}
