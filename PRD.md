# Product Requirements Document (PRD)

## 1. Product Overview

Support AI is an enterprise document Q&A assistant for policy and knowledge-base content. The product enables users to upload internal documents, ingest them into a secure retrieval system, and ask natural-language questions grounded in the uploaded material.

The current product focuses on:
- policy document ingestion
- secure per-user document isolation
- semantic search over uploaded content
- AI-generated grounded answers with citations/source references
- multi-turn conversational follow-up
- document lifecycle tracking (uploaded, processing, completed, failed)

## 2. Problem Statement

Organizations often distribute policy information across PDFs, DOCX files, and text documents. Employees need fast, reliable answers, but manually reading long policy documents is time-consuming and error-prone. Existing generic AI tools are often not grounded in company documents and can fabricate answers.

The product addresses this by letting users upload policy docs and ask narrowly scoped questions that are answered strictly from the uploaded content.

## 3. Goals

### Primary Goals
- Allow users to upload and process one or more documents.
- Search across uploaded documents semantically and efficiently.
- Return answers grounded to document text rather than generic knowledge.
- Maintain conversation context across user queries.
- Preserve privacy by isolating each user's documents and chats.

### Secondary Goals
- Reduce manual support burden for policy interpretation.
- Improve trust with explicit source-aware answers.
- Support future extensibility for more document types and enterprise integrations.

## 4. Non-Goals
- Full enterprise document workflow automation beyond Q&A
- Real-time collaborative editing of documents
- Support for multi-tenant admin dashboards in v1
- Automatic policy change approval workflows

## 5. Target Users

### Primary User
- Knowledge workers and employees searching internal policies
- HR, legal, security, and operations teams
- Users who need policy answers without reading hundreds of pages

### Secondary User
- Application administrators managing users, uploads, and API access
- Teams integrating the backend into custom front-end experiences

## 6. User Personas

### Persona A: Employee Seeking Policy Clarification
- Wants quick answers to policy questions
- Needs clear, reliable responses from uploaded docs
- Expects follow-up questions to remain in context

### Persona B: Policy Administrator
- Uploads official documentation
- Tracks ingestion status and document processing outcomes
- Wants strict data isolation and safe document handling

## 7. Core User Journeys

### Journey 1: Upload and Query
1. User signs up/logs in.
2. User uploads a document.
3. System processes the file asynchronously.
4. User waits for status to become completed.
5. User asks a question in natural language.
6. System retrieves relevant chunks and returns grounded answer.

### Journey 2: Follow-Up Question
1. User asks an initial question.
2. User asks a follow-up such as "What about the other policy?"
3. System combines prior conversation and document context.
4. Answer remains grounded to current policy content.

### Journey 3: Unsupported or Missing Fact
1. User asks a question not present in uploaded documents.
2. System responds with a grounded fallback such as "I can't find the answer in the uploaded documents."

## 8. Functional Requirements

### 8.1 Authentication and User Identity
- Users must be able to register and log in.
- API calls requiring access to user documents must enforce JWT-based authorization.
- Each user's chats and uploads must be isolated by user ID.

### 8.2 Document Management
- Users can upload supported file types: TXT, PDF, DOC, DOCX.
- System stores file metadata in PostgreSQL.
- Each document has status values such as processing, completed, and failed.
- Failed ingestion should surface a useful error message.

### 8.3 Ingestion Pipeline
- The system extracts text from uploaded files.
- Text is split into chunks for retrieval.
- Chunk embeddings are generated using the configured embedding model.
- Vector entries are stored with metadata including user ID and document ID.
- Ingestion is run asynchronously to avoid blocking the API.

### 8.4 Retrieval
- User queries are converted into embeddings.
- Semantic search is performed against the vector index.
- Filters restrict results to the current user and optionally selected documents.
- Relevant chunks are returned in ranked order.

### 8.5 Answer Generation
- The LLM uses retrieved content as primary context.
- If relevant facts are not in the documents, the response must avoid hallucination.
- The system may include source information and page information when available.

### 8.6 Conversational Memory
- The system can store chat messages in a session.
- Follow-up questions should use prior messages as context.
- Session title generation is optional but desirable for usability.

### 8.7 API Behaviors
- The backend should expose endpoints for health checks, auth, documents, and chat.
- Chat endpoints must accept question text and optional history.
- API responses must support both raw retrieval results and LLM answer outputs.

## 9. Non-Functional Requirements

### Security
- JWT auth required for protected routes
- User must never retrieve another user's vectors or documents
- Search results and LLM context must be scoped by user_id

### Reliability
- Background ingestion should not block web requests
- Partial failures should be recorded in the database
- Retry and circuit-breaker patterns should protect cloud dependencies

### Performance
- Retrieval should remain fast for typical document sets
- Chunking and embedding should tolerate moderate document sizes
- UI should show polling transitions while ingestion is running

### Observability
- Health endpoints for core services such as Pinecone should exist
- Logs should identify failed ingestion, retrieval errors, and API exceptions

## 10. Functional Acceptance Criteria

### AC1: Upload and Ingestion
Given a valid authenticated user, when they upload a supported document, then the document is stored and goes through background ingestion.

### AC2: Query Response
Given a completed document, when the user asks a question supported by the document text, then the answer must be grounded in the uploaded material.

### AC3: Missing Information
Given a question unsupported by the documents, when a user asks it, then the product returns a grounded answer indicating the information is unavailable.

### AC4: Follow-Up Context
Given a conversation history, when the user asks a follow-up question, then the answer should use prior context without losing document grounding.

### AC5: User Isolation
Given two authenticated users with different documents, when one user queries the system, then only their own documents are included in retrieval and generation.

## 11. Risks and Constraints
- External API availability (Gemini and Pinecone) can affect reliability.
- Large documents may increase ingestion time and embedding cost.
- Inconsistent document extraction may impact retrieval quality.
- Some file types may require additional parsing or quality checks.

## 12. Release Scope

Version 1 should include:
- user auth
- document upload
- ingestion status tracking
- retrieval and Q&A
- follow-up chat memory
- basic security isolation

## 13. Success Metrics
- successful uploads per user
- document completion rate
- retrieval answer accuracy on test questions
- reduced time to answer policy questions
- user trust via grounded precise responses
