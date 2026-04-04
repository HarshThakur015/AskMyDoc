# 🛡️ Support AI: Enterprise RAG Chatbot

An advanced, context-aware Retrieval-Augmented Generation (RAG) system designed for policy document analysis. Built with a **Two-Stage Retrieval (Pinecone + Cross-Encoder)** architecture and **Google Gemini 1.5 Flash**.

---

## ✨ Key Features
- **Section-Aware Ingestion**: Smart chunking that preserves policy structure (e.g., "Section 1: Health Benefits").
- **Two-Stage Re-ranking**: Combines Pinecone vector search with a local Cross-Encoder (`ms-marco-MiniLM-L-6-v2`) for extreme precision.
- **Conversational Memory**: Maintains context across turns (e.g., "And what about the other policy?").
- **Grounding & Safety**: Strict rules to prevent hallucinations; the AI only answers based on provided documents.
- **Meta-Conversational Reasoning**: The AI can explain *why* it can't answer a question based on its instructions.
- **JWT Authentication**: Secure user-isolated document storage and chat history.

---

## 🛠️ Quick Start

### 1. Prerequisites
- Python 3.12+
- PostgreSQL (Neon)
- Pinecone (Serverless index, 768 dimensions - `cosine`)
- Google Gemini API Key

### 2. Setup
```powershell
# Install dependencies
pip install -r requirements.txt

# Configure your environment
# Create a .env file with:
# DATABASE_URL, PINECONE_API_KEY, PINECONE_ENVIRONMENT, 
# COLLECTION_NAME, GEMINI_API_KEY, JWT_SECRET
```

### 3. Run the Server
```powershell
python run.py
```

### 4. Interactive Chat
```powershell
python chat_cli.py
```

---

## 🧪 Unified Validation
We provide a **Master E2E Suite** to verify every component of the system in one go.
```powershell
python test_master_e2e.py
```
**This script tests:**
- ✅ User Registration & JWT Login
- ✅ Document Upload & Ingestion Polling
- ✅ High-Precision Fact Retrieval
- ✅ Multi-turn Conversational Memory
- ✅ Grounding Fallback & Meta-Reasoning

---

## 🏗️ Architecture & Deep Dive
For a full technical breakdown of the ingestion pipeline, retrieval logic, and tech stack, please refer to:
👉 **[ARCHITECTURE.md](./ARCHITECTURE.md)**

---

## 📁 Repository Map
- `backend/app.py`: Flask API & Chat Orchestration.
- `backend/ingestion.py`: Section-aware splitters & Pinecone indexing.
- `backend/retrieval.py`: Vector search & Cross-Encoder re-ranking.
- `backend/llm_handler.py`: Gemini 1.5 Flash & Prompt Engineering.
- `chat_cli.py`: Interactive CLI interface.
- `test_master_e2e.py`: Comprehensive validation suite.

---
Made with ❤️ for high-accuracy document intelligence.
"# AskMyDoc" 
