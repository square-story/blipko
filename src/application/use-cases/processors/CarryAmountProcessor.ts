import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IPendingActionRepository } from "../../../domain/repositories/IPendingActionRepository";
import {
  IMessagingPlatform,
  InlineButtonRows,
} from "../../interfaces/IMessagingPlatform";
import { carryCb } from "../carryCallback";
import { parseBareAmount } from "../carryFlow";
import { formatMoney, periodKey } from "../budgetMath";

// The typed leg of the carry-forward prompt: the user tapped "Different
// amount", so the next bare number they send is that amount rather than an
// expense. Gated on the staged CARRY_AMOUNT row, which is pre-resolved in
// ProcessIncomingMessage because canHandle cannot query.
//
// That row is the whole reason this is safe: outside its 30-minute window a
// lone "500" goes back to being a ₹500 expense.
export class CarryAmountProcessor implements MessageProcessor {
  constructor(
    private readonly pendingActionRepository: IPendingActionRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return (
      Boolean(context.carryPrompt) &&
      parseBareAmount(context.textMessage ?? "") !== null
    );
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { user, platformUserId, carryPrompt } = context;
    const amount = parseBareAmount(context.textMessage)!;

    // Single-use: consume before answering, so the same staged row can't route
    // a second number.
    const claimed = await this.pendingActionRepository.consume(
      carryPrompt!.id,
      user.id,
    );
    if (!claimed) {
      const body = "That request expired — I'll ask again next cycle.";
      await this.messageService.sendMessage({ to: platformUserId, body });
      return { response: body, parsed: { intent: "UNKNOWN", confidence: 1 } };
    }

    const cycleKey = periodKey(user.payday, new Date(), user.timezone);
    const money = formatMoney(amount);
    const rows: InlineButtonRows = [
      [
        { id: carryCb.savings(cycleKey, amount), title: `💰 Savings ${money}` },
        {
          id: carryCb.opening(cycleKey, amount),
          title: `➡️ Opening balance ${money}`,
        },
      ],
    ];
    const body = `${money} it is. Where should it go?`;
    await this.messageService.sendInteractiveMessage(
      platformUserId,
      body,
      rows,
    );
    return { response: body, parsed: { intent: "UNKNOWN", confidence: 1 } };
  }
}
