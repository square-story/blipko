import { Router } from "express";
import { telegramWebhookController } from "../controllers/TelegramWebhookController";

export const telegramRoutes: Router = Router();

telegramRoutes.post("/", (req, res, next) =>
  telegramWebhookController.handleWebhook(req, res, next),
);
