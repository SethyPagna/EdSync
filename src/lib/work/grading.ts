export type WorkGradingMode = "points" | "weighted" | "completion" | "participation";

export type WorkGradingSettings = {
  mode: WorkGradingMode;
  gradeWeightPercent: number | null;
  countsTowardGrade: boolean;
  participationCriteria: string;
};

const MODES = new Set<WorkGradingMode>(["points", "weighted", "completion", "participation"]);
const DEFAULT_GRADING_SETTINGS: WorkGradingSettings = {
  mode: "points",
  gradeWeightPercent: null,
  countsTowardGrade: true,
  participationCriteria: "",
};

function readRecord(value: unknown) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function normalizeWorkGradingSettings(value: unknown): WorkGradingSettings {
  const record = readRecord(value);
  const rawMode = String(record.gradingMode ?? record.mode ?? DEFAULT_GRADING_SETTINGS.mode);
  const mode = MODES.has(rawMode as WorkGradingMode) ? (rawMode as WorkGradingMode) : DEFAULT_GRADING_SETTINGS.mode;
  const rawWeight = Number(record.gradeWeightPercent ?? record.weightPercent ?? 0);
  const gradeWeightPercent = mode === "weighted" && Number.isFinite(rawWeight) ? Math.min(100, Math.max(0, rawWeight)) : null;
  const countsTowardGrade =
    mode === "completion" || mode === "participation" ? false : record.countsTowardGrade !== false;
  const participationCriteria =
    typeof record.participationCriteria === "string" ? record.participationCriteria.slice(0, 500) : "";

  return { mode, gradeWeightPercent, countsTowardGrade, participationCriteria };
}

export function serializeWorkGradingSettings(value: unknown) {
  return JSON.stringify(normalizeWorkGradingSettings(value));
}

export function workGradeContribution(input: {
  pointsEarned: number | null | undefined;
  pointsPossible: number | null | undefined;
  settings: WorkGradingSettings;
}) {
  if (input.settings.mode !== "weighted" || input.settings.gradeWeightPercent === null) return null;
  const earned = Number(input.pointsEarned ?? 0);
  const possible = Number(input.pointsPossible ?? 0);
  if (!Number.isFinite(earned) || !Number.isFinite(possible) || possible <= 0) return null;
  const value = (earned / possible) * input.settings.gradeWeightPercent;
  return Math.round(value * 100) / 100;
}

export function workGradingLabel(settings: WorkGradingSettings, pointsPossible: number) {
  if (settings.mode === "completion") return "Completion only";
  if (settings.mode === "participation") return "Participation";
  if (settings.mode === "weighted" && settings.gradeWeightPercent !== null) {
    return `${pointsPossible} pts -> ${settings.gradeWeightPercent}% of course`;
  }
  return `${pointsPossible} pts`;
}
