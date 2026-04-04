"use client";
import React, { useEffect, useRef, useState } from "react";
import { Message, useStore } from "@/lib/store";
import { sendMessage, getChatHistory, getSessions, createSession } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, FileText, FileSearch2, AlertTriangle, RotateCcw, Sparkles, BrainCircuit, ShieldAlert, ListChecks } from "lucide-react";
import ReactMarkdown from "react-markdown";

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 3, padding: "2px 0" }}>
      {[0, 1, 2].map((i) => (
        <motion.div key={i} animate={{ opacity: [0.35, 1, 0.35], y: [0, -1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
          style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--accent)" }} />
      ))}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isBot = msg.role === "assistant";
  return (
    <motion.div 
      initial={{ opacity: 0, y: 12, scale: 0.98 }} 
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      style={{ display: "flex", gap: 14, justifyContent: isBot ? "flex-start" : "flex-end", maxWidth: "100%" }}>
      {isBot && (
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: "linear-gradient(135deg, var(--bg-2) 0%, var(--bg-3) 100%)",
          border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, boxShadow: "var(--shadow-sm)"
        }}>
          <Bot size={18} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: "calc(100% - 50px)", alignItems: isBot ? "flex-start" : "flex-end" }}>
        <div style={{
          background: isBot ? "var(--surface)" : "var(--accent)",
          border: isBot ? "1px solid var(--border)" : "none",
          borderRadius: isBot ? "18px 18px 18px 4px" : "18px 18px 4px 18px",
          padding: "14px 20px",
          color: isBot ? "var(--text)" : "#fff",
          fontSize: 15, lineHeight: 1.65,
          boxShadow: isBot ? "0 4px 15px rgba(0,0,0,0.03)" : "0 6px 20px rgba(99,102,241,0.15)",
          position: "relative"
        }}>
          <ReactMarkdown components={{
            p: (props: any) => <p {...props} style={{ marginBottom: 12 }} />,
            strong: (props: any) => <strong {...props} style={{ fontWeight: 600, color: isBot ? "var(--accent)" : "#fff" }} />,
            ul: (props: any) => <ul {...props} style={{ marginLeft: 20, marginBottom: 12, listStyleType: "disc" }} />,
            ol: (props: any) => <ol {...props} style={{ marginLeft: 20, marginBottom: 12, listStyleType: "decimal" }} />,
            li: (props: any) => <li {...props} style={{ marginBottom: 8 }} />,
            code: (props: any) => <code {...props} style={{ background: isBot ? "var(--bg-2)" : "rgba(255,255,255,0.15)", padding: "2px 5px", borderRadius: 4, fontStyle: "normal" }} />,
          }}>
            {msg.content || ""}
          </ReactMarkdown>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-3)", opacity: 0.6, padding: "0 10px", letterSpacing: "0.04em", fontWeight: 500 }}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </motion.div>
  );
}

