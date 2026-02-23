import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-2">
          Welcome, {session.user?.name ?? session.user?.email}
        </h1>
        <p className="text-stone-500 text-sm">Dashboard coming soon.</p>
      </div>
    </div>
  );
}
