import { Router } from "express";
import { cronController } from "../controllers/TelegramWebhookController";

export const cronRoutes: Router = Router();

// Driven by the hourly Railway cron (guarded by x-cron-secret).
cronRoutes.post("/tick", (req, res, next) =>
  cronController.handleTick(req, res, next),
);
