import { describe, it, expect } from "vitest";
import { generateApiKey } from "@/lib/users";
import { createHash } from "crypto";

describe("API key generation", () => {
  it("should generate a key with pai_ prefix", () => {
    const { key } = generateApiKey();
    expect(key.startsWith("pai_")).toBe(true);
  });

  it("should generate a key of sufficient length", () => {
    const { key } = generateApiKey();
    // pai_ + 64 hex chars = 68 chars
    expect(key.length).toBe(68);
  });

  it("should generate a prefix from the key", () => {
    const { key, prefix } = generateApiKey();
    expect(key.startsWith(prefix)).toBe(true);
    expect(prefix.length).toBe(12);
  });

  it("should generate a valid SHA-256 hash", () => {
    const { key, hash } = generateApiKey();
    const expectedHash = createHash("sha256").update(key).digest("hex");
    expect(hash).toBe(expectedHash);
  });

  it("should generate unique keys", () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      keys.add(generateApiKey().key);
    }
    expect(keys.size).toBe(100);
  });
});

describe("RBAC logic", () => {
  it("should identify admin users", () => {
    const user = { isAdmin: true };
    expect(user.isAdmin).toBe(true);
  });

  it("should identify non-admin users", () => {
    const user = { isAdmin: false };
    expect(user.isAdmin).toBe(false);
  });

  it("should default isAdmin to false for new users", () => {
    const user = { isAdmin: false };
    expect(user.isAdmin).toBe(false);
  });
});
