import { describe, it, expect } from "vitest";
import { uniqueLeafCategories } from "./categoryHints";

const cat = (name: string, userId: string | null, isGroup = false) => ({
  name,
  userId,
  isGroup,
});

// This list is what the parser prompt and the assistant's tool enum are built
// from. Every duplicate in it is a duplicate the model can pick.
describe("uniqueLeafCategories", () => {
  it("drops group rows", () => {
    const out = uniqueLeafCategories(
      [cat("Essentials", "u1", true), cat("Rent", "u1")],
      "u1",
    );
    expect(out.map((c) => c.name)).toEqual(["Rent"]);
  });

  it("collapses the system template against the user's own copy", () => {
    const out = uniqueLeafCategories(
      [cat("Rent", null), cat("Rent", "u1")],
      "u1",
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.userId).toBe("u1");
  });

  it("prefers the user's row regardless of order", () => {
    const out = uniqueLeafCategories(
      [cat("Rent", "u1"), cat("Rent", null)],
      "u1",
    );
    expect(out[0]!.userId).toBe("u1");
  });

  it("collapses near-duplicates that already exist in the DB", () => {
    const out = uniqueLeafCategories(
      [cat("Snacks", "u1"), cat("Snack", "u1")],
      "u1",
    );
    expect(out).toHaveLength(1);
  });

  it("keeps genuinely distinct categories", () => {
    const out = uniqueLeafCategories(
      [cat("Eating Out", "u1"), cat("Groceries", "u1"), cat("Fuel", null)],
      "u1",
    );
    expect(out).toHaveLength(3);
  });
});
