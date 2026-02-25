import { AnnotationPage } from "@/components/annotations/AnnotationPage";

export const metadata = {
  title: "My Highlights | eRegs",
  description: "Your highlighted paragraphs across Federal Motor Carrier Safety Regulations.",
};

export default function HighlightsPage() {
  return <AnnotationPage pageType="highlights" />;
}
