import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { PrismaClient } from "@prisma/client";
import { SendBudgetNudgesUseCase } from "../../application/use-cases/SendBudgetNudges";
import { PostRecurringChargesUseCase } from "../../application/use-cases/PostRecurringCharges";
import { SendCycleReportUseCase } from "../../application/use-cases/SendCycleReport";
import { SendBoxTargetAlertsUseCase } from "../../application/use-cases/SendBoxTargetAlerts";
import { zonedParts } from "../../utils/time";
import { logger } from "../../utils/logger";

const log = logger.child({ component: "cron" });
const PRUNE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Runs the scheduled jobs, driven by an hourly Railway cron hitting
// POST /api/cron/tick with the shared secret. Each job self-gates on the user's
// local hour, so the same hourly tick delivers everything at the right local
// time. `?force=1` bypasses the hour gate (testing); `?only=nudges|recurring|report`
// runs a single job.
export class CronController {
  constructor(
    private readonly sendBudgetNudges: SendBudgetNudgesUseCase,
    private readonly postRecurringCharges: PostRecurringChargesUseCase,
    private readonly sendCycleReport: SendCycleReportUseCase,
    private readonly sendBoxTargetAlerts: SendBoxTargetAlertsUseCase,
    private readonly prisma: PrismaClient,
    private readonly cronSecret: string,
  ) {}

  private authorized(req: Request): boolean {
    const incoming = req.headers["x-cron-secret"];
    if (typeof incoming !== "string") return false;
    const a = Buffer.from(incoming);
    const b = Buffer.from(this.cronSecret);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async handleTick(req: Request, res: Response, next: NextFunction) {
    try {
      if (!this.authorized(req)) {
        res.status(403).json({ success: false, message: "Forbidden" });
        return;
      }

      const now = new Date();
      const force = req.query.force === "1" || req.query.force === "true";
      const only =
        typeof req.query.only === "string" ? req.query.only : undefined;
      const wants = (name: string) => !only || only === name;

      const data: Record<string, unknown> = {};
      if (wants("recurring")) {
        data.recurring = await this.postRecurringCharges.execute(now, force);
      }
      if (wants("nudges")) {
        data.nudges = await this.sendBudgetNudges.execute(now, force);
      }
      if (wants("report")) {
        data.report = await this.sendCycleReport.execute(now, force);
      }
      if (wants("boxes")) {
        // Once-only via Box.targetReachedAt, so no hour-gate needed.
        data.boxes = await this.sendBoxTargetAlerts.execute();
      }

      // Weekly prune of stale rows (Sunday 00:00 UTC), or on force.
      const utc = zonedParts(now, "UTC");
      if (force || (utc.weekday === "Sun" && utc.hour === 0)) {
        data.pruned = await this.prune();
      }

      log.info("Cron tick complete", { force, only: only ?? "all", ...data });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  private async prune(): Promise<{ conversations: number; processed: number }> {
    const cutoff = new Date(Date.now() - PRUNE_WINDOW_MS);
    const conv = await this.prisma.conversationMessage.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    const proc = await this.prisma.processedMessage.deleteMany({
      where: { processedAt: { lt: cutoff } },
    });
    return { conversations: conv.count, processed: proc.count };
  }
}
