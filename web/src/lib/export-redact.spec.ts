import { describe, expect, it } from "vitest";
import { redactExport } from "./export-redact";

describe("redactExport", () => {
  it("drops auth secrets and link tokens but keeps financial data", () => {
    const out = redactExport({
      id: "u1",
      email: "a@b.c",
      accounts: [{ access_token: "x", refresh_token: "y" }],
      sessions: [{ sessionToken: "s" }],
      telegramLinkToken: { token: "t" },
      expenses: [{ amount: "30.00" }],
    });
    const s = JSON.stringify(out);
    expect(s).not.toMatch(/access_token|refresh_token|sessionToken|"token"/);
    expect(out).toMatchObject({ id: "u1", expenses: [{ amount: "30.00" }] });
  });
});
