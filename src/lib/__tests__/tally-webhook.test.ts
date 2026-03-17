import { describe, it, expect } from "vitest";

// Test the Tally field mapping logic (extracted as pure functions)

const DEFAULT_FIELD_MAP: Record<string, string> = {
  email: "_email",
  "email address": "_email",
  "e-mail": "_email",
  "first name": "_firstName",
  "firstname": "_firstName",
  "last name": "_lastName",
  "lastname": "_lastName",
  name: "_name",
  country: "country",
  chapter: "chapter",
  skills: "skills",
  "hours committed": "hours_committed",
  "hours per week": "hours_committed",
  motivation: "motivation_level",
  "motivation level": "motivation_level",
};

type TallyField = {
  key: string;
  label: string;
  type: string;
  value: unknown;
};

function mapTallyFields(fields: TallyField[], fieldMap: Record<string, string>) {
  let email: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  const customFields: Record<string, unknown> = {};

  for (const field of fields) {
    const mappedKey = fieldMap[field.label.toLowerCase()];
    if (!mappedKey) {
      customFields[`tally_${field.key}`] = field.value;
      continue;
    }

    switch (mappedKey) {
      case "_email":
        email = (field.value as string) || null;
        break;
      case "_firstName":
        firstName = (field.value as string) || null;
        break;
      case "_lastName":
        lastName = (field.value as string) || null;
        break;
      case "_name": {
        const parts = ((field.value as string) || "").trim().split(/\s+/);
        if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts.slice(1).join(" ");
        } else if (parts.length === 1) {
          firstName = parts[0];
        }
        break;
      }
      default:
        customFields[mappedKey] = field.value;
    }
  }

  return { email, firstName, lastName, customFields };
}

describe("Tally webhook field mapping", () => {
  it("should map standard fields correctly", () => {
    const fields: TallyField[] = [
      { key: "q1", label: "Email", type: "INPUT_EMAIL", value: "jane@example.com" },
      { key: "q2", label: "First Name", type: "INPUT_TEXT", value: "Jane" },
      { key: "q3", label: "Last Name", type: "INPUT_TEXT", value: "Doe" },
      { key: "q4", label: "Country", type: "INPUT_TEXT", value: "Germany" },
    ];

    const result = mapTallyFields(fields, DEFAULT_FIELD_MAP);
    expect(result.email).toBe("jane@example.com");
    expect(result.firstName).toBe("Jane");
    expect(result.lastName).toBe("Doe");
    expect(result.customFields.country).toBe("Germany");
  });

  it("should split full name into first/last", () => {
    const fields: TallyField[] = [
      { key: "q1", label: "Email", type: "INPUT_EMAIL", value: "jane@example.com" },
      { key: "q2", label: "Name", type: "INPUT_TEXT", value: "Jane Maria Doe" },
    ];

    const result = mapTallyFields(fields, DEFAULT_FIELD_MAP);
    expect(result.firstName).toBe("Jane");
    expect(result.lastName).toBe("Maria Doe");
  });

  it("should handle single name", () => {
    const fields: TallyField[] = [
      { key: "q1", label: "Email", type: "INPUT_EMAIL", value: "jane@example.com" },
      { key: "q2", label: "Name", type: "INPUT_TEXT", value: "Jane" },
    ];

    const result = mapTallyFields(fields, DEFAULT_FIELD_MAP);
    expect(result.firstName).toBe("Jane");
    expect(result.lastName).toBeNull();
  });

  it("should store unmapped fields with tally_ prefix", () => {
    const fields: TallyField[] = [
      { key: "q1", label: "Email", type: "INPUT_EMAIL", value: "jane@example.com" },
      { key: "q99", label: "How did you hear about us?", type: "INPUT_TEXT", value: "Twitter" },
    ];

    const result = mapTallyFields(fields, DEFAULT_FIELD_MAP);
    expect(result.customFields["tally_q99"]).toBe("Twitter");
  });

  it("should handle case-insensitive label matching", () => {
    const fields: TallyField[] = [
      { key: "q1", label: "EMAIL", type: "INPUT_EMAIL", value: "jane@example.com" },
      { key: "q2", label: "FIRST NAME", type: "INPUT_TEXT", value: "Jane" },
    ];

    const result = mapTallyFields(fields, DEFAULT_FIELD_MAP);
    expect(result.email).toBe("jane@example.com");
    expect(result.firstName).toBe("Jane");
  });

  it("should handle empty/null values gracefully", () => {
    const fields: TallyField[] = [
      { key: "q1", label: "Email", type: "INPUT_EMAIL", value: "jane@example.com" },
      { key: "q2", label: "First Name", type: "INPUT_TEXT", value: "" },
      { key: "q3", label: "Country", type: "INPUT_TEXT", value: null },
    ];

    const result = mapTallyFields(fields, DEFAULT_FIELD_MAP);
    expect(result.email).toBe("jane@example.com");
    expect(result.firstName).toBeNull();
    expect(result.customFields.country).toBeNull();
  });

  it("should map alternative email labels", () => {
    const fields: TallyField[] = [
      { key: "q1", label: "E-mail", type: "INPUT_EMAIL", value: "jane@example.com" },
    ];
    expect(mapTallyFields(fields, DEFAULT_FIELD_MAP).email).toBe("jane@example.com");

    const fields2: TallyField[] = [
      { key: "q1", label: "Email Address", type: "INPUT_EMAIL", value: "jane@example.com" },
    ];
    expect(mapTallyFields(fields2, DEFAULT_FIELD_MAP).email).toBe("jane@example.com");
  });
});

describe("CSV import mapping", () => {
  it("should validate that mapping requires at least one mapped field", () => {
    const mapping: Record<string, string | null> = {
      col1: null,
      col2: null,
    };
    const hasMappedFields = Object.values(mapping).some((v) => v !== null);
    expect(hasMappedFields).toBe(false);
  });

  it("should skip rows with no identifiable data", () => {
    const row = { col1: "", col2: "", col3: "" };
    const mapping = { col1: "_email", col2: "_firstName", col3: "_lastName" };

    let email: string | null = null;
    let firstName: string | null = null;
    let lastName: string | null = null;

    for (const [col, target] of Object.entries(mapping)) {
      const value = row[col as keyof typeof row]?.trim() || null;
      if (!value) continue;
      if (target === "_email") email = value;
      if (target === "_firstName") firstName = value;
      if (target === "_lastName") lastName = value;
    }

    expect(!email && !firstName && !lastName).toBe(true);
  });
});
