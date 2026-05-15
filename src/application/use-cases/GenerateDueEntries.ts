import { IRecurringChargeRepository } from "../../domain/repositories/IRecurringChargeRepository";
import { IDueEntryRepository } from "../../domain/repositories/IDueEntryRepository";
import { computeDueDatesInWindow, addMonths } from "../../utils/dueDate";

const LOOKAHEAD_MONTHS = 3;

export class GenerateDueEntriesUseCase {
  constructor(
    private readonly chargeRepo: IRecurringChargeRepository,
    private readonly dueRepo: IDueEntryRepository,
  ) {}

  async execute(): Promise<{ processed: number; created: number }> {
    const charges = await this.chargeRepo.findAllActive();
    const now = new Date();
    const windowEnd = addMonths(now, LOOKAHEAD_MONTHS);
    let totalCreated = 0;

    for (const charge of charges) {
      if (!["MONTHLY", "QUARTERLY"].includes(charge.period)) continue;
      try {
        const dates = computeDueDatesInWindow(
          charge.dayOfMonth,
          charge.period as "MONTHLY" | "QUARTERLY",
          charge.startDate,
          charge.endDate ?? null,
          now,
          windowEnd,
        );
        if (dates.length === 0) continue;
        const created = await this.dueRepo.createManySkipDuplicates(
          dates.map((d) => ({
            chargeId: charge.id,
            ...(charge.contactId && { contactId: charge.contactId }),
            ...(charge.walletId && { walletId: charge.walletId }),
            dueDate: d,
            amount: Number(charge.amount),
          })),
        );
        totalCreated += created;
      } catch (err) {
        console.error(
          `GenerateDueEntries: failed for charge ${charge.id}`,
          err,
        );
      }
    }

    console.log(
      `GenerateDueEntries: ${totalCreated} new dues from ${charges.length} charges`,
    );
    return { processed: charges.length, created: totalCreated };
  }
}
