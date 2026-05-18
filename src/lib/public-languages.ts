export const EDSYNC_LANGUAGES = [
  { name: "English", code: "en" },
  { name: "Korean", code: "ko" },
  { name: "Khmer", code: "km" },
  { name: "Chinese", code: "zh" },
  { name: "Japanese", code: "ja" },
  { name: "Spanish", code: "es" },
  { name: "French", code: "fr" },
  { name: "Vietnamese", code: "vi" },
  { name: "Thai", code: "th" },
] as const;

export type PublicLanguageName = (typeof EDSYNC_LANGUAGES)[number]["name"];
export type PublicLanguageCode = (typeof EDSYNC_LANGUAGES)[number]["code"];

export const DEFAULT_PUBLIC_LANGUAGE: PublicLanguageName = "English";

const LANGUAGE_LABELS: Record<PublicLanguageName, string> = {
  English: "Language",
  Korean: "언어",
  Khmer: "ភាសា",
  Chinese: "语言",
  Japanese: "言語",
  Spanish: "Idioma",
  French: "Langue",
  Vietnamese: "Ngôn ngữ",
  Thai: "ภาษา",
};

export function languageCodeFor(name: string) {
  return EDSYNC_LANGUAGES.find((language) => language.name === name)?.code ?? "en";
}

export function normalizePublicLanguage(value?: string | null): PublicLanguageName {
  const byName = EDSYNC_LANGUAGES.find((language) => language.name === value);
  if (byName) return byName.name;

  const byCode = EDSYNC_LANGUAGES.find((language) => language.code === value);
  return byCode?.name ?? DEFAULT_PUBLIC_LANGUAGE;
}

export function languageLabelFor(value?: string | null) {
  return LANGUAGE_LABELS[normalizePublicLanguage(value)];
}
