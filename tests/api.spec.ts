import { test, expect } from "@playwright/test";

test.describe("API health check", () => {
  test("GET /health returns 200 OK", async ({ request }) => {
    const response = await request.get("/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "OK",
      data: null,
    });
  });
});

test.describe("Telegram webhook", () => {
  test("rejects a request without the secret token (403)", async ({
    request,
  }) => {
    const response = await request.post("/api/webhooks/telegram", {
      data: { update_id: 1 },
    });
    expect(response.status()).toBe(403);
  });

  test("accepts a non-actionable update with the correct secret (200)", async ({
    request,
  }) => {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    test.skip(!secret, "TELEGRAM_WEBHOOK_SECRET not set in this environment");

    // An update with no message/callback_query is acknowledged without touching
    // the DB or AI, so it's safe to assert against with dummy provider keys.
    const response = await request.post("/api/webhooks/telegram", {
      headers: { "x-telegram-bot-api-secret-token": secret as string },
      data: { update_id: 1 },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });
});
