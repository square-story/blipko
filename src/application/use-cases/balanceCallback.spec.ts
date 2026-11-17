import { describe, it, expect } from "vitest";
import { balanceCb, parseBalanceCallback } from "./balanceCallback";

describe("balance callback", () => {
  it("round-trips both choices", () => {
    expect(parseBalanceCallback(balanceCb.log("ckabc123"))).toEqual({
      id: "ckabc123",
      choice: "y",
    });
    expect(parseBalanceCallback(balanceCb.skip("ckabc123"))).toEqual({
      id: "ckabc123",
      choice: "n",
    });
  });

  it.each([
    "bal:",
    "bal:abc",
    "bal:abc:x",
    "bal::y",
    "car:2026-05-01:n",
    "balance 9000",
  ])("rejects %s", (data) => {
    expect(parseBalanceCallback(data)).toBeNull();
  });
});
