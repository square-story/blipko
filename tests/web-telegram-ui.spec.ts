import {
  test,
  expect,
  chromium,
  Browser,
  BrowserContext,
} from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const WEB_URL = process.env.TEST_WEB_URL ?? "http://localhost:3000";
const DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!DB_URL) throw new Error("TEST_DATABASE_URL env var is required");

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

// One run-id per test session to avoid cross-run collisions
const RUN_ID = crypto.randomBytes(4).toString("hex");
const TEST_EMAIL = `ui-test-${RUN_ID}@blipko.test`;

let userId: string;
let sessionToken: string;
let browser: Browser;

async function freshContext(): Promise<BrowserContext> {
  const ctx = await browser.newContext();
  await ctx.addCookies([
    {
      name: "__Secure-authjs.session-token",
      value: sessionToken,
      domain: "earnest-determination-production-5788.up.railway.app",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
  return ctx;
}

// Serial so tests share setup and don't race on the DB
test.describe.serial("Web UI — Telegram linking flow", () => {
  test.beforeAll(async () => {
    browser = await chromium.launch();

    const user = await prisma.user.create({
      data: { email: TEST_EMAIL, name: "UI Test User", hasOnboarded: false },
    });
    userId = user.id;

    sessionToken = crypto.randomUUID();
    await prisma.session.create({
      data: {
        userId,
        sessionToken,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  });

  test.afterAll(async () => {
    await prisma.session.deleteMany({ where: { user: { email: TEST_EMAIL } } });
    await prisma.telegramLinkToken.deleteMany({
      where: { user: { email: TEST_EMAIL } },
    });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.$disconnect();
    if (browser) await browser.close();
  });

  test("onboarding modal: 5 steps, last step is Connect Telegram", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { hasOnboarded: false },
    });

    const ctx = await freshContext();
    const page = await ctx.newPage();
    await page.goto(`${WEB_URL}/dashboard`, { waitUntil: "domcontentloaded" });

    // Modal must appear
    await page.waitForSelector('[role="dialog"]', { timeout: 15000 });

    // Step 1 visible
    const title = page.locator('[role="dialog"]').getByRole("heading");
    await expect(title).toContainText("Welcome to Blipko");

    // 5 step-indicator dots
    const dots = page.locator('[role="dialog"] .rounded-full');
    await expect(dots).toHaveCount(5);

    // Advance through steps 1–4
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: /next/i }).click();
      await page.waitForTimeout(300);
    }

    // Step 5
    await expect(title).toContainText("Connect Telegram");
    await expect(
      page.getByRole("button", { name: /open telegram bot/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /skip/i })).toBeVisible();

    await ctx.close();
  });

  test("'Open Telegram Bot' button opens t.me deep link and closes modal", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { hasOnboarded: false },
    });

    const ctx = await freshContext();
    const page = await ctx.newPage();

    // Capture new tab before clicking
    const newPagePromise = ctx.waitForEvent("page");

    await page.goto(`${WEB_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[role="dialog"]', { timeout: 15000 });

    // Skip to step 5
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: /next/i }).click();
      await page.waitForTimeout(300);
    }

    await page.getByRole("button", { name: /open telegram bot/i }).click();

    // New tab URL must be a Telegram deep link with our token
    const newTab = await newPagePromise;
    expect(newTab.url()).toMatch(
      /^https:\/\/t\.me\/Blipko_bot\?start=[a-f0-9]{32}/,
    );
    await newTab.close();

    // Modal closes after click
    await page.waitForSelector('[role="dialog"]', {
      state: "detached",
      timeout: 8000,
    });

    // DB: hasOnboarded = true and a fresh link token was created
    await page.waitForTimeout(1000);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.hasOnboarded).toBe(true);

    const token = await prisma.telegramLinkToken.findFirst({
      where: { userId },
    });
    expect(token).not.toBeNull();
    expect(token!.expiresAt.getTime()).toBeGreaterThan(Date.now());

    await ctx.close();
  });

  test("account page: 'Connect Telegram' button visible when not connected", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { telegramId: null, hasOnboarded: true },
    });

    const ctx = await freshContext();
    const page = await ctx.newPage();
    await page.goto(`${WEB_URL}/dashboard/account`, {
      waitUntil: "domcontentloaded",
    });

    // TelegramCard heading
    await expect(page.getByText("Telegram").first()).toBeVisible({
      timeout: 15000,
    });

    // Connect button visible
    await expect(
      page.getByRole("button", { name: /connect telegram/i }),
    ).toBeVisible();

    // No "Connected" badge
    await expect(page.getByText("Connected")).not.toBeVisible();

    await ctx.close();
  });

  test("account page: shows 'Connected' badge when telegramId is set", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { telegramId: "777777777", hasOnboarded: true },
    });

    const ctx = await freshContext();
    const page = await ctx.newPage();
    await page.goto(`${WEB_URL}/dashboard/account`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByText("Connected").first()).toBeVisible({
      timeout: 15000,
    });

    // Connect button gone
    await expect(
      page.getByRole("button", { name: /connect telegram/i }),
    ).not.toBeVisible();

    await prisma.user.update({
      where: { id: userId },
      data: { telegramId: null },
    });
    await ctx.close();
  });
});
