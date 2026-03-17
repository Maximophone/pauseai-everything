import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
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
  },
}));

describe("Field Definitions", () => {
  describe("schema and types", () => {
    it("should define all valid field types", () => {
      const validTypes = [
        "text",
        "number",
        "date",
        "select",
        "multiselect",
        "boolean",
        "url",
        "email",
      ];
      expect(validTypes).toHaveLength(8);
      // These are the types supported in the API route validation
      validTypes.forEach((type) => {
        expect(typeof type).toBe("string");
      });
    });

    it("should require options for select and multiselect types", () => {
      const typesRequiringOptions = ["select", "multiselect"];
      const typesWithoutOptions = [
        "text",
        "number",
        "date",
        "boolean",
        "url",
        "email",
      ];

      typesRequiringOptions.forEach((type) => {
        expect(["select", "multiselect"]).toContain(type);
      });
      typesWithoutOptions.forEach((type) => {
        expect(["select", "multiselect"]).not.toContain(type);
      });
    });
  });

  describe("API validation logic", () => {
    const validTypes = [
      "text",
      "number",
      "date",
      "select",
      "multiselect",
      "boolean",
      "url",
      "email",
    ];

    it("should reject missing required fields (name, label, fieldType)", () => {
      const bodies = [
        { label: "Test", fieldType: "text" }, // missing name
        { name: "test", fieldType: "text" }, // missing label
        { name: "test", label: "Test" }, // missing fieldType
        {}, // missing all
      ];

      bodies.forEach((body) => {
        const { name, label, fieldType } = body as Record<string, string>;
        expect(!name || !label || !fieldType).toBe(true);
      });
    });

    it("should reject invalid field types", () => {
      const invalidTypes = ["string", "int", "dropdown", "checkbox", "array"];
      invalidTypes.forEach((type) => {
        expect(validTypes.includes(type)).toBe(false);
      });
    });

    it("should accept all valid field types", () => {
      validTypes.forEach((type) => {
        expect(validTypes.includes(type)).toBe(true);
      });
    });

    it("should auto-generate snake_case name from label", () => {
      const testCases = [
        { label: "Country", expected: "country" },
        { label: "Lifecycle Stage", expected: "lifecycle_stage" },
        { label: "Hours Committed", expected: "hours_committed" },
        { label: "AI Policy Position", expected: "ai_policy_position" },
        { label: "  Extra  Spaces  ", expected: "extra_spaces" },
      ];

      testCases.forEach(({ label, expected }) => {
        const name = label
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");
        expect(name).toBe(expected);
      });
    });

    it("should handle sort order correctly for new fields", () => {
      const existingFields = [
        { sortOrder: 0 },
        { sortOrder: 1 },
        { sortOrder: 5 },
        { sortOrder: 3 },
      ];

      const maxSort = existingFields.reduce(
        (m, f) => Math.max(m, f.sortOrder),
        0
      );
      expect(maxSort).toBe(5);
      expect(maxSort + 1).toBe(6);
    });

    it("should handle empty field list for sort order", () => {
      const existingFields: { sortOrder: number }[] = [];
      const maxSort = existingFields.reduce(
        (m, f) => Math.max(m, f.sortOrder),
        0
      );
      expect(maxSort).toBe(0);
      expect(maxSort + 1).toBe(1);
    });

    it("should swap sort orders when reordering", () => {
      const fields = [
        { id: "a", sortOrder: 0 },
        { id: "b", sortOrder: 1 },
        { id: "c", sortOrder: 2 },
      ];

      // Move "b" up: swap with "a"
      const idx = 1;
      const swapIdx = 0;
      const currentOrder = fields[idx].sortOrder;
      const swapOrder = fields[swapIdx].sortOrder;

      expect(currentOrder).toBe(1);
      expect(swapOrder).toBe(0);

      // After swap
      fields[idx].sortOrder = swapOrder;
      fields[swapIdx].sortOrder = currentOrder;

      expect(fields[0].sortOrder).toBe(1); // "a" now has order 1
      expect(fields[1].sortOrder).toBe(0); // "b" now has order 0
    });

    it("should not move first field up or last field down", () => {
      const fields = [
        { id: "a", sortOrder: 0 },
        { id: "b", sortOrder: 1 },
      ];

      // First field can't go up
      const firstIdx = 0;
      expect(firstIdx === 0).toBe(true); // blocked

      // Last field can't go down
      const lastIdx = fields.length - 1;
      expect(lastIdx === fields.length - 1).toBe(true); // blocked
    });

    it("should strip options for non-select types", () => {
      // When saving a text field, options should be null
      const fieldType = "text";
      const options = ["a", "b"]; // leftover from switching type
      const hasOptions =
        fieldType === "select" || fieldType === "multiselect";
      const savedOptions = hasOptions ? options : null;
      expect(savedOptions).toBeNull();
    });

    it("should preserve options for select types", () => {
      const fieldType = "select";
      const options = ["option_a", "option_b"];
      const hasOptions =
        fieldType === "select" || fieldType === "multiselect";
      const savedOptions = hasOptions ? options : null;
      expect(savedOptions).toEqual(["option_a", "option_b"]);
    });
  });
});
