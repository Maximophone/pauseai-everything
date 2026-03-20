import { z } from "zod";
import type {
  Connector,
  ExternalField,
  ExternalResource,
  ExternalRecord,
  FetchResult,
} from "./types";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const PAGE_SIZE = 100;

export const NotionCredentialsSchema = z.object({
  integrationToken: z.string().min(1, "Integration token is required"),
});

async function notionFetch(
  path: string,
  token: string,
  options: { method?: string; body?: unknown } = {}
): Promise<Response> {
  const { method = "GET", body } = options;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${NOTION_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") || "1");
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      lastError = new Error("Rate limited");
      continue;
    }

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Notion API error ${res.status}: ${errorBody}`);
    }

    return res;
  }

  throw lastError || new Error("Notion request failed after retries");
}

type NotionProperty = {
  id: string;
  name: string;
  type: string;
};

type NotionDatabase = {
  id: string;
  title: { plain_text: string }[];
  properties: Record<string, NotionProperty>;
};

type NotionPage = {
  id: string;
  properties: Record<string, NotionPropertyValue>;
};

type NotionPropertyValue = {
  type: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  number?: number | null;
  select?: { name: string } | null;
  multi_select?: { name: string }[];
  date?: { start: string } | null;
  checkbox?: boolean;
  email?: string | null;
  url?: string | null;
  phone_number?: string | null;
  people?: { name: string }[];
};

function extractNotionValue(prop: NotionPropertyValue): unknown {
  switch (prop.type) {
    case "title":
      return prop.title?.map((t) => t.plain_text).join("") || "";
    case "rich_text":
      return prop.rich_text?.map((t) => t.plain_text).join("") || "";
    case "number":
      return prop.number ?? null;
    case "select":
      return prop.select?.name || null;
    case "multi_select":
      return prop.multi_select?.map((s) => s.name).join(", ") || null;
    case "date":
      return prop.date?.start || null;
    case "checkbox":
      return prop.checkbox ?? false;
    case "email":
      return prop.email || null;
    case "url":
      return prop.url || null;
    case "phone_number":
      return prop.phone_number || null;
    case "people":
      return prop.people?.map((p) => p.name).join(", ") || null;
    default:
      return null;
  }
}

export class NotionConnector implements Connector {
  type = "notion" as const;
  label = "Notion";
  credentialsSchema = NotionCredentialsSchema;

  async testConnection(credentials: Record<string, unknown>): Promise<string> {
    const { integrationToken } = NotionCredentialsSchema.parse(credentials);
    const res = await notionFetch("/users/me", integrationToken);
    const data = (await res.json()) as { bot: { owner: { type: string } } };
    return `Connected as ${data.bot?.owner?.type || "integration"}.`;
  }

  async listResources(credentials: Record<string, unknown>): Promise<ExternalResource[]> {
    const { integrationToken } = NotionCredentialsSchema.parse(credentials);

    // Search for all databases the integration can access
    const res = await notionFetch("/search", integrationToken, {
      method: "POST",
      body: {
        filter: { value: "database", property: "object" },
        page_size: 100,
      },
    });

    const data = (await res.json()) as {
      results: NotionDatabase[];
    };

    return data.results.map((db) => ({
      id: JSON.stringify({ databaseId: db.id }),
      name: db.title.map((t) => t.plain_text).join("") || "Untitled",
    }));
  }

  async getSchema(
    credentials: Record<string, unknown>,
    resource: Record<string, unknown>
  ): Promise<ExternalField[]> {
    const { integrationToken } = NotionCredentialsSchema.parse(credentials);
    const { databaseId } = resource as { databaseId: string };

    const res = await notionFetch(`/databases/${databaseId}`, integrationToken);
    const data = (await res.json()) as NotionDatabase;

    return Object.entries(data.properties).map(([name, prop]) => ({
      id: prop.id,
      name,
      type: prop.type,
    }));
  }

  async fetchRecords(
    credentials: Record<string, unknown>,
    resource: Record<string, unknown>,
    cursor?: string
  ): Promise<FetchResult> {
    const { integrationToken } = NotionCredentialsSchema.parse(credentials);
    const { databaseId } = resource as { databaseId: string };

    const body: Record<string, unknown> = {
      page_size: PAGE_SIZE,
    };
    if (cursor) {
      body.start_cursor = cursor;
    }

    const res = await notionFetch(
      `/databases/${databaseId}/query`,
      integrationToken,
      { method: "POST", body }
    );

    const data = (await res.json()) as {
      results: NotionPage[];
      has_more: boolean;
      next_cursor: string | null;
    };

    const records: ExternalRecord[] = data.results.map((page) => {
      const fields: Record<string, unknown> = {};
      for (const [name, prop] of Object.entries(page.properties)) {
        // Use the property name as the field key (Notion property IDs are opaque)
        // We also store by property ID for matching
        const propDef = prop as NotionPropertyValue & { id?: string };
        if (propDef.id) {
          fields[propDef.id] = extractNotionValue(prop);
        }
        fields[name] = extractNotionValue(prop);
      }
      return {
        externalId: page.id,
        fields,
      };
    });

    return {
      records,
      cursor: data.has_more && data.next_cursor ? data.next_cursor : undefined,
    };
  }
}
