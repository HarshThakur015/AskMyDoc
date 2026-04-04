import axios from "axios";

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
});

// Attach JWT token to every request
API.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = (email: string, password: string) =>
  API.post("/auth/login", { email, password });

export const register = (email: string, password: string) =>
  API.post("/auth/signup", { username: email.split('@')[0] || email, email, password });

// Documents
export const uploadDocument = (file: File) => {
  const fd = new FormData();
  fd.append("files", file);
  return API.post("/api/v1/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const getDocuments = () => API.get("/api/v1/documents");

export const deleteDocument = (docId: string) =>
  API.delete(`/api/v1/documents/${docId}`);

// Chat
export const sendMessage = (
  documentIds: string[],
  question: string,
  history: { role: string; content: string }[],
  sessionId?: string | number
) => API.post("/api/v1/chat/run", { document_ids: documentIds, question, history, session_id: sessionId });

export const getChatHistory = (sessionId?: string | number) => 
  API.get("/api/v1/chat/history", { params: { session_id: sessionId } });

export const clearChatHistory = () => API.post("/api/v1/chat/history/clear");

// Sessions
export const createSession = (title: string, documentIds: string[]) =>
  API.post("/api/v1/sessions", { title, document_ids: documentIds });

export const getSessions = () => API.get("/api/v1/sessions");

export const getSessionDocuments = (sessionId: string | number) =>
  API.get(`/api/v1/sessions/${sessionId}/documents`);

export const deleteSession = (sessionId: string | number) =>
  API.delete(`/api/v1/sessions/${sessionId}`);
