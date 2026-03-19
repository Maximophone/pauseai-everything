import { describe, it, expect } from "vitest";

/**
 * Test the Mailersend event type → email status mapping logic.
 * This is the pure mapping extracted from the webhook handler.
 */

function mapMailersendEventToStatus(eventType: string): string | null {
  switch (eventType) {
    case "activity.sent":
      return "sent";
    case "activity.delivered":
      return "delivered";
    case "activity.soft_bounced":
    case "activity.hard_bounced":
      return "bounced";
    case "activity.opened":
      return "opened";
    case "activity.clicked":
      return "clicked";
    case "activity.unsubscribed":
    case "activity.spam_complaint":
      return "complained";
    default:
      return null;
  }
}

/**
 * Simulates the campaign count recalculation logic.
 * Given a list of email statuses, compute aggregate counts.
 */
function computeCampaignCounts(statuses: string[]) {
  const sentStatuses = ["sent", "delivered", "opened", "clicked"];
  const deliveredStatuses = ["delivered", "opened", "clicked"];
  const openedStatuses = ["opened", "clicked"];

  return {
    sentCount: statuses.filter((s) => sentStatuses.includes(s)).length,
    deliveredCount: statuses.filter((s) => deliveredStatuses.includes(s)).length,
    openedCount: statuses.filter((s) => openedStatuses.includes(s)).length,
    clickedCount: statuses.filter((s) => s === "clicked").length,
    bouncedCount: statuses.filter((s) => s === "bounced").length,
  };
}

describe("Mailersend webhook event mapping", () => {
  it("should map sent event correctly", () => {
    expect(mapMailersendEventToStatus("activity.sent")).toBe("sent");
  });

  it("should map delivered event correctly", () => {
    expect(mapMailersendEventToStatus("activity.delivered")).toBe("delivered");
  });

  it("should map soft_bounced to bounced", () => {
    expect(mapMailersendEventToStatus("activity.soft_bounced")).toBe("bounced");
  });

  it("should map hard_bounced to bounced", () => {
    expect(mapMailersendEventToStatus("activity.hard_bounced")).toBe("bounced");
  });

  it("should map opened event correctly", () => {
    expect(mapMailersendEventToStatus("activity.opened")).toBe("opened");
  });

  it("should map clicked event correctly", () => {
    expect(mapMailersendEventToStatus("activity.clicked")).toBe("clicked");
  });

  it("should map unsubscribed to complained", () => {
    expect(mapMailersendEventToStatus("activity.unsubscribed")).toBe("complained");
  });

  it("should map spam_complaint to complained", () => {
    expect(mapMailersendEventToStatus("activity.spam_complaint")).toBe("complained");
  });

  it("should return null for unknown events", () => {
    expect(mapMailersendEventToStatus("activity.unknown")).toBeNull();
    expect(mapMailersendEventToStatus("random_event")).toBeNull();
    expect(mapMailersendEventToStatus("")).toBeNull();
  });
});

describe("Campaign count recalculation", () => {
  it("should count all statuses correctly for a mixed campaign", () => {
    const statuses = [
      "delivered",
      "delivered",
      "opened",
      "clicked",
      "bounced",
      "sent",
      "delivered",
    ];
    const counts = computeCampaignCounts(statuses);
    expect(counts.sentCount).toBe(6); // all except bounced
    expect(counts.deliveredCount).toBe(5); // 3 delivered + opened + clicked
    expect(counts.openedCount).toBe(2); // opened + clicked
    expect(counts.clickedCount).toBe(1);
    expect(counts.bouncedCount).toBe(1);
  });

  it("should return zeros for empty list", () => {
    const counts = computeCampaignCounts([]);
    expect(counts.sentCount).toBe(0);
    expect(counts.deliveredCount).toBe(0);
    expect(counts.openedCount).toBe(0);
    expect(counts.clickedCount).toBe(0);
    expect(counts.bouncedCount).toBe(0);
  });

  it("should handle all-bounced campaign", () => {
    const statuses = ["bounced", "bounced", "bounced"];
    const counts = computeCampaignCounts(statuses);
    expect(counts.sentCount).toBe(0);
    expect(counts.bouncedCount).toBe(3);
  });

  it("should handle perfect campaign (all clicked)", () => {
    const statuses = ["clicked", "clicked", "clicked"];
    const counts = computeCampaignCounts(statuses);
    expect(counts.sentCount).toBe(3);
    expect(counts.deliveredCount).toBe(3);
    expect(counts.openedCount).toBe(3);
    expect(counts.clickedCount).toBe(3);
    expect(counts.bouncedCount).toBe(0);
  });

  it("should not count failed/complained in sent", () => {
    const statuses = ["failed", "complained", "sent"];
    const counts = computeCampaignCounts(statuses);
    expect(counts.sentCount).toBe(1);
    expect(counts.deliveredCount).toBe(0);
  });
});
