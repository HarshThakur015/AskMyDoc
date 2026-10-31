# Low-Level Design (LLD)

## 1. Scope

This document describes the implementation details for Support AI’s backend and application flow. It focuses on the modules, functions, data flows, and integration points that support authentication, document ingestion, retrieval, and chat generation.

## 2. Module Breakdown

### 2.1 Backend Entry Point
File: `backend/app.py`

Responsibilities:
- initialize Flask app
- load environment variables
- register auth blueprint
- define health routes
- define chat endpoint
- orchestrate retrieval + LLM calls
- manage background ingestion triggers

Important functions:
- `allowed_file(filename)`
- `chat_run()`
- `check_pinecone()`
- `_prewarm_models()`

### 2.2 Auth Module
File: `backend/auth/routes.py`

Responsibilities:
- user registration
- login
- JWT creation/validation
- request-scoped user resolution
- DB connection handling

Key patterns:
- `token_required` decorator protects endpoints
- `get_db_connection()` and `release_db_connection()` manage DB sessions
- auth responses return token and user metadata

### 2.3 Document Ingestion Module
File: `backend/ingestion.py`

Responsibilities:
- extract text from supported file formats
- split text into manageable chunks
- batch embed chunks
- upsert vectors into Pinecone
- maintain document status in PostgreSQL

Key functions:
- `extract_text(file_path, filename)`
- `process_and_ingest(file_path, filename, user_id, document_id)`
- `_update_document_status(document_id, status, user_id=None, error_message=None)`
- `trigger_ingestion(file_path, filename, user_id, document_id)`

### 2.4 Retrieval Module
File: `backend/retrieval.py`

Responsibilities:
- embed query text
- create Pinecone index if missing
- query the vector index with user filters
- normalize result payloads

Key functions:
- `get_embedding(text)`
- `get_embeddings_batch(texts)`
- `get_pinecone_client()`
- `search_documents(question, user_id, document_ids=None, retrieve_top_k=8)`
- `circuit_breaker(name, failure_threshold=3, recovery_timeout=60)`

### 2.5 LLM Generation Module
File: `backend/llm_handler.py`

Responsibilities:
- lazy initialize Gemini
- construct prompt with retrieved context and history
- generate answer using Gemini
- enforce grounded answer behavior

Key functions:
- `ensure_genai_initialized()`
- `generate_response(question, search_results, history=None)`

## 3. Detailed Function Design

### 3.1 Authentication Flow
Flow:
1. User sends signup/login request to `/auth/register` or `/auth/login`.
2. The auth module validates credentials.
3. A JWT is generated.
4. The frontend stores the token and passes it as a Bearer token.
5. Protected endpoints call `token_required` before executing.

Pseudo flow:
```python
@app.route('/auth/login', methods=['POST'])
def login():
    # validate email/password
    # fetch user from DB
    # generate JWT
    # return token + user info
```

### 3.2 Ingestion Flow
Pseudo flow:
```python
def trigger_ingestion(file_path, filename, user_id, document_id):
    thread = threading.Thread(target=process_and_ingest, args=(...))
    thread.daemon = True
    thread.start()
```

`process_and_ingest` does the following:
1. `extract_text()` uses file type to parse content.
2. `RecursiveCharacterTextSplitter` creates chunks.
3. `get_embeddings_batch()` generates vectors for each chunk.
4. `get_pinecone_client()` returns a Pinecone client.
5. `Index.upsert()` stores vectors with metadata.
6. `_update_document_status()` marks the document as completed or failed.

### 3.3 Query and Retrieval Flow
Pseudo flow:
```python
question_embedding = get_embedding(question)
index = pinecone_client.Index(COLLECTION_NAME)
results_raw = index.query(
    vector=question_embedding,
    top_k=retrieve_top_k,
    filter={"user_id": user_id, "document_id": {"$in": document_ids}},
    include_metadata=True,
)
```

Normalization:
- each Pinecone match becomes a dict with:
  - `id`
  - `text`
  - `source`
  - `page`
  - `similarity`

### 3.4 Answer Generation Flow
Pseudo flow:
```python
response = generate_response(question, results, history)
```

The function:
1. collects document excerpts and source metadata
2. builds policy-grounding prompt
3. includes conversation history for follow-up context
4. calls Gemini with strict instructions
5. returns answer + source list + provider name

Critical logic:
- If no search results and no prior message history, it returns a fallback.
- If the answer is not available in the context, it returns a grounded refusal sentence.

## 4. Database Design

### 4.1 Users
Purpose: Auth and identity.
Typical fields:
- id
- email
- password_hash
- created_at

