"use client";

import { useEffect, useState } from "react";

interface Props {
  message: string;
  visible: boolean;
}

export function Toast({ message, visible }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 2300);
      return () => clearTimeout(timer);
    }
  }, [visible, message]);

  return (
    <div style={{
      position: "fixed",
      bottom: 80,
      left: "50%",
      transform: `translateX(-50%) translateY(${show ? "0" : "20px"})`,
      background: "var(--text)",
      color: "white",
      padding: "9px 18px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 500,
      fontFamily: "'Inter', sans-serif",
      boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
      zIndex: 500,
      opacity: show ? 1 : 0,
      transition: "all 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
      pointerEvents: "none",
      whiteSpace: "nowrap",
    }}>
      {message}
    </div>
  );
}
