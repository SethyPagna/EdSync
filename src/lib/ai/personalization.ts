import { d1Query } from "@/lib/db/d1";

type ProfileRow = {
  id: string;
  role: "teacher" | "student";
  full_name: string | null;
  grade_level: string | null;
  subjects: string | null;
  interests: string | null;
  preferences: string | null;
  total_xp?: number | null;
  streak_days?: number | null;
};

export type GenerationStyle = {
  depth?: "quick" | "standard" | "zero_to_expert";
  languageStyle?: "student_friendly" | "professional" | "speaking" | "simple";
  versionCount?: number;
  audienceLanguage?: string;
};

function parseList(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string").slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

function parsePreferences(value: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function loadAiUserContext(userId: string) {
  const [profile] = await d1Query<ProfileRow>(
    `SELECT id, role, full_name, grade_level, subjects, interests, preferences, total_xp, streak_days
       FROM profiles
      WHERE id = ?
      LIMIT 1`,
    [userId],
  );

  if (!profile) {
    return {
      profile: null,
      prompt: "User profile: not available. Keep output broadly useful and ask for missing context only when necessary.",
    };
  }

  const subjects = parseList(profile.subjects);
  const interests = parseList(profile.interests);
  const preferences = parsePreferences(profile.preferences);
  const textSize = typeof preferences.text_size === "string" ? preferences.text_size : "medium";

  const prompt = [
    "EdSync user profile:",
    `- Role: ${profile.role}`,
    `- Name: ${profile.full_name || "not provided"}`,
    `- Grade level: ${profile.grade_level || "not provided"}`,
    `- Subjects: ${subjects.length ? subjects.join(", ") : "not provided"}`,
    `- Interests: ${interests.length ? interests.join(", ") : "not provided"}`,
    `- Preferred text size/detail: ${textSize}`,
    profile.role === "student"
      ? `- Student progress signal: ${profile.total_xp ?? 0} XP, ${profile.streak_days ?? 0} day streak`
      : "- Teacher goal: produce classroom-ready, editable materials.",
  ].join("\n");

  return { profile: { ...profile, subjects, interests, preferences }, prompt };
}

export function buildGenerationStylePrompt(style: GenerationStyle = {}) {
  const depth = style.depth ?? "standard";
  const languageStyle = style.languageStyle ?? "student_friendly";
  const versionCount = Math.min(3, Math.max(1, Number(style.versionCount || 1)));
  const audienceLanguage = style.audienceLanguage?.trim() || "English";

  const depthLine =
    depth === "zero_to_expert"
      ? "Depth: build from zero assumptions to expert transfer, with clear beginner entry points and advanced extension tasks."
      : depth === "quick"
        ? "Depth: concise, classroom-ready, and focused on the minimum useful explanation."
        : "Depth: balanced and grade-appropriate, with enough explanation for independent study.";

  const styleLine =
    languageStyle === "professional"
      ? "Language style: polished professional classroom language, precise but still readable."
      : languageStyle === "speaking"
        ? "Language style: natural spoken teacher script, easy to read aloud."
        : languageStyle === "simple"
          ? "Language style: plain language, short sentences, define terms before using them."
          : "Language style: warm student-friendly teaching language.";

  return [
    depthLine,
    styleLine,
    `Primary response language: ${audienceLanguage}.`,
    `Versioning: generate ${versionCount} distinct version${versionCount > 1 ? "s" : ""}; if the endpoint only accepts one lesson object, make the main object the strongest version and add version labels in tags/objectives where useful.`,
  ].join("\n");
}
