"use client";

import { useRef, useCallback, useState } from "react";

interface Props {
  side: "left" | "right";
  onResize: (delta: number) => void;
  onDoubleClick?: () => void;
}

/**
 * Claude-style resize handle: thin 1px line with a small pill/nub
 * centered vertically. On hover, line darkens and nub becomes visible.
 * Drag to resize panels. Double-click to collapse (if supported).
 */
export function ResizeHandle({ side, onResize, onDoubleClick }: Props) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    setActive(true);
    startX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    startX.current = e.clientX;
    onResize(side === "left" ? delta : -delta);
  }, [onResize, side]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
    setActive(false);
  }, []);

  const isActive = hovered || active;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 9,
        flexShrink: 0,
        cursor: "col-resize",
        position: "relative",
        zIndex: 10,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        margin: "0 -2px",
      }}
    >
      {/* Visible vertical line */}
      <div style={{
        width: 1,
        background: isActive ? "var(--text3)" : "var(--border)",
        transition: "background 0.15s",
      }} />

      {/* Pill / nub handle — centered vertically */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 6,
        height: 32,
        borderRadius: 3,
        background: isActive ? "var(--text3)" : "var(--border2)",
        border: `1px solid ${isActive ? "var(--text3)" : "var(--border)"}`,
        opacity: isActive ? 1 : 0.6,
        transition: "all 0.15s",
        pointerEvents: "none",
      }} />
    </div>
  );
}
