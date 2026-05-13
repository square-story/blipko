import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IWalletRepository } from "../../../domain/repositories/IWalletRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";

export class WalletProcessor implements MessageProcessor {
  constructor(
    private readonly walletRepository: IWalletRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return context.parsed?.intent === "WALLET";
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const parsed = context.parsed!;
    const action = parsed.wallet_action;
    const userId = context.user.id;
    let response: string;

    if (!action) {
      response =
        "Which wallet action? Try: 'show wallets', 'switch to Shop', 'create Savings wallet'";
      await this.messageService.sendMessage({
        to: context.platformUserId,
        body: response,
      });
      return { response, parsed };
    }

    switch (action.action) {
      case "LIST": {
        const wallets = await this.walletRepository.findByUserId(userId);
        if (wallets.length === 0) {
          response =
            "You have no wallets yet. Create one: 'create Shop wallet'";
        } else {
          const lines = wallets.map(
            (w) =>
              `${w.emoji} *${w.name}*${w.isDefault ? " ✅ (default)" : ""}`,
          );
          response = `Your wallets:\n\n${lines.join("\n")}`;
        }
        break;
      }

      case "SHOW_BALANCE": {
        const name = action.walletName;
        const wallet = name
          ? await this.walletRepository.findByName(userId, name)
          : await this.walletRepository.findDefaultByUser(userId);
        if (!wallet) {
          response = `No wallet found${name ? ` named "${name}"` : ""}. Try 'list wallets'.`;
        } else {
          response = `${wallet.emoji} *${wallet.name}* wallet — use the dashboard for balance details.`;
        }
        break;
      }

      case "SWITCH": {
        const name = action.walletName;
        if (!name) {
          response = "Which wallet to switch to? E.g. 'switch to Shop'";
          break;
        }
        const wallet = await this.walletRepository.findByName(userId, name);
        if (!wallet) {
          response = `No wallet named "${name}". Try 'list wallets'.`;
          break;
        }
        await this.walletRepository.setDefault(wallet.id, userId);
        response = `${wallet.emoji} Switched to *${wallet.name}* as default. Future entries go here.`;
        break;
      }

      case "CREATE": {
        const name = action.walletName;
        if (!name) {
          response =
            "What should I call the new wallet? E.g. 'create Shop wallet'";
          break;
        }
        const existing = await this.walletRepository.findByName(userId, name);
        if (existing) {
          response = `A wallet named "${name}" already exists.`;
          break;
        }
        const wallet = await this.walletRepository.create({ name, userId });
        response = `${wallet.emoji} Wallet *${wallet.name}* created! Prefix messages with "${name}: " to use it.`;
        break;
      }

      default:
        response =
          "Try: 'list wallets', 'switch to Shop', 'create Savings wallet'";
    }

    await this.messageService.sendMessage({
      to: context.platformUserId,
      body: response,
    });
    return { response, parsed };
  }
}
