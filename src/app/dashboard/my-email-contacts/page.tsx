import { MyEmailContacts } from "@/components/my-email-contacts";

export default function MyEmailContactsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">My Email Contacts</h2>
      <p className="text-muted-foreground mt-1">
        Connect your Gmail account to import contacts and automatically log email interactions.
      </p>
      <div className="mt-6">
        <MyEmailContacts />
      </div>
    </div>
  );
}
