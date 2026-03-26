"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export function DocRenderer({ content, title }: { content: string; title: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight mb-1">{title}</h2>
      <article className="prose prose-neutral dark:prose-invert max-w-none mt-6 prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-border prose-code:before:content-none prose-code:after:content-none prose-thead:border-border prose-tr:border-border">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
