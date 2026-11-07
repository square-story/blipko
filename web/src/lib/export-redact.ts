// Strips credentials from a user's data export. The export query already
// leaves these relations out; this is the second line of defence so a future
// `include` can't leak OAuth tokens, session tokens or bot link tokens.
export function redactExport<T extends Record<string, unknown>>(
  user: T,
): Omit<T, "accounts" | "sessions" | "telegramLinkToken"> {
  const {
    accounts: _accounts,
    sessions: _sessions,
    telegramLinkToken: _linkToken,
    ...rest
  } = user;
  return rest;
}
