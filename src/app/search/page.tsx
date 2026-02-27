import { auth, canAccessPro, canAccessFleet } from "@/lib/auth";
import { SearchShell } from "@/components/search/SearchShell";

export default async function SearchPage() {
  const session = await auth();
  const isPaid = session ? canAccessPro(session) : false;
  const isFleet = session ? canAccessFleet(session) : false;

  return <SearchShell isPaid={isPaid} isFleet={isFleet} userName={session?.user?.name ?? null} />;
}

export function generateMetadata() {
  return {
    title: "Search | eRegs",
    description:
      "Search Federal Motor Carrier Safety Regulations, FMCSA guidance, and trucking industry content.",
  };
}
