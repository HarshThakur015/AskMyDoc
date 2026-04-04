# Support AI: Enterprise RAG Chatbot Architecture

A high-performance, context-aware Retrieval-Augmented Generation (RAG) system designed for policy document analysis. This system uses a state-of-the-art **two-stage retrieval pipeline** combined with **conversational memory** and **Google Gemini 1.5 Flash**.

---

## 🚀 Tech Stack

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Api Framework** | Flask (Python 3.x) | Lightweight, extensible, and high-performance routing. |
| **User Database** | PostgreSQL (Neon) | Relational storage for user accounts, JWT security, and document metadata. |
| **Vector Database** | Pinecone | Managed vector store for lightning-fast semantic search with metadata filtering. |
| **Embeddings** | `BAAI/bge-base-en-v1.5` | Top-tier open-source model for high-density semantic representation. |
| **Re-ranking** | `ms-marco-MiniLM-L-6-v2` | Cross-Encoder model to accurately rank top candidates for high precision. |
| **Synthesis (LLM)**| Google Gemini 1.5 Flash | Large context window and robust reasoning with strict grounding rules. |

---

## 🏗️ Architecture Overview

The system follows a classic **Retrieve-and-Generate** pattern but with several enterprise-grade enhancements:

### 1. Ingestion Pipeline
1.  **Extraction**: The system parses PDF, DOCX, and TXT files using `PyMuPDF` and `python-docx`.
2.  **Structural Splitter**: Unlike random character cutting, we use a **Section-Aware Splitter**. It identifies `### SECTION` headers to maintain the integrity of policy chapters.
3.  **Vectorization**: Chunks are embedded using the `BAAI` model and stored in Pinecone with `user_id` and `document_id` metadata. This ensures strict data isolation between users.

### 2. Retrieval Engine (The Two-Stage Process)
To ensure the AI never misses the "needle in a haystack," we use a two-step approach:
- **Stage 1 (Vector Search)**: Pinecone fetches the top 8 candidates based on cosine similarity.
- **Stage 2 (Re-Ranking)**: A **Cross-Encoder** analyzes the actual *relevance* of each result against the question. Chunks that look good but are irrelevant are discarded. Only the truly relevant context (top 4 results) proceeds to the LLM.

### 3. Conversational Reasoning
The system maintains an in-memory `history` array. When you ask a question like "Why did you say that?", the system:
1.  Appends previous turns to the current query.
2.  Passes both the **Document Context** and the **Conversational Context** to Gemini.
3.  Allows the LLM to explain its own reasoning (Meta-Conversation).

---

## 🔄 Core Workflows

### User Interaction Workflow
1.  **Auth**: User logs in and receives a JWT token.
2.  **Upload**: User uploads a policy document. The backend starts a background thread for ingestion.
3.  **Polling**: The UI/CLI polls `/api/v1/documents` until the status changes from `processing` to `completed`.
4.  **Query**: User asks a question (e.g., "What is the insurance policy?").
5.  **Retrieval**: The system filters Pinecone by `user_id` to ensure absolute privacy.
6.  **Synthesis**: Gemini combines the document facts with the question and history.

### Security & Privacy
- **Data Isolation**: All vector operations are scoped by `user_id` filters. Even if a document is similar, a user will never see another user's content.
- **JWT Protection**: All core API endpoints require a valid Bearer token.
- **Grounding Guardrails**: The system is instructed to say "I can't find the answer" if the document doesn't contain the fact, preventing AI hallucinations.

---

## 🛠️ Verification & Testing

The system includes a **Master Validation Suite** (`test_master_e2e.py`) which automates:
1.  Registration of a unique test identity.
2.  Full document ingestion and state polling.
3.  Fact verification (Direct questions).
4.  Memory verification (Follow-up questions).
5.  Safety verification (Out-of-domain rejection).

---

## 💬 Using the Interactive Chat CLI (`chat_cli.py`)

The CLI is a user-friendly interface to interact with your support AI.

### 1. Starting the Chat
Ensure your backend server is running (`python run.py`), then launch the CLI:
```powershell
python chat_cli.py
```

### 2. User Authentication
Initially, you can sign up with any email and password.
- **Login**: If you've already created a user, enter your email and password.
- **Automatic Signup**: The CLI will attempt to sign you up automatically if it doesn't recognize your email, ensuring a seamless onboarding experience.
- **Email**: [testuser_1775217755@example.com]
- **Password**: [password123]

### 3. Sample Interaction Scenarios

#### Testing Fact Retrieval
**Question**: "What are the office days?"
**Expected**: "Tuesdays and Thursdays" (if using the test document).

#### Testing Conversational Memory
**Question**: "Tell me more about the first policy."
**Expected**: Acknowledgement of the "Remote Work Policy" based on the context of the previous turn.

#### Testing Grounding & Safety
**Question**: "How do I become a billionaire?"
**Expected**: "I can't find the answer in the uploaded documents." (This confirms the AI is staying grounded to your policies).

#### Testing Meta-Conversational Awareness
**Question**: "Why didn't you answer my last question?"
**Expected**: An explanation that the information was missing from the policy documents provided.

---

## 📁 Repository Structure

```text
/
├── backend/
│   ├── app.py             # Main Flask server & API routes
│   ├── ingestion.py       # Document parsing & Pinecone indexing
│   ├── retrieval.py       # Two-stage search & Re-ranking logic
│   ├── llm_handler.py     # Gemini API integration & Prompt engineering
│   └── auth/              # JWT & Postgres user management
├── chat_cli.py            # User-facing Interactive Chat Interface
├── test_master_e2e.py     # Unified End-to-End Validation Suite
└── run.py                 # Boilerplate to launch the backend
```
