"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { getSessions, getChatHistory, getSessionDocuments } from "@/lib/api";
import { LogOut, Plus, MessageSquare, FileSearch2 } from "lucide-react";

export default function HistoryPanel() {
  const {
    user, sessions, currentSessionId,
    setSessions, setCurrentSessionId, setActiveDocIds, setMessages, logout,
  } = useStore();

  useEffect(() => {
    // Sessions already in store from localStorage — show immediately.
    // Silently refresh in background to pick up any new sessions.
    getSessions()
      .then((res) => setSessions(res.data || []))
      .catch(() => {});
  }, []);

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setActiveDocIds([]);
  };

  const switchSession = async (id: string | number) => {
    // Set session ID — ChatWindow's useEffect will handle showing messages
    // (cache-first, then background DB refresh). Never blank the screen here.
    setCurrentSessionId(id);

    // Still need to update active doc IDs from DB
    try {
      const docsRes = await getSessionDocuments(id);
      const docIds = (docsRes.data || []).map((d: any) => String(d.id));
      setActiveDocIds(docIds);
    } catch (e) {
      console.error("Failed to load session docs", e);
    }
  };

  // Group sessions by date
  const today = new Date();
  const todaySessions = sessions.filter((s) => {
    const d = new Date(s.created_at);
    return d.toDateString() === today.toDateString();
  });
  const olderSessions = sessions.filter((s) => {
    const d = new Date(s.created_at);
    return d.toDateString() !== today.toDateString();
  });

  return (
    <aside style={{
      width: 260, minWidth: 260, height: "100vh",
      background: "var(--surface)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      zIndex: 10,
    }}>
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 18px 16px" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          boxShadow: "var(--shadow)"
        }}>
          <FileSearch2 size={16} color="#fff" strokeWidth={1.8} />
        </div>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 15.5, color: "var(--text)", letterSpacing: "-0.02em" }}>AskMyDoc</div>
          <div style={{ fontSize: 10, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 500 }}>Document Intelligence</div>
        </div>
      </div>

      {/* New Chat */}
      <div style={{ padding: "0 14px 16px" }}>
        <button onClick={startNewChat} style={{
          width: "100%", padding: "10px 0", borderRadius: 10, border: "none",
          background: "var(--accent)",
          color: "#fff", fontSize: 13.5, fontWeight: 500, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: "var(--shadow)",
          transition: "all 0.2s",
        }}>
          <Plus size={15} strokeWidth={2.5} /> New Chat
        </button>
      </div>

      {/* Session List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 8px" }}>
        {todaySessions.length > 0 && (
          <>
            <div style={{ padding: "8px 18px 6px", fontSize: 10, color: "var(--text-3)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Today</div>
            {todaySessions.map((s) => (
              <div key={s.id} onClick={() => switchSession(s.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 18px", cursor: "pointer",
                  background: currentSessionId === s.id ? "var(--bg-2)" : "transparent",
                  borderLeft: currentSessionId === s.id ? "3px solid var(--accent)" : "3px solid transparent",
                  transition: "all 0.15s",
                }}>
                <MessageSquare size={13} strokeWidth={1.5} style={{ color: currentSessionId === s.id ? "var(--accent)" : "var(--text-3)", flexShrink: 0 }} />
                <span style={{
                  fontSize: 13, color: currentSessionId === s.id ? "var(--text)" : "var(--text-2)",
                  fontWeight: currentSessionId === s.id ? 500 : 400,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{s.title}</span>
              </div>
            ))}
          </>
        )}

        {olderSessions.length > 0 && (
          <>
            <div style={{ padding: "12px 18px 6px", fontSize: 10, color: "var(--text-3)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Previous</div>
            {olderSessions.map((s) => (
              <div key={s.id} onClick={() => switchSession(s.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 18px", cursor: "pointer",
                  background: currentSessionId === s.id ? "var(--bg-2)" : "transparent",
                  borderLeft: currentSessionId === s.id ? "3px solid var(--accent)" : "3px solid transparent",
                  transition: "all 0.15s",
                }}>
                <MessageSquare size={13} strokeWidth={1.5} style={{ color: currentSessionId === s.id ? "var(--accent)" : "var(--text-3)", flexShrink: 0 }} />
                <span style={{
                  fontSize: 13, color: currentSessionId === s.id ? "var(--text)" : "var(--text-2)",
                  fontWeight: currentSessionId === s.id ? 500 : 400,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{s.title}</span>
              </div>
            ))}
          </>
        )}

        {sessions.length === 0 && (
          <div style={{ padding: "32px 18px", textAlign: "center" }}>
            <MessageSquare size={28} strokeWidth={1} style={{ color: "var(--border)", margin: "0 auto 10px", display: "block" }} />
            <div style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.6 }}>
              No conversations yet.<br />
              <span style={{ fontStyle: "italic", fontSize: 11.5 }}>Click "New Chat" to begin.</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{user?.email}</div>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>Authenticated</div>
          </div>
          <button onClick={logout} style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 7,
            padding: "5px 7px", cursor: "pointer", color: "var(--text-3)",
            transition: "all 0.15s", lineHeight: 0,
          }}>
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
