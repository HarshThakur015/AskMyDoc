"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";
import { login, register } from "@/lib/api";
import { Mail, Lock, ArrowRight, ShieldCheck, Sparkles, Fingerprint, Loader2, BookOpen } from "lucide-react";
import ThreeBackground from "./ThreeBackground";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setUser = useStore((s) => s.setUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = isLogin ? await login(email, password) : await register(email, password);
      const token = res.data.token || res.data.access_token;
      // In a real app we might use cookies, but we follow the store pattern here
      localStorage.setItem("token", token);
      localStorage.setItem("email", email);
      setUser({ email, token });
    } catch (err: unknown) {
      const maybeAxiosErr = err as {
        response?: { data?: { error?: string; message?: string } };
      };
      setError(maybeAxiosErr.response?.data?.error || maybeAxiosErr.response?.data?.message || "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: "flex", width: "100vw", minHeight: "100dvh",
      background: "linear-gradient(120deg, #f8fafc 0%, #eef2f7 45%, #f6f8fb 100%)",
      color: "var(--text)", overflow: "hidden", position: "relative"
    }} className="auth-root">
      <ThreeBackground />

      {/* Brand Panel - Left */}
      <div style={{ 
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px",
        position: "relative", zIndex: 5, background: "linear-gradient(to right, rgba(248,250,252,0.78), rgba(248,250,252,0.28))"
      }} className="auth-brand-panel">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
            <div style={{ position: "relative" }}>
               <div style={{
                width: 52, height: 52, borderRadius: 16,
                background: "linear-gradient(135deg, var(--accent), #4338ca)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 30px rgba(99,102,241,0.4)",
              }}>
                <BookOpen size={28} color="#fff" strokeWidth={1.8} />
              </div>
              <motion.div 
                animate={{ top: ["-10%", "110%", "-10%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                style={{
                  position: "absolute", left: -10, right: -10, height: 2,
                  background: "linear-gradient(to right, transparent, var(--accent), transparent)",
                  boxShadow: "0 0 15px var(--accent)", zIndex: 2
                }}
              />
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em" }}>
              AskMyDoc <span style={{ color: "var(--accent)", opacity: 0.8 }}>AI</span>
            </div>
          </div>

          <h1 style={{ 
            fontFamily: "'Playfair Display', serif", fontSize: "4.5rem", fontWeight: 400, 
            lineHeight: 1.1, marginBottom: 24, letterSpacing: "-0.04em" 
          }} className="auth-hero-title">
            Unlock your <br />
            <span style={{ fontStyle: "italic", fontWeight: 300, color: "var(--accent)" }}>Collective Intelligence.</span>
          </h1>
          
          <p style={{ 
            color: "var(--text-3)", fontSize: 18, maxWidth: 460, lineHeight: 1.7, 
            fontFamily: "'Source Serif 4', serif", opacity: 0.7 
          }} className="auth-hero-copy">
            Grounded analysis for modern teams. Turn static documents into clear, useful answers.
          </p>

          <div style={{ display: "flex", gap: 32, marginTop: 60 }} className="auth-feature-row">
            {[
              { icon: <ShieldCheck size={20} />, label: "Secure Access" },
              { icon: <Sparkles size={20} />, label: "Clear Answers" },
              { icon: <Fingerprint size={20} />, label: "Private Workspace" }
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-3)", fontSize: 13, fontWeight: 500 }}>
                <div style={{ color: "var(--accent)" }}>{item.icon}</div>
                {item.label}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Auth Card - Right */}
      <div style={{ 
        width: "50%", display: "flex", alignItems: "center", justifyContent: "center", 
        padding: 40, position: "relative", zIndex: 10 
      }} className="auth-form-panel">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          style={{ 
            width: "100%", maxWidth: 420, padding: 48, borderRadius: 32,
            background: "rgba(255, 255, 255, 0.86)", backdropFilter: "blur(22px)",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow: "0 30px 70px rgba(15, 23, 42, 0.14)",
          }}
          className="auth-card"
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{ fontSize: 36, fontWeight: 600, marginBottom: 12, letterSpacing: "-0.02em", color: "#0f172a", fontFamily: "'Playfair Display', serif" }}>
              {isLogin ? "Welcome Back" : "Create Account"}
            </h2>
            <p style={{ color: "#475569", fontSize: 14 }}>
              {isLogin ? "Sign in to continue" : "Create your account to get started"}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ position: "relative" }}>
              <Mail style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} size={18} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email"
                style={{ 
                  width: "100%", padding: "16px 16px 16px 48px", borderRadius: 14,
                  background: "#ffffff", border: "1px solid rgba(15,23,42,0.12)",
                  color: "var(--text)", fontSize: 14, outline: "none", transition: "all 0.2s"
                }} className="auth-input" />
            </div>

            <div style={{ position: "relative" }}>
              <Lock style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} size={18} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Password"
                style={{ 
                  width: "100%", padding: "16px 16px 16px 48px", borderRadius: 14,
                  background: "#ffffff", border: "1px solid rgba(15,23,42,0.12)",
                  color: "var(--text)", fontSize: 14, outline: "none", transition: "all 0.2s"
                }} className="auth-input" />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  style={{ color: "var(--danger)", fontSize: 13, textAlign: "center", padding: "12px", background: "rgba(220,38,38,0.05)", borderRadius: 10, border: "1px solid rgba(220,38,38,0.1)" }}>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading} style={{
              marginTop: 10, padding: "16px", borderRadius: 14, border: "none",
              background: "var(--accent)", color: "#fff", fontWeight: 600, 
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: "0 10px 25px rgba(61,68,81,0.28)", transition: "all 0.3s"
            }} className="hover-lift">
              {loading ? <Loader2 size={18} className="animate-spin" /> : (isLogin ? "Sign In" : "Create Account")}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div style={{ marginTop: 32, textAlign: "center", fontSize: 14 }}>
            <span style={{ color: "var(--text-3)" }}>
              {isLogin ? "New here?" : "Already have an account?"}
            </span>
            <button onClick={() => { setIsLogin(!isLogin); setError(""); }} style={{
              background: "none", border: "none", color: "var(--accent)",
              fontWeight: 600, cursor: "pointer", marginLeft: 8, textDecoration: "underline"
            }}>
              {isLogin ? "Create account" : "Sign in"}
            </button>
          </div>
        </motion.div>
      </div>

      <style>{`
        .auth-input:focus {
          border-color: var(--accent) !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 3px rgba(61,68,81,0.12);
        }

        @media (max-width: 980px) {
          .auth-root {
            flex-direction: column;
            min-height: 100dvh;
            overflow-y: auto;
          }

          .auth-brand-panel {
            flex: 0 0 auto !important;
            padding: 36px 20px 10px !important;
            background: linear-gradient(to bottom, rgba(248,250,252,0.92), rgba(248,250,252,0.45)) !important;
          }

          .auth-form-panel {
            width: 100% !important;
            padding: 14px 14px 26px !important;
          }

          .auth-card {
            max-width: 560px !important;
            width: 100% !important;
            padding: 30px 22px !important;
            border-radius: 22px !important;
          }

          .auth-hero-title {
            font-size: 2.5rem !important;
            margin-bottom: 16px !important;
          }

          .auth-hero-copy {
            font-size: 15px !important;
            line-height: 1.6 !important;
          }

          .auth-feature-row {
            margin-top: 24px !important;
            gap: 12px !important;
            flex-wrap: wrap;
          }
        }

        @media (max-width: 720px) {
          .auth-brand-panel {
            display: none !important;
          }

          .auth-form-panel {
            width: 100% !important;
            min-height: 100dvh !important;
            padding: 18px 12px !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .auth-card {
            max-width: 430px !important;
            padding: 24px 16px !important;
            border-radius: 18px !important;
          }
        }

        @media (max-width: 420px) {
          .auth-card {
            padding: 20px 14px !important;
            border-radius: 16px !important;
          }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
