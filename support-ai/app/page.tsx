"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import AuthPage from "@/components/AuthPage";
import HistoryPanel from "@/components/HistoryPanel";
import ChatWindow from "@/components/ChatWindow";
import DocsPanel from "@/components/DocsPanel";

const ThreeBackground = dynamic(() => import("@/components/ThreeBackground"), { ssr: false });

export default function Home() {
  const { user, setUser } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("token");
    const email = localStorage.getItem("email");
    if (token && email) setUser({ token, email });
  }, []);

  if (!mounted) return null;

  return (
    <>
      <ThreeBackground />
      {!user ? (
        <div style={{ position: "relative", zIndex: 1 }}>
          <AuthPage />
        </div>
      ) : (
        <div style={{
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
        }}>
          <HistoryPanel />
          <ChatWindow />
          <DocsPanel />
        </div>
      )}
    </>
  );
}
