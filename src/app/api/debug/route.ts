import { NextRequest, NextResponse } from "next/server";
import { fetchSection } from "@/lib/ecfr";

export async function GET(request: NextRequest) {
  const section = request.nextUrl.searchParams.get("section") || "395.1";
  const part = section.split(".")[0];
  const result = await fetchSection(part, section);
  return NextResponse.json(result, { status: 200 });
}
