import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) redirect("/login");

  const session = await verifySession(token);
  if (!session) redirect("/login");

  const params = await searchParams;
  const showWelcomeNudge = params.welcome === "1" && session.mode === "FULL";

  return (
    <DashboardClient
      mode={session.mode}
      email={session.email}
      passwordSalt={session.passwordSalt}
      showWelcomeNudge={showWelcomeNudge}
    />
  );
}
