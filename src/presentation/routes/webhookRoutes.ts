import { Router } from "express";

import { webhookController } from "../controllers/WebhookController";

export const webhookRoutes: Router = Router();

webhookRoutes.get("/", (req, res, next) =>
  webhookController.verifyWebhook(req, res, next),
);

webhookRoutes.post("/", (req, res, next) =>
  webhookController.handleWebhook(req, res, next),
);
