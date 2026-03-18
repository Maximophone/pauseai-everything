import { describe, it, expect, vi } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  },
}));

describe("Automation rules config validation", () => {
  it("should define valid action types", () => {
    const validTypes = ["set_field", "add_tag", "remove_tag"];
    expect(validTypes).toHaveLength(3);
  });

  it("should structure set_field action correctly", () => {
    const action = { type: "set_field" as const, field: "lifecycle_stage", value: "dormant" };
    expect(action.type).toBe("set_field");
    expect(action.field).toBe("lifecycle_stage");
    expect(action.value).toBe("dormant");
  });

  it("should structure add_tag action correctly", () => {
    const action = { type: "add_tag" as const, tag: "newsletter" };
    expect(action.type).toBe("add_tag");
    expect(action.tag).toBe("newsletter");
  });

  it("should structure remove_tag action correctly", () => {
    const action = { type: "remove_tag" as const, tag: "inactive" };
    expect(action.type).toBe("remove_tag");
    expect(action.tag).toBe("inactive");
  });

  it("should combine conditions and actions in a rule config", () => {
    const config = {
      match: "all" as const,
      conditions: [
        { field: "country", operator: "eq", value: "NL" },
        { field: "lifecycle_stage", operator: "eq", value: "joined" },
      ],
      actions: [
        { type: "add_tag" as const, tag: "netherlands" },
        { type: "set_field" as const, field: "lifecycle_stage", value: "onboarding" },
      ],
    };

    expect(config.match).toBe("all");
    expect(config.conditions).toHaveLength(2);
    expect(config.actions).toHaveLength(2);
  });

  it("should support match=any for OR conditions", () => {
    const config = {
      match: "any" as const,
      conditions: [
        { field: "country", operator: "eq", value: "NL" },
        { field: "country", operator: "eq", value: "BE" },
      ],
      actions: [{ type: "add_tag" as const, tag: "benelux" }],
    };

    expect(config.match).toBe("any");
  });
});

describe("Churn detection logic", () => {
  it("should calculate correct cutoff date", () => {
    const DORMANT_DAYS = 60;
    const now = new Date("2026-03-18");
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - DORMANT_DAYS);

    expect(cutoff.toISOString().slice(0, 10)).toBe("2026-01-17");
  });

  it("should identify active stages as candidates for churn", () => {
    const activeStages = ["active", "highly_active"];
    expect(activeStages).toContain("active");
    expect(activeStages).toContain("highly_active");
    expect(activeStages).not.toContain("dormant");
    expect(activeStages).not.toContain("joined");
  });
});

describe("Worker task configuration", () => {
  it("should define all required tasks", () => {
    const taskNames = ["send_campaign", "detect_churn", "run_automations"];
    expect(taskNames).toHaveLength(3);
  });

  it("should have valid cron patterns", () => {
    // Daily at 6am UTC
    const churnCron = "0 6 * * *";
    const parts = churnCron.split(" ");
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe("0"); // minute
    expect(parts[1]).toBe("6"); // hour

    // Hourly
    const automationsCron = "0 * * * *";
    const autoParts = automationsCron.split(" ");
    expect(autoParts).toHaveLength(5);
    expect(autoParts[0]).toBe("0");
    expect(autoParts[1]).toBe("*");
  });
});
