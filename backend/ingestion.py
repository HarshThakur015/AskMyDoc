import os
import threading
import uuid
import fitz  # PyMuPDF
import docx
from langchain_experimental.text_splitter import SemanticChunker
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from auth.routes import get_db_connection, release_db_connection
from cache import invalidate_docs_cache
from retrieval import get_embedding_model, get_pinecone_client, COLLECTION_NAME

# Global singleton for the fast semantic chunker model.
# Must be pre-warmed from the main thread on Windows to avoid PyTorch crash.
_fast_embedder = None

def get_fast_embedder():
    global _fast_embedder
    if _fast_embedder is None:
        print("Loading fast semantic chunker model (all-MiniLM-L6-v2)...")
        _fast_embedder = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    return _fast_embedder

def extract_text(file_path, filename):
    """Extracts text from the given file based on its extension."""
    ext = filename.split('.')[-1].lower()
    text = ""
    
    if ext == 'pdf':
        doc = fitz.open(file_path)
        for page in doc:
            page_text = page.get_text("text")  # Optimized structural text extraction
            if page_text:
                text += page_text + "\n"
        doc.close()
    elif ext in ['doc', 'docx']:
        doc = docx.Document(file_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    elif ext == 'txt':
        with open(file_path, 'r', encoding='utf-8') as file:
            text = file.read()
    else:
        raise ValueError(f"Unsupported file extension: {ext}")
        
    return text

def process_and_ingest(file_path, filename, user_id, document_id):
    """
    Background worker function that parses a file, chunks it, 
    embeds chunks, and upserts them to Pinecone. 
    Updates DB status on completion or failure.
    """
    print(f"Starting ingestion for {filename} (User: {user_id}, Doc: {document_id})")
    try:
        # 1. Extract Text
        raw_text = extract_text(file_path, filename)
        if not raw_text.strip():
            raise ValueError("Extracted text is empty. File might be scanned or corrupted.")

        # 2. Section-Aware Structural Chunking Strategy
        print("Chunking document into sections...")
        import re
        # Split by '### SECTION' but keep the delimiter for context using lookahead
        section_pattern = r'(?=### SECTION \d+:)'
        chunks = [c.strip() for c in re.split(section_pattern, raw_text) if c.strip()]
        
        # Guard: If no sections found (len <= 1), fallback to standard splitting
        if len(chunks) <= 1:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000, 
                chunk_overlap=100,
                separators=["\n\n", "\n", ". ", " "]
            )
            chunks = splitter.split_text(raw_text)

        # Pass 2 - Size Guard
        if not chunks:
            raise ValueError("Failed to create chunks from the text.")
        

        if not chunks:
            raise ValueError("Failed to create chunks from the text.")

        # 3. Generate Embeddings (Batched)
        model = get_embedding_model()
        vectors = []
        batch_size = 100
        
        # Process in batches for performance
        for i in range(0, len(chunks), batch_size):
            batch_chunks = chunks[i:i + batch_size]
            embeddings = model.encode(batch_chunks, convert_to_tensor=False)
            
            # Prepare vectors for Pinecone
            for j, emb in enumerate(embeddings):
                # Ensure the embedding is a list of floats
                emb_list = emb.tolist() if hasattr(emb, "tolist") else list(emb)
                chunk_text = batch_chunks[j]
                
                # Each chunk needs a unique vector ID
                vector_id = f"{document_id}_chunk_{i+j}"
                
                # Metadata is CRITICAL for filtering during retrieval
                # If chunk starts with SECTION, use that as the 'page' equivalent
                import re
                section_match = re.search(r'SECTION (\d+)', chunk_text)
                section_val = section_match.group(1) if section_match else "General"

                metadata = {
                    "user_id": user_id,
                    "document_id": document_id,
                    "source": filename,
                    "page": section_val,
                    "text": chunk_text
                }
                
                vectors.append((vector_id, emb_list, metadata))

        # 4. Upsert to Pinecone
        pinecone_client = get_pinecone_client()
        index = pinecone_client.Index(COLLECTION_NAME)
        
        # Upsert in chunks to respect Pinecone limits
        upsert_batch_size = 100
        for i in range(0, len(vectors), upsert_batch_size):
            index.upsert(vectors=vectors[i:i + upsert_batch_size])

        # 5. Success! Update DB status to 'completed'
        _update_document_status(document_id, 'completed', user_id=user_id)
        print(f"Successfully ingested {filename} ({len(chunks)} chunks).")

    except Exception as e:
        print(f"Ingestion failed for {filename}: {str(e)}")
        # Update DB status to 'failed' and save the error message
        _update_document_status(document_id, 'failed', user_id=user_id, error_message=str(e))
    finally:
        # We now keep the file to support document preview
        pass

def _update_document_status(document_id, status, user_id=None, error_message=None):
    """Helper purely to update the Postgres document row."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE documents SET status = %s, error_message = %s WHERE id = %s",
            (status, error_message, document_id)
        )
        conn.commit()
        cur.close()
        release_db_connection(conn)
        
        # VERY IMPORTANT: Invalidate the cache for this user so they see the status update!
        if user_id:
            invalidate_docs_cache(user_id)
    except Exception as e:
        print(f"Critical error updating document {document_id} status to {status}: {e}")

def trigger_ingestion(file_path, filename, user_id, document_id):
    """Starts the ingestion process in a background thread."""
    thread = threading.Thread(
        target=process_and_ingest,
        args=(file_path, filename, user_id, document_id)
    )
    thread.daemon = True
    thread.start()
