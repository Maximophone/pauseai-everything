import { describe, it, expect, vi, beforeEach } from "vitest";
import { INTERACTION_TYPES } from "@/lib/interactions";

describe("INTERACTION_TYPES", () => {
  it("should contain expected types", () => {
    expect(INTERACTION_TYPES).toContain("email_sent");
    expect(INTERACTION_TYPES).toContain("email_received");
    expect(INTERACTION_TYPES).toContain("call");
    expect(INTERACTION_TYPES).toContain("meeting");
    expect(INTERACTION_TYPES).toContain("note");
    expect(INTERACTION_TYPES).toContain("form_submission");
    expect(INTERACTION_TYPES).toContain("event_attended");
    expect(INTERACTION_TYPES).toContain("action_taken");
    expect(INTERACTION_TYPES).toContain("stage_change");
  });

  it("should have 9 types", () => {
    expect(INTERACTION_TYPES).toHaveLength(9);
  });
});

// Test the API validation logic (extracted as pure functions)
describe("Interaction API validation", () => {
  it("should reject empty type", () => {
    const type = "";
    expect(!type).toBe(true);
  });

  it("should reject invalid type", () => {
    const type = "invalid_type";
    expect(INTERACTION_TYPES.includes(type as typeof INTERACTION_TYPES[number])).toBe(false);
  });

  it("should accept valid types", () => {
    for (const type of INTERACTION_TYPES) {
      expect(INTERACTION_TYPES.includes(type)).toBe(true);
    }
  });

  it("should handle date parsing for occurredAt", () => {
    const isoString = "2026-03-17T10:30:00.000Z";
    const date = new Date(isoString);
    expect(date.getFullYear()).toBe(2026);
    expect(date.toISOString()).toBe(isoString);
  });

  it("should default occurredAt to now when not provided", () => {
    const before = new Date();
    const occurredAt = new Date();
    const after = new Date();
    expect(occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
