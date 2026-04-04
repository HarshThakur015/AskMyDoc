"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";
import { getDocuments, uploadDocument, deleteDocument, getSessions, createSession, getChatHistory, getSessionDocuments } from "@/lib/api";
import { FileText, Upload, Trash2, BookOpen, LogOut, RefreshCw, AlertCircle, CheckCircle2, Clock, Eye, Plus, MessageSquare } from "lucide-react";

export default function Sidebar() {
  const { user, documents, sessions, currentSessionId, activeDocIds, setDocuments, setSessions, setCurrentSessionId, setActiveDocIds, toggleActiveDocId, setMessages, setPreviewDocUrl, logout } = useStore();
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = async () => {
    try {
      const [docsRes, sessRes] = await Promise.all([getDocuments(), getSessions()]);
      setDocuments(docsRes.data.documents || docsRes.data || []);
      setSessions(sessRes.data || []);
    } catch {}
  };

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(() => {
      const docs = useStore.getState().documents;
      if (docs.some((d) => d.status === "processing")) fetchData();
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { 
      await uploadDocument(file); 
      await fetchData(); 
    } catch {}
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setActiveDocIds([]);
  };

  const switchSession = async (id: string | number) => {
    try {
      setCurrentSessionId(id);
      const [histRes, docsRes] = await Promise.all([
        getChatHistory(id),
        getSessionDocuments(id)
      ]);
      setMessages(histRes.data);
      setActiveDocIds(docsRes.data.map((d: any) => d.id));
    } catch (e) {
      console.error("Failed to switch session", e);
    }
  };

  const handleDelete = async (id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    try { 
      await deleteDocument(id); 
      if (activeDocIds?.includes(id)) toggleActiveDocId(id); 
      await fetchData(); 
    } catch {}
  };

  const statusIcon = (s: string) => {
    if (s === "completed") return <CheckCircle2 size={11} strokeWidth={1.5} style={{ color: "var(--success)" }} />;
    if (s === "failed")    return <AlertCircle   size={11} strokeWidth={1.5} style={{ color: "var(--danger)" }} />;
    return <Clock size={11} strokeWidth={1.5} className="pulse-dot" style={{ color: "var(--warning)" }} />;
  };

  return (
    <aside style={{
      width: 260, minWidth: 260, height: "100vh",
      background: "var(--surface)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      padding: "20px 0", gap: 0, zIndex: 10,
    }}>
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 18px 18px" }}>
        <div style={{ width: 32, height: 32, background: "var(--accent)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <BookOpen size={15} color="#fff" strokeWidth={1.5} />
        </div>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 500, fontSize: 15, color: "var(--text)", letterSpacing: "-0.01em" }}>Support AI</div>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Policy Intelligence</div>
        </div>
      </div>

      <div style={{ padding: "0 14px 14px" }}>
        <button className="btn-primary" onClick={startNewChat} style={{ width: "100%", justifyContent: "center", borderRadius: 10, padding: "10px 0" }}>
          <Plus size={16} strokeWidth={2} /> New Chat
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* Sessions Section */}
        <div>
          <div style={{ padding: "0 18px 8px", color: "var(--text-3)", fontSize: 10.5, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase" }}>
            Recent Chats
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {sessions.map((s) => (
              <div key={s.id} onClick={() => switchSession(s.id)}
                className={`sidebar-link ${currentSessionId === s.id ? "active" : ""}`}
                style={{ borderRadius: 0, paddingLeft: 18 }}>
                <MessageSquare size={13} strokeWidth={1.5} style={{ opacity: 0.6 }} />
                <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
              </div>
            ))}
            {sessions.length === 0 && (
              <div style={{ padding: "12px 18px", fontSize: 12, color: "var(--text-3)", fontStyle: "italic" }}>No history yet</div>
            )}
          </div>
        </div>

        {/* Documents Section */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px 8px", color: "var(--text-3)", fontSize: 10.5, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase" }}>
            <span>Documents</span>
            <button onClick={() => { setRefreshing(true); fetchData().finally(() => setRefreshing(false)); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2, lineHeight: 0 }}>
              <RefreshCw size={10} strokeWidth={1.5} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
          
          <div style={{ padding: "0 14px 8px" }}>
             <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }} onChange={handleUpload} />
             <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: "100%", height: 32, background: "var(--bg)", border: "1px dashed var(--border)", borderRadius: 8, color: "var(--text-2)", fontSize: 11.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
                {uploading ? <RefreshCw size={11} className="animate-spin" /> : <Upload size={11} />}
                Add Document
             </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {documents.map((doc) => {
              const isActive = activeDocIds?.includes(doc.id);
              return (
                <div key={doc.id}
                  className={`sidebar-link ${isActive ? "active" : ""}`}
                  onClick={() => doc.status === "completed" && toggleActiveDocId(doc.id)}
                  style={{ borderRadius: 0, paddingLeft: 18, opacity: doc.status === "processing" ? 0.6 : 1 }}>
                  
                  <div style={{ width: 12, height: 12, borderRadius: 3, border: isActive ? "none" : "1px solid var(--border)", background: isActive ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isActive && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }}/>}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0, marginLeft: 6 }}>
                    <div style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.filename}</div>
                  </div>
                  
                  <div className="actions" style={{ display: "flex", gap: 4 }}>
                    <button onClick={(e) => {
                        e.stopPropagation();
                        const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
                        const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/v1/documents/${doc.id}/file?token=${encodeURIComponent(token || "")}`;
                        setPreviewDocUrl(url);
                    }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 4 }}><Eye size={12} /></button>
                    <button onClick={(e) => handleDelete(doc.id, e)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 4 }}><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "18px 18px 0", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ minWidth: 0 }}>
             <div style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
             <div style={{ fontSize: 10.5, color: "var(--text-3)", fontStyle: "italic" }}>Authenticated Session</div>
          </div>
          <button className="btn-ghost" onClick={logout} style={{ padding: "6px" }}><LogOut size={13} /></button>
        </div>
      </div>
    </aside>
  );
}
