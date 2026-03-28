export type DocPage = {
  slug: string;
  title: string;
  file: string;
};

export type DocSection = {
  title: string;
  pages: DocPage[];
};

export const docsManifest: DocSection[] = [
  {
    title: "User Guide",
    pages: [
      { slug: "welcome", title: "Welcome & Overview", file: "user-guide/welcome.md" },
      { slug: "contacts", title: "Contacts", file: "user-guide/contacts.md" },
      { slug: "my-email-contacts", title: "My Email Contacts", file: "user-guide/my-email-contacts.md" },
      { slug: "email", title: "Email", file: "user-guide/email.md" },
      { slug: "automations", title: "Automations", file: "user-guide/automations.md" },
      { slug: "connections", title: "Connections & Sync", file: "user-guide/connections.md" },
      { slug: "support", title: "Support", file: "user-guide/support.md" },
      { slug: "settings", title: "Settings (Administration)", file: "user-guide/settings.md" },
    ],
  },
  {
    title: "Developer",
    pages: [
      { slug: "development", title: "Development Setup", file: "development.md" },
      { slug: "deployment", title: "Deployment", file: "deployment.md" },
      { slug: "architecture", title: "Architecture Overview", file: "architecture.md" },
      { slug: "workspaces", title: "Workspaces (Multi-Tenancy)", file: "workspaces.md" },
      { slug: "features", title: "Features", file: "features.md" },
    ],
  },
  {
    title: "Reference",
    pages: [
      { slug: "api-reference", title: "API Reference", file: "api-reference.md" },
      { slug: "build-plan", title: "Build Plan", file: "build-plan.md" },
      { slug: "future-features", title: "Future Features", file: "future-features.md" },
    ],
  },
];
