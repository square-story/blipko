import { User } from "@prisma/client";

// Returns the first available platform ID in preference order.
// Add new platforms here as they are implemented.
export function resolvePlatformUserId(
  user: Pick<User, "telegramId">,
): string | null {
  return user.telegramId ?? null;
  // Future: return user.telegramId ?? user.whatsappId ?? user.signalId ?? null;
}
