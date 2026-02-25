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

/** Build a stable paragraph ID from section + node info.
 *  Uses the content array index as the primary unique key to avoid
 *  collisions when the same label (e.g. "(1)") appears multiple times
 *  in different subsections.
 *
 *  Format: "{section}-{index}-{label}" e.g. "395.1-14-1" or "395.1-p0"
 *  NOTE: Changed from label-only format. Old annotations using "{section}-{label}"
 *  will no longer match and need migration if any exist in production.
 */
export function makeParagraphId(section: string, label?: string, index?: number): string {
  // Index is always unique within a section's content array
  const idx = index ?? 0;
  if (label) {
    const clean = label.replace(/[()]/g, "").replace(/\s+/g, "-");
    return `${section}-${idx}-${clean}`;
  }
  return `${section}-p${idx}`;
}
