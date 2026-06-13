import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import SecurityClient from "./SecurityClient";

export default async function SecurityPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) redirect("/login");

  const session = await verifySession(token);
  if (!session || session.mode !== "FULL") redirect("/dashboard");

  return <SecurityClient mode={session.mode} email={session.email} passwordSalt={session.passwordSalt} />;
}
