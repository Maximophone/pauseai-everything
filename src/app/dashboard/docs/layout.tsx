"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsManifest } from "@/lib/docs-manifest";
import { cn } from "@/lib/utils";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-8">
      <nav className="w-56 shrink-0 hidden md:block">
        <div className="sticky top-4 space-y-6">
          {docsManifest.map((section) => (
            <div key={section.title}>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                {section.title}
              </h4>
              <ul className="space-y-1">
                {section.pages.map((page) => {
                  const href = `/dashboard/docs/${page.slug}`;
                  const isActive = pathname === href;
                  return (
                    <li key={page.slug}>
                      <Link
                        href={href}
                        className={cn(
                          "block text-sm px-3 py-1.5 rounded-md transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        )}
                      >
                        {page.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
