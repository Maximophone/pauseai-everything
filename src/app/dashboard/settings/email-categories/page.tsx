import { listCategories } from "@/lib/communication-categories";
import { CategoriesManager } from "@/components/categories-manager";

export default async function EmailCategoriesPage() {
  const categories = await listCategories();

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
    </div>
  );
}
