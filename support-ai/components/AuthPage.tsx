"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { login, register } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Loader2, ArrowRight, Mail, Lock, BookOpen } from "lucide-react";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setUser = useStore((s) => s.setUser);

  const handleSubmit = async () => {
    if (!email || !password) { setError("Please fill in both fields."); return; }
    setError(""); setLoading(true);
    try {
      const fn = mode === "login" ? login : register;
      const res = await fn(email, password);
      const token = res.data.token || res.data.access_token;
      localStorage.setItem("token", token);
      localStorage.setItem("email", email);
      setUser({ email, token });
    } catch (e: any) {
      setError(e?.response?.data?.message || "Authentication failed. Please check your credentials.");
    } finally { setLoading(false); }
  };

  return (
    <div className="relative z-10 flex items-center justify-center min-h-screen px-6">
      <div style={{ display: "flex", gap: 56, alignItems: "center", maxWidth: 860, width: "100%" }}>

        {/* Left — editorial brand panel */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="hidden lg:flex"
          style={{ flexDirection: "column", gap: 32, flex: 1 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, background: "var(--accent)",
              borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <BookOpen size={18} color="#fff" strokeWidth={1.5} />
            </div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 500, color: "var(--text)", letterSpacing: "-0.01em" }}>
                Support AI
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Policy Intelligence
              </div>
            </div>
          </div>

          <div>
            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 38, fontWeight: 400,
              lineHeight: 1.2, color: "var(--text)",
              letterSpacing: "-0.02em", marginBottom: 16,
            }}>
              Your documents,<br />
              <em style={{ fontStyle: "italic", color: "var(--text-2)" }}>answered precisely.</em>
            </h1>
            <p style={{ color: "var(--text-2)", fontSize: 15, lineHeight: 1.75, maxWidth: 340 }}>
              Ask questions in plain language. Get grounded answers from your policy documents — no fabrication, no drift.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { n: "01", label: "Two-stage semantic retrieval" },
              { n: "02", label: "Cross-encoder re-ranking" },
              { n: "03", label: "Conversational memory" },
              { n: "04", label: "Strict grounding — never hallucinates" },
            ].map((f) => (
              <div key={f.n} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 11, color: "var(--text-3)",
                  minWidth: 20, fontStyle: "italic",
                }}>
                  {f.n}
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ fontSize: 13, color: "var(--text-2)" }}>{f.label}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11.5, color: "var(--text-3)", letterSpacing: "0.03em" }}>
            Gemini 1.5 Flash · Pinecone · BAAI/bge-base-en-v1.5
          </p>
        </motion.div>

        {/* Right — auth form */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.08 }}
          className="card"
          style={{ width: 380, padding: "36px 32px", flexShrink: 0 }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <BookOpen size={18} style={{ color: "var(--accent)" }} strokeWidth={1.5} />
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 500, fontSize: 16, color: "var(--text)" }}>Support AI</span>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 400, color: "var(--text)", letterSpacing: "-0.01em", marginBottom: 4 }}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-3)", fontStyle: "italic" }}>
              {mode === "login" ? "Sign in to your workspace" : "Start analysing your documents"}
            </p>
          </div>

          {/* Tab row */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
            {(["login", "register"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
                flex: 1, padding: "8px 0", background: "none", border: "none",
                borderBottom: `2px solid ${mode === m ? "var(--accent)" : "transparent"}`,
                fontFamily: "'Source Serif 4', serif", fontSize: 13.5,
                color: mode === m ? "var(--accent)" : "var(--text-3)",
                cursor: "pointer", transition: "all 0.18s", marginBottom: -1,
                fontWeight: mode === m ? 500 : 400,
              }}>
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11.5, color: "var(--text-2)", fontWeight: 500, display: "block", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "'Source Serif 4', serif" }}>
                Email address
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={13} strokeWidth={1.5} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
                <input className="input" style={{ paddingLeft: 34 }} type="email"
                  placeholder="you@company.com" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11.5, color: "var(--text-2)", fontWeight: 500, display: "block", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "'Source Serif 4', serif" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={13} strokeWidth={1.5} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
                <input className="input" style={{ paddingLeft: 34 }} type="password"
                  placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  style={{ background: "rgba(138,48,48,0.06)", border: "1px solid rgba(138,48,48,0.18)", borderRadius: "var(--radius)", padding: "9px 13px", color: "var(--danger)", fontSize: 13, fontStyle: "italic" }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button className="btn-primary" onClick={handleSubmit} disabled={loading}
              style={{ width: "100%", justifyContent: "center", marginTop: 2 }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <>{mode === "login" ? "Sign In" : "Create Account"} <ArrowRight size={14} strokeWidth={1.5} /></>}
            </button>
          </div>

          <p style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12.5, marginTop: 20, fontStyle: "italic" }}>
            {mode === "login" ? "No account? " : "Already registered? "}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontFamily: "'Source Serif 4', serif", fontStyle: "italic" }}>
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
