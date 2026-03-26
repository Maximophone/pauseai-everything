import { redirect } from "next/navigation";
import { docsManifest } from "@/lib/docs-manifest";

export default function DocsIndexPage() {
  const firstPage = docsManifest[0]?.pages[0];
  if (firstPage) {
    redirect(`/dashboard/docs/${firstPage.slug}`);
  }
  return null;
}
