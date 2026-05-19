import { describe, expect, it } from "vitest";
import {
  EDSYNC_LANGUAGES,
  languageCodeFor,
  languageLabelFor,
  normalizePublicLanguage,
  publicLanguageHref,
} from "./languages";

describe("public languages", () => {
  it("normalizes configured language names and codes", () => {
    for (const language of EDSYNC_LANGUAGES) {
      expect(normalizePublicLanguage(language.name)).toBe(language.name);
      expect(normalizePublicLanguage(language.code)).toBe(language.name);
      expect(languageCodeFor(language.name)).toBe(language.code);
    }
    expect(normalizePublicLanguage("unknown")).toBe("English");
  });

  it("keeps language labels readable", () => {
    expect(languageLabelFor("English")).toBe("Language");
    expect(languageLabelFor("Korean")).toBe("언어");
    expect(languageLabelFor("Khmer")).toBe("ភាសា");
    expect(languageLabelFor("Vietnamese")).toBe("Ngôn ngữ");
    expect(languageLabelFor("Thai")).toBe("ภาษา");
  });

  it("preserves existing query params while adding language", () => {
    expect(publicLanguageHref("/catalog?q=algebra", "Spanish", { price: "free" })).toBe(
      "/catalog?q=algebra&price=free&language=Spanish",
    );
    expect(publicLanguageHref("/catalog?q=algebra", "English", { price: "free" })).toBe("/catalog?q=algebra&price=free");
  });
});
