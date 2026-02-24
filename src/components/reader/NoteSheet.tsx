"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
  onDelete?: () => void;
  paragraphPreview: string;
  initialText?: string;
  isEditing?: boolean;
}

export function NoteSheet({ open, onClose, onSave, onDelete, paragraphPreview, initialText, isEditing }: Props) {
  const [text, setText] = useState(initialText || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(initialText || "");
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [open, initialText]);

  const handleSave = () => {
    if (!text.trim()) return;
    onSave(text.trim());
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 400,
          background: "rgba(26, 24, 20, 0.4)",
          display: open ? "flex" : "none",
          alignItems: "flex-end",
        }}
      >
        {/* Sheet */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "var(--white)",
            borderRadius: "20px 20px 0 0",
            width: "100%",
            padding: "0 18px 20px",
            paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
            animation: "noteSheetUp 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
            maxHeight: "80dvh",
            display: "flex", flexDirection: "column",
          }}
        >
          {/* Handle */}
          <div style={{
            width: 36, height: 4, background: "var(--border2)",
            borderRadius: 2, margin: "14px auto 16px", flexShrink: 0,
          }} />

          {/* Label */}
          <div style={{
            fontSize: 11, fontWeight: 700, color: "var(--text3)",
            letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: 6, flexShrink: 0,
          }}>
            {isEditing ? "Edit Note" : "Add Note"}
          </div>

          {/* Paragraph preview */}
          <div style={{
            fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5,
            marginBottom: 12, fontStyle: "italic", flexShrink: 0,
            padding: "8px 10px", background: "var(--bg2)", borderRadius: 6,
            borderLeft: "3px solid var(--border2)",
            maxHeight: 80, overflow: "hidden",
          }}>
            {paragraphPreview}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your note..."
            style={{
              width: "100%", border: "1px solid var(--border2)", borderRadius: 10,
              padding: "12px 14px", fontSize: 15, fontFamily: "'Inter', sans-serif",
              color: "var(--text)", background: "var(--bg)", resize: "none",
              outline: "none", minHeight: 100, lineHeight: 1.55, flexShrink: 0,
            }}
          />

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexShrink: 0 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: 12, borderRadius: 9,
                border: "1px solid var(--border)", background: "var(--bg2)",
                fontSize: 14, fontFamily: "'Inter', sans-serif",
                color: "var(--text2)", cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                flex: 2, padding: 12, borderRadius: 9, border: "none",
                background: "var(--accent)", fontSize: 14, fontWeight: 500,
                fontFamily: "'Inter', sans-serif", color: "white",
                cursor: "pointer", opacity: text.trim() ? 1 : 0.5,
              }}
            >
              Save
            </button>
          </div>

          {/* Delete button (edit mode only) */}
          {isEditing && onDelete && (
            <button
              onClick={onDelete}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                width: "100%", padding: 11, borderRadius: 10,
                border: "1px solid #fdd", background: "#fff5f5",
                color: "#c0392b", fontSize: 13.5,
                fontFamily: "'Inter', sans-serif",
                cursor: "pointer", marginTop: 6,
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
              Delete Note
            </button>
          )}
        </div>
      </div>

      {/* Animation keyframe via inline style tag */}
      <style>{`
        @keyframes noteSheetUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
