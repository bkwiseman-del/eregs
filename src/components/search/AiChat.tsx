"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Module-level chat history cache — persists across page navigations
let chatCache: { messages: Message[]; remaining: number | null } = { messages: [], remaining: null };

interface Citation {
  section: string | null;
  part: string | null;
  title: string;
  sourceType: string;
  similarity: number;
}

interface Props {
  isPaid: boolean;
  onSubmitRef?: React.MutableRefObject<((q: string) => void) | null>;
}

// Post-process AI response to fix links: rewrite external regulation/FMCSA URLs to internal /regs/ format
function fixLinks(text: string): string {
  // Match markdown links: [label](url)
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (full, label: string, href: string) => {
    // Already internal — keep as-is
    if (href.startsWith("/")) return full;

    // Extract section number from the link text (e.g., "§ 395.1" or "§ 395.1(e)")
    const sectionMatch = label.match(/§\s*([\d]+\.[\d]+)/);

    // External eCFR link → rewrite to internal
    if (href.includes("ecfr.gov")) {
      // Try to extract section from URL: /section-395.1 or /section-395.1#p-395.1(e)
      const urlSection = href.match(/section[/-]([\d]+\.[\d]+)/)?.[1];
      const section = urlSection ?? sectionMatch?.[1];
      if (section) return `[${label}](/regs/${section})`;
      return `[${label}](/regs/)`;
    }

    // External FMCSA link → rewrite to internal guidance link
    if (href.includes("fmcsa.dot.gov")) {
      const section = sectionMatch?.[1];
      if (section) return `[${label}](/regs/${section}?insights=open)`;
      // No section found — try to make it a guidance link from context
      return `[${label}](/regs/)`;
    }

    // Any other external link referencing a section → internalize
    if (sectionMatch?.[1] && !href.startsWith("http")) {
      return `[${label}](/regs/${sectionMatch[1]})`;
    }

    return full;
  });
}

// Simple markdown rendering — handles bold, bullets, headers, and links
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h4
          key={i}
          style={{ fontSize: 13, fontWeight: 700, margin: "12px 0 4px", color: "var(--text)" }}
        >
          {processInline(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3
          key={i}
          style={{ fontSize: 14, fontWeight: 700, margin: "14px 0 4px", color: "var(--text)" }}
        >
          {processInline(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li
          key={i}
          style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text)", marginLeft: 16 }}
        >
          {processInline(line.slice(2))}
        </li>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} style={{ height: 8 }} />);
    } else {
      elements.push(
        <p key={i} style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text)", margin: "2px 0" }}>
          {processInline(line)}
        </p>
      );
    }
  }

  return elements;
}

// Process inline markdown: **bold**, [text](url)
function processInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold**, [text](url), or plain text
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let match;
  let idx = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[1]) {
      parts.push(
        <strong key={idx++} style={{ fontWeight: 600 }}>
          {match[1]}
        </strong>
      );
    } else if (match[2] && match[3]) {
      const href = match[3];
      const isInternal = href.startsWith("/");
      if (isInternal) {
        parts.push(
          <Link
            key={idx++}
            href={href}
            style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 500 }}
          >
            {match[2]}
          </Link>
        );
      } else {
        parts.push(
          <a
            key={idx++}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)", textDecoration: "underline" }}
          >
            {match[2]}
          </a>
        );
      }
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : [text];
}

// Extract all unique source citations from AI response text
// Captures regulation links, guidance links, and external content links
interface SourceCitation {
  label: string;
  href: string;
  type: "regulation" | "guidance" | "content";
}

function extractCitations(text: string): SourceCitation[] {
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  const seen = new Set<string>();
  const citations: SourceCitation[] = [];
  let match;

  while ((match = re.exec(text)) !== null) {
    const label = match[1];
    const href = match[2];
    if (seen.has(href)) continue;
    seen.add(href);

    // Categorize: internal /regs/ links with ?insights=open → guidance, other /regs/ → regulation, external → content
    if (href.startsWith("/regs/") && href.includes("insights=open")) {
      citations.push({ label, href, type: "guidance" });
    } else if (href.startsWith("/regs/") || href.startsWith("/")) {
      citations.push({ label, href, type: "regulation" });
    } else if (href.startsWith("http")) {
      citations.push({ label, href, type: "content" });
    }
  }

  return citations;
}

