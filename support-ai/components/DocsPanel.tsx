"use client";
import React, { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { getDocuments, uploadDocument, deleteDocument } from "@/lib/api";
import { FileText, Upload, Trash2, RefreshCw, Eye, CheckCircle2, AlertCircle, Clock, FolderOpen } from "lucide-react";
import ConfirmModal from "./ConfirmModal";

/**
 * Modern, slim progress bar for background processing
 */
function ProcessingBar() {
  return (
    <div style={{ width: "100%", height: 3, background: "rgba(0,0,0,0.04)", borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
      <div 
        className="pulse-bg" 
        style={{ 
          width: "40%", height: "100%", 
          background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
          animation: "shimmer-move 1.5s infinite linear"
        }} 
      />
      <style>{`
        @keyframes shimmer-move {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
}

export default function DocsPanel() {
  const {
    documents, activeDocIds,
    setDocuments, toggleActiveDocId, setPreviewDocUrl, setActiveDocIds,
  } = useStore();
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<{ id: string | number, name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDocs = async (silent = false) => {
    if (!silent) setUploading(false);
    try {
      const res = await getDocuments();
      setDocuments(res.data.documents || res.data || []);
    } catch {}
  };

  useEffect(() => {
    fetchDocs(true);
    pollRef.current = setInterval(() => {
      const docs = useStore.getState().documents;
      if (docs.some((d: any) => d.status === "processing")) fetchDocs(true);
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      console.log(`Starting upload for "${file.name}"...`);
      await uploadDocument(file);
      console.log("Upload accepted. Document is now being processed in the background.");
      await fetchDocs();
    } catch (e: any) {
      console.error("Upload failed:", e);
      const status = e.response?.status;
      const errorMsg = e.response?.data?.error || e.message || "Unknown error";
      
      if (status === 401) {
        alert("Session Expired: Re-authentication required. Please Logout and Login again.");
      } else {
        alert(`Upload Protocol Error [${status}]: ${errorMsg}`);
      }
    }
    setUploading(false);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const confirmDelete = async () => {
    if (!deletingDoc) return;
    const targetDoc = deletingDoc;
    const targetId = String(targetDoc.id);
    const prevDocs = useStore.getState().documents;
    const prevActiveIds = useStore.getState().activeDocIds;

    // Close modal and update UI first for faster perceived deletion.
    setDeletingDoc(null);
    setDocuments(prevDocs.filter((d: any) => String(d.id) !== targetId));
    setActiveDocIds(prevActiveIds.filter((id) => id !== targetId));

    try {
      await deleteDocument(targetDoc.id);
      fetchDocs(true);
    } catch (e) {
      console.error("Delete failed", e);
      // If backend delete fails, restore from server state.
      fetchDocs(true);
    }
  };

  const statusBadge = (s: string) => {
    if (s === "completed") return <CheckCircle2 size={11} strokeWidth={2} style={{ color: "var(--success)" }} />;
    if (s === "failed") return <AlertCircle size={11} strokeWidth={2} style={{ color: "var(--danger)" }} />;
    return <Clock size={11} strokeWidth={2} className="pulse-dot" style={{ color: "var(--warning)" }} />;
  };

  const selectedCount = documents.filter((d) => activeDocIds?.includes(String(d.id))).length;
  const failedCount = documents.filter((d) => d.status === "failed").length;

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <aside style={{
      width: 290, minWidth: 290, height: "100vh",
      background: "var(--surface)",
      borderLeft: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      zIndex: 10,
    }}>
      {/* Brand & Header */}
      <div style={{ padding: "20px 20px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FolderOpen size={16} strokeWidth={2} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>Library</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {selectedCount > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#fff",
                background: "var(--accent)", borderRadius: 12,
                padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.02em"
              }}>{selectedCount} Selected</span>
            )}
            <button onClick={() => { setRefreshing(true); fetchDocs().finally(() => setRefreshing(false)); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2, display: "flex" }}>
              <RefreshCw size={13} strokeWidth={2} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Upload Dropzone */}
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: "none" }} onChange={onFileChange} />
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            padding: "18px", borderRadius: 14, cursor: "pointer",
            border: dragOver ? "2px solid var(--accent)" : "2px dashed var(--border)",
            background: dragOver ? "rgba(99,102,241,0.04)" : "rgba(0,0,0,0.015)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          className="hover-lift"
        >
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 10px rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.03)"
          }}>
            {uploading ? (
              <RefreshCw size={18} className="animate-spin" style={{ color: "var(--accent)" }} />
            ) : (
              <Upload size={18} strokeWidth={2} style={{ color: dragOver ? "var(--accent)" : "var(--text-3)" }} />
            )}
          </div>
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", display: "block" }}>
              {uploading ? "Processing file..." : "Upload Document"}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2, display: "block" }}>PDF, DOC/DOCX, or TXT Files</span>
          </div>
        </div>
      </div>

      {/* Dynamic List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
        <div style={{ padding: "0 10px 10px", fontSize: 10, color: "var(--text-3)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Repository Internal Files
        </div>

        {failedCount > 0 && (
          <div style={{
            margin: "0 10px 10px",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid rgba(239, 68, 68, 0.2)",
            background: "rgba(239, 68, 68, 0.06)",
            color: "var(--danger)",
            fontSize: 11,
            lineHeight: 1.4,
          }}>
            {failedCount} document{failedCount > 1 ? "s" : ""} failed processing. Open the file row to see the exact reason.
          </div>
        )}

        {documents.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <FileText size={32} strokeWidth={1} style={{ color: "var(--border)", margin: "0 auto 12px", opacity: 0.5 }} />
            <div style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.5 }}>
              Your library is empty.<br />
              <span style={{ fontStyle: "italic", opacity: 0.8 }}>Upload files to start chatting.</span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {documents.map((doc) => {
            const isActive = activeDocIds?.includes(String(doc.id));
            const isReady = doc.status === "completed";
            const isProcessing = doc.status === "processing";
            const isFailed = doc.status === "failed";
            const failureReason = (doc as any).error_message as string | undefined;
            
            return (
              <div key={doc.id}
                onClick={() => isReady && toggleActiveDocId(String(doc.id))}
                style={{
                  display: "flex", flexDirection: "column", gap: 2,
                  padding: "10px 12px", borderRadius: 12,
                  cursor: isReady ? "pointer" : "default",
                  background: isActive ? "rgba(99,102,241,0.05)" : "transparent",
                  border: isActive ? "1px solid rgba(99,102,241,0.1)" : "1px solid transparent",
                  transition: "all 0.2s ease",
                  position: "relative"
                }}
                className={isReady ? "hover-bg" : ""}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Neural Checkbox */}
                  <div style={{
                    width: 16, height: 16, borderRadius: 5, flexShrink: 0,
                    border: isActive ? "none" : "1.5px solid var(--border)",
                    background: isActive ? "var(--accent)" : "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                    boxShadow: isActive ? "0 2px 6px rgba(99,102,241,0.3)" : "none"
                  }}>
                    {isActive && <CheckCircle2 size={10} color="#fff" strokeWidth={3} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      color: isProcessing ? "var(--text-3)" : isFailed ? "var(--danger)" : "var(--text-2)",
                      fontWeight: isActive ? 600 : 400,
                    }}>{doc.filename}</div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {statusBadge(doc.status)}
                    <button onClick={(e) => {
                      e.stopPropagation();
                      const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
                      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/v1/documents/${doc.id}/file?token=${encodeURIComponent(token || "")}`;
                      setPreviewDocUrl(url);
                    }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 4, display: "flex" }}>
                      <Eye size={13} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeletingDoc({ id: doc.id, name: doc.filename }); }} 
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 4, display: "flex" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {isProcessing && <ProcessingBar />}
                {isFailed && failureReason && (
                  <div style={{
                    marginTop: 4,
                    marginLeft: 26,
                    fontSize: 11,
                    color: "var(--danger)",
                    lineHeight: 1.4,
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  }}>
                    {failureReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Context Indicator */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.01)" }}>
        <div style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic", lineHeight: 1.5, textAlign: "center" }}>
          Selected files are used as context<br />for your answers.
        </div>
      </div>
      <ConfirmModal
        isOpen={!!deletingDoc}
        onClose={() => setDeletingDoc(null)}
        onConfirm={confirmDelete}
        title="Are you sure you want to delete this file?"
        message={`"${deletingDoc?.name}"`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </aside>
  );
}
