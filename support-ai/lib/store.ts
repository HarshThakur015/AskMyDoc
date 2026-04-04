import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  email: string;
  token: string;
}

export interface Document {
  id: string;
  filename: string;
  status: "processing" | "completed" | "failed";
  created_at: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date | string;
}

interface Session {
  id: string | number;
  title: string;
  created_at: string;
}

interface AppState {
  user: User | null;
  documents: Document[];
  sessions: Session[];
  currentSessionId: string | number | null;
  activeDocIds: string[];
  messages: Message[];
  // Per-session message cache: { [sessionId]: Message[] }
  messageCache: Record<string, Message[]>;
  isStreaming: boolean;
  previewDocUrl: string | null;

  setUser: (u: User | null) => void;
  setDocuments: (d: Document[]) => void;
  setSessions: (s: Session[]) => void;
  setCurrentSessionId: (id: string | number | null) => void;
  toggleActiveDocId: (id: string) => void;
  setActiveDocIds: (ids: string[]) => void;
  addMessage: (m: Message) => void;
  setMessages: (m: Message[]) => void;
  cacheMessages: (sessionId: string | number, messages: Message[]) => void;
  getCachedMessages: (sessionId: string | number) => Message[] | null;
  setStreaming: (v: boolean) => void;
  setPreviewDocUrl: (url: string | null) => void;
  logout: () => void;
  clearHistory: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      documents: [],
      sessions: [],
      currentSessionId: null,
      activeDocIds: [],
      messages: [],
      messageCache: {},
      isStreaming: false,
      previewDocUrl: null,

      setUser: (user) => set({ user }),
      setDocuments: (documents) => set({ documents }),
      setSessions: (sessions) => set({ sessions }),
      setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
      setActiveDocIds: (activeDocIds) => set({ activeDocIds }),

      toggleActiveDocId: (id) =>
        set((state) => ({
          activeDocIds: state.activeDocIds.includes(id)
            ? state.activeDocIds.filter((d) => d !== id)
            : [...state.activeDocIds, id],
        })),

      addMessage: (m) =>
        set((s) => {
          const updated = [...s.messages, m];
          // Also update cache for current session
          const cache = s.currentSessionId
            ? { ...s.messageCache, [String(s.currentSessionId)]: updated }
            : s.messageCache;
          return { messages: updated, messageCache: cache };
        }),

      setMessages: (messages) =>
        set((s) => {
          // Also update cache for current session
          const cache = s.currentSessionId
            ? { ...s.messageCache, [String(s.currentSessionId)]: messages }
            : s.messageCache;
          return { messages, messageCache: cache };
        }),

      cacheMessages: (sessionId, messages) =>
        set((s) => ({
          messageCache: { ...s.messageCache, [String(sessionId)]: messages },
        })),

      getCachedMessages: (sessionId) =>
        get().messageCache[String(sessionId)] ?? null,

      setStreaming: (isStreaming) => set({ isStreaming }),
      setPreviewDocUrl: (url) => set({ previewDocUrl: url }),

      clearHistory: () => set({ messages: [] }),

      logout: () => {
        if (typeof window !== "undefined") localStorage.removeItem("token");
        set({
          user: null,
          documents: [],
          sessions: [],
          currentSessionId: null,
          activeDocIds: [],
          messages: [],
          messageCache: {},
          previewDocUrl: null,
        });
      },
    }),
    {
      name: "chat-storage",
      partialize: (state) => ({
        // Persist everything needed for instant load
        documents: state.documents,
        sessions: state.sessions,
        activeDocIds: state.activeDocIds,
        currentSessionId: state.currentSessionId,
        messages: state.messages,
        messageCache: state.messageCache,
      }),
    }
  )
);
