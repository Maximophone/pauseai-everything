import { z } from "zod";
import type {
  Connector,
  ExternalField,
  ExternalResource,
  ExternalRecord,
  FetchResult,
} from "./types";

const AIRTABLE_API = "https://api.airtable.com/v0";
const PAGE_SIZE = 100;
const RATE_LIMIT_DELAY = 220; // ms between requests (Airtable allows 5 req/s)

export const AirtableCredentialsSchema = z.object({
  apiKey: z.string().min(1, "Personal Access Token is required"),
});

async function airtableFetch(
  path: string,
  apiKey: string,
  params?: Record<string, string>
): Promise<Response> {
  const url = new URL(`${AIRTABLE_API}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") || "1");
      await sleep(retryAfter * 1000);
      lastError = new Error("Rate limited");
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable API error ${res.status}: ${body}`);
    }

    return res;
  }

  throw lastError || new Error("Airtable request failed after retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapAirtableFieldType(airtableType: string): string {
  // Keep the original Airtable type for display; CRM coercion handles conversion
  return airtableType;
}

export class AirtableConnector implements Connector {
  type = "airtable" as const;
  label = "Airtable";
  credentialsSchema = AirtableCredentialsSchema;

  async testConnection(credentials: Record<string, unknown>): Promise<string> {
    const { apiKey } = AirtableCredentialsSchema.parse(credentials);
    const res = await airtableFetch("/meta/bases", apiKey, { pageSize: "1" });
    const data = (await res.json()) as { bases: { id: string; name: string }[] };
    return `Connected. Found ${data.bases.length} base(s).`;
  }

  async listResources(credentials: Record<string, unknown>): Promise<ExternalResource[]> {
    const { apiKey } = AirtableCredentialsSchema.parse(credentials);

    // Fetch all bases
    const basesRes = await airtableFetch("/meta/bases", apiKey);
    const basesData = (await basesRes.json()) as {
      bases: { id: string; name: string }[];
    };

    // For each base, fetch tables
    const resources: ExternalResource[] = [];
    for (const base of basesData.bases) {
      await sleep(RATE_LIMIT_DELAY);
      const tablesRes = await airtableFetch(`/meta/bases/${base.id}/tables`, apiKey);
      const tablesData = (await tablesRes.json()) as {
        tables: { id: string; name: string }[];
      };
      for (const table of tablesData.tables) {
        resources.push({
          id: JSON.stringify({ baseId: base.id, tableId: table.id }),
          name: `${base.name} → ${table.name}`,
        });
      }
    }

    return resources;
  }

  async getSchema(
    credentials: Record<string, unknown>,
    resource: Record<string, unknown>
  ): Promise<ExternalField[]> {
    const { apiKey } = AirtableCredentialsSchema.parse(credentials);
    const { baseId, tableId } = resource as { baseId: string; tableId: string };

    const res = await airtableFetch(`/meta/bases/${baseId}/tables`, apiKey);
    const data = (await res.json()) as {
      tables: {
        id: string;
        name: string;
        fields: { id: string; name: string; type: string }[];
      }[];
    };

    const table = data.tables.find((t) => t.id === tableId);
    if (!table) {
      throw new Error(`Table ${tableId} not found in base ${baseId}`);
    }

    return table.fields.map((f) => ({
      id: f.id,
      name: f.name,
      type: mapAirtableFieldType(f.type),
    }));
  }

  async fetchRecords(
    credentials: Record<string, unknown>,
    resource: Record<string, unknown>,
    cursor?: string
  ): Promise<FetchResult> {
    const { apiKey } = AirtableCredentialsSchema.parse(credentials);
    const { baseId, tableId } = resource as { baseId: string; tableId: string };

    const params: Record<string, string> = {
      pageSize: String(PAGE_SIZE),
    };
    if (cursor) {
      params.offset = cursor;
    }

    if (cursor) {
      // Rate limit between pages
      await sleep(RATE_LIMIT_DELAY);
    }

    const res = await airtableFetch(`/${baseId}/${tableId}`, apiKey, params);
    const data = (await res.json()) as {
      records: { id: string; fields: Record<string, unknown> }[];
      offset?: string;
    };

    const records: ExternalRecord[] = data.records.map((r) => ({
      externalId: r.id,
      fields: r.fields,
    }));

    return {
      records,
      cursor: data.offset,
    };
  }
}
