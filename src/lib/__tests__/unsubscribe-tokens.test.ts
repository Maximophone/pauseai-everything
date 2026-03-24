import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Set env before importing the module
const MOCK_SECRET = "test-secret-key-for-hmac-generation";

describe("unsubscribe tokens", () => {
  beforeEach(() => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", MOCK_SECRET);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.pauseai.info");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("should generate a valid hex token", async () => {
    const { generateUnsubscribeToken } = await import("@/lib/unsubscribe-tokens");
    const token = generateUnsubscribeToken("contact-123", "ws-abc", "newsletter");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should generate deterministic tokens", async () => {
    const { generateUnsubscribeToken } = await import("@/lib/unsubscribe-tokens");
    const token1 = generateUnsubscribeToken("contact-123", "ws-abc", "newsletter");
    const token2 = generateUnsubscribeToken("contact-123", "ws-abc", "newsletter");
    expect(token1).toBe(token2);
  });

  it("should generate different tokens for different contacts", async () => {
    const { generateUnsubscribeToken } = await import("@/lib/unsubscribe-tokens");
    const token1 = generateUnsubscribeToken("contact-123", "ws-abc", "newsletter");
    const token2 = generateUnsubscribeToken("contact-456", "ws-abc", "newsletter");
    expect(token1).not.toBe(token2);
  });

  it("should generate different tokens for different categories", async () => {
    const { generateUnsubscribeToken } = await import("@/lib/unsubscribe-tokens");
    const token1 = generateUnsubscribeToken("contact-123", "ws-abc", "newsletter");
    const token2 = generateUnsubscribeToken("contact-123", "ws-abc", "events");
    expect(token1).not.toBe(token2);
  });

  it("should generate different tokens for different workspaces", async () => {
    const { generateUnsubscribeToken } = await import("@/lib/unsubscribe-tokens");
    const token1 = generateUnsubscribeToken("contact-123", "ws-abc", "newsletter");
    const token2 = generateUnsubscribeToken("contact-123", "ws-def", "newsletter");
    expect(token1).not.toBe(token2);
  });

  it("should verify a valid token", async () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import("@/lib/unsubscribe-tokens");
    const token = generateUnsubscribeToken("contact-123", "ws-abc", "newsletter");
    expect(verifyUnsubscribeToken("contact-123", "ws-abc", "newsletter", token)).toBe(true);
  });

  it("should reject an invalid token", async () => {
    const { verifyUnsubscribeToken } = await import("@/lib/unsubscribe-tokens");
    expect(verifyUnsubscribeToken("contact-123", "ws-abc", "newsletter", "invalid")).toBe(false);
  });

  it("should reject a token for wrong contact", async () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import("@/lib/unsubscribe-tokens");
    const token = generateUnsubscribeToken("contact-123", "ws-abc", "newsletter");
    expect(verifyUnsubscribeToken("contact-456", "ws-abc", "newsletter", token)).toBe(false);
  });

  it("should reject a token for wrong category", async () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import("@/lib/unsubscribe-tokens");
    const token = generateUnsubscribeToken("contact-123", "ws-abc", "newsletter");
    expect(verifyUnsubscribeToken("contact-123", "ws-abc", "events", token)).toBe(false);
  });

  it("should reject a token for wrong workspace", async () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import("@/lib/unsubscribe-tokens");
    const token = generateUnsubscribeToken("contact-123", "ws-abc", "newsletter");
    expect(verifyUnsubscribeToken("contact-123", "ws-def", "newsletter", token)).toBe(false);
  });

  it("should build a correct unsubscribe URL", async () => {
    const { buildUnsubscribeUrl } = await import("@/lib/unsubscribe-tokens");
    const url = buildUnsubscribeUrl("contact-123", "ws-abc", "newsletter");
    expect(url).toContain("https://app.pauseai.info/unsubscribe");
    expect(url).toContain("contact=contact-123");
    expect(url).toContain("workspace=ws-abc");
    expect(url).toContain("category=newsletter");
    expect(url).toContain("token=");
  });

  it("should throw when UNSUBSCRIBE_SECRET is not set", async () => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "");
    const { generateUnsubscribeToken } = await import("@/lib/unsubscribe-tokens");
    expect(() => generateUnsubscribeToken("contact-123", "ws-abc", "newsletter")).toThrow(
      "UNSUBSCRIBE_SECRET is not configured"
    );
  });
});
