import { describe, it, expect, vi, beforeEach } from "vitest";
import { HelpProcessor } from "./HelpProcessor";

describe("HelpProcessor", () => {
  let messageService: any;
  let processor: HelpProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
    processor = new HelpProcessor(messageService);
  });

  it("matches 'help' and '/help' only", () => {
    expect(processor.canHandle({ textMessage: "help" } as any)).toBe(true);
    expect(processor.canHandle({ textMessage: "  /HELP " } as any)).toBe(true);
    expect(processor.canHandle({ textMessage: "chai 30" } as any)).toBe(false);
  });

  it("sends a detailed guide covering commands, voice, and questions", async () => {
    await processor.process({
      platformUserId: "123",
      textMessage: "/help",
    } as any);

    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("/status");
    expect(body).toContain("/settings");
    expect(body).toContain("voice");
    expect(body).toContain("can I afford");
  });
});
