"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";
import { login, register } from "@/lib/api";
import { BrainCircuit, Mail, Lock, ArrowRight, ShieldCheck, Sparkles, Fingerprint, Loader2, BookOpen } from "lucide-react";
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
      setError("Credentials required to initialize neural link.");
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
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || "Neural authentication failed. Access denied.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: "flex", width: "100vw", height: "100vh", background: "#050505", 
      color: "var(--text)", overflow: "hidden", position: "relative" 
    }}>
      <ThreeBackground />

      {/* Brand Panel - Left */}
      <div style={{ 
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px",
        position: "relative", zIndex: 5, background: "linear-gradient(to right, rgba(0,0,0,0.4), transparent)"
      }}>
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
          }}>
            Unlock your <br />
            <span style={{ fontStyle: "italic", fontWeight: 300, color: "var(--accent)" }}>Collective Intelligence.</span>
          </h1>
          
          <p style={{ 
            color: "var(--text-3)", fontSize: 18, maxWidth: 460, lineHeight: 1.7, 
            fontFamily: "'Source Serif 4', serif", opacity: 0.7 
          }}>
            Grounded analysis for the modern researcher. Bridge the gap between static archives and dynamic neural insights.
          </p>

          <div style={{ display: "flex", gap: 32, marginTop: 60 }}>
            {[
              { icon: <ShieldCheck size={20} />, label: "Encrypted Node" },
              { icon: <Sparkles size={20} />, label: "Contextual Synthesis" },
              { icon: <Fingerprint size={20} />, label: "Biometric Validated" }
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
      }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          style={{ 
            width: "100%", maxWidth: 420, padding: 48, borderRadius: 32,
            background: "rgba(255, 255, 255, 0.03)", backdropFilter: "blur(40px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 40px 100px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{ fontSize: 28, fontWeight: 600, marginBottom: 12, letterSpacing: "-0.02em" }}>
              {isLogin ? "Welcome Back" : "Initialize Account"}
            </h2>
            <p style={{ color: "var(--text-3)", fontSize: 14 }}>
              {isLogin ? "Reconnect to your neural archives" : "Join the global intelligence network"}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ position: "relative" }}>
              <Mail style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} size={18} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Neural Identity (Email)"
                style={{ 
                  width: "100%", padding: "16px 16px 16px 48px", borderRadius: 14,
                  background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
                  color: "var(--text)", fontSize: 14, outline: "none", transition: "all 0.2s"
                }} className="auth-input" />
            </div>

            <div style={{ position: "relative" }}>
              <Lock style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} size={18} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Authentication Key"
                style={{ 
                  width: "100%", padding: "16px 16px 16px 48px", borderRadius: 14,
                  background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
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
              boxShadow: "0 10px 25px rgba(99,102,241,0.3)", transition: "all 0.3s"
            }} className="hover-lift">
              {loading ? <Loader2 size={18} className="animate-spin" /> : (isLogin ? "Initialize Session" : "Create Profile")}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div style={{ marginTop: 32, textAlign: "center", fontSize: 14 }}>
            <span style={{ color: "var(--text-3)" }}>
              {isLogin ? "New operator?" : "Already registered?"}
            </span>
            <button onClick={() => { setIsLogin(!isLogin); setError(""); }} style={{
              background: "none", border: "none", color: "var(--accent)",
              fontWeight: 600, cursor: "pointer", marginLeft: 8, textDecoration: "underline"
            }}>
              {isLogin ? "Activate Terminal" : "Access Archive"}
            </button>
          </div>
        </motion.div>
      </div>

      <style>{`
        .auth-input:focus {
          border-color: var(--accent) !important;
          background: rgba(99,102,241,0.03) !important;
          box-shadow: 0 0 0 1px var(--accent);
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
