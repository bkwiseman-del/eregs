"use client";

import { useRef, useCallback } from "react";

interface Props {
  side: "left" | "right"; // which side of the content area
  onResize: (delta: number) => void;
  onDoubleClick?: () => void;
}

/**
 * Thin drag handle that sits between panels.
 * Renders as a 5px-wide invisible hit area with a 1px visible line.
 * Drag left/right to resize. Double-click to collapse.
 */
export function ResizeHandle({ side, onResize, onDoubleClick }: Props) {
  const dragging = useRef(false);
  const startX = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    startX.current = e.clientX;
    // For the left handle (TOC), dragging right = wider = positive delta
    // For the right handle (insights), dragging left = wider = negative delta
    onResize(side === "left" ? delta : -delta);
  }, [onResize, side]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      style={{
        width: 5,
        flexShrink: 0,
        cursor: "col-resize",
        position: "relative",
        zIndex: 10,
        // Invisible hit area, visible center line
        background: "transparent",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
      }}
    >
      {/* Visible line */}
      <div
        className="resize-handle-line"
        style={{
          width: 1,
          background: "var(--border)",
          transition: "background 0.15s, width 0.15s",
        }}
      />
      <style>{`
        .resize-handle-line:hover,
        div:active > .resize-handle-line {
          width: 3px;
          background: var(--accent);
          border-radius: 1px;
        }
      `}</style>
    </div>
  );
}