export function AiChat({ isPaid, onSubmitRef }: Props) {
  const [messages, setMessages] = useState<Message[]>(chatCache.messages);
  const [streaming, setStreaming] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(chatCache.remaining);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Persist chat history to module cache
  useEffect(() => {
    chatCache = { messages, remaining };
  }, [messages, remaining]);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streaming]);

  // Expose submitQuestion to parent via ref
  useEffect(() => {
    if (onSubmitRef) {
      onSubmitRef.current = submitQuestion;
    }
  });

  async function submitQuestion(question: string) {
    if (!question.trim() || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setIsLoading(true);
    setStreaming("");
    setError(null);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        let errMsg = "Failed to get response";
        try {
          const err = await res.json();
          if (res.status === 429) {
            errMsg = `Daily limit reached. Resets ${err.resetsAt ? "in 24 hours" : "soon"}.`;
          } else if (res.status === 401) {
            errMsg = "Please sign in to use AI chat.";
          } else if (res.status === 403) {
            errMsg = "Pro subscription required for AI chat.";
          } else {
            errMsg = err.detail ? `${err.error}: ${err.detail}` : (err.error ?? errMsg);
          }
        } catch {
          errMsg = `Server error (${res.status}). Please try again.`;
        }
        setError(errMsg);
        setIsLoading(false);
        return;
      }

      const remainingHeader = res.headers.get("X-Remaining");
      if (remainingHeader) setRemaining(parseInt(remainingHeader));

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          setStreaming(fixLinks(fullContent));
        }
      }

      const fixed = fixLinks(fullContent);
      setMessages((prev) => [...prev, { role: "assistant", content: fixed }]);
      setStreaming("");
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!isPaid) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--accent), #a34f18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <svg width="22" height="22" fill="none" stroke="white" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M9.5 2l.5 4 4 .5-4 .5-.5 4-.5-4-4-.5 4-.5z" />
            <path d="M17 12l.5 3 3 .5-3 .5-.5 3-.5-3-3-.5 3-.5z" />
            <path d="M8 16l.5 2.5 2.5.5-2.5.5L8 22l-.5-2.5L5 19l2.5-.5z" />
          </svg>
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
          AI Regulatory Assistant
        </p>
        <p style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.5, maxWidth: 340 }}>
          Get AI-driven answers based on FMCSR regulatory text and FMCSA guidance with direct links
          to applicable sections. Available with a Pro subscription.
        </p>
        <Link
          href="/signup"
          style={{
            marginTop: 16,
            padding: "8px 20px",
            borderRadius: 8,
            background: "var(--accent)",
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Upgrade to Pro
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 24px" }}>
        {messages.length === 0 && !streaming && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent), #a34f18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
              }}
            >
              <svg width="18" height="18" fill="none" stroke="white" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M9.5 2l.5 4 4 .5-4 .5-.5 4-.5-4-4-.5 4-.5z" />
                <path d="M17 12l.5 3 3 .5-3 .5-.5 3-.5-3-3-.5 3-.5z" />
                <path d="M8 16l.5 2.5 2.5.5-2.5.5L8 22l-.5-2.5L5 19l2.5-.5z" />
              </svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
              AI Regulatory Assistant
            </p>
            <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, maxWidth: 380, margin: "0 auto" }}>
              Get AI-driven answers based on FMCSR regulatory text and FMCSA guidance with direct
              links to applicable sections. Note: AI can make mistakes, so please verify important details.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 16 }}>
              {[
                "What are the maximum driving hours?",
                "Who needs a CDL?",
                "Drug testing requirements",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => submitQuestion(q)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 16,
                    border: "1px solid var(--border)",
                    background: "var(--white)",
                    fontSize: 12,
                    color: "var(--text2)",
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            {msg.role === "user" ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    background: "var(--accent)",
                    color: "white",
                    padding: "10px 14px",
                    borderRadius: "14px 14px 4px 14px",
                    fontSize: 13,
                    lineHeight: 1.5,
                    maxWidth: "80%",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    background: "var(--bg2)",
                    padding: "12px 16px",
                    borderRadius: "14px 14px 14px 4px",
                    maxWidth: "95%",
                  }}
                >
                  {renderMarkdown(msg.content)}
                </div>
                {/* Source pills */}
                {(() => {
                  const cites = extractCitations(msg.content);
                  if (cites.length === 0) return null;
                  const pillColors = {
                    regulation: { bg: "var(--accent-bg)", color: "var(--accent)", border: "var(--accent-border)" },
                    guidance: { bg: "#f0fdfa", color: "#0d9488", border: "#99f6e4" },
                    content: { bg: "#eff6ff", color: "#1a6fc4", border: "#bfdbfe" },
                  };
                  return (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 4,
                        marginTop: 8,
                      }}
                    >
                      <span style={{ fontSize: 11, color: "var(--text3)", marginRight: 4 }}>
                        Sources:
                      </span>
                      {cites.map((c) => {
                        const colors = pillColors[c.type];
                        const style = {
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: colors.bg,
                          color: colors.color,
                          border: `1px solid ${colors.border}`,
                          textDecoration: "none" as const,
                        };
                        if (c.type === "content") {
                          return (
                            <a key={c.href} href={c.href} target="_blank" rel="noopener noreferrer" style={style}>
                              {c.label}
                            </a>
                          );
                        }
                        return (
                          <Link key={c.href} href={c.href} style={style}>
                            {c.label}
                          </Link>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ))}

        {/* Streaming response */}
        {streaming && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                background: "var(--bg2)",
                padding: "12px 16px",
                borderRadius: "14px 14px 14px 4px",
                maxWidth: "95%",
              }}
            >
              {renderMarkdown(streaming)}
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 14,
                  background: "var(--accent)",
                  marginLeft: 2,
                  animation: "blink 1s infinite",
                  verticalAlign: "text-bottom",
                }}
              />
              <style>{`@keyframes blink { 0%,50% { opacity: 1 } 51%,100% { opacity: 0 } }`}</style>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !streaming && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                background: "var(--bg2)",
                padding: "12px 16px",
                borderRadius: "14px 14px 14px 4px",
                display: "inline-block",
              }}
            >
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--text3)",
                      animation: `dotPulse 1.2s ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
              <style>{`@keyframes dotPulse { 0%,60%,100% { opacity: 0.3 } 30% { opacity: 1 } }`}</style>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              fontSize: 13,
              color: "#dc2626",
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Scroll sentinel — scrollIntoView target for auto-scroll */}
        <div ref={bottomRef} />
      </div>

      {/* Footer: disclaimer + usage meter */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "8px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexShrink: 0,
        }}
      >
        {/* AI disclaimer */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
          <svg width="12" height="12" fill="none" stroke="var(--text3)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span style={{ fontSize: 10.5, color: "var(--text3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            AI can make mistakes. Verify important regulatory details.
          </span>
        </div>

        {/* Usage meter */}
        {remaining !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <div
              style={{
                width: 60,
                height: 4,
                borderRadius: 2,
                background: "var(--border)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${((20 - remaining) / 20) * 100}%`,
                  borderRadius: 2,
                  background: remaining <= 3 ? "#dc2626" : remaining <= 8 ? "#ca8a04" : "var(--accent)",
                  transition: "width 0.3s, background 0.3s",
                }}
              />
            </div>
            <span style={{ fontSize: 10.5, color: remaining <= 3 ? "#dc2626" : "var(--text3)", whiteSpace: "nowrap", fontWeight: remaining <= 3 ? 600 : 400 }}>
              {20 - remaining}/{20}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Expose submitQuestion for parent component to call
AiChat.displayName = "AiChat";
