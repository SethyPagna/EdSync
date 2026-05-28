import { GRADE_LEVELS, SUBJECT_AREAS } from "@/lib/grades";

export const PROFILE_TEXT_MAX_LENGTH = 160;
export const PROFILE_LIST_MAX_ITEMS = 24;

export const INTEREST_AREAS = [
  "Space & Astronomy",
  "Sports",
  "Music",
  "Gaming",
  "Art & Design",
  "Technology",
  "Nature & Environment",
  "Cooking & Food",
  "Travel",
  "Movies & TV",
  "History",
  "Health & Fitness",
  "Animals",
  "Fashion",
  "Business",
] as const;

const GRADE_LEVEL_SET = new Set<string>(GRADE_LEVELS);
const SUBJECT_AREA_SET = new Set<string>(SUBJECT_AREAS);
const INTEREST_AREA_SET = new Set<string>(INTEREST_AREAS);

export function validateOptionalProfileLine(
  value: unknown,
  label: string,
): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (text.length > PROFILE_TEXT_MAX_LENGTH) {
    throw new Error(`${label} must be ${PROFILE_TEXT_MAX_LENGTH} characters or fewer.`);
  }
  if (/[\r\n]/.test(text)) {
    throw new Error(`${label} must be a single line.`);
  }
  return text;
}

export function validateGradeLevel(value: unknown): string | null {
  const gradeLevel = validateOptionalProfileLine(value, "Grade level");
  if (!gradeLevel) return null;
  if (!GRADE_LEVEL_SET.has(gradeLevel)) {
    throw new Error("Choose a supported grade level.");
  }
  return gradeLevel;
}

function validateOptionList(
  values: unknown,
  allowedValues: Set<string>,
  label: string,
): string[] {
  if (!Array.isArray(values)) return [];
  if (values.length > PROFILE_LIST_MAX_ITEMS) {
    throw new Error(`${label} can include at most ${PROFILE_LIST_MAX_ITEMS} items.`);
  }

  const uniqueValues = new Set<string>();
  values.forEach((value) => {
    if (typeof value !== "string") {
      throw new Error(`${label} contains an unsupported item.`);
    }
    if (!allowedValues.has(value)) {
      throw new Error(`${label} contains an unsupported item.`);
    }
    uniqueValues.add(value);
  });

  return Array.from(uniqueValues);
}

export function validateSubjectAreas(values: unknown): string[] {
  return validateOptionList(values, SUBJECT_AREA_SET, "Subjects");
}

export function validateInterestAreas(values: unknown): string[] {
  return validateOptionList(values, INTEREST_AREA_SET, "Interests");
}
