"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push("/regs/390.5");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid var(--border2)",
    fontSize: 13,
    color: "var(--text)",
    background: "var(--bg)",
    fontFamily: "'Inter', sans-serif",
    outline: "none",
    transition: "border-color 0.15s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text2)",
    marginBottom: 6,
    fontFamily: "'Inter', sans-serif",
  };

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 16px",
    }}>
      <div style={{ maxWidth: 400, width: "100%" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/">
            <Image
              src="/images/logo-wordmark.svg"
              alt="eRegs"
              width={120}
              height={43}
              style={{ display: "inline-block" }}
            />
          </Link>
          <p style={{
            marginTop: 8,
            fontSize: 14,
            color: "var(--text3)",
            fontFamily: "'Inter', sans-serif",
          }}>
            Sign in to your account
          </p>
        </div>

        {/* Form card */}
        <div style={{
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "28px 28px 24px",
          boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
        }}>
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                fontSize: 13,
                color: "#b91c1c",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 16,
                fontFamily: "'Inter', sans-serif",
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label htmlFor="email" style={labelStyle}>Email address</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border2)")}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label htmlFor="password" style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
                <Link href="/forgot-password" style={{
                  fontSize: 11.5,
                  color: "var(--accent)",
                  fontWeight: 500,
                  fontFamily: "'Inter', sans-serif",
                }}>
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border2)")}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "11px 16px",
                borderRadius: 9,
                border: "none",
                background: loading ? "var(--border2)" : "var(--accent)",
                color: "white",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div style={{
            borderTop: "1px solid var(--border)",
            marginTop: 20,
            paddingTop: 16,
            textAlign: "center",
          }}>
            <p style={{ fontSize: 12, color: "var(--text3)", fontFamily: "'Inter', sans-serif" }}>
              Don&apos;t have an account?{" "}
              <Link href="/signup" style={{ color: "var(--accent)", fontWeight: 500 }}>
                Start free trial
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
