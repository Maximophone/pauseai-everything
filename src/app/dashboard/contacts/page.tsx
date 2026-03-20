import { listContacts, listFieldDefinitions } from "@/lib/contacts";
import { getTagsForContacts } from "@/lib/tags";
import { listCategories } from "@/lib/communication-categories";
import { ContactsTable } from "@/components/contacts-table";
import { AddContactButton } from "@/components/add-contact-button";

export default async function ContactsPage() {
  const [contactsResult, fields, categories] = await Promise.all([
    listContacts({ pageSize: 200 }),
    listFieldDefinitions(),
    listCategories(),
  ]);

  const contactIds = contactsResult.contacts.map((c) => c.id);
  const tagsMap = await getTagsForContacts(contactIds);

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
          initialContacts={JSON.parse(JSON.stringify(contactsResult.contacts))}
          fieldDefinitions={JSON.parse(JSON.stringify(fields))}
          total={contactsResult.total}
          initialTagsMap={tagsMap}
          categories={JSON.parse(JSON.stringify(categories))}
        />
      </div>
    </div>
  );
}
