import { describe, it, expect } from "vitest";
import { AirtableCredentialsSchema } from "../connectors/airtable";
import type { ExternalField, FetchResult, ExternalResource, Connector } from "../connectors/types";

// ── Airtable credentials schema tests ──────────────────────

describe("AirtableCredentialsSchema", () => {
  it("accepts valid credentials", () => {
    const result = AirtableCredentialsSchema.safeParse({
      apiKey: "patXYZ123.abc",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty API key", () => {
    const result = AirtableCredentialsSchema.safeParse({
      apiKey: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing API key", () => {
    const result = AirtableCredentialsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ── Zod schema tests ───────────────────────────────────────

describe("Connection Zod schemas", () => {
  let CreateConnectionInput: typeof import("../schemas/connections").CreateConnectionInput;
  let CreateSyncConfigInput: typeof import("../schemas/connections").CreateSyncConfigInput;
  let UpdateSyncConfigInput: typeof import("../schemas/connections").UpdateSyncConfigInput;

  beforeAll(async () => {
    const mod = await import("../schemas/connections");
    CreateConnectionInput = mod.CreateConnectionInput;
    CreateSyncConfigInput = mod.CreateSyncConfigInput;
    UpdateSyncConfigInput = mod.UpdateSyncConfigInput;
  });

  it("validates CreateConnectionInput", () => {
    const valid = CreateConnectionInput.safeParse({
      name: "Test Connection",
      connectorType: "airtable",
      credentials: { apiKey: "pat123" },
    });
    expect(valid.success).toBe(true);
  });

  it("rejects invalid connector type", () => {
    const result = CreateConnectionInput.safeParse({
      name: "Test",
      connectorType: "invalid",
      credentials: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = CreateConnectionInput.safeParse({
      name: "",
      connectorType: "airtable",
      credentials: { apiKey: "pat123" },
    });
    expect(result.success).toBe(false);
  });

  it("validates CreateSyncConfigInput", () => {
    const result = CreateSyncConfigInput.safeParse({
      name: "My Sync",
      externalResource: { baseId: "appXYZ", tableId: "tblABC" },
      fieldMapping: {
        mappings: [
          {
            externalFieldId: "fld1",
            externalFieldName: "Email",
            crmTarget: "_email",
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects sync config with empty mappings", () => {
    const result = CreateSyncConfigInput.safeParse({
      name: "My Sync",
      externalResource: { baseId: "appXYZ", tableId: "tblABC" },
      fieldMapping: { mappings: [] },
    });
    expect(result.success).toBe(false);
  });

  it("applies default values for sync config", () => {
    const result = CreateSyncConfigInput.safeParse({
      name: "My Sync",
      externalResource: { baseId: "appXYZ", tableId: "tblABC" },
      fieldMapping: {
        mappings: [
          {
            externalFieldId: "fld1",
            externalFieldName: "Email",
            crmTarget: "_email",
          },
        ],
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.syncFrequency).toBe("manual");
      expect(result.data.duplicateStrategy).toBe("update");
    }
  });

  it("validates UpdateSyncConfigInput allows partial updates", () => {
    const result = UpdateSyncConfigInput.safeParse({
      syncFrequency: "daily",
    });
    expect(result.success).toBe(true);
  });

  it("validates sync frequency values", () => {
    for (const freq of ["manual", "hourly", "daily", "weekly"]) {
      const result = CreateSyncConfigInput.safeParse({
        name: "Test",
        externalResource: { baseId: "app1", tableId: "tbl1" },
        fieldMapping: {
          mappings: [
            { externalFieldId: "f1", externalFieldName: "Email", crmTarget: "_email" },
          ],
        },
        syncFrequency: freq,
      });
      expect(result.success).toBe(true);
    }

    const invalid = CreateSyncConfigInput.safeParse({
      name: "Test",
      externalResource: { baseId: "app1", tableId: "tbl1" },
      fieldMapping: {
        mappings: [
          { externalFieldId: "f1", externalFieldName: "Email", crmTarget: "_email" },
        ],
      },
      syncFrequency: "every_5_minutes",
    });
    expect(invalid.success).toBe(false);
  });
});

// ── Connector interface tests ──────────────────────────────

describe("Connector registry", () => {
  it("returns the Airtable connector", async () => {
    const { getConnector } = await import("../connectors");
    const connector = getConnector("airtable");
    expect(connector.type).toBe("airtable");
    expect(connector.label).toBe("Airtable");
  });

  it("throws for unknown connector type", async () => {
    const { getConnector } = await import("../connectors");
    expect(() => getConnector("unknown" as "airtable")).toThrow(
      "Unknown or unavailable connector type"
    );
  });
});

// ── CONNECTOR_TYPES metadata tests ─────────────────────────

describe("CONNECTOR_TYPES", () => {
  it("has airtable as available", async () => {
    const { CONNECTOR_TYPES } = await import("../connectors");
    const airtable = CONNECTOR_TYPES.find((c) => c.type === "airtable");
    expect(airtable).toBeDefined();
    expect(airtable!.available).toBe(true);
  });

  it("has notion as available", async () => {
    const { CONNECTOR_TYPES } = await import("../connectors");
    const notion = CONNECTOR_TYPES.find((c) => c.type === "notion");
    expect(notion).toBeDefined();
    expect(notion!.available).toBe(true);
  });
});

// ── DB schema type tests ───────────────────────────────────

describe("Connection schema types", () => {
  it("FieldMapping type has correct structure", async () => {
    // Just verify the types exist and can be imported
    const schema = await import("@/db/schema/connections");
    expect(schema.connections).toBeDefined();
    expect(schema.syncConfigurations).toBeDefined();
    expect(schema.syncRuns).toBeDefined();
  });
});
