import { listFieldDefinitions } from "@/lib/contacts";
import { listCategories } from "@/lib/communication-categories";
import { ContactsTable } from "@/components/contacts-table";
import { AddContactButton } from "@/components/add-contact-button";

export default async function ContactsPage() {
  const [fields, categories] = await Promise.all([
    listFieldDefinitions(),
    listCategories(),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Contacts</h2>
          <p className="text-muted-foreground mt-1">
            Manage your volunteers, stakeholders, and network.
          </p>
        </div>
        <AddContactButton />
      </div>
      <div className="mt-4">
        <ContactsTable
          fieldDefinitions={JSON.parse(JSON.stringify(fields))}
          categories={JSON.parse(JSON.stringify(categories))}
        />
      </div>
    </div>
  );
}
