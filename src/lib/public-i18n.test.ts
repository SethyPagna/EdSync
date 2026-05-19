import { describe, expect, it } from "vitest";
import { getPublicAuthCopy } from "./public/auth-copy";
import { languageCodeFor, normalizePublicLanguage, publicCopy } from "./public/i18n";
import { publicLanguageQuerySuffix } from "./public/languages";

describe("public i18n", () => {
  it("normalizes language names and codes", () => {
    expect(normalizePublicLanguage("Spanish")).toBe("Spanish");
    expect(normalizePublicLanguage("es")).toBe("Spanish");
    expect(normalizePublicLanguage("unknown")).toBe("English");
  });

  it("maps language names to html codes", () => {
    expect(languageCodeFor("Khmer")).toBe("km");
    expect(languageCodeFor("English")).toBe("en");
  });

  it("provides readable translated public hero copy", () => {
    expect(publicCopy.Spanish.heroTitle).toContain("Enseña");
    expect(publicCopy.Korean.signIn).toBe("로그인");
  });

  it("provides readable auth copy with fallbacks", () => {
    expect(getPublicAuthCopy("Spanish").wrongCredentials).toContain("incorrectos");
    expect(getPublicAuthCopy("Korean").welcomeBack).toContain("다시");
    expect(getPublicAuthCopy("French").wrongCredentials).toBe("Wrong email or password.");
  });

  it("omits default English from public URL query suffixes", () => {
    expect(publicLanguageQuerySuffix("English")).toBe("");
    expect(publicLanguageQuerySuffix("en")).toBe("");
    expect(publicLanguageQuerySuffix("Spanish")).toBe("?language=Spanish");
    expect(publicLanguageQuerySuffix("zh")).toBe("?language=Chinese");
  });
});
