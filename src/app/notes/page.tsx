import { AnnotationPage } from "@/components/annotations/AnnotationPage";

export const metadata = {
  title: "My Notes | eRegs",
  description: "Your private notes on Federal Motor Carrier Safety Regulations.",
};

export default function NotesPage() {
  return <AnnotationPage pageType="notes" />;
}
