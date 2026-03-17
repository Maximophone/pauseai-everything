import { notFound } from "next/navigation";
import { getContact, listFieldDefinitions } from "@/lib/contacts";
import { ContactDetailForm } from "@/components/contact-detail-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";

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
      <ContactDetailForm contact={JSON.parse(JSON.stringify(contact))} fieldDefinitions={JSON.parse(JSON.stringify(fields))} />
    </div>
  );
}
