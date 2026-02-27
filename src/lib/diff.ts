import DiffMatchPatch from "diff-match-patch";
import type { EcfrNode } from "@/lib/ecfr";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DiffSegment {
  type: "equal" | "insert" | "delete";
  text: string;
}

export interface DiffResult {
  type: "unchanged" | "modified" | "added" | "removed";
  oldNode?: EcfrNode;
  newNode?: EcfrNode;
  textDiff?: DiffSegment[];
}

// ── Text diffing (wraps diff-match-patch) ────────────────────────────────────

const dmp = new DiffMatchPatch();

export function diffText(oldText: string, newText: string): DiffSegment[] {
  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);
  return diffs.map(([op, text]) => ({
    type: op === -1 ? "delete" : op === 1 ? "insert" : "equal",
    text,
  }));
}

// ── Section diffing (paragraph-level matching) ───────────────────────────────

/**
 * Compare two EcfrNode[] arrays and produce a diff.
 * `oldNodes` = historical version, `newNodes` = current version.
 * Output order follows the new (current) version, with removed nodes
 * interleaved at their approximate original positions.
 */
export function diffSections(
  oldNodes: EcfrNode[],
  newNodes: EcfrNode[],
): DiffResult[] {
  // Phase 1: Match labeled paragraphs by label+level
  const oldMatched = new Set<number>();
  const newMatched = new Set<number>();
  const matches: [number, number][] = []; // [oldIdx, newIdx]

  const oldByKey = new Map<string, number[]>();
  for (let i = 0; i < oldNodes.length; i++) {
    const n = oldNodes[i];
    if (n.label) {
      const key = `${n.label}:${n.level}`;
      const arr = oldByKey.get(key) ?? [];
      arr.push(i);
      oldByKey.set(key, arr);
    }
  }

  for (let j = 0; j < newNodes.length; j++) {
    const n = newNodes[j];
    if (n.label) {
      const key = `${n.label}:${n.level}`;
      const candidates = oldByKey.get(key);
      if (candidates && candidates.length > 0) {
        const oi = candidates.shift()!;
        matches.push([oi, j]);
        oldMatched.add(oi);
        newMatched.add(j);
        if (candidates.length === 0) oldByKey.delete(key);
      }
    }
  }

  // Phase 2: Match remaining unlabeled nodes by type in positional order
  const oldUnmatched: number[] = [];
  for (let i = 0; i < oldNodes.length; i++) {
    if (!oldMatched.has(i)) oldUnmatched.push(i);
  }

  const unmatchedByType = new Map<string, number[]>();
  for (const i of oldUnmatched) {
    const t = oldNodes[i].type;
    const arr = unmatchedByType.get(t) ?? [];
    arr.push(i);
    unmatchedByType.set(t, arr);
  }

  for (let j = 0; j < newNodes.length; j++) {
    if (newMatched.has(j)) continue;
    const candidates = unmatchedByType.get(newNodes[j].type);
    if (candidates && candidates.length > 0) {
      const oi = candidates.shift()!;
      matches.push([oi, j]);
      oldMatched.add(oi);
      newMatched.add(j);
      if (candidates.length === 0) unmatchedByType.delete(newNodes[j].type);
    }
  }

  // Phase 3: Build ordered result
  // Create a map of oldIdx -> newIdx for quick lookup
  const oldToNew = new Map<number, number>();
  for (const [oi, ni] of matches) oldToNew.set(oi, ni);

  const newToOld = new Map<number, number>();
  for (const [oi, ni] of matches) newToOld.set(ni, oi);

  // Walk through new nodes in order, inserting removed old nodes before their
  // successor where appropriate
  const results: DiffResult[] = [];
  let nextOldRemoved = 0; // cursor for unmatched old nodes

  // Collect removed old indices in order
  const removedOldIndices: number[] = [];
  for (let i = 0; i < oldNodes.length; i++) {
    if (!oldMatched.has(i)) removedOldIndices.push(i);
  }

  for (let j = 0; j < newNodes.length; j++) {
    // Insert any removed old nodes that appeared before this new node's match
    const matchedOld = newToOld.get(j);
    if (matchedOld !== undefined) {
      while (
        nextOldRemoved < removedOldIndices.length &&
        removedOldIndices[nextOldRemoved] < matchedOld
      ) {
        results.push({
          type: "removed",
          oldNode: oldNodes[removedOldIndices[nextOldRemoved]],
        });
        nextOldRemoved++;
      }
    }

    if (newMatched.has(j)) {
      // Matched pair — check if modified or unchanged
      const oi = newToOld.get(j)!;
      const oldNode = oldNodes[oi];
      const newNode = newNodes[j];
      if (nodeTextEqual(oldNode, newNode)) {
        results.push({ type: "unchanged", oldNode, newNode });
      } else {
        results.push({
          type: "modified",
          oldNode,
          newNode,
          textDiff: diffText(oldNode.text, newNode.text),
        });
      }
    } else {
      // New node with no match → added
      results.push({ type: "added", newNode: newNodes[j] });
    }
  }

  // Append any remaining removed nodes
  while (nextOldRemoved < removedOldIndices.length) {
    results.push({
      type: "removed",
      oldNode: oldNodes[removedOldIndices[nextOldRemoved]],
    });
    nextOldRemoved++;
  }

  return results;
}

function nodeTextEqual(a: EcfrNode, b: EcfrNode): boolean {
  if (a.text !== b.text) return false;
  if (a.type !== b.type) return false;
  if (a.type === "table" || b.type === "table") {
    return (
      JSON.stringify(a.tableHeaders) === JSON.stringify(b.tableHeaders) &&
      JSON.stringify(a.tableRows) === JSON.stringify(b.tableRows)
    );
  }
  return true;
}
