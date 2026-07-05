import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectAccountProcessor } from "./ConnectAccountProcessor";

const WEB_URL = "https://blipko.lol";

describe("ConnectAccountProcessor", () => {
  let messageService: any;
  let processor: ConnectAccountProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("m1"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("m2"),
    };
    processor = new ConnectAccountProcessor(messageService, WEB_URL);
  });

  it("handles any message from a not-onboarded user, plus /start", () => {
    const notOnboarded = { user: { hasOnboarded: false } };
    const onboarded = { user: { hasOnboarded: true } };
    expect(
      processor.canHandle({ ...notOnboarded, textMessage: "hi" } as any),
    ).toBe(true);
    expect(
      processor.canHandle({ ...onboarded, textMessage: "/start" } as any),
    ).toBe(true);
    expect(
      processor.canHandle({ ...onboarded, textMessage: "chai 30" } as any),
    ).toBe(false);
  });

  it("hands a not-onboarded user off to the dashboard with a URL button", async () => {
    await processor.process({
      user: { hasOnboarded: false },
      platformUserId: "123",
      textMessage: "hi",
    } as any);

    const [, body, rows] = messageService.sendInteractiveMessage.mock.calls[0];
    expect(body).toContain("Welcome to Blipko");
    expect(body).toContain("Connect Telegram");
    expect(rows[0][0].url).toBe(WEB_URL);
    expect(messageService.sendMessage).not.toHaveBeenCalled();
  });

  it("greets an onboarded user who types /start", async () => {
    await processor.process({
      user: { hasOnboarded: true },
      platformUserId: "123",
      textMessage: "/start",
    } as any);

    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "Welcome back",
    );
    expect(messageService.sendInteractiveMessage).not.toHaveBeenCalled();
  });
});
