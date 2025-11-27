import { test, expect } from "@playwright/test";

test.describe("API Health Check", () => {
  test("GET /health should return 200 OK", async ({ request }) => {
    const response = await request.get("/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, message: "OK", data: null });
  });
});

test.describe("WhatsApp Webhook Verification", () => {
  test("GET /api/webhooks/whatsapp should verify token", async ({
    request,
  }) => {
    const verifyToken = process.env.META_VERIFY_TOKEN;

    // If token is not available in test environment, we might need to skip or mock.
    // Assuming .env is loaded by playwright.config.ts
    if (!verifyToken) {
      console.warn(
        "META_VERIFY_TOKEN not found in environment variables. Skipping verification test.",
      );
      test.skip();
      return;
    }

    const challenge = "123456789";
    const response = await request.get("/api/webhooks/whatsapp", {
      params: {
        "hub.mode": "subscribe",
        "hub.verify_token": verifyToken,
        "hub.challenge": challenge,
      },
    });

    expect(response.status()).toBe(200);
    expect(await response.text()).toBe(challenge);
  });

  test("GET /api/webhooks/whatsapp should fail with invalid token", async ({
    request,
  }) => {
    const challenge = "123456789";
    const response = await request.get("/api/webhooks/whatsapp", {
      params: {
        "hub.mode": "subscribe",
        "hub.verify_token": "invalid_token_123",
        "hub.challenge": challenge,
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Verification failed");
  });
});
