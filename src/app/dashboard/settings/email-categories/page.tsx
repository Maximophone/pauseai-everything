import { listCategories } from "@/lib/communication-categories";
import { getAllSettings } from "@/lib/app-settings";
import { CategoriesManager } from "@/components/categories-manager";
import { EmailSettings } from "@/components/email-settings";
import { getServerWorkspaceId } from "@/lib/workspace-server";

export default async function EmailCategoriesPage() {
  const workspaceId = await getServerWorkspaceId();
  const [categories, settings] = await Promise.all([
    listCategories(workspaceId),
    getAllSettings(),
  ]);

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Email Categories</h2>
      <p className="text-muted-foreground mt-1">
        Manage the types of emails contacts can subscribe/unsubscribe from.
        Campaigns assigned a category will include an unsubscribe link and
        respect contact preferences.
      </p>
      <div className="mt-6">
        <CategoriesManager
          initialCategories={JSON.parse(JSON.stringify(categories))}
        />
      </div>

      <h3 className="text-xl font-bold tracking-tight mt-10">Email Settings</h3>
      <div className="mt-4">
        <EmailSettings initialSettings={settings} />
      </div>
    </div>
  );
}
