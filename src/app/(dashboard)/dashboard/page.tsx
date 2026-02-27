import { redirect } from "next/navigation";
import { auth, canAccessPro, canAccessFleet } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canAccessPro(session)) redirect("/regs/390.1");

  const userName = session.user?.name ?? session.user?.email?.split("@")[0] ?? "there";
  const isFleet = canAccessFleet(session);

  return <DashboardShell userName={userName} isFleet={isFleet} />;
}
