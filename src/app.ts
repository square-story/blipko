import express, { Application, NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";

import { env } from "./config/env";
import { prisma } from "./data/prisma/client";
import { telegramRoutes } from "./presentation/routes/telegramRoutes";
import {
  telegramWebhookController,
  sendBudgetNudges,
  postRecurringCharges,
  sendCycleReport,
} from "./presentation/controllers/TelegramWebhookController";
import { startScheduler } from "./infrastructure/scheduler";
import { logger } from "./utils/logger";

const app: Application = express();
app.set("trust proxy", 1);

app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) =>
  res.status(200).json({ success: true, message: "OK", data: null }),
);

const webhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/webhooks", webhookLimiter);
app.use("/api/webhooks/telegram", telegramRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled request error", { err });
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    data: null,
  });
});

const port = env.PORT;

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(port, () => {
    process.stdout.write(`🚀 Blipko budget bot listening on port ${port}\n`);
    if (!env.SARVAM_API_KEY.trim()) {
      logger.warn(
        "SARVAM_API_KEY not set — voice transcription disabled; users will be asked to type instead.",
      );
    }
    startScheduler(sendBudgetNudges, postRecurringCharges, sendCycleReport);
    telegramWebhookController
      .registerBotCommands()
      .catch((err) => logger.error("registerBotCommands failed", { err }));
  });

  function shutdown() {
    logger.info("Shutting down gracefully");
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", { reason });
  });
}

export { app };
