import { describe, it, expect, vi } from "vitest";

// We test the pure logic of buildSegmentWhere without hitting the DB
// by importing the function and checking the generated SQL fragments

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

describe("Segment query builder", () => {
  let buildSegmentWhere: typeof import("@/lib/segments").buildSegmentWhere;

  beforeAll(async () => {
    const mod = await import("@/lib/segments");
    buildSegmentWhere = mod.buildSegmentWhere;
  });

  it("should return undefined for empty conditions", () => {
    const result = buildSegmentWhere({ match: "all", conditions: [] });
    expect(result).toBeUndefined();
  });

  it("should build an eq condition on a core field", () => {
    const result = buildSegmentWhere({
      match: "all",
      conditions: [{ field: "email", operator: "eq", value: "test@example.com" }],
    });
    expect(result).toBeDefined();
    // The SQL object should exist (we can't easily inspect the exact SQL without executing)
    expect(result?.queryChunks).toBeDefined();
  });

  it("should build a contains condition on a custom field", () => {
    const result = buildSegmentWhere({
      match: "all",
      conditions: [{ field: "country", operator: "contains", value: "Neth" }],
    });
    expect(result).toBeDefined();
  });

  it("should build a tag has condition", () => {
    const result = buildSegmentWhere({
      match: "all",
      conditions: [{ field: "tag", operator: "has", value: "newsletter" }],
    });
    expect(result).toBeDefined();
  });

  it("should build a tag not_has condition", () => {
    const result = buildSegmentWhere({
      match: "all",
      conditions: [{ field: "tag", operator: "not_has", value: "unsubscribed" }],
    });
    expect(result).toBeDefined();
  });

  it("should combine multiple conditions with AND for match=all", () => {
    const result = buildSegmentWhere({
      match: "all",
      conditions: [
        { field: "email", operator: "eq", value: "a@b.com" },
        { field: "first_name", operator: "contains", value: "John" },
      ],
    });
    expect(result).toBeDefined();
  });

  it("should combine multiple conditions with OR for match=any", () => {
    const result = buildSegmentWhere({
      match: "any",
      conditions: [
        { field: "email", operator: "eq", value: "a@b.com" },
        { field: "first_name", operator: "contains", value: "John" },
      ],
    });
    expect(result).toBeDefined();
  });

  it("should handle is_set operator", () => {
    const result = buildSegmentWhere({
      match: "all",
      conditions: [{ field: "email", operator: "is_set", value: "" }],
    });
    expect(result).toBeDefined();
  });

  it("should handle is_not_set operator", () => {
    const result = buildSegmentWhere({
      match: "all",
      conditions: [{ field: "country", operator: "is_not_set", value: "" }],
    });
    expect(result).toBeDefined();
  });

  it("should handle in operator with array value", () => {
    const result = buildSegmentWhere({
      match: "all",
      conditions: [{ field: "lifecycle_stage", operator: "in", value: ["active", "highly_active"] }],
    });
    expect(result).toBeDefined();
  });

  it("should return null for in operator with empty array", () => {
    const result = buildSegmentWhere({
      match: "all",
      conditions: [{ field: "lifecycle_stage", operator: "in", value: [] }],
    });
    // Empty array means no valid conditions
    expect(result).toBeUndefined();
  });

  it("should handle date operators (after/before)", () => {
    const resultAfter = buildSegmentWhere({
      match: "all",
      conditions: [{ field: "created_at", operator: "after", value: "2025-01-01" }],
    });
    expect(resultAfter).toBeDefined();

    const resultBefore = buildSegmentWhere({
      match: "all",
      conditions: [{ field: "created_at", operator: "before", value: "2025-12-31" }],
    });
    expect(resultBefore).toBeDefined();
  });

  it("should handle numeric operators (gt, gte, lt, lte)", () => {
    const ops = ["gt", "gte", "lt", "lte"];
    for (const op of ops) {
      const result = buildSegmentWhere({
        match: "all",
        conditions: [{ field: "hours_committed", operator: op, value: "10" }],
      });
      expect(result).toBeDefined();
    }
  });

  it("should skip conditions with unknown operators", () => {
    const result = buildSegmentWhere({
      match: "all",
      conditions: [{ field: "email", operator: "unknown_op", value: "test" }],
    });
    expect(result).toBeUndefined();
  });
});

describe("Mailersend template rendering", () => {
  let renderTemplate: typeof import("@/lib/mailersend").renderTemplate;

  beforeAll(async () => {
    const mod = await import("@/lib/mailersend");
    renderTemplate = mod.renderTemplate;
  });

  it("should replace merge fields", () => {
    const result = renderTemplate("Hi {{firstName}}!", { firstName: "Alice" });
    expect(result).toBe("Hi Alice!");
  });

  it("should replace multiple merge fields", () => {
    const result = renderTemplate(
      "{{firstName}} {{lastName}} from {{country}}",
      { firstName: "Bob", lastName: "Smith", country: "Netherlands" }
    );
    expect(result).toBe("Bob Smith from Netherlands");
  });

  it("should replace missing fields with empty string", () => {
    const result = renderTemplate("Hi {{firstName}}!", {});
    expect(result).toBe("Hi !");
  });

  it("should handle null values", () => {
    const result = renderTemplate("Hi {{firstName}}!", { firstName: null });
    expect(result).toBe("Hi !");
  });

  it("should join array values with commas", () => {
    const result = renderTemplate("Skills: {{skills}}", {
      skills: ["policy", "design"],
    });
    expect(result).toBe("Skills: policy, design");
  });

  it("should leave text without merge fields unchanged", () => {
    const result = renderTemplate("No fields here.", { firstName: "Alice" });
    expect(result).toBe("No fields here.");
  });
});
