import { notFound } from "next/navigation";
import { parseSectionSlug, fetchSection, fetchPartStructure, getAdjacentSections } from "@/lib/ecfr";
import { ReaderShell } from "@/components/reader/ReaderShell";

interface Props {
  params: Promise<{ section: string }>;
}

export default async function SectionPage({ params }: Props) {
  const { section: slug } = await params;
  const parsed = parseSectionSlug(slug);
  if (!parsed) notFound();

  const [section, toc, adjacent] = await Promise.all([
    fetchSection(parsed.part, parsed.section),
    fetchPartStructure(parsed.part),
    getAdjacentSections(parsed.part, parsed.section),
  ]);

  if (!section) notFound();

  return (
    <ReaderShell
      section={section}
      toc={toc}
      adjacent={adjacent}
      slug={slug}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { section: slug } = await params;
  const parsed = parseSectionSlug(slug);
  if (!parsed) return {};

  const section = await fetchSection(parsed.part, parsed.section);
  if (!section) return {};

  return {
    title: `§ ${section.section} ${section.title} | eRegs`,
    description: `Federal Motor Carrier Safety Regulations § ${section.section} — ${section.title}`,
  };
}
