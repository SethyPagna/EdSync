import { d1Query } from "@/lib/db/d1";

export const SUPPORTED_FEATURE_FLAGS = {
  work_items: {
    label: "Assignments",
    description: "Assignment lists, authoring, submissions, and grading in the Work area.",
  },
  gradebook: {
    label: "Gradebook",
    description: "Manual scores, gradebook views, and weighted class progress. Lesson quiz scoring stays available.",
  },
  student_notes: {
    label: "Learner notes",
    description: "Creator notes and learner-visible notes in the Notes area.",
  },
  ai_provider_fallback: {
    label: "AI provider failover",
    description: "Try another configured AI provider when the selected provider fails.",
  },
  email_outbox: {
    label: "Course messages",
    description: "Allow creators to compose and send course messages from the email tool.",
  },
} as const;

export type SupportedFeatureFlag = keyof typeof SUPPORTED_FEATURE_FLAGS;

export function isSupportedFeatureFlag(value: string): value is SupportedFeatureFlag {
  return Object.prototype.hasOwnProperty.call(SUPPORTED_FEATURE_FLAGS, value);
}

export async function isFeatureEnabled(key: SupportedFeatureFlag): Promise<boolean> {
  try {
    const [flag] = await d1Query<{ enabled: number | boolean }>(
      "SELECT enabled FROM feature_flags WHERE flag_key = ? LIMIT 1",
      [key],
    );
    return flag ? Boolean(flag.enabled) : true;
  } catch {
    return true;
  }
}
