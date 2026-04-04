"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";
import { getSessions, getChatHistory, getSessionDocuments, deleteSession } from "@/lib/api";
import { LogOut, Plus, MessageSquare, FileSearch2, Trash2, LayoutDashboard, BrainCircuit, Sparkles, ChevronRight, BookOpen } from "lucide-react";
import ConfirmModal from "./ConfirmModal";

export default function HistoryPanel() {
  const {
    user, sessions, currentSessionId,
    setSessions, setCurrentSessionId, setActiveDocIds, setMessages, logout,
  } = useStore();
  const [deletingSession, setDeletingSession] = useState<{ id: string | number, title: string } | null>(null);

  const fetchSessions = async () => {
    try {
      const res = await getSessions();
      setSessions(res.data || []);
    } catch {}
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const confirmDeleteSession = async () => {
    if (!deletingSession) return;
    try {
      await deleteSession(deletingSession.id);
      if (String(currentSessionId) === String(deletingSession.id)) {
        setCurrentSessionId(null);
        setMessages([]);
        setActiveDocIds([]);
      }
      await fetchSessions();
    } catch (e) {
      console.error("Failed to delete session", e);
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setActiveDocIds([]);
  };

  const switchSession = async (id: string | number) => {
    setCurrentSessionId(id);
    try {
      const docsRes = await getSessionDocuments(id);
      const docIds = (docsRes.data || []).map((d: any) => String(d.id));
      setActiveDocIds(docIds);
    } catch (e) {
      console.error("Failed to load session docs", e);
    }
  };

  // Grouping logic
  const today = new Date();
  const todaySessions = sessions.filter((s) => new Date(s.created_at).toDateString() === today.toDateString());
  const olderSessions = sessions.filter((s) => new Date(s.created_at).toDateString() !== today.toDateString());

  return (
    <aside style={{
      width: 280, minWidth: 280, height: "100vh",
      background: "var(--surface)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      zIndex: 10,
    }}>
      {/* Brand Header */}
      <div style={{ padding: "24px 22px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: "linear-gradient(135deg, var(--accent) 0%, #4338ca 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 16px -4px rgba(99,102,241,0.3)"
          }}>
            <BookOpen size={20} color="#fff" strokeWidth={1.8} />
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 17, color: "var(--text)", letterSpacing: "-0.01em" }}>AskMyDoc</div>
            <div style={{ fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, opacity: 0.8 }}>Neural Archive</div>
          </div>
        </div>
      </div>

      {/* New Session Action */}
      <div style={{ padding: "0 18px 20px" }}>
        <button onClick={startNewChat} style={{
          width: "100%", padding: "12px 0", borderRadius: 14, border: "none",
          background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          boxShadow: "0 4px 12px rgba(99,102,241,0.2)",
          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        }} className="hover-lift">
          <Plus size={16} strokeWidth={2.5} /> Initialize Workspace
        </button>
      </div>

      {/* Scrollable List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 8px" }}>
        <AnimatePresence mode="popLayout">
          {todaySessions.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ padding: "10px 14px 8px", fontSize: 10.5, color: "var(--text-3)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6 }}>Recent Activity</div>
              {todaySessions.map((s) => (
                <SessionItem key={s.id} session={s} isActive={String(currentSessionId) === String(s.id)} onClick={() => switchSession(s.id)} onDelete={() => setDeletingSession({ id: s.id, title: s.title })} />
              ))}
            </motion.div>
          )}

          {olderSessions.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 16 }}>
              <div style={{ padding: "10px 14px 8px", fontSize: 10.5, color: "var(--text-3)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6 }}>Historical Traces</div>
              {olderSessions.map((s) => (
                <SessionItem key={s.id} session={s} isActive={String(currentSessionId) === String(s.id)} onClick={() => switchSession(s.id)} onDelete={() => setDeletingSession({ id: s.id, title: s.title })} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {sessions.length === 0 && (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <Sparkles size={32} strokeWidth={1} style={{ color: "var(--border)", margin: "0 auto 14px", display: "block", opacity: 0.4 }} />
            <div style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.6 }}>
              No neural exchanges found.<br />
              <span style={{ fontStyle: "italic", opacity: 0.7 }}>Launch a workspace to begin.</span>
            </div>
          </div>
        )}
      </div>

      {/* Identity Footer */}
      <div style={{ padding: "20px", borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.01)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ 
            width: 32, height: 32, borderRadius: "50%", 
            background: "var(--bg-3)", border: "1.5px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
          }}>
            <LayoutDashboard size={14} color="var(--text-2)" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{user?.email}</div>
            <div style={{ fontSize: 10.5, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--success)" }} /> Linked Operator
            </div>
          </div>
          <button onClick={logout} style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 10,
            padding: "6px", cursor: "pointer", color: "var(--text-3)",
            transition: "all 0.2s", display: "flex"
          }} className="hover-bg">
            <LogOut size={14} />
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deletingSession}
        onClose={() => setDeletingSession(null)}
        onConfirm={confirmDeleteSession}
        title="Are you sure you want to delete this chat?"
        message={`"${deletingSession?.title}"`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </aside>
  );
}

function SessionItem({ session, isActive, onClick, onDelete }: any) {
  return (
    <motion.div 
      onClick={onClick}
      whileHover={{ x: 4 }}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 14px", borderRadius: 12, cursor: "pointer",
        background: isActive ? "rgba(99,102,241,0.06)" : "transparent",
        border: isActive ? "1px solid rgba(99,102,241,0.12)" : "1px solid transparent",
        marginBottom: 2, transition: "all 0.2s",
        position: "relative"
      }}
      className={!isActive ? "hover-bg" : ""}
    >
      <div style={{
        width: 8, height: 8, borderRadius: "50%", 
        background: isActive ? "var(--accent)" : "transparent", 
        border: isActive ? "none" : "1.5px solid var(--border)",
        flexShrink: 0
      }} />
      <span style={{
        flex: 1, fontSize: 13.5, color: isActive ? "var(--text)" : "var(--text-2)",
        fontWeight: isActive ? 600 : 450,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{session.title}</span>
      
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} 
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 4, display: "flex", opacity: isActive ? 1 : 0.4 }}>
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  );
}
