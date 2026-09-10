import { describe, it, expect, vi, beforeEach } from "vitest";
import { PendingActionProcessor } from "./PendingActionProcessor";

const user: any = { id: "u1", payday: 1, timezone: "Asia/Kolkata" };

function ctx(textMessage: string): any {
  return { user, platformUserId: "123", textMessage };
}

function pending(overrides: object = {}): any {
  return {
    id: "p1",
    userId: "u1",
    kind: "BOX_MOVE",
    payload: { boxName: "Goa trip", amount: 5000, direction: "IN" },
    summary: "Add ₹5,000 to Goa trip",
    ...overrides,
  };
}

describe("PendingActionProcessor", () => {
  let pendingActionRepository: any;
  let expenseRepository: any;
  let categoryRepository: any;
  let boxRepository: any;
  let recurringRuleRepository: any;
  let messageService: any;
  let incomeCategoryRepository: any;
  let p: PendingActionProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    pendingActionRepository = {
      findLiveForUser: vi.fn().mockResolvedValue(pending()),
      consume: vi.fn().mockResolvedValue(true),
    };
    expenseRepository = {
      findById: vi.fn(),
      softDelete: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    };
    categoryRepository = { findByNameForUser: vi.fn().mockResolvedValue(null) };
    boxRepository = {
      findByNameForUser: vi
        .fn()
        .mockResolvedValue({ id: "b1", name: "Goa trip", targetAmount: null }),
      addEntry: vi.fn().mockResolvedValue({}),
      balanceFor: vi.fn().mockResolvedValue(5000),
      markTargetReached: vi.fn().mockResolvedValue(false),
    };
    recurringRuleRepository = {
      create: vi.fn().mockResolvedValue({ id: "r1" }),
    };
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
    incomeCategoryRepository = {
      findAllForUser: vi.fn().mockResolvedValue([
        { id: "ic-salary", name: "Salary", countsAsEarnings: true },
        { id: "ic-other", name: "Other Income", countsAsEarnings: true },
      ]),
    };

    p = new PendingActionProcessor(
      pendingActionRepository,
      expenseRepository,
      categoryRepository,
      boxRepository,
      recurringRuleRepository,
      messageService,
      incomeCategoryRepository,
    );
  });

  describe("routing", () => {
    it("handles act: callbacks", () => {
      expect(p.canHandle(ctx("act:p1:y"))).toBe(true);
      expect(p.canHandle(ctx("act:p1:n"))).toBe(true);
    });

    it("ignores anything else", () => {
      expect(p.canHandle(ctx("chai 30"))).toBe(false);
      expect(p.canHandle(ctx("txn:askdel:e:x1"))).toBe(false);
      expect(p.canHandle(ctx("act:p1"))).toBe(false);
      expect(p.canHandle(ctx("act:p1:maybe"))).toBe(false);
    });
  });

  it("applies the action on confirm", async () => {
    const out = await p.process(ctx("act:p1:y"));
    expect(boxRepository.addEntry).toHaveBeenCalled();
    expect(out.response).toContain("Goa trip");
  });

  it("changes nothing on cancel", async () => {
    const out = await p.process(ctx("act:p1:n"));
    expect(boxRepository.addEntry).not.toHaveBeenCalled();
    expect(recurringRuleRepository.create).not.toHaveBeenCalled();
    expect(out.response).toBe("Cancelled — nothing changed.");
  });

  describe("authorization and single-use", () => {
    it("refuses another user's pending id", async () => {
      // The repository scopes by userId, so a foreign id resolves to nothing.
      pendingActionRepository.findLiveForUser.mockResolvedValue(null);
      const out = await p.process(ctx("act:someone-elses-id:y"));

      expect(out.response).toContain("expired");
      expect(boxRepository.addEntry).not.toHaveBeenCalled();
      expect(pendingActionRepository.findLiveForUser).toHaveBeenCalledWith(
        "someone-elses-id",
        "u1",
      );
    });

    it("refuses an expired or already-used action", async () => {
      pendingActionRepository.findLiveForUser.mockResolvedValue(null);
      const out = await p.process(ctx("act:p1:y"));
      expect(out.response).toContain("expired");
    });

    it("does not apply twice when the claim is lost to a double tap", async () => {
      pendingActionRepository.consume.mockResolvedValue(false);
      const out = await p.process(ctx("act:p1:y"));

      expect(boxRepository.addEntry).not.toHaveBeenCalled();
      expect(out.response).toContain("expired");
    });

    it("claims the action before writing, not after", async () => {
      const order: string[] = [];
      pendingActionRepository.consume.mockImplementation(async () => {
        order.push("consume");
        return true;
      });
      boxRepository.addEntry.mockImplementation(async () => {
        order.push("write");
        return {};
      });

      await p.process(ctx("act:p1:y"));
      expect(order).toEqual(["consume", "write"]);
    });
  });

  describe("payload validation", () => {
    it("rejects a payload that no longer matches its schema", async () => {
      pendingActionRepository.findLiveForUser.mockResolvedValue(
        pending({
          payload: { boxName: "Goa trip", amount: -5, direction: "IN" },
        }),
      );
      const out = await p.process(ctx("act:p1:y"));

      expect(out.response).toContain("expired");
      expect(boxRepository.addEntry).not.toHaveBeenCalled();
    });

    it("rejects an unknown action kind", async () => {
      pendingActionRepository.findLiveForUser.mockResolvedValue(
        pending({ kind: "DROP_DATABASE", payload: {} }),
      );
      const out = await p.process(ctx("act:p1:y"));
      expect(out.response).toContain("expired");
    });
  });

  describe("apply-time re-checks", () => {
    it("re-verifies expense ownership at apply time, not just at proposal", async () => {
      pendingActionRepository.findLiveForUser.mockResolvedValue(
        pending({ kind: "DELETE_EXPENSE", payload: { expenseId: "e1" } }),
      );
      // Proposal was made 30 minutes ago; the row now belongs to someone else.
      expenseRepository.findById.mockResolvedValue({
        id: "e1",
        userId: "someone-else",
        amount: 220,
        isDeleted: false,
      });

      const out = await p.process(ctx("act:p1:y"));
      expect(expenseRepository.softDelete).not.toHaveBeenCalled();
      expect(out.response).toContain("expired");
    });

    it("will not delete an already-deleted expense", async () => {
      pendingActionRepository.findLiveForUser.mockResolvedValue(
        pending({ kind: "DELETE_EXPENSE", payload: { expenseId: "e1" } }),
      );
      expenseRepository.findById.mockResolvedValue({
        id: "e1",
        userId: "u1",
        amount: 220,
        isDeleted: true,
      });

      const out = await p.process(ctx("act:p1:y"));
      expect(expenseRepository.softDelete).not.toHaveBeenCalled();
      expect(out.response).toContain("expired");
    });

    it("deletes a valid expense", async () => {
      pendingActionRepository.findLiveForUser.mockResolvedValue(
        pending({ kind: "DELETE_EXPENSE", payload: { expenseId: "e1" } }),
      );
      expenseRepository.findById.mockResolvedValue({
        id: "e1",
        userId: "u1",
        amount: 220,
        note: "chai",
        isDeleted: false,
      });

      const out = await p.process(ctx("act:p1:y"));
      expect(expenseRepository.softDelete).toHaveBeenCalledWith("e1");
      expect(out.response).toContain("₹220");
    });
  });

  describe("recurring", () => {
    it("lets a named category's bucket override the model's guess", async () => {
      pendingActionRepository.findLiveForUser.mockResolvedValue(
        pending({
          kind: "SET_RECURRING",
          payload: {
            kind: "EXPENSE",
            amount: 8000,
            dayOfMonth: 1,
            bucket: "WANTS", // model guessed wrong
            categoryName: "Rent",
            note: "rent",
          },
        }),
      );
      categoryRepository.findByNameForUser.mockResolvedValue({
        id: "c1",
        name: "Rent",
        bucket: "NEEDS",
      });

      await p.process(ctx("act:p1:y"));
      expect(recurringRuleRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ bucket: "NEEDS", categoryId: "c1" }),
      );
    });

    // The bug: this resolved every rule against the EXPENSE taxonomy whatever
    // the kind, so an income rule for a user who happened to have a spending
    // category called "Freelance" got that category AND its bucket attached.
    it("never resolves an income rule against the expense categories", async () => {
      pendingActionRepository.findLiveForUser.mockResolvedValue(
        pending({
          kind: "SET_RECURRING",
          payload: {
            kind: "INCOME",
            amount: 45000,
            dayOfMonth: 1,
            incomeCategoryName: "Salary",
            note: "salary",
          },
        }),
      );
      // A same-named expense category exists; it must not be consulted.
      categoryRepository.findByNameForUser.mockResolvedValue({
        id: "c-freelance",
        name: "Salary",
        bucket: "WANTS",
      });

      await p.process(ctx("act:p1:y"));

      expect(categoryRepository.findByNameForUser).not.toHaveBeenCalled();
      const created = recurringRuleRepository.create.mock.calls[0]![0];
      expect(created.incomeCategoryId).toBe("ic-salary");
      expect(created.categoryId).toBeUndefined();
      expect(created.bucket).toBeUndefined();
    });

    it("falls back to Other Income when the assistant names nothing", async () => {
      pendingActionRepository.findLiveForUser.mockResolvedValue(
        pending({
          kind: "SET_RECURRING",
          payload: { kind: "INCOME", amount: 45000, dayOfMonth: 1 },
        }),
      );

      await p.process(ctx("act:p1:y"));
      expect(
        recurringRuleRepository.create.mock.calls[0]![0].incomeCategoryId,
      ).toBe("ic-other");
    });
  });

  it("reports a failed write without claiming success", async () => {
    boxRepository.addEntry.mockRejectedValue(new Error("db down"));
    const out = await p.process(ctx("act:p1:y"));
    expect(out.response).toContain("nothing was changed");
  });
});
