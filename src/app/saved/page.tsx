import { AnnotationPage } from "@/components/annotations/AnnotationPage";

export const metadata = {
  title: "Saved Sections | eRegs",
  description: "Your bookmarked regulation sections.",
};

export default function SavedPage() {
  return <AnnotationPage pageType="saved" />;
}
