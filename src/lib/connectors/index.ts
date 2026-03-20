import type { Connector, ConnectorType } from "./types";
import { AirtableConnector } from "./airtable";
import { NotionConnector } from "./notion";
import { DemoConnector } from "./demo";

const connectors: Record<string, Connector> = {
  airtable: new AirtableConnector(),
  notion: new NotionConnector(),
  demo: new DemoConnector(),
};

export function getConnector(type: ConnectorType): Connector {
  const c = connectors[type];
  if (!c) throw new Error(`Unknown or unavailable connector type: ${type}`);
  return c;
}

export { CONNECTOR_TYPES } from "./types";
export type { Connector, ConnectorType, ExternalField, ExternalResource, ExternalRecord, FetchResult } from "./types";
