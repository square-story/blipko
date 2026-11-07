const SECRET_KEYS = ["accounts", "sessions", "telegramLinkToken"] as const;

// Strips credentials from a user's data export. The export query already
// leaves these relations out; this is the second line of defence so a future
// `include` can't leak OAuth tokens, session tokens or bot link tokens.
export function redactExport<T extends Record<string, unknown>>(
  user: T,
): Omit<T, (typeof SECRET_KEYS)[number]> {
  const rest: Record<string, unknown> = { ...user };
  for (const key of SECRET_KEYS) delete rest[key];
  return rest as Omit<T, (typeof SECRET_KEYS)[number]>;
}
