import { describe, expect, it } from "vitest";
import { DELETE_PHRASE, isDeleteConfirmed } from "./delete-confirm";

describe("isDeleteConfirmed", () => {
  it("accepts the account email, ignoring case and surrounding spaces", () => {
    expect(isDeleteConfirmed("  Sadik@Example.com ", "sadik@example.com")).toBe(
      true,
    );
  });

  it("accepts the phrase, ignoring case and extra spaces", () => {
    expect(DELETE_PHRASE).toBe("delete my all data");
    expect(isDeleteConfirmed("Delete  my all   DATA", "a@b.c")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isDeleteConfirmed("", "a@b.c")).toBe(false);
    expect(isDeleteConfirmed("delete", "a@b.c")).toBe(false);
    expect(isDeleteConfirmed("someone@else.com", "a@b.c")).toBe(false);
  });

  it("never matches an empty email when the account has none", () => {
    expect(isDeleteConfirmed("", null)).toBe(false);
    expect(isDeleteConfirmed("delete my all data", null)).toBe(true);
  });
});
