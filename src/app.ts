import express, { Application, NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";

import { env } from "./config/env";
import { telegramRoutes } from "./presentation/routes/telegramRoutes";
import { sendDueNotifications } from "./presentation/controllers/TelegramWebhookController";
import { startScheduler } from "./infrastructure/scheduler";

const app: Application = express();

app.use(express.json());

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
  console.error("Global Error Handler:", err);
  res.status(500).json({
    success: false,
    message: err.message ?? "Internal Server Error",
    data: null,
  });
});

const port = env.PORT;

if (process.env.NODE_ENV !== "test") {
  const message = `🚀 AI Ledger server listening on port ${port}\n`;
  process.stdout.write(message);
  app.listen(port);
  startScheduler(sendDueNotifications);
}

export { app };
