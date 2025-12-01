import express, { Application, NextFunction, Request, Response } from "express";

import { env } from "./config/env";
import { webhookRoutes } from "./presentation/routes/webhookRoutes";

const app: Application = express();

app.use(express.json());

app.get("/health", (_req, res) =>
  res.status(200).json({ success: true, message: "OK", data: null }),
);

app.use("/api/webhooks/whatsapp", webhookRoutes);

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
}

export { app };
