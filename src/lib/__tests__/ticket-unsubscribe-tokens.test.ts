import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Set up env before importing the module
beforeEach(() => {
  process.env.UNSUBSCRIBE_SECRET = "test-secret-for-tickets";
});

afterEach(() => {
  delete process.env.UNSUBSCRIBE_SECRET;
  vi.resetModules();
});

describe("Ticket Unsubscribe Tokens", () => {
  it("generates and verifies a valid token", async () => {
    const {
      generateTicketUnsubscribeToken,
      verifyTicketUnsubscribeToken,
    } = await import("../ticket-unsubscribe-tokens");

    const token = generateTicketUnsubscribeToken("user-1", "ticket-1");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    expect(verifyTicketUnsubscribeToken("user-1", "ticket-1", token)).toBe(true);
  });

  it("rejects token for wrong user", async () => {
    const {
      generateTicketUnsubscribeToken,
      verifyTicketUnsubscribeToken,
    } = await import("../ticket-unsubscribe-tokens");

    const token = generateTicketUnsubscribeToken("user-1", "ticket-1");
    expect(verifyTicketUnsubscribeToken("user-2", "ticket-1", token)).toBe(false);
  });

  it("rejects token for wrong ticket", async () => {
    const {
      generateTicketUnsubscribeToken,
      verifyTicketUnsubscribeToken,
    } = await import("../ticket-unsubscribe-tokens");

    const token = generateTicketUnsubscribeToken("user-1", "ticket-1");
    expect(verifyTicketUnsubscribeToken("user-1", "ticket-2", token)).toBe(false);
  });

  it("rejects garbage token", async () => {
    const { verifyTicketUnsubscribeToken } = await import(
      "../ticket-unsubscribe-tokens"
    );

    expect(verifyTicketUnsubscribeToken("user-1", "ticket-1", "not-hex")).toBe(false);
  });

  it("throws when UNSUBSCRIBE_SECRET is missing", async () => {
    delete process.env.UNSUBSCRIBE_SECRET;
    const { generateTicketUnsubscribeToken } = await import(
      "../ticket-unsubscribe-tokens"
    );

    expect(() =>
      generateTicketUnsubscribeToken("user-1", "ticket-1")
    ).toThrow("UNSUBSCRIBE_SECRET is not configured");
  });

  it("builds a valid unsubscribe URL", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    const { buildTicketUnsubscribeUrl } = await import(
      "../ticket-unsubscribe-tokens"
    );

    const url = buildTicketUnsubscribeUrl("user-1", "ticket-1");
    expect(url).toContain("https://app.example.com/api/support-tickets/unsubscribe");
    expect(url).toContain("user=user-1");
    expect(url).toContain("ticket=ticket-1");
    expect(url).toContain("token=");

    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("generates deterministic tokens for same input", async () => {
    const { generateTicketUnsubscribeToken } = await import(
      "../ticket-unsubscribe-tokens"
    );

    const token1 = generateTicketUnsubscribeToken("user-1", "ticket-1");
    const token2 = generateTicketUnsubscribeToken("user-1", "ticket-1");
    expect(token1).toBe(token2);
  });

  it("generates different tokens for different inputs", async () => {
    const { generateTicketUnsubscribeToken } = await import(
      "../ticket-unsubscribe-tokens"
    );

    const token1 = generateTicketUnsubscribeToken("user-1", "ticket-1");
    const token2 = generateTicketUnsubscribeToken("user-1", "ticket-2");
    expect(token1).not.toBe(token2);
  });
});
