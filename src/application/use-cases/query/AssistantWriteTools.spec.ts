import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssistantWriteTools } from "./AssistantWriteTools";

describe("AssistantWriteTools", () => {
  let pendingActionRepository: any;
  let expenseRepository: any;
  let categoryRepository: any;
  let boxRepository: any;
  let writes: AssistantWriteTools;

  beforeEach(() => {
    vi.clearAllMocks();
    pendingActionRepository = {
      create: vi.fn().mockResolvedValue({ id: "p1" }),
    };
    expenseRepository = {
      findById: vi.fn().mockResolvedValue({
        id: "e1",
        userId: "u1",
        amount: 220,
        note: "chai",
        isDeleted: false,
      }),
    };
    categoryRepository = {
      findByNameForUser: vi.fn().mockResolvedValue(null),
      findAllForUser: vi
        .fn()
        .mockResolvedValue([{ name: "Food", bucket: "WANTS", isGroup: false }]),
    };
    boxRepository = {
      findByNameForUser: vi
        .fn()
        .mockResolvedValue({ id: "b1", name: "Goa trip" }),
      listWithBalances: vi.fn().mockResolvedValue([{ name: "Goa trip" }]),
    };

    writes = new AssistantWriteTools(
      pendingActionRepository,
      expenseRepository,
      categoryRepository,
      boxRepository,
    );
  });

  it("never mutates — it only stages a proposal", async () => {
    const res = await writes.proposeBoxMove("u1", {
      box: "Goa trip",
      amount: 5000,
      direction: "IN",
    });

    expect(res).toMatchObject({ ok: true, pendingId: "p1" });
    expect(pendingActionRepository.create).toHaveBeenCalledTimes(1);
    // No ledger repository has a write method called here at all.
    expect(boxRepository).not.toHaveProperty("addEntry.mock.calls.0");
  });

  it("stages a proposal with an expiry", async () => {
    await writes.proposeBoxMove("u1", {
      box: "Goa trip",
      amount: 5000,
      direction: "IN",
    });
    expect(pendingActionRepository.create.mock.calls[0]![0].ttlMinutes).toBe(
      30,
    );
  });

  describe("references are resolved against real rows", () => {
    it("rejects an unknown box and hands back the real names", async () => {
      boxRepository.findByNameForUser.mockResolvedValue(null);
      const res = await writes.proposeBoxMove("u1", {
        box: "Bali trip",
        amount: 5000,
        direction: "IN",
      });

      expect(res).toMatchObject({
        ok: false,
        error: "unknown_box",
        available_boxes: ["Goa trip"],
      });
      expect(pendingActionRepository.create).not.toHaveBeenCalled();
    });

    it("stores the box's canonical name, not the model's spelling", async () => {
      boxRepository.findByNameForUser.mockResolvedValue({
        id: "b1",
        name: "Goa trip",
      });
      await writes.proposeBoxMove("u1", {
        box: "goa TRIP",
        amount: 100,
        direction: "IN",
      });
      expect(
        pendingActionRepository.create.mock.calls[0]![0].payload.boxName,
      ).toBe("Goa trip");
    });

    it("rejects another user's expense", async () => {
      expenseRepository.findById.mockResolvedValue({
        id: "e1",
        userId: "someone-else",
        amount: 220,
        isDeleted: false,
      });
      const res = await writes.proposeDeleteExpense("u1", { expenseId: "e1" });

      expect(res).toMatchObject({ ok: false, error: "expense_not_found" });
      expect(pendingActionRepository.create).not.toHaveBeenCalled();
    });

    it("rejects an unknown category and lists the valid ones", async () => {
      const res = await writes.proposeRecurring("u1", {
        kind: "EXPENSE",
        amount: 8000,
        dayOfMonth: 1,
        category: "Groceries",
      });

      expect(res).toMatchObject({
        ok: false,
        error: "unknown_category",
        available_categories: ["Food"],
      });
    });

    it("takes the bucket from the named category, not the model", async () => {
      categoryRepository.findByNameForUser.mockResolvedValue({
        id: "c1",
        name: "Rent",
        bucket: "NEEDS",
      });
      await writes.proposeRecurring("u1", {
        kind: "EXPENSE",
        amount: 8000,
        dayOfMonth: 1,
        bucket: "SAVINGS", // wrong guess
        category: "Rent",
      });

      expect(
        pendingActionRepository.create.mock.calls[0]![0].payload.bucket,
      ).toBe("NEEDS");
    });

    // Income has its own taxonomy. This used to resolve every rule against the
    // expense categories, so an income rule inherited a spending category and
    // its bucket.
    it("stages an income rule against the income taxonomy, with no bucket", async () => {
      await writes.proposeRecurring("u1", {
        kind: "INCOME",
        amount: 45000,
        dayOfMonth: 1,
        bucket: "NEEDS", // meaningless for income
        category: "Salary",
      });

      expect(categoryRepository.findByNameForUser).not.toHaveBeenCalled();
      const payload = pendingActionRepository.create.mock.calls[0]![0].payload;
      expect(payload.incomeCategoryName).toBe("Salary");
      expect(payload.categoryName).toBeUndefined();
      expect(payload.bucket).toBeUndefined();
    });

    it("rejects an unknown income category with the income names", async () => {
      const res = await writes.proposeRecurring("u1", {
        kind: "INCOME",
        amount: 45000,
        dayOfMonth: 1,
        category: "Food", // a real EXPENSE category, wrong taxonomy
      });

      expect(res).toMatchObject({
        ok: false,
        error: "unknown_income_category",
      });
      expect((res as any).available_categories).toContain("Salary");
      expect((res as any).available_categories).toContain("Refund");
      expect(pendingActionRepository.create).not.toHaveBeenCalled();
    });

    it("matches an income category case-insensitively", async () => {
      await writes.proposeRecurring("u1", {
        kind: "INCOME",
        amount: 45000,
        dayOfMonth: 1,
        category: "salary",
      });

      expect(
        pendingActionRepository.create.mock.calls[0]![0].payload
          .incomeCategoryName,
      ).toBe("Salary");
    });
  });

  describe("payload validation happens before staging", () => {
    it("rejects a day of month outside 1-28", async () => {
      const res = await writes.proposeRecurring("u1", {
        kind: "EXPENSE",
        amount: 8000,
        dayOfMonth: 31,
      });
      expect(res).toMatchObject({ ok: false, error: "invalid_proposal" });
      expect(pendingActionRepository.create).not.toHaveBeenCalled();
    });

    it("rejects an absurd amount", async () => {
      const res = await writes.proposeBoxMove("u1", {
        box: "Goa trip",
        amount: 9_999_999_999,
        direction: "IN",
      });
      expect(res).toMatchObject({ ok: false, error: "invalid_proposal" });
    });
  });

  it("rejects an edit that changes nothing", async () => {
    const res = await writes.proposeExpenseEdit("u1", { expenseId: "e1" });
    expect(res).toMatchObject({ ok: false, error: "no_changes" });
  });

  it("summarises an edit as a before → after the user can check", async () => {
    const res = await writes.proposeExpenseEdit("u1", {
      expenseId: "e1",
      amount: 50,
    });
    expect(res).toMatchObject({ ok: true });
    expect((res as any).summary).toContain("₹220");
    expect((res as any).summary).toContain("₹50");
  });
});
