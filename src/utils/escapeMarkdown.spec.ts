import { describe, it, expect } from "vitest";
import { escapeMarkdown } from "./escapeMarkdown";

describe("escapeMarkdown", () => {
  it("escapes all MarkdownV2 special characters", () => {
    const chars = "_*[]()~`>#+-.=|{}.!\\";
    const result = escapeMarkdown(chars);
    for (const ch of chars) {
      expect(result).toContain("\\" + ch);
    }
  });

  it("leaves plain text unchanged", () => {
    expect(escapeMarkdown("Hello world 123")).toBe("Hello world 123");
  });

  it("escapes underscore in contact names (prevents broken bold)", () => {
    expect(escapeMarkdown("Mr_Smith")).toBe("Mr\\_Smith");
  });

  it("escapes asterisk", () => {
    expect(escapeMarkdown("*bold*")).toBe("\\*bold\\*");
  });

  it("escapes parentheses used in inline links", () => {
    expect(escapeMarkdown("(link)")).toBe("\\(link\\)");
  });

  it("escapes dot and exclamation", () => {
    expect(escapeMarkdown("Hello! 1.0")).toBe("Hello\\! 1\\.0");
  });

  it("escapes backslash itself", () => {
    expect(escapeMarkdown("a\\b")).toBe("a\\\\b");
  });

  it("handles empty string", () => {
    expect(escapeMarkdown("")).toBe("");
  });
});
