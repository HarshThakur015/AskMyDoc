import os
import threading
import uuid
import fitz  # PyMuPDF
import docx
from langchain_text_splitters import RecursiveCharacterTextSplitter
from auth.routes import get_db_connection, release_db_connection
from cache import invalidate_docs_cache
from retrieval import get_embeddings_batch, get_pinecone_client, COLLECTION_NAME

# NOTE: Semantic chunking is replaced with RecursiveCharacterTextSplitter 
# for higher build stability and to remove local model dependencies (Torch/MiniLM).
# Google's text-embedding-004 is robust enough to handle these chunks very well.

def extract_text(file_path, filename):
    """Extracts text from the given file based on its extension."""
    ext = filename.split('.')[-1].lower()
    text = ""
    
    if ext == 'pdf':
        doc = fitz.open(file_path)
        for page in doc:
            page_text = page.get_text("text")
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
    Background worker: parses a file, chunks it, embeds with Google API, upserts to Pinecone.
    """
    print(f"Starting ingestion for {filename} (User: {user_id}, Doc: {document_id})")
    try:
        # 1. Extract Text
        raw_text = extract_text(file_path, filename)
        if not raw_text.strip():
            raise ValueError("Extracted text is empty. File might be scanned or corrupted.")

        # 2. Chunking
        print("Chunking document...")
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000, 
            chunk_overlap=150,
            separators=["\n\n", "\n", ". ", " "]
        )
        chunks = splitter.split_text(raw_text)

        if not chunks:
            raise ValueError("Failed to create chunks from the text.")

        # 3. Generate Embeddings (Higher Parallelization)
        print(f"Generating vectors for {len(chunks)} chunks via Google API (Turbo mode)...")
        from concurrent.futures import ThreadPoolExecutor
        
        batch_size = 100 
        chunk_batches = [chunks[i:i + batch_size] for i in range(0, len(chunks), batch_size)]
        
        def process_batch(batch_idx, batch_chunks):
            embeddings = get_embeddings_batch(batch_chunks)
            batch_vectors = []
            for j, emb in enumerate(embeddings):
                chunk_text = batch_chunks[j]
                global_idx = (batch_idx * batch_size) + j
                vector_id = f"{document_id}_chunk_{global_idx}"
                metadata = {
                    "user_id": user_id,
                    "document_id": document_id,
                    "source": filename,
                    "text": chunk_text
                }
                batch_vectors.append((vector_id, emb, metadata))
            return batch_vectors

        all_vectors = []
        # Increased workers from 5 to 15 for faster cloud API throughput
        with ThreadPoolExecutor(max_workers=15) as executor:
            batch_results = list(executor.map(lambda p: process_batch(*p), enumerate(chunk_batches)))
            for result_list in batch_results:
                all_vectors.extend(result_list)

        # 4. Upsert to Pinecone (Higher Parallelization)
        print(f"Upserting {len(all_vectors)} vectors to Pinecone...")
        pinecone_client = get_pinecone_client()
        index = pinecone_client.Index(COLLECTION_NAME)
        
        upsert_batch_size = 100
        upsert_batches = [all_vectors[i:i + upsert_batch_size] for i in range(0, len(all_vectors), upsert_batch_size)]
        
        # Increased workers from 5 to 10 for faster upserts
        with ThreadPoolExecutor(max_workers=10) as executor:
            list(executor.map(lambda b: index.upsert(vectors=b, namespace=""), upsert_batches))

        # 5. Success! Update DB status to 'completed'
        _update_document_status(document_id, 'completed', user_id=user_id)
        print(f"Successfully ingested {filename} ({len(chunks)} chunks).")

    except Exception as e:
        print(f"Ingestion failed for {filename}: {str(e)}")
        _update_document_status(document_id, 'failed', user_id=user_id, error_message=str(e))

def _update_document_status(document_id, status, user_id=None, error_message=None):
    """Update Postgres document row status."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE documents SET status = %s, error_message = %s WHERE id = %s", (status, error_message, document_id))
        conn.commit()
        cur.close()
        release_db_connection(conn)
        if user_id:
            invalidate_docs_cache(user_id)
    except Exception as e:
        print(f"Error updating doc status: {e}")

def trigger_ingestion(file_path, filename, user_id, document_id):
    """Starts the ingestion process in a background thread."""
    thread = threading.Thread(target=process_and_ingest, args=(file_path, filename, user_id, document_id))
    thread.daemon = True
    thread.start()
