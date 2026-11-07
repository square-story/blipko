import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClarityScoreProcessor } from "./ClarityScoreProcessor";

const user = { id: "u1" } as any;
const ctx = (textMessage: string) =>
  ({ user, platformUserId: "tg1", textMessage }) as any;

describe("ClarityScoreProcessor", () => {
  let clarityScoreRepository: any;
  let processor: ClarityScoreProcessor;

  beforeEach(() => {
    clarityScoreRepository = { record: vi.fn().mockResolvedValue(undefined) };
    processor = new ClarityScoreProcessor(clarityScoreRepository);
  });

  it("handles only a valid clr: callback", () => {
    expect(processor.canHandle(ctx("clr:2026-05-01:4"))).toBe(true);
    expect(processor.canHandle(ctx("clr:2026-05-01:9"))).toBe(false);
    expect(processor.canHandle(ctx("chai 30"))).toBe(false);
  });

  it("records the score for that cycle and thanks with a toast", async () => {
    const out = await processor.process(ctx("clr:2026-05-01:4"));
    expect(clarityScoreRepository.record).toHaveBeenCalledWith(
      "u1",
      "2026-05-01",
      4,
    );
    expect(out.toast).toBe("Thanks — noted 🙏");
  });

  // Re-taps (or a tap on an old report) re-record; the repository upserts, so
  // the last tap wins and nothing throws.
  it("accepts a second tap on the same cycle", async () => {
    await processor.process(ctx("clr:2026-05-01:4"));
    await processor.process(ctx("clr:2026-05-01:2"));
    expect(clarityScoreRepository.record).toHaveBeenCalledTimes(2);
    expect(clarityScoreRepository.record).toHaveBeenLastCalledWith(
      "u1",
      "2026-05-01",
      2,
    );
  });
});