### 4.2 Documents
Purpose: user-owned uploaded documents and ingestion state.
Typical fields:
- id
- user_id
- filename
- status
- error_message
- created_at

Status examples:
- processing
- completed
- failed

### 4.3 Sessions
Purpose: chat containers.
Typical fields:
- id
- user_id
- title
- created_at

### 4.4 Messages
Purpose: store user/assistant chat history.
Typical fields:
- id
- session_id
- user_id
- role
- content
- created_at

## 5. API Design

### 5.1 Auth Endpoints
- `/auth/register` — create a user
- `/auth/login` — authenticate and return JWT
- protected routes via `token_required`

### 5.2 Document Endpoints
The app exposes document routes in the main Flask app and auth module. In practice, the system supports:
- upload document
- list documents
- get document status
- delete document (if implemented in future front-end flows)

### 5.3 Chat Endpoint
Endpoint:
- `POST /api/v1/chat/run`

Request JSON:
```json
{
  "question": "What are the office days?",
  "history": [{"role": "user", "content": "Tell me more"}],
  "document_ids": [12, 13],
  "use_llm": true,
  "include_raw": false
}
```

Response JSON:
```json
{
  "query": "What are the office days?",
  "answer": "Tuesdays and Thursdays.",
  "time_taken": 1.23
}
```

## 6. Data Flow Details

### 6.1 Ingestion Pipeline
```text
Upload request
  -> save file
  -> DB document row created
  -> trigger_ingestion()
  -> extract_text()
  -> split chunks
  -> embed batch
  -> Pinecone upsert
  -> update DB status
```

### 6.2 Retrieval Pipeline
```text
Question
  -> build embedding
  -> Pinecone query with user_id filter
  -> normalize matches
  -> generate answer using Gemini
  -> save messages in DB
  -> return result
```

## 7. Error Handling Design

### Ingestion Errors
Handled in `process_and_ingest()` with try/except around extraction, chunking, embedding, and upsert. On failure, the document status is updated to failed and error_message is stored.

### Retrieval Errors
Handled in `search_documents()` with structured fallback payloads:
- embedding error
- Pinecone query error
- missing result sets

### LLM Errors
Handled in `generate_response()` with:
- missing API key detection
- quota/429 retry support
- filtered-response handling
- generic safe fallback response

## 8. Security and Privacy Implementation Details

### 8.1 JWT Enforcement
The auth decorator checks the Authorization header before allowing access to protected routes.

### 8.2 User Scope in Pinecone
Every vector is stored with metadata including `user_id`. Retrieval queries include a filter like:
```python
{"user_id": user_id}
```

Optionally, document filtering is also applied:
```python
{"user_id": user_id, "document_id": {"$in": document_ids}}
```

### 8.3 LLM Grounding Guardrails
Prompt instructions explicitly state: if the requested fact is not in the provided excerpts, answer with a grounded fallback. This prevents easy hallucination from the general model knowledge base.

## 9. Concurrency and Background Design

The ingestion process runs in a background thread using Python's `threading.Thread`, keeping the API responsive. This allows the system to accept more uploads without blocking user requests.

## 10. Testing Strategy

### Unit/Component Testing
- auth token creation and validation
- file extraction for TXT/PDF/DOCX
- chunk splitting validity
- embedding and Pinecone query compatibility
- LLM fallback conditions

### Integration Testing
- upload route
- document processing state transitions
- query execution against real Pinecone data
- conversation memory in session storage

### End-to-End Validation
The repository includes an end-to-end validation suite for:
- signup/login
- document upload
- ingestion status polling
- fact retrieval
- memory follow-up
- grounded refusal behavior

## 11. Dependencies and Libraries

Key packages in use include:
- Flask
- PostgreSQL driver
- PyMuPDF / python-docx
- LangChain text splitter
- Pinecone client
- Google Generative AI SDK
- Next.js frontend

## 12. Implementation Notes

- The system is designed to be modular so retrieval, ingestion, and LLM logic can evolve independently.
- The architecture is intentionally cloud-first because embedding generation and vector search are handled externally.
- Security is enforced both at the API layer and retrieval/data layer.
- The design favors reliability and groundedness over unconstrained generative output.

## 13. Summary

The low-level design mirrors the application’s practical implementation: a Flask API orchestrating authentication, ingestion, retrieval, and LLM generation; PostgreSQL for metadata and chat history; Pinecone for semantic indexing; and Gemini for embedding and reasoning. The design prioritizes privacy, grounded responses, asynchronous processing, and simple operational deployment.
