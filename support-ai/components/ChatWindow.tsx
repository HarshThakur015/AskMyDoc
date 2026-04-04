"use client";

import { useEffect, useRef, useState } from "react";
import { Message, useStore } from "@/lib/store";
import { sendMessage, getChatHistory, getSessions, createSession } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, FileText, FileSearch2, AlertTriangle, RotateCcw } from "lucide-react";
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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: "flex", gap: 14, justifyContent: isBot ? "flex-start" : "flex-end", maxWidth: "100%" }}>
      {isBot && (
        <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "var(--shadow-sm)" }}>
          <Bot size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxWidth: "calc(100% - 44px)", alignItems: isBot ? "flex-start" : "flex-end" }}>
        <div style={{ background: isBot ? "var(--surface)" : "var(--accent)", border: isBot ? "1px solid var(--border)" : "none", borderRadius: isBot ? "12px 12px 12px 3px" : "12px 12px 3px 12px", padding: "12px 16px", color: isBot ? "var(--text)" : "#fff", fontSize: 14.5, lineHeight: 1.6, boxShadow: isBot ? "var(--shadow-sm)" : "var(--shadow-accent)", position: "relative" }}>
          <ReactMarkdown components={{
            p: (props: any) => <p {...props} style={{ marginBottom: 12 }} />,
            strong: (props: any) => <strong {...props} style={{ fontWeight: 600, color: isBot ? "var(--accent)" : "#fff" }} />,
            ul: (props: any) => <ul {...props} style={{ marginLeft: 18, marginBottom: 12, listStyleType: "disc" }} />,
            ol: (props: any) => <ol {...props} style={{ marginLeft: 18, marginBottom: 12, listStyleType: "decimal" }} />,
            li: (props: any) => <li {...props} style={{ marginBottom: 6 }} />,
          }}>
            {msg.content}
          </ReactMarkdown>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-3)", opacity: 0.7, padding: "0 6px" }}>
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

  const activeDocs = documents.filter((d) => activeDocIds?.includes(d.id));

  useEffect(() => {
    if (!currentSessionId) return;

    // Skip if we just created this session (first message already in state)
    if (skipHistoryReload.current) {
      skipHistoryReload.current = false;
      return;
    }

    // Always show cache immediately if available (zero blank time)
    const cached = useStore.getState().getCachedMessages(currentSessionId);
    if (cached && cached.length > 0) {
      setMessages(cached);
    }
    // Always fetch fresh from DB in background — updates silently when ready
    // This handles both page-reload and session-switch cases
    getChatHistory(currentSessionId)
      .then((res) => {
        const fresh = Array.isArray(res.data) ? res.data : [];
        if (fresh.length > 0) setMessages(fresh); // only update if DB has data
      })
      .catch(() => {}); // never clear on error
  }, [currentSessionId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isStreaming]);

  const submit = async (text?: string) => {
    const q = (text || input).trim();
    if (!q || isStreaming) return;
    if (!activeDocIds || activeDocIds.length === 0) {
      setError("Select at least one document from the right panel.");
      return;
    }
    setInput(""); setError("");
    addMessage({ role: "user", content: q, timestamp: new Date() });
    setStreaming(true);

    let sessionId = currentSessionId;
    try {
      if (!sessionId) {
        const title = q.length > 40 ? q.substring(0, 40) + "..." : q;
        const sessRes = await createSession(title, activeDocIds);
        sessionId = sessRes.data.session_id;
        skipHistoryReload.current = true; // prevent useEffect from wiping messages
        setCurrentSessionId(sessionId);
        getSessions().then((r: any) => setSessions(r.data));
      }
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await sendMessage(activeDocIds, q, history, sessionId ?? undefined);
      const answer = res.data.answer || res.data.response || res.data.message || "No response received.";
      addMessage({ role: "assistant", content: answer, timestamp: new Date() });
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to get response.");
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
    "Summarize the key findings",
    "What are the follow-up steps?",
    "List all important details",
    "Explain the main issues",
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", minWidth: 0, background: "var(--bg)", position: "relative" }}>

      {/* Preview Modal */}
      {previewDocUrl && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "90%", height: "90%", background: "var(--surface)", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 48px rgba(0,0,0,0.25)", border: "1px solid var(--border)" }}>
            <div style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Document Preview</div>
              <button onClick={() => setPreviewDocUrl(null)} style={{ padding: "6px 14px", border: "1px solid var(--border)", borderRadius: 7, fontSize: 13, background: "var(--bg)", cursor: "pointer", color: "var(--text-2)" }}>Close</button>
            </div>
            <div style={{ flex: 1, background: "#f5f5f5", display: "flex" }}>
              <iframe src={previewDocUrl} style={{ flex: 1, width: "100%", height: "100%", border: "none" }} title="Preview" />
            </div>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 24px", borderBottom: "1px solid var(--border)",
        background: "var(--surface)", flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "var(--bg-2)",
          border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <FileSearch2 size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
            {currentSessionId ? (activeDocs.length === 1 ? activeDocs[0]?.filename : `${activeDocs.length || "No"} docs selected`) : "New Conversation"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>
            {currentSessionId ? `${messages.length} messages` : "Select documents from the right panel to begin"}
          </div>
        </div>
        {activeDocs.length > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 500, color: "var(--success)",
            background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
            borderRadius: 6, padding: "3px 10px",
          }}>Ready</span>
        )}
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Empty / Welcome */}
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, padding: "60px 0 40px" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "var(--bg-2)",
              border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "var(--shadow-sm)",
            }}>
              <FileSearch2 size={24} strokeWidth={1.2} style={{ color: "var(--accent)" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 400, color: "var(--text)", marginBottom: 8, letterSpacing: "-0.02em" }}>
                {activeDocIds.length > 0 ? "Ask anything about your documents" : "Start a conversation"}
              </h2>
              <p style={{ color: "var(--text-3)", fontSize: 14, maxWidth: 420, lineHeight: 1.7, fontStyle: "italic" }}>
                {activeDocIds.length > 0
                  ? "I'll retrieve the most relevant sections and provide grounded answers."
                  : "Select one or more documents from the right panel, then type your question below."}
              </p>
            </div>
            {activeDocIds.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 520 }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => submit(s)} style={{
                    fontSize: 12.5, padding: "7px 14px", borderRadius: 8,
                    background: "var(--surface)", border: "1px solid var(--border)",
                    color: "var(--text-2)", cursor: "pointer", transition: "all 0.15s",
                  }}>{s}</button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        </AnimatePresence>

        {isStreaming && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Bot size={13} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px 12px 12px 3px", padding: "10px 14px", boxShadow: "var(--shadow-sm)" }}>
              <TypingIndicator />
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.12)", borderRadius: 10, padding: "11px 14px", color: "var(--danger)", fontSize: 13.5 }}>
              <AlertTriangle size={14} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ flex: 1 }}>{error}</span>
              <button onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", lineHeight: 0 }}>
                <RotateCcw size={12} strokeWidth={1.5} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ padding: "12px 24px 16px", borderTop: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }}>
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-end",
          background: "var(--bg)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "9px 9px 9px 15px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <textarea ref={textareaRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown} disabled={isStreaming}
            placeholder={activeDocIds.length > 0 ? "Ask about your documents… (Enter to send)" : "Select documents first →"}
            style={{ flex: 1, resize: "none", background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 14, fontFamily: "'Source Serif 4', serif", lineHeight: 1.65, paddingTop: 1 }} />
          <button onClick={() => submit()} disabled={!input.trim() || isStreaming || activeDocIds.length === 0}
            style={{
              padding: "8px 14px", flexShrink: 0, borderRadius: 8, border: "none",
              background: input.trim() && activeDocIds.length > 0 ? "linear-gradient(135deg, var(--accent), #7c3aed)" : "var(--border)",
              color: "#fff", cursor: input.trim() && activeDocIds.length > 0 ? "pointer" : "not-allowed",
              transition: "all 0.2s", lineHeight: 0,
              boxShadow: input.trim() && activeDocIds.length > 0 ? "0 2px 6px rgba(99,102,241,0.25)" : "none",
            }}>
            <Send size={14} strokeWidth={1.5} />
          </button>
        </div>
        <p style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 6, textAlign: "center", fontStyle: "italic" }}>
          Answers grounded in document context · conversational memory active
        </p>
      </div>
    </div>
  );
}
