import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const devBypass =
    process.env.NODE_ENV === "development" &&
    process.env.DEV_BYPASS_AUTH === "true";

  if (!devBypass) {
    const session = await auth();
    // @ts-expect-error - role is added in auth callbacks
    const role = session?.user?.role ?? "viewer";

    if (role !== "admin") {
      redirect("/dashboard");
    }
  }

  return <>{children}</>;
}
