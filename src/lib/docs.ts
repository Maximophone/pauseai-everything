import fs from "fs";
import path from "path";
import { docsManifest, type DocPage } from "./docs-manifest";

const DOCS_DIR = path.join(process.cwd(), "docs");

const allPages = docsManifest.flatMap((s) => s.pages);

export function getDocContent(slug: string): { content: string; page: DocPage } | null {
  const page = allPages.find((p) => p.slug === slug);
  if (!page) return null;

  const filePath = path.join(DOCS_DIR, page.file);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, "utf-8");
  return { content, page };
}

export function getAllDocSlugs(): string[] {
  return allPages.map((p) => p.slug);
}
