import { describe, expect, it } from "vitest";
import { languageCodeFor, normalizePublicLanguage, publicCopy } from "./public-i18n";

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

  it("provides translated public hero copy", () => {
    expect(publicCopy.Spanish.heroTitle).toContain("Aprende");
    expect(publicCopy.Korean.signIn).toBeTruthy();
  });
});
