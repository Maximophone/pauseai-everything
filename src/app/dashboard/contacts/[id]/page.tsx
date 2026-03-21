import { notFound } from "next/navigation";
import { getContact, listFieldDefinitions } from "@/lib/contacts";
import { ContactDetailForm } from "@/components/contact-detail-form";
import { InteractionTimeline } from "@/components/interaction-timeline";
import { ContactTags } from "@/components/contact-tags";
import { ContactPreferences } from "@/components/contact-preferences";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import { db } from "@/db";
import { syncConfigurations, connections } from "@/db/schema/connections";
import { eq } from "drizzle-orm";

type SyncSource = {
  connectionId: string;
  connectionName: string;
  connectorType: string;
  syncId: string;
  syncName: string;
  lastSyncAt: string | null;
};

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [contact, fields] = await Promise.all([
    getContact(id),
    listFieldDefinitions(),
  ]);

  if (!contact) {
    notFound();
  }

  // Fetch sync source info if this contact was synced
  let syncSource: SyncSource | null = null;
  if (contact.syncConfigurationId) {
    const [row] = await db
      .select({
        connectionId: connections.id,
        connectionName: connections.name,
        connectorType: connections.connectorType,
        syncId: syncConfigurations.id,
        syncName: syncConfigurations.name,
        lastSyncAt: syncConfigurations.lastSyncAt,
      })
      .from(syncConfigurations)
      .innerJoin(connections, eq(connections.id, syncConfigurations.connectionId))
      .where(eq(syncConfigurations.id, contact.syncConfigurationId));

    if (row) {
      syncSource = {
        ...row,
        lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
      };
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/contacts">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {contact.firstName || ""} {contact.lastName || ""}
            {!contact.firstName && !contact.lastName && (
              <span className="text-muted-foreground">Unnamed Contact</span>
            )}
          </h2>
          {contact.email && (
            <p className="text-muted-foreground">{contact.email}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: form + tags */}
        <div className="lg:col-span-1 space-y-6">
          <ContactDetailForm
            contact={JSON.parse(JSON.stringify(contact))}
            fieldDefinitions={JSON.parse(JSON.stringify(fields))}
            syncSource={syncSource}
          />
          <div className="border-t pt-6">
            <ContactTags contactId={contact.id} />
          </div>
          <div className="border-t pt-6">
            <ContactPreferences
              contactId={contact.id}
              initialPreferences={
                (contact.communicationPreferences as Record<string, "subscribed" | "unsubscribed">) || {}
              }
            />
          </div>
        </div>

        {/* Right column: interactions timeline */}
        <div className="lg:col-span-2">
          <InteractionTimeline contactId={contact.id} />
        </div>
      </div>
    </div>
  );
}
