import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return <MarketingPage />;
}
