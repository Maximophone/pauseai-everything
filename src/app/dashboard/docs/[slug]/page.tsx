import { notFound } from "next/navigation";
import { getDocContent, getAllDocSlugs } from "@/lib/docs";
import { DocRenderer } from "@/components/doc-renderer";

export function generateStaticParams() {
  return getAllDocSlugs().map((slug) => ({ slug }));
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDocContent(slug);
  if (!doc) notFound();

  return <DocRenderer content={doc.content} title={doc.page.title} />;
}
