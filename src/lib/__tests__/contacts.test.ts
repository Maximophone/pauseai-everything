import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll test validateCustomFields by mocking the DB call
// and test the pure logic

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
    $dynamic: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([]),
  },
}));

// Mock field definitions for validation tests
const mockFieldDefinitions = [
  {
    id: "1",
    name: "lifecycle_stage",
    label: "Lifecycle Stage",
    fieldType: "select",
    options: ["joined", "onboarding", "active", "dormant"],
    required: true,
    sortOrder: 1,
    createdAt: new Date(),
  },
  {
    id: "2",
    name: "country",
    label: "Country",
    fieldType: "text",
    options: null,
    required: false,
    sortOrder: 2,
    createdAt: new Date(),
  },
  {
    id: "3",
    name: "hours_committed",
    label: "Hours Committed",
    fieldType: "number",
    options: null,
    required: false,
    sortOrder: 3,
    createdAt: new Date(),
  },
  {
    id: "4",
    name: "skills",
    label: "Skills",
    fieldType: "multiselect",
    options: ["policy", "communications", "design"],
    required: false,
    sortOrder: 4,
    createdAt: new Date(),
  },
  {
    id: "5",
    name: "is_active",
    label: "Is Active",
    fieldType: "boolean",
    options: null,
    required: false,
    sortOrder: 5,
    createdAt: new Date(),
  },
];

describe("validateCustomFields", () => {
  let validateCustomFields: typeof import("@/lib/contacts").validateCustomFields;

  beforeEach(async () => {
    // Re-import to get fresh module with mocks
    vi.resetModules();

    // Setup mock for listFieldDefinitions (which calls db.select().from().orderBy())
    const dbMock = await import("@/db");
    const mockDb = dbMock.db as unknown as {
      select: ReturnType<typeof vi.fn>;
      from: ReturnType<typeof vi.fn>;
      orderBy: ReturnType<typeof vi.fn>;
    };
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.orderBy.mockResolvedValue(mockFieldDefinitions);

    const mod = await import("@/lib/contacts");
    validateCustomFields = mod.validateCustomFields;
  });

  it("should pass with valid fields", async () => {
    const result = await validateCustomFields({
      lifecycle_stage: "active",
      country: "Germany",
      hours_committed: 5,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail when a required field is missing", async () => {
    const result = await validateCustomFields({
      country: "Germany",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Field "Lifecycle Stage" is required.');
  });

  it("should fail when a select field has an invalid value", async () => {
    const result = await validateCustomFields({
      lifecycle_stage: "invalid_stage",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("must be one of");
  });

  it("should fail when a number field gets a string", async () => {
    const result = await validateCustomFields({
      lifecycle_stage: "active",
      hours_committed: "five" as unknown as number,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Field "Hours Committed" must be a number.');
  });

  it("should fail when a multiselect field has invalid values", async () => {
    const result = await validateCustomFields({
      lifecycle_stage: "active",
      skills: ["policy", "hacking"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("invalid values: hacking");
  });

  it("should fail when a multiselect field is not an array", async () => {
    const result = await validateCustomFields({
      lifecycle_stage: "active",
      skills: "policy" as unknown as string[],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Field "Skills" must be an array.');
  });

  it("should fail when a boolean field gets a string", async () => {
    const result = await validateCustomFields({
      lifecycle_stage: "active",
      is_active: "yes" as unknown as boolean,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Field "Is Active" must be a boolean.');
  });

  it("should pass when optional fields are omitted", async () => {
    const result = await validateCustomFields({
      lifecycle_stage: "joined",
    });
    expect(result.valid).toBe(true);
  });

  it("should pass when optional fields are null", async () => {
    const result = await validateCustomFields({
      lifecycle_stage: "active",
      country: null as unknown as string,
      hours_committed: null as unknown as number,
    });
    expect(result.valid).toBe(true);
  });

  it("should collect multiple errors", async () => {
    const result = await validateCustomFields({
      // missing required lifecycle_stage
      hours_committed: "not a number" as unknown as number,
      skills: "not an array" as unknown as string[],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
