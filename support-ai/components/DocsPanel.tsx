"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { getDocuments, uploadDocument, deleteDocument } from "@/lib/api";
import { FileText, Upload, Trash2, RefreshCw, Eye, CheckCircle2, AlertCircle, Clock, FolderOpen } from "lucide-react";

export default function DocsPanel() {
  const {
    documents, activeDocIds,
    setDocuments, toggleActiveDocId, setPreviewDocUrl,
  } = useStore();
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDocs = async (silent = false) => {
    // silent=true means don't show a loading state, just update in background
    if (!silent) setUploading(false);
    try {
      const res = await getDocuments();
      setDocuments(res.data.documents || res.data || []);
    } catch {}
  };

  useEffect(() => {
    // Documents already in store from localStorage — show immediately.
    // Fire a background refresh to pick up any changes since last visit.
    fetchDocs(true);
    pollRef.current = setInterval(() => {
      const docs = useStore.getState().documents;
      if (docs.some((d) => d.status === "processing")) fetchDocs(true);
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await uploadDocument(file);
      await fetchDocs();
    } catch {}
    setUploading(false);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDelete = async (id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    try {
      await deleteDocument(id);
      await fetchDocs();
    } catch {}
  };

  const statusBadge = (s: string) => {
    if (s === "completed") return <CheckCircle2 size={11} strokeWidth={2} style={{ color: "var(--success)" }} />;
    if (s === "failed") return <AlertCircle size={11} strokeWidth={2} style={{ color: "var(--danger)" }} />;
    return <Clock size={11} strokeWidth={2} className="pulse-dot" style={{ color: "var(--warning)" }} />;
  };

  const selectedCount = documents.filter((d) => activeDocIds?.includes(d.id)).length;

  return (
    <aside style={{
      width: 280, minWidth: 280, height: "100vh",
      background: "var(--surface)",
      borderLeft: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      zIndex: 10,
    }}>
      {/* Header */}
      <div style={{ padding: "20px 18px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FolderOpen size={15} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>Documents</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {selectedCount > 0 && (
              <span style={{
                fontSize: 10.5, fontWeight: 600, color: "#fff",
                background: "var(--accent)", borderRadius: 10,
                padding: "2px 8px", lineHeight: "16px",
              }}>{selectedCount} selected</span>
            )}
            <button onClick={() => { setRefreshing(true); fetchDocs().finally(() => setRefreshing(false)); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2, lineHeight: 0 }}>
              <RefreshCw size={12} strokeWidth={1.5} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Upload area */}
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }} onChange={onFileChange} />
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            padding: "14px 16px", borderRadius: 10, cursor: "pointer",
            border: dragOver ? "2px solid var(--accent)" : "2px dashed var(--border)",
            background: dragOver ? "rgba(99,102,241,0.05)" : "var(--bg)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            transition: "all 0.2s",
          }}
        >
          {uploading ? (
            <RefreshCw size={16} className="animate-spin" style={{ color: "var(--accent)" }} />
          ) : (
            <Upload size={16} style={{ color: dragOver ? "var(--accent)" : "var(--text-3)" }} />
          )}
          <span style={{ fontSize: 12, color: dragOver ? "var(--accent)" : "var(--text-3)", textAlign: "center" }}>
            {uploading ? "Uploading..." : "Drop file here or click to upload"}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-3)", opacity: 0.6 }}>PDF, DOCX, TXT</span>
        </div>
      </div>

      {/* Document list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        <div style={{ padding: "6px 18px 8px", fontSize: 10, color: "var(--text-3)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          All Files ({documents.length})
        </div>

        {documents.length === 0 && (
          <div style={{ padding: "28px 18px", textAlign: "center" }}>
            <FileText size={28} strokeWidth={1} style={{ color: "var(--border)", margin: "0 auto 10px", display: "block" }} />
            <div style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.6 }}>
              No documents uploaded.<br />
              <span style={{ fontStyle: "italic", fontSize: 11.5 }}>Upload a file to get started.</span>
            </div>
          </div>
        )}

        {documents.map((doc) => {
          const isActive = activeDocIds?.includes(doc.id);
          const isReady = doc.status === "completed";
          return (
            <div key={doc.id}
              onClick={() => isReady && toggleActiveDocId(doc.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 18px", cursor: isReady ? "pointer" : "default",
                background: isActive ? "rgba(99,102,241,0.06)" : "transparent",
                borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                opacity: doc.status === "processing" ? 0.6 : 1,
                transition: "all 0.15s",
              }}>
              {/* Checkbox */}
              <div style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                border: isActive ? "none" : "1.5px solid var(--border)",
                background: isActive ? "var(--accent)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}>
                {isActive && <CheckCircle2 size={10} color="#fff" strokeWidth={2.5} />}
              </div>

              {/* Icon + name */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 7 }}>
                <FileText size={13} style={{ color: isActive ? "var(--accent)" : "var(--text-3)", flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: isActive ? "var(--text)" : "var(--text-2)",
                    fontWeight: isActive ? 500 : 400,
                  }}>{doc.filename}</div>
                </div>
              </div>

              {/* Status + actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                {statusBadge(doc.status)}
                <button onClick={(e) => {
                  e.stopPropagation();
                  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
                  const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/v1/documents/${doc.id}/file?token=${encodeURIComponent(token || "")}`;
                  setPreviewDocUrl(url);
                }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 3, lineHeight: 0 }}>
                  <Eye size={12} />
                </button>
                <button onClick={(e) => handleDelete(doc.id, e)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 3, lineHeight: 0 }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tip */}
      <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic", lineHeight: 1.5, textAlign: "center" }}>
          Select documents to use as context in your chat
        </div>
      </div>
    </aside>
  );
}
