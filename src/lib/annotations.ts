// ── Annotation types for client-side use ─────────────────────────────────────

/** Normalized annotation shape used by reader components.
 *  The API returns DB-native field names (cfr49Part, sectionId, etc.)
 *  but we normalize to this shape so components stay simple.
 */
export interface ReaderAnnotation {
  id: string;
  type: "HIGHLIGHT" | "NOTE" | "BOOKMARK";
  paragraphId: string;      // last pid (note/highlight bubble placement) or empty (bookmark)
  paragraphIds?: string[];  // note + highlight — all pids in the selection
  part: string;
  section: string;
  note?: string | null;
  color?: string;
  textSnippet?: string;
  sectionTitle?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Build a stable paragraph ID from section + node info.
 *  Uses the content array index as the primary unique key to avoid
 *  collisions when the same label (e.g. "(1)") appears multiple times
 *  in different subsections.
 *
 *  Format: "{section}-{index}-{label}" e.g. "395.1-14-1" or "395.1-p0"
 */
export function makeParagraphId(section: string, label?: string, index?: number): string {
  const idx = index ?? 0;
  if (label) {
    const clean = label.replace(/[()]/g, "").replace(/\s+/g, "-");
    return `${section}-${idx}-${clean}`;
  }
  return `${section}-p${idx}`;
}
