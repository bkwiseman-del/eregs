"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

type Plan = "pro" | "fleet";

const PLANS = [
  {
    id: "pro" as Plan,
    name: "Pro",
    price: "$9",
    period: "/mo",
    annual: "$89 billed annually",
    description: "Full regulation access with annotations, insights, and offline reading.",
    features: [
      "Highlights, notes & bookmarks",
      "FMCSA guidance & Trucksafe insights",
      "Version history & change diffs",
      "Copy with full CFR citation",
      "Offline access via PWA",
    ],
  },
  {
    id: "fleet" as Plan,
    name: "Fleet Manager",
    price: "$19",
    period: "/mo",
    annual: "$189 billed annually",
    description: "Everything in Pro, plus driver management and acknowledgement tracking.",
    features: [
      "Everything in Pro",
      "Invite & manage drivers",
      "Acknowledgement records",
      "2 free driver invites to start",
      "$4 per driver invite",
    ],
    recommended: true,
  },
];

export default function SignupPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<Plan>("fleet");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Account created but sign-in failed. Please sign in manually.");
      router.push("/login");
      return;
    }

    router.push(`/onboarding/checkout?plan=${selectedPlan}`);
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--bg)",
      padding: "40px 16px 80px",
      overflowY: "auto",
    }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <Image
            src="/images/logo-wordmark.svg"
            alt="eRegs"
            width={120}
            height={43}
            style={{ display: "inline-block" }}
          />
          <p style={{
            marginTop: 8,
            fontSize: 13,
            color: "var(--text3)",
            fontFamily: "'Inter', sans-serif",
          }}>
            Choose a plan to get started
          </p>
        </div>

        {/* Plan cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 24,
        }}>
          {PLANS.map(plan => {
            const selected = selectedPlan === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlan(plan.id)}
                style={{
                  position: "relative",
                  textAlign: "left",
                  background: "var(--white)",
                  border: `2px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 12,
                  padding: "20px",
                  cursor: "pointer",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  boxShadow: selected ? "0 2px 16px rgba(201,106,42,0.12)" : "none",
                }}
              >
                {plan.recommended && (
                  <span style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    background: "var(--accent-bg)",
                    color: "var(--accent-text)",
                    border: "1px solid var(--accent-border)",
                    padding: "3px 8px",
                    borderRadius: 99,
                  }}>
                    Popular
                  </span>
                )}

                {/* Radio indicator */}
                <div style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: `2px solid ${selected ? "var(--accent)" : "var(--border2)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                  transition: "border-color 0.15s",
                }}>
                  {selected && (
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--accent)",
                    }} />
                  )}
                </div>

                <div style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text)",
                  marginBottom: 6,
                  fontFamily: "'Inter', sans-serif",
                }}>
                  {plan.name}
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 26,
                    fontWeight: 700,
                    color: "var(--text)",
                    fontFamily: "'Lora', serif",
                  }}>
                    {plan.price}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--text3)" }}>{plan.period}</span>
                </div>

                <div style={{
                  fontSize: 11,
                  color: "var(--text3)",
                  marginBottom: 12,
                  fontFamily: "'Inter', sans-serif",
                }}>
                  {plan.annual}
                </div>

                <p style={{
                  fontSize: 12,
                  color: "var(--text2)",
                  lineHeight: 1.55,
                  marginBottom: 14,
                  fontFamily: "'Inter', sans-serif",
                }}>
                  {plan.description}
                </p>

                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 7,
                      fontSize: 12,
                      color: "var(--text2)",
                      marginBottom: 5,
                      fontFamily: "'Inter', sans-serif",
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="var(--accent)" strokeWidth="2.5"
                        style={{ flexShrink: 0, marginTop: 1 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* Account form */}
        <div style={{
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "28px 28px 24px",
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text3)",
            marginBottom: 18,
            fontFamily: "'Inter', sans-serif",
          }}>
            Create your account
          </div>

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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text2)",
                  marginBottom: 6,
                  fontFamily: "'Inter', sans-serif",
                }}>
                  Full name
                </label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border2)",
                    fontSize: 13,
                    color: "var(--text)",
                    background: "var(--bg)",
                    fontFamily: "'Inter', sans-serif",
                    outline: "none",
                  }}
                  onFocus={e => e.target.style.borderColor = "var(--accent)"}
                  onBlur={e => e.target.style.borderColor = "var(--border2)"}
                />
              </div>
              <div>
                <label style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text2)",
                  marginBottom: 6,
                  fontFamily: "'Inter', sans-serif",
                }}>
                  Work email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border2)",
                    fontSize: 13,
                    color: "var(--text)",
                    background: "var(--bg)",
                    fontFamily: "'Inter', sans-serif",
                    outline: "none",
                  }}
                  onFocus={e => e.target.style.borderColor = "var(--accent)"}
                  onBlur={e => e.target.style.borderColor = "var(--border2)"}
                />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text2)",
                marginBottom: 6,
                fontFamily: "'Inter', sans-serif",
              }}>
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border2)",
                  fontSize: 13,
                  color: "var(--text)",
                  background: "var(--bg)",
                  fontFamily: "'Inter', sans-serif",
                  outline: "none",
                }}
                onFocus={e => e.target.style.borderColor = "var(--accent)"}
                onBlur={e => e.target.style.borderColor = "var(--border2)"}
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
              {loading
                ? "Creating account…"
                : `Get started with ${PLANS.find(p => p.id === selectedPlan)?.name}`
              }
            </button>
          </form>

          <div style={{
            borderTop: "1px solid var(--border)",
            marginTop: 20,
            paddingTop: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <p style={{ fontSize: 12, color: "var(--text3)", fontFamily: "'Inter', sans-serif" }}>
              Already have an account?{" "}
              <Link href="/login" style={{ color: "var(--accent)", fontWeight: 500 }}>
                Sign in
              </Link>
            </p>
            <p style={{ fontSize: 12, color: "var(--text3)", fontFamily: "'Inter', sans-serif" }}>
              Need enterprise?{" "}
              <Link href="/contact" style={{ color: "var(--accent)", fontWeight: 500 }}>
                Contact us
              </Link>
            </p>
          </div>

          <p style={{
            fontSize: 11,
            color: "var(--text3)",
            textAlign: "center",
            marginTop: 12,
            fontFamily: "'Inter', sans-serif",
            lineHeight: 1.6,
          }}>
            By signing up you agree to our{" "}
            <Link href="/terms" style={{ color: "var(--text2)" }}>Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy" style={{ color: "var(--text2)" }}>Privacy Policy</Link>.
          </p>
        </div>

      </div>
    </div>
  );
}
