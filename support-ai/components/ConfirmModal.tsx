"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20
        }}>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(23, 23, 23, 0.4)",
              backdropFilter: "blur(8px)"
            }}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            style={{
              width: "100%", maxWidth: 420, 
              background: "#ffffff",
              borderRadius: 32,
              padding: "48px 40px",
              display: "flex", flexDirection: "column", alignItems: "center",
              textAlign: "center",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
              position: "relative",
              zIndex: 1001
            }}
          >
            {/* 3D Trash Can Component (CSS Mockup) */}
            <div style={{ marginBottom: 32, position: "relative" }}>
               <div style={{
                 width: 80, height: 80, 
                 background: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
                 borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                 boxShadow: "inset 0 -4px 8px rgba(0,0,0,0.05), 0 10px 20px -5px rgba(186, 230, 253, 0.5)"
               }}>
                  <div style={{ position: "relative" }}>
                     <Trash2 size={38} color="#0369a1" strokeWidth={1.5} />
                     <motion.div 
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        style={{ position: "absolute", top: -8, left: -4, right: -4, height: 4, background: "rgba(3, 105, 161, 0.2)", borderRadius: 10 }}
                     />
                  </div>
               </div>
            </div>

            <h3 style={{ 
              fontSize: 24, fontWeight: 700, color: "#0f172a", 
              marginBottom: 16, lineHeight: 1.3,
              fontFamily: "var(--font-heading, inherit)"
            }}>
              {title}
            </h3>

            <p style={{ 
              fontSize: 15, color: "#64748b", margin: 0, 
              fontFamily: "var(--font-sans, inherit)",
              opacity: 0.8, fontStyle: "italic"
            }}>
              {message}
            </p>

            <div style={{ 
              display: "flex", gap: 16, width: "100%", marginTop: 40 
            }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: "14px 20px", borderRadius: 12, border: "1px solid #e2e8f0",
                  background: "#ffffff", color: "#1e293b", fontSize: 16, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.2s"
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.background = "#ffffff"}
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                style={{
                  flex: 1, padding: "14px 20px", borderRadius: 12, border: "none",
                  background: "#dc2626", color: "#ffffff", fontSize: 16, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.2s",
                  boxShadow: "0 4px 12px rgba(220, 38, 38, 0.2)"
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.background = "#b91c1c"}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.background = "#dc2626"}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
