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
    // @ts-expect-error - isAdmin is added in auth callbacks
    const isAdmin = session?.user?.isAdmin ?? false;

    if (!isAdmin) {
      redirect("/dashboard");
    }
  }

  return <>{children}</>;
}
