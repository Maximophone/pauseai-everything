import { z } from "zod";

export type ConnectorType = "airtable" | "notion" | "google_sheets" | "mailchimp" | "demo";

export type ExternalField = {
  id: string;
  name: string;
  type: string;
};

export type ExternalResource = {
  id: string;
  name: string;
};

export type ExternalRecord = {
  externalId: string;
  fields: Record<string, unknown>;
};

export type FetchResult = {
  records: ExternalRecord[];
  cursor?: string; // undefined = no more pages
};

export interface Connector {
  type: ConnectorType;
  label: string;
  credentialsSchema: z.ZodType;

  /** Validate credentials. Returns a human-readable success message. Throws on failure. */
  testConnection(credentials: Record<string, unknown>): Promise<string>;

  /** List available tables/databases the user can sync from. */
  listResources(credentials: Record<string, unknown>): Promise<ExternalResource[]>;

  /** Fetch the schema (field list) of a specific resource. */
  getSchema(
    credentials: Record<string, unknown>,
    resource: Record<string, unknown>
  ): Promise<ExternalField[]>;

  /** Fetch records with cursor-based pagination. */
  fetchRecords(
    credentials: Record<string, unknown>,
    resource: Record<string, unknown>,
    cursor?: string
  ): Promise<FetchResult>;
}

export const CONNECTOR_TYPES: { type: ConnectorType; label: string; available: boolean; devOnly?: boolean }[] = [
  { type: "airtable", label: "Airtable", available: true },
  { type: "notion", label: "Notion", available: true },
  { type: "google_sheets", label: "Google Sheets", available: false },
  { type: "mailchimp", label: "Mailchimp", available: false },
  { type: "demo", label: "Demo (Test Data)", available: true, devOnly: true },
];
