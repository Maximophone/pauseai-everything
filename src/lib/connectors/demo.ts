import { z } from "zod";
import type {
  Connector,
  ExternalField,
  ExternalResource,
  FetchResult,
} from "./types";

export const DemoCredentialsSchema = z.object({});

const DEMO_FIELDS: ExternalField[] = [
  { id: "demo_email", name: "Email Address", type: "email" },
  { id: "demo_first", name: "First Name", type: "singleLineText" },
  { id: "demo_last", name: "Last Name", type: "singleLineText" },
  { id: "demo_country", name: "Country", type: "singleLineText" },
  { id: "demo_joined", name: "Date Joined", type: "date" },
  { id: "demo_active", name: "Is Active", type: "checkbox" },
  { id: "demo_notes", name: "Notes", type: "multilineText" },
  { id: "demo_score", name: "Engagement Score", type: "number" },
];

const DEMO_RECORDS = [
  { Email: "alice@example.com", First: "Alice", Last: "Martin", Country: "France", Joined: "2026-01-15", Active: true, Notes: "Attended 3 events", Score: 85 },
  { Email: "bob@example.com", First: "Bob", Last: "Schmidt", Country: "Germany", Joined: "2026-02-01", Active: true, Notes: "Chapter lead", Score: 95 },
  { Email: "carol@example.com", First: "Carol", Last: "Silva", Country: "Brazil", Joined: "2026-01-20", Active: false, Notes: "Dormant since Feb", Score: 20 },
  { Email: "david@example.com", First: "David", Last: "Nakamura", Country: "Japan", Joined: "2026-03-01", Active: true, Notes: "", Score: 60 },
  { Email: "elena@example.com", First: "Elena", Last: "Petrov", Country: "Netherlands", Joined: "2025-11-10", Active: true, Notes: "Core volunteer, helps with comms", Score: 90 },
  { Email: "fatima@example.com", First: "Fatima", Last: "Al-Rashid", Country: "UK", Joined: "2026-02-14", Active: true, Notes: "Journalist contact", Score: 70 },
  { Email: "george@example.com", First: "George", Last: "Papadopoulos", Country: "Greece", Joined: "2026-03-10", Active: true, Notes: "New joiner", Score: 40 },
  { Email: "", First: "Unknown", Last: "Person", Country: "??", Joined: "", Active: false, Notes: "No email — should be skipped", Score: 0 },
];

/**
 * A demo connector that returns fake data. Available in development only.
 * Useful for testing the sync flow without a real external API.
 */
export class DemoConnector implements Connector {
  type = "demo" as const;
  label = "Demo (Test Data)";
  credentialsSchema = DemoCredentialsSchema;

  async testConnection(): Promise<string> {
    return "Demo connector ready. Returns 8 sample contacts.";
  }

  async listResources(): Promise<ExternalResource[]> {
    return [
      { id: JSON.stringify({ tableId: "demo_volunteers" }), name: "Demo Volunteers" },
      { id: JSON.stringify({ tableId: "demo_stakeholders" }), name: "Demo Stakeholders" },
    ];
  }

  async getSchema(): Promise<ExternalField[]> {
    return DEMO_FIELDS;
  }

  async fetchRecords(
    _credentials: Record<string, unknown>,
    _resource: Record<string, unknown>,
    cursor?: string
  ): Promise<FetchResult> {
    // Return all records in one page (no pagination needed for demo)
    if (cursor) return { records: [] };

    const fieldKeyMap: Record<string, string> = {
      Email: "demo_email",
      First: "demo_first",
      Last: "demo_last",
      Country: "demo_country",
      Joined: "demo_joined",
      Active: "demo_active",
      Notes: "demo_notes",
      Score: "demo_score",
    };

    return {
      records: DEMO_RECORDS.map((r, i) => ({
        externalId: `demo_${i}`,
        fields: Object.fromEntries(
          Object.entries(r).map(([k, v]) => [fieldKeyMap[k] || k, v])
        ),
      })),
    };
  }
}
