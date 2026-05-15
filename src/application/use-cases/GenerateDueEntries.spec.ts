import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenerateDueEntriesUseCase } from "./GenerateDueEntries";

const makeCharge = (overrides: Record<string, unknown> = {}) => ({
  id: "charge-1",
  userId: "user-1",
  contactId: null,
  walletId: null,
  amount: 1000,
  period: "MONTHLY",
  dayOfMonth: 1,
  startDate: new Date(2026, 0, 1),
  endDate: null,
  ...overrides,
});

describe("GenerateDueEntriesUseCase", () => {
  let chargeRepo: any;
  let dueRepo: any;
  let useCase: GenerateDueEntriesUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    chargeRepo = { findAllActive: vi.fn() };
    dueRepo = { createManySkipDuplicates: vi.fn().mockResolvedValue(0) };
    useCase = new GenerateDueEntriesUseCase(chargeRepo, dueRepo);
  });

  it("returns zero created when no active charges", async () => {
    chargeRepo.findAllActive.mockResolvedValue([]);
    const result = await useCase.execute();
    expect(result).toEqual({ processed: 0, created: 0 });
    expect(dueRepo.createManySkipDuplicates).not.toHaveBeenCalled();
  });

  it("creates dues for MONTHLY charge and returns count", async () => {
    chargeRepo.findAllActive.mockResolvedValue([makeCharge()]);
    dueRepo.createManySkipDuplicates.mockResolvedValue(3);
    const result = await useCase.execute();
    expect(dueRepo.createManySkipDuplicates).toHaveBeenCalledOnce();
    const entries = dueRepo.createManySkipDuplicates.mock.calls[0][0];
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].chargeId).toBe("charge-1");
    expect(result.created).toBe(3);
    expect(result.processed).toBe(1);
  });

  it("second run returns created=0 (skipDuplicates idempotency)", async () => {
    chargeRepo.findAllActive.mockResolvedValue([makeCharge()]);
    dueRepo.createManySkipDuplicates.mockResolvedValue(0);
    const result = await useCase.execute();
    expect(result.created).toBe(0);
  });

  it("skips non-MONTHLY/QUARTERLY periods", async () => {
    chargeRepo.findAllActive.mockResolvedValue([
      makeCharge({ period: "WEEKLY" }),
    ]);
    const result = await useCase.execute();
    expect(dueRepo.createManySkipDuplicates).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
  });

  it("per-charge exception does not abort loop", async () => {
    chargeRepo.findAllActive.mockResolvedValue([
      makeCharge({ id: "charge-bad", dayOfMonth: 1 }),
      makeCharge({ id: "charge-ok" }),
    ]);
    dueRepo.createManySkipDuplicates
      .mockRejectedValueOnce(new Error("DB down"))
      .mockResolvedValueOnce(2);
    const result = await useCase.execute();
    expect(result.processed).toBe(2);
    expect(result.created).toBe(2);
  });

  it("charge with expired endDate yields zero dues", async () => {
    const past = new Date(2020, 0, 1);
    chargeRepo.findAllActive.mockResolvedValue([
      makeCharge({ startDate: new Date(2019, 0, 1), endDate: past }),
    ]);
    const result = await useCase.execute();
    expect(dueRepo.createManySkipDuplicates).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
  });

  it("includes contactId and walletId when present on charge", async () => {
    chargeRepo.findAllActive.mockResolvedValue([
      makeCharge({ contactId: "contact-1", walletId: "wallet-1" }),
    ]);
    dueRepo.createManySkipDuplicates.mockResolvedValue(1);
    await useCase.execute();
    const entries = dueRepo.createManySkipDuplicates.mock.calls[0][0];
    expect(entries[0].contactId).toBe("contact-1");
    expect(entries[0].walletId).toBe("wallet-1");
  });

  it("QUARTERLY charge generates dues every 3 months", async () => {
    chargeRepo.findAllActive.mockResolvedValue([
      makeCharge({ period: "QUARTERLY", startDate: new Date(2026, 0, 1) }),
    ]);
    dueRepo.createManySkipDuplicates.mockImplementation(async (entries) => entries.length);
    await useCase.execute();
    const entries = dueRepo.createManySkipDuplicates.mock.calls[0][0];
    expect(entries.length).toBeLessThanOrEqual(2);
  });
});
