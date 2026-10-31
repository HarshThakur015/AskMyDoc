# High-Level Design (HLD)

## 1. Overview

Support AI is a policy-document Q&A platform built around a retrieval-augmented generation (RAG) architecture. It allows authenticated users to upload policy documents, index their content for semantic retrieval, and ask natural-language questions grounded in those documents.

The platform combines:
- Flask backend for application logic and API orchestration
- PostgreSQL for user and document metadata
- Pinecone for vector search
- Google Gemini for embedding and answer generation
- Next.js frontend for user interaction

## 2. Design Goals

### Functional Goals
- Accept policy documents from users
- Extract and chunk text reliably
- Embed text and index it for search
- Retrieve relevant excerpts based on the user question
- Generate grounded answers from the retrieved context
- Maintain multi-turn conversational context

### Quality Goals
- Privacy and data isolation per user
- High answer precision for policy and factual questions
- Graceful failure handling when no relevant document content is found
- Fast enough response time for interactive workloads

### Non-Goals
- Full enterprise workflow engine
- Multi-tenant admin controls in the first release
- Complex policy approval workflows
- Deep native integrations beyond the existing API patterns

## 3. High-Level Architecture

The system has four main layers:

1. Client Layer
   - Web application (Next.js)
   - CLI tool for local or test use

2. Application Layer
   - Flask API routes for auth, chat, and document operations
   - Business logic for ingestion, retrieval, and answer generation

3. Data Layer
   - PostgreSQL for users, messages, sessions, documents
   - Pinecone vector store for document chunks
   - File storage for temporary upload handling

4. External AI Layer
   - Google Gemini for embeddings and answer synthesis

## 4. Core Components

### 4.1 Frontend
The Next.js app provides:
- login/signup flows
- document upload UI
- status monitoring for ingestion
- chat window for Q&A
- history panel and session management

### 4.2 Flask Backend
The backend exposes endpoints such as:
- auth routes for signup/login
- document upload and status listing
- chat execution
- health checks and diagnostics

### 4.3 Authentication Service
JWT-based auth ensures that protected APIs can identify the current user. The auth blueprint validates tokens and provides user identity to downstream services.

### 4.4 Document Ingestion Service
When a document is uploaded:
- the file is saved temporarily
- text is extracted based on file type
- content is split into chunks
- embeddings are generated
- vectors are written to Pinecone with metadata
- document status is updated to completed or failed

### 4.5 Retrieval Service
On each query:
- the question is embedded
- Pinecone filters results to the current user
- candidate chunks are ranked by similarity
- result set is passed to the LLM with conversation history

### 4.6 LLM Answer Service
Gemini receives:
- the current user question
- targeted excerpts from the document
- previous conversation context

The LLM is instructed to answer only from the provided excerpts and to refuse unsupported questions with a grounded fallback.

## 5. Runtime Flow

### Upload and Ingestion Flow
1. User authenticates.
2. User uploads a file.
3. API stores document metadata in PostgreSQL.
4. Background thread starts ingestion.
5. Text extraction occurs.
6. Chunks are created.
7. Embeddings are generated using Google embedding model.
8. Chunks are upserted to Pinecone with user_id and document_id metadata.
9. DB row status is marked completed or failed.

### Chat Flow
1. Authenticated request hits /api/v1/chat/run.
2. User question is converted to embedding.
3. Pinecone query is executed with user filter.
4. Relevant chunks are collected and normalized.
5. The LLM is called with the fetched context and prior history.
6. Response is returned to the frontend.
7. Messages are stored in the session database.

## 6. Data Model

### PostgreSQL Tables
The application uses relational tables for:
- users
- documents
- sessions
- messages

Core document metadata includes:
- user_id
- filename
- status
- created_at
- error_message

Session/message tables support:
- chat history
- multi-turn conversation
- session titles

### Vector Metadata
Stored vectors in Pinecone include metadata such as:
- user_id
- document_id
- source
- text
- page (if available)

This ensures result queries are scoped to the correct user and optional document list.

## 7. Key Design Decisions

### User Isolation by Metadata Filter
The application avoids leaking documents across users by filtering retrieval results using user_id in Pinecone search requests. This is a key security boundary.

### Async Ingestion
Ingestion is executed in a background thread to prevent long-running uploads from tying up API workers.

### Grounded Fallback Behavior
The LLM is explicitly instructed to answer with a refusal-style fallback when the answer is not in the document excerpts, reducing hallucination risk.

### Hybrid Retrieval Pattern
The product combines semantic vector retrieval with selective contextual prompting to the LLM, which balances retrieval speed and answer quality.

## 8. External Dependencies

### Google Gemini
Used for:
- embedding generation
- answer synthesis

### Pinecone
Used for:
- fast semantic search over large document chunk sets
- metadata filtering by user and document

### PostgreSQL
Used for:
- auth user records
- document metadata
- chat session/message storage

## 9. Security Architecture

### JWT Authorization
Protected routes require a valid Bearer token. The request context includes user information, which is used to scope document access.

### Document-Level Access Control
Search and answer generation only consider documents for the authenticated user. The application does not provide cross-user document retrieval.

### Cloud Dependency Resilience
Circuit-breaker and retry logic are used around Pinecone and embedding calls to avoid hard failure cascades.

## 10. Scalability and Reliability

### Scalability
- Async ingestion prevents upload requests from blocking the main API path.
- Vector search scales with the external vector database.
- Additional document uploads can be parallelized with background workers.

### Reliability
- Document processing status is tracked in the DB.
- Failed ingestion writes error_message to the proper document row.
- API health checks expose Pinecone status and route availability.

## 11. Failure Modes

### Ingestion Failure
Causes include unsupported extensions, unreadable documents, or cloud API failures. Result: status is set to failed and an error is recorded.

### No Relevant Search Results
If retrieval returns nothing, the LLM is either given a minimal fallback or told no relevant context is available.

### External API Rate Limits
Google APIs or Pinecone may rate-limit or fail. The system includes retry logic and graceful user-facing responses.

## 12. Future Evolution

Planned extensions may include:
- multi-document collections and folders
- role-based access control
- richer answer citations
- admin analytics and usage dashboards
- conversation summarization and saved knowledge graphs
- stronger enterprise integrations with SSO and audit logging

## 13. Summary

This design is centered around a secure, user-scoped RAG system that prioritizes grounded answers, operational simplicity, and strong document privacy. The combination of PostgreSQL, Pinecone, Gemini, and Flask makes the product highly suitable for internal knowledge search and policy Q&A workflows.
