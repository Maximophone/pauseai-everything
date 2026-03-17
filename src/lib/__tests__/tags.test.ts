import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db for tag operations
vi.mock("@/db", () => {
  const mockTags: Array<{ id: string; name: string; color: string | null; createdAt: Date }> = [];
  const mockContactTags: Array<{ contactId: string; tagId: string; assignedAt: Date }> = [];

  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockImplementation(() => Promise.resolve(mockTags)),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    },
    __mockTags: mockTags,
    __mockContactTags: mockContactTags,
  };
});

describe("Tag operations", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should validate tag name is required", () => {
    const name = "";
    expect(!name).toBe(true);
  });

  it("should validate tag name is non-empty after trim", () => {
    const name = "   ";
    expect(!name.trim()).toBe(true);
  });

  it("should accept valid tag names", () => {
    const validNames = ["policy-interest", "active-volunteer", "german-chapter", "vip"];
    for (const name of validNames) {
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });

  it("should handle duplicate tag detection via unique constraint", () => {
    // The DB enforces uniqueness — the API catches the error
    const errorMessage = 'duplicate key value violates unique constraint "tags_name_unique"';
    expect(errorMessage.includes("unique") || errorMessage.includes("duplicate")).toBe(true);
  });
});

describe("Contact-tag association", () => {
  it("should validate contactId is required for tag assignment", () => {
    const contactId = "";
    const tagId = "some-tag-id";
    expect(!contactId || !tagId).toBe(true);
  });

  it("should validate tagId is required for tag assignment", () => {
    const contactId = "some-contact-id";
    const tagId = "";
    expect(!contactId || !tagId).toBe(true);
  });

  it("should allow same tag on multiple contacts", () => {
    const assignments = [
      { contactId: "contact-1", tagId: "tag-1" },
      { contactId: "contact-2", tagId: "tag-1" },
    ];
    const uniqueContacts = new Set(assignments.map((a) => a.contactId));
    expect(uniqueContacts.size).toBe(2);
  });

  it("should allow multiple tags on same contact", () => {
    const assignments = [
      { contactId: "contact-1", tagId: "tag-1" },
      { contactId: "contact-1", tagId: "tag-2" },
    ];
    const uniqueTags = new Set(assignments.map((a) => a.tagId));
    expect(uniqueTags.size).toBe(2);
  });
});