export default function ChatWindow() {
  const {
    activeDocIds, documents, currentSessionId, messages, isStreaming,
    setSessions, setCurrentSessionId, addMessage, setMessages, setStreaming,
    previewDocUrl, setPreviewDocUrl,
  } = useStore();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipHistoryReload = useRef(false);

  const activeDocs = documents.filter((d) => activeDocIds?.includes(String(d.id)));

  useEffect(() => {
    if (!currentSessionId) return;
    if (skipHistoryReload.current) { skipHistoryReload.current = false; return; }

    const cached = useStore.getState().getCachedMessages(String(currentSessionId));
    if (cached && cached.length > 0) setMessages(cached);

    getChatHistory(currentSessionId)
      .then((res) => {
        const fresh = Array.isArray(res.data) ? res.data : [];
        if (fresh.length > 0) setMessages(fresh);
      })
      .catch(() => {});
  }, [currentSessionId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isStreaming]);

  const submit = async (text?: string) => {
    const q = (text || input).trim();
    if (!q || isStreaming) return;
    if (!activeDocIds || activeDocIds.length === 0) {
      setError("Please select at least one document from the library panel to gain context.");
      return;
    }
    setInput(""); setError("");
    addMessage({ role: "user", content: q, timestamp: new Date() });
    setStreaming(true);

    let sessionId = currentSessionId;
    try {
      if (!sessionId) {
        const sessRes = await createSession(q.substring(0, 40), activeDocIds);
        sessionId = sessRes.data.session_id;
        skipHistoryReload.current = true;
        setCurrentSessionId(sessionId!);
        getSessions().then((r: any) => setSessions(r.data));
      }
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await sendMessage(activeDocIds, q, history, sessionId ?? undefined);
      addMessage({ role: "assistant", content: res.data.answer || "No response received.", timestamp: new Date() });
    } catch (e: any) {
      setError(e.response?.data?.error || "Neural link failure. Connection interrupted.");
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 130) + "px";
    }
  }, [input]);

  const SUGGESTIONS = [
    { label: "Summarize this document", icon: <FileText size={13} /> },
    { label: "Give me an overview", icon: <BrainCircuit size={13} /> },
    { label: "What is this document about?", icon: <Sparkles size={13} /> },
    { label: "Extract key insights", icon: <ListChecks size={13} /> },
    { label: "Identify potential risks", icon: <ShieldAlert size={13} /> },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", minWidth: 0, background: "var(--bg)", position: "relative" }}>

      {/* Preview Modal Overlay */}
      <AnimatePresence>
        {previewDocUrl && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ width: "100%", maxWidth: 1000, height: "90%", background: "var(--surface)", borderRadius: 20, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 30px 60px -12px rgba(0,0,0,0.25)", border: "1px solid var(--border)" }}>
              <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>Document Intelligence Preview</div>
                <button onClick={() => setPreviewDocUrl(null)} style={{ padding: "8px 18px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, background: "var(--bg)", cursor: "pointer", color: "var(--text-2)", fontWeight: 500 }}>Close View</button>
              </div>
              <div style={{ flex: 1, background: "#f8f9fa" }}>
                <iframe src={previewDocUrl} style={{ width: "100%", height: "100%", border: "none" }} title="Preview" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "16px 28px", borderBottom: "1px solid var(--border)",
        background: "var(--surface)", flexShrink: 0,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: "var(--bg-2)",
          border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          boxShadow: "var(--shadow-sm)"
        }}>
          <FileSearch2 size={16} strokeWidth={2} style={{ color: "var(--accent)" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>
            {currentSessionId ? (activeDocs.length === 1 ? activeDocs[0]?.filename : `${activeDocs.length || "No"} Source Nodes`) : "Intelligence Interface"}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 500 }}>
            {currentSessionId ? `${messages.length} Neural Exchanges` : "Awaiting document selection"}
          </div>
        </div>
        {activeDocs.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 10px var(--success)" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Authenticated</span>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "30px 40px", display: "flex", flexDirection: "column", gap: 24 }}>
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, padding: "80px 0 60px" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: "var(--bg-2)", border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "var(--shadow-md)",
            }}>
              <BrainCircuit size={32} strokeWidth={1} style={{ color: "var(--accent)" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 400, color: "var(--text)", marginBottom: 12, letterSpacing: "-0.02em" }}>
                Document Synthesis
              </h2>
              <p style={{ color: "var(--text-3)", fontSize: 15, maxWidth: 460, lineHeight: 1.8, fontStyle: "italic" }}>
                {activeDocIds.length > 0
                  ? "Select a specialized query below to analyze your data repository."
                  : "Bridge the gap with your archives. Select source nodes to initialize the neural link."}
              </p>
            </div>
            {activeDocIds.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", maxWidth: 700 }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s.label} onClick={() => submit(s.label)} 
                    style={{
                      fontSize: 13, padding: "10px 20px", borderRadius: 14,
                      background: "var(--surface)", border: "1px solid var(--border)",
                      color: "var(--text-2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.03)", transition: "all 0.2s", fontWeight: 500
                    }}
                    className="hover-lift"
                  >
                    <span style={{ color: "var(--accent)" }}>{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        <AnimatePresence mode="popLayout">
          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        </AnimatePresence>

        {isStreaming && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Bot size={14} style={{ color: "var(--accent)" }} />
            </div>
            <TypingIndicator />
          </motion.div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.15)", borderRadius: 14, padding: "14px 20px", color: "var(--danger)", fontSize: 14 }}>
              <AlertTriangle size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontWeight: 500 }}>{error}</span>
              <button onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.7 }}>
                <RotateCcw size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} style={{ height: 10 }} />
      </div>

      {/* Input bar */}
      <div style={{ padding: "0 28px 24px", background: "transparent", flexShrink: 0 }}>
        <div style={{
          display: "flex", gap: 12, alignItems: "flex-end",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 16, padding: "12px 14px 12px 20px",
          boxShadow: "0 10px 40px -10px rgba(0,0,0,0.08)",
        }}>
          <textarea ref={textareaRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown} disabled={isStreaming}
            placeholder={activeDocIds.length > 0 ? "Ask anything about your archives…" : "Select source nodes to continue →"}
            style={{ flex: 1, resize: "none", background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 15, fontFamily: "'Source Serif 4', serif", lineHeight: 1.7, paddingTop: 4 }} />
          <button onClick={() => submit()} disabled={!input.trim() || isStreaming || activeDocIds.length === 0}
            style={{
              padding: "10px 18px", flexShrink: 0, borderRadius: 12, border: "none",
              background: input.trim() && activeDocIds.length > 0 ? "var(--accent)" : "var(--bg-3)",
              color: "#fff", cursor: input.trim() && activeDocIds.length > 0 ? "pointer" : "not-allowed",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", lineHeight: 0,
              boxShadow: input.trim() && activeDocIds.length > 0 ? "0 4px 15px rgba(99,102,241,0.3)" : "none",
            }}>
            <Send size={18} strokeWidth={2.2} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 10, textAlign: "center", fontStyle: "italic", opacity: 0.8 }}>
          Grounded Synthesis · Active Neural Retrieval
        </p>
      </div>
    </div>
  );
}
