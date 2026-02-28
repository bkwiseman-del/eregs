"use client";

import { useState, useEffect } from "react";
import { useInstallPrompt } from "@/lib/pwa/useInstallPrompt";

/** Delay before showing the banner (ms). Let the user settle in first. */
const SHOW_DELAY = 8000;

export function PWAInstallBanner() {
  const { canPrompt, isIOS, installed, shouldShow, promptInstall, dismiss } =
    useInstallPrompt();
  const [visible, setVisible] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Only show on mobile
  useEffect(() => {
    setIsMobile(window.innerWidth < 900);
  }, []);

  // Delayed show
  useEffect(() => {
    if (!shouldShow || !isMobile || installed) return;
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY);
    return () => clearTimeout(timer);
  }, [shouldShow, isMobile, installed]);

  if (!visible || installed) return null;
  // Only show if we have native prompt OR iOS instructions
  if (!canPrompt && !isIOS) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: 62, // above MobileBottomTabs (54px + 8px gap)
          left: 12,
          right: 12,
          zIndex: 9998,
          background: "linear-gradient(135deg, #1a1814 0%, #2d2820 100%)",
          borderRadius: 14,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)",
          fontFamily: "'Inter', sans-serif",
          animation: "slideUpBanner 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <style>{`
          @keyframes slideUpBanner {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>

        {/* App icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#ede9e2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/pwa-logo.svg"
            alt="eRegs"
            width={36}
            height={36}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#f5f0eb",
              marginBottom: 2,
            }}
          >
            Add eRegs to Home Screen
          </div>
          <div style={{ fontSize: 11, color: "#9a948e", lineHeight: 1.4 }}>
            Access regulations offline, even without signal
          </div>
        </div>

        {/* Action button */}
        {canPrompt ? (
          <button
            onClick={promptInstall}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              background: "var(--accent, #c96a2a)",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              flexShrink: 0,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Install
          </button>
        ) : isIOS ? (
          <button
            onClick={() => setShowIOSGuide(true)}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              background: "var(--accent, #c96a2a)",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              flexShrink: 0,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            How to
          </button>
        ) : null}

        {/* Dismiss X */}
        <button
          onClick={() => {
            dismiss();
            setVisible(false);
          }}
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6b6560",
            padding: 4,
            lineHeight: 1,
          }}
          aria-label="Dismiss"
        >
          <svg
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* iOS instructions modal */}
      {showIOSGuide && <IOSInstallGuide onClose={() => setShowIOSGuide(false)} />}
    </>
  );
}

function IOSInstallGuide({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10001,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
        }}
      />
      <div
        style={{
          position: "relative",
          background: "var(--white, #fff)",
          borderRadius: "16px 16px 0 0",
          padding: "24px 20px",
          paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
          width: "100%",
          maxWidth: 420,
          fontFamily: "'Inter', sans-serif",
          animation: "slideUpBanner 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <h3
          style={{
            fontSize: 17,
            fontWeight: 600,
            marginBottom: 16,
            color: "var(--text, #1a1814)",
          }}
        >
          Install eRegs on your iPhone
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Step
            number={1}
            text="Tap the Share button in Safari"
            icon={
              <svg width="20" height="20" fill="none" stroke="#007AFF" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            }
          />
          <Step
            number={2}
            text='Scroll down and tap "Add to Home Screen"'
            icon={
              <svg width="20" height="20" fill="none" stroke="#007AFF" strokeWidth="1.8" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            }
          />
          <Step
            number={3}
            text='Tap "Add" in the top right corner'
            icon={
              <svg width="20" height="20" fill="none" stroke="#34C759" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            }
          />
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: 20,
            padding: "12px 0",
            fontSize: 14,
            fontWeight: 600,
            background: "var(--bg2, #f3f1ee)",
            border: "1px solid var(--border, #e5e1db)",
            borderRadius: 10,
            cursor: "pointer",
            color: "var(--text, #1a1814)",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function Step({
  number,
  text,
  icon,
}: {
  number: number;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "var(--bg2, #f3f1ee)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3, #9a948e)", marginBottom: 1 }}>
          Step {number}
        </div>
        <div style={{ fontSize: 13, color: "var(--text, #1a1814)", lineHeight: 1.4 }}>
          {text}
        </div>
      </div>
    </div>
  );
}
