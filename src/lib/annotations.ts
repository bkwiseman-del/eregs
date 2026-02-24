// Annotation types for client-side use

export interface Annotation {
  id: string;
  type: "HIGHLIGHT" | "NOTE" | "BOOKMARK";
  paragraphId: string;  // stable ID: "{section}-{label}" e.g. "395.1-a" or "{section}-p{index}" for unlabeled
  part: string;
  section: string;
  note?: string | null;
  regVersion: string;
  createdAt: string;
  updatedAt: string;
}

/** Build a stable paragraph ID from section + node info */
export function makeParagraphId(section: string, label?: string, index?: number): string {
  if (label) {
    // Strip parens and whitespace: "(a)(1)" → "a-1"
    const clean = label.replace(/[()]/g, "").replace(/\s+/g, "-");
    return `${section}-${clean}`;
  }
  return `${section}-p${index ?? 0}`;
}
