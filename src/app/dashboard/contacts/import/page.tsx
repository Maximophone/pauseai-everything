import { CsvImporter } from "@/components/csv-importer";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ImportContactsPage() {
  const devBypass =
    process.env.NODE_ENV === "development" &&
    process.env.DEV_BYPASS_AUTH === "true";

  if (!devBypass) {
    const session = await auth();
    // @ts-expect-error - role is added in auth callbacks
    const role = session?.user?.role ?? "viewer";
    if (role !== "admin") {
      redirect("/dashboard/contacts");
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Import Contacts</h2>
      <p className="text-muted-foreground mt-1">
        Upload a CSV file to import contacts into the system.
      </p>
      <div className="mt-6">
        <CsvImporter />
      </div>
    </div>
  );
}
