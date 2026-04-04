import { describe, it, expect, afterEach } from "vitest";

/**
 * Tests for sandbox mode logic.
 * Pure unit tests — no DB access needed.
 */

// Replicate the event mapping logic from email-events.ts for pure testing
const EVENT_TO_STATUS: Record<string, string> = {
  "activity.sent": "sent",
  "activity.delivered": "delivered",
  "activity.soft_bounced": "bounced",
  "activity.hard_bounced": "bounced",
  "activity.opened": "opened",
  "activity.clicked": "clicked",
  "activity.unsubscribed": "complained",
  "activity.spam_complaint": "complained",
};

const SIMPLE_EVENT_TO_MAILERSEND: Record<string, string> = {
  sent: "activity.sent",
  delivered: "activity.delivered",
  opened: "activity.opened",
  clicked: "activity.clicked",
  bounced: "activity.hard_bounced",
  complained: "activity.spam_complaint",
  unsubscribed: "activity.unsubscribed",
};

function simpleEventToStatus(event: string): string | null {
  const mailersendEvent = SIMPLE_EVENT_TO_MAILERSEND[event];
  if (!mailersendEvent) return null;
  return EVENT_TO_STATUS[mailersendEvent] ?? null;
}

function simpleEventToMailersendType(event: string): string | null {
  return SIMPLE_EVENT_TO_MAILERSEND[event] ?? null;
}

// ── getEmailMode ──────────────────────────────────────

describe("getEmailMode", () => {
  const originalEnv = process.env.EMAIL_MODE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EMAIL_MODE;
    } else {
      process.env.EMAIL_MODE = originalEnv;
    }
  });

  function getEmailMode(): "sandbox" | "live" {
    const mode = process.env.EMAIL_MODE?.toLowerCase();
    if (mode === "live") return "live";
    return "sandbox";
  }

  it("should default to sandbox when EMAIL_MODE is not set", () => {
    delete process.env.EMAIL_MODE;
    expect(getEmailMode()).toBe("sandbox");
  });

  it("should return sandbox when EMAIL_MODE=sandbox", () => {
    process.env.EMAIL_MODE = "sandbox";
    expect(getEmailMode()).toBe("sandbox");
  });

  it("should return live when EMAIL_MODE=live", () => {
    process.env.EMAIL_MODE = "live";
    expect(getEmailMode()).toBe("live");
  });

  it("should be case-insensitive for live", () => {
    process.env.EMAIL_MODE = "LIVE";
    expect(getEmailMode()).toBe("live");
  });

  it("should default to sandbox for unrecognized values", () => {
    process.env.EMAIL_MODE = "production";
    expect(getEmailMode()).toBe("sandbox");
  });

  it("should default to sandbox for empty string", () => {
    process.env.EMAIL_MODE = "";
    expect(getEmailMode()).toBe("sandbox");
  });
});

// ── Event mapping ──────────────────────────────────────

describe("simpleEventToStatus", () => {
  it("should map delivered to delivered status", () => {
    expect(simpleEventToStatus("delivered")).toBe("delivered");
  });

  it("should map opened to opened status", () => {
    expect(simpleEventToStatus("opened")).toBe("opened");
  });

  it("should map clicked to clicked status", () => {
    expect(simpleEventToStatus("clicked")).toBe("clicked");
  });

  it("should map bounced to bounced status", () => {
    expect(simpleEventToStatus("bounced")).toBe("bounced");
  });

  it("should map complained to complained status", () => {
    expect(simpleEventToStatus("complained")).toBe("complained");
  });

  it("should map unsubscribed to complained status (same as Mailersend behavior)", () => {
    expect(simpleEventToStatus("unsubscribed")).toBe("complained");
  });

  it("should map sent to sent status", () => {
    expect(simpleEventToStatus("sent")).toBe("sent");
  });

  it("should return null for unknown events", () => {
    expect(simpleEventToStatus("invalid")).toBeNull();
    expect(simpleEventToStatus("")).toBeNull();
  });
});

describe("simpleEventToMailersendType", () => {
  it("should map simple events to Mailersend activity types", () => {
    expect(simpleEventToMailersendType("delivered")).toBe("activity.delivered");
    expect(simpleEventToMailersendType("opened")).toBe("activity.opened");
    expect(simpleEventToMailersendType("clicked")).toBe("activity.clicked");
    expect(simpleEventToMailersendType("bounced")).toBe("activity.hard_bounced");
    expect(simpleEventToMailersendType("unsubscribed")).toBe("activity.unsubscribed");
    expect(simpleEventToMailersendType("complained")).toBe("activity.spam_complaint");
    expect(simpleEventToMailersendType("sent")).toBe("activity.sent");
  });

  it("should return null for unknown events", () => {
    expect(simpleEventToMailersendType("invalid")).toBeNull();
  });

  it("every mapped Mailersend type should exist in EVENT_TO_STATUS", () => {
    const simpleEvents = ["sent", "delivered", "opened", "clicked", "bounced", "complained", "unsubscribed"];
    for (const evt of simpleEvents) {
      const mailersendType = simpleEventToMailersendType(evt);
      expect(mailersendType).not.toBeNull();
      expect(EVENT_TO_STATUS[mailersendType!]).toBeDefined();
    }
  });
});

// ── Sandbox message ID format ────────────────────────────────��─────

describe("sandbox message ID format", () => {
  it("sandbox message IDs should start with sandbox_ prefix", () => {
    const messageId = `sandbox_${crypto.randomUUID()}`;
    expect(messageId).toMatch(/^sandbox_[0-9a-f-]{36}$/);
  });

  it("sandbox message IDs should be unique", () => {
    const ids = new Set(Array.from({ length: 100 }, () => `sandbox_${crypto.randomUUID()}`));
    expect(ids.size).toBe(100);
  });
});

// ── Campaign tag extraction ──────────────────────────────────────

describe("campaign tag extraction", () => {
  function extractCampaignId(tags?: string[]): string | null {
    if (!tags) return null;
    const campaignTag = tags.find((t) => t.startsWith("campaign:"));
    return campaignTag?.replace("campaign:", "") ?? null;
  }

  it("should extract campaignId from tags", () => {
    expect(extractCampaignId(["campaign:abc-123", "other-tag"])).toBe("abc-123");
  });

  it("should return null for missing campaign tag", () => {
    expect(extractCampaignId(["other-tag"])).toBeNull();
  });

  it("should return null for empty tags", () => {
    expect(extractCampaignId([])).toBeNull();
  });

  it("should return null for undefined tags", () => {
    expect(extractCampaignId(undefined)).toBeNull();
  });

  it("should handle UUID-formatted campaign IDs", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(extractCampaignId([`campaign:${uuid}`])).toBe(uuid);
  });
});
