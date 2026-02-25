"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  selectedCount: number;
  allHighlighted: boolean;
  onHighlight: () => void;
  onSaveNote: (text: string) => void;
  onCopy: () => void;
  onClear: () => void;
  // Edit mode — when user taps an existing note bubble
  editingNote: { id: string; note: string } | null;
  onUpdateNote: (text: string) => void;
  onDeleteNote: () => void;
  onCancelEdit: () => void;
  paragraphPreview: string;
  // Free vs paid
  isPaid: boolean;
}

export function ActionBar({
  selectedCount, allHighlighted,
  onHighlight, onSaveNote, onCopy, onClear,
  editingNote, onUpdateNote, onDeleteNote, onCancelEdit,
  paragraphPreview,
  isPaid,
}: Props) {
  const visible = selectedCount > 0 || !!editingNote;
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // When editing an existing note, open the note panel with its text
  useEffect(() => {
    if (editingNote) {
      setNoteText(editingNote.note || "");
      setNoteOpen(true);
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [editingNote]);

  // Reset note panel when selection cleared
  useEffect(() => {
    if (selectedCount === 0 && !editingNote) {
      setNoteOpen(false);
      setNoteText("");
      setCopyFeedback(false);
    }
  }, [selectedCount, editingNote]);

  const handleNoteToggle = () => {
    if (noteOpen) {
      setNoteOpen(false);
      setNoteText("");
    } else {
      setNoteOpen(true);
      setNoteText("");
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  };

  const handleSave = () => {
    if (!noteText.trim()) return;
    if (editingNote) {
      onUpdateNote(noteText.trim());
    } else {
      onSaveNote(noteText.trim());
    }
    setNoteOpen(false);
    setNoteText("");
  };

  const handleCancel = () => {
    if (editingNote) {
      onCancelEdit();
    }
    setNoteOpen(false);
    setNoteText("");
  };

  const handleFreeCopy = () => {
    onCopy();
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 3000);
  };

  return (
    <>
      <div
        className="action-bar-outer"
        style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          display: "flex", justifyContent: "center",
          zIndex: 150,
          pointerEvents: "none",
          transform: visible ? "translateY(0)" : "translateY(110%)",
          opacity: visible ? 1 : 0,
          visibility: visible ? "visible" as const : "hidden" as const,
          transition: "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s, visibility 0.25s",
        }}
      >
        <div
          className="action-bar-inner"
          style={{
            width: "100%",
            background: "var(--white)",
            borderTop: "1px solid var(--border)",
            padding: "10px 16px",
            paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
            pointerEvents: "auto",
          }}
        >
          {/* Selection info */}
          <div style={{
            fontSize: 12, color: "var(--text3)", marginBottom: 10,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {editingNote ? (
              <span style={{ fontWeight: 500, color: "var(--text2)" }}>Editing note</span>
            ) : (
              <>
                <span style={{
                  fontWeight: 600, color: "var(--accent)",
                  background: "var(--accent-bg)", border: "1px solid var(--accent-border)",
                  padding: "1px 8px", borderRadius: 10, fontSize: 11.5,
                }}>
                  {selectedCount === 1 ? "1 paragraph" : `${selectedCount} paragraphs`}
                </span>
                <span>selected</span>
              </>
            )}
            <span
              onClick={editingNote ? onCancelEdit : onClear}
              style={{ marginLeft: "auto", color: "var(--text3)", cursor: "pointer", fontSize: 12 }}
            >
              {editingNote ? "Cancel" : "Clear"}
            </span>
          </div>

          {/* ═══ PAID: full action bar ═══ */}
          {isPaid ? (
            <>
              {/* Note panel — expands inline when note button is tapped */}
              {noteOpen && (
                <div style={{ marginBottom: 10 }}>
                  {paragraphPreview && (
                    <div style={{
                      fontSize: 12, color: "var(--text2)", lineHeight: 1.5,
                      fontStyle: "italic", padding: "7px 10px",
                      background: "var(--bg2)", borderRadius: 6,
                      borderLeft: "3px solid var(--border2)",
                      maxHeight: 56, overflow: "hidden", marginBottom: 8,
                    }}>
                      {paragraphPreview}
                    </div>
                  )}

                  <textarea
                    ref={textareaRef}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Type your note..."
                    rows={3}
                    style={{
                      width: "100%", border: "1px solid var(--border2)", borderRadius: 10,
                      padding: "10px 12px", fontSize: 14, fontFamily: "'Inter', sans-serif",
                      color: "var(--text)", background: "var(--bg)", resize: "none",
                      outline: "none", lineHeight: 1.5,
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "var(--border2)"; }}
                  />

                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {editingNote && (
                      <button
                        onClick={onDeleteNote}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          padding: "9px 14px", borderRadius: 9,
                          border: "1px solid #fdd", background: "#fff5f5",
                          color: "#c0392b", fontSize: 13, fontWeight: 500,
                          fontFamily: "'Inter', sans-serif", cursor: "pointer",
                        }}
                      >
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                        Delete
                      </button>
                    )}
                    <button
                      onClick={handleCancel}
                      style={{
                        flex: 1, padding: "9px 14px", borderRadius: 9,
                        border: "1px solid var(--border)", background: "var(--bg2)",
                        fontSize: 13, fontFamily: "'Inter', sans-serif",
                        color: "var(--text2)", cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      style={{
                        flex: 1.5, padding: "9px 14px", borderRadius: 9, border: "none",
                        background: "var(--accent)", fontSize: 13, fontWeight: 500,
                        fontFamily: "'Inter', sans-serif", color: "white",
                        cursor: "pointer", opacity: noteText.trim() ? 1 : 0.5,
                      }}
                    >
                      {editingNote ? "Update" : "Save Note"}
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons — hide when editing an existing note */}
              {!(noteOpen && editingNote) && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={onHighlight}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "10px 16px", borderRadius: 9,
                      border: allHighlighted ? "1px solid var(--yellow-hl-border)" : "1px solid var(--border)",
                      background: allHighlighted ? "var(--yellow-hl)" : "var(--bg2)",
                      fontSize: 13.5, fontWeight: 500,
                      fontFamily: "'Inter', sans-serif",
                      color: allHighlighted ? "#5a4400" : "var(--text)",
                      cursor: "pointer", transition: "all 0.15s", flex: 1.5,
                    }}
                  >
                    {allHighlighted ? (
                      <>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        Remove
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Highlight
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleNoteToggle}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "10px 16px", borderRadius: 9,
                      border: noteOpen ? "1px solid var(--blue-border)" : "1px solid var(--border)",
                      background: noteOpen ? "var(--blue-bg)" : "var(--bg2)",
                      fontSize: 13.5, fontWeight: 500,
                      fontFamily: "'Inter', sans-serif",
                      color: noteOpen ? "var(--blue)" : "var(--text)",
                      cursor: "pointer", transition: "all 0.15s", flex: 1,
                    }}
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                    Note
                  </button>

                  <button
                    onClick={onCopy}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "10px 13px", borderRadius: 9,
                      border: "1px solid var(--border)",
                      background: "var(--bg2)",
                      fontSize: 13.5, fontWeight: 500,
                      fontFamily: "'Inter', sans-serif",
                      color: "var(--text)", cursor: "pointer",
                      transition: "all 0.15s", flex: "none",
                    }}
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                  </button>
                </div>
              )}
            </>
          ) : (
            /* ═══ FREE: copy button + upsell ═══ */
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: copyFeedback ? 10 : 0 }}>
                <button
                  onClick={handleFreeCopy}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "10px 16px", borderRadius: 9,
                    border: "1px solid var(--border)",
                    background: "var(--bg2)",
                    fontSize: 13.5, fontWeight: 500,
                    fontFamily: "'Inter', sans-serif",
                    color: "var(--text)", cursor: "pointer",
                    transition: "all 0.15s", flex: 1,
                  }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                  Copy with eRegs link
                </button>
              </div>

              {/* Upsell — appears after copy, or as a persistent subtle row */}
              {copyFeedback ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 11px", borderRadius: 8,
                  background: "var(--accent-bg)", border: "1px solid var(--accent-border)",
                }}>
                  <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span style={{ fontSize: 12.5, color: "var(--accent-text)", flex: 1, lineHeight: 1.4 }}>
                    Copied! Upgrade to Pro for highlights, notes &amp; full citations.
                  </span>
                  <a
                    href="/login"
                    style={{
                      fontSize: 12, fontWeight: 600, color: "var(--accent)",
                      textDecoration: "none", whiteSpace: "nowrap",
                      padding: "4px 10px", borderRadius: 6,
                      background: "var(--white)", border: "1px solid var(--accent-border)",
                    }}
                  >
                    Try free
                  </a>
                </div>
              ) : (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  marginTop: 6,
                }}>
                  <div style={{ display: "flex", gap: 4, opacity: 0.45 }}>
                    <svg width="12" height="12" fill="none" stroke="var(--text3)" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    <svg width="12" height="12" fill="none" stroke="var(--text3)" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: 11.5, color: "var(--text3)" }}>
                    Highlight &amp; annotate with
                  </span>
                  <a
                    href="/login"
                    style={{
                      fontSize: 11.5, fontWeight: 600, color: "var(--accent)",
                      textDecoration: "none",
                    }}
                  >
                    eRegs Pro
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .action-bar-outer {
            bottom: 16px !important;
            padding: 0 24px;
          }
          .action-bar-inner {
            max-width: 680px;
            border-radius: 14px !important;
            border: 1px solid var(--border) !important;
            box-shadow: 0 8px 40px rgba(0,0,0,0.12) !important;
          }
        }
      `}</style>
    </>
  );
}
