import os
import sys
import time
import threading
from functools import wraps
from dotenv import load_dotenv
from pinecone import Pinecone
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import google.generativeai as genai

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
COLLECTION_NAME = "user-documents-v3"
EMBEDDING_MODEL_NAME = "models/gemini-embedding-2-preview"

# Configure Google Generative AI
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

# Initialize clients and models only when needed
_pinecone_client = None
_model_lock = threading.Lock()

# --- Simple circuit breaker implementation (in-file) ---
_circuit_states = {}

def circuit_breaker(name, failure_threshold=3, recovery_timeout=60):
    """Simple circuit breaker decorator."""
    state = _circuit_states.setdefault(name, {"failures": 0, "opened_at": None})

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if state["opened_at"] is not None:
                if time.time() - state["opened_at"] < recovery_timeout:
                    raise Exception(f"Circuit '{name}' is open")
                else:
                    state["failures"] = 0
                    state["opened_at"] = None

            try:
                result = func(*args, **kwargs)
            except Exception:
                state["failures"] += 1
                if state["failures"] >= failure_threshold:
                    state["opened_at"] = time.time()
                raise

            state["failures"] = 0
            state["opened_at"] = None
            return result

        return wrapper
    return decorator

# --- Embedding Functions (Google Cloud) ---

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
def get_embedding(text):
    """Generates an embedding for the given text using Google's API."""
    if not text.strip():
        return [0.0] * 3072  # Return zero vector for empty text
        
    try:
        response = genai.embed_content(
            model=EMBEDDING_MODEL_NAME,
            content=text,
            task_type="retrieval_query"
        )
        return response['embedding']
    except Exception as e:
        print(f"Error generating embedding with Google API: {str(e)}")
        raise

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
def get_embeddings_batch(texts):
    """Generates embeddings for a batch of texts using Google's API."""
    if not texts:
        return []
        
    try:
        response = genai.embed_content(
            model=EMBEDDING_MODEL_NAME,
            content=texts,
            task_type="retrieval_document"
        )
        # Handle cases where the SDK might return 'embedding' or 'embeddings' 
        # based on model/version, ensuring we always return a list of vectors.
        if 'embedding' in response:
            return response['embedding']
        elif 'embeddings' in response:
            return response['embeddings']
        else:
            raise KeyError(f"Unexpected response format from Google API: {response.keys() if hasattr(response, 'keys') else 'No keys'}")
    except Exception as e:
        print(f"Error generating batch embeddings with Google API: {str(e)}")
        raise

# --- Pinecone Client ---

def get_pinecone_client():
    global _pinecone_client
    if _pinecone_client is None:
        @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
        def _create_client():
            from pinecone import ServerlessSpec
            client = Pinecone(api_key=PINECONE_API_KEY)
            
            existing_indexes = [i.name for i in client.list_indexes()]
            if COLLECTION_NAME not in existing_indexes:
                print(f"Index {COLLECTION_NAME} missing! Creating new Serverless index...")
                client.create_index(
                    name=COLLECTION_NAME,
                    dimension=3072,  # Match Google gemini-embedding-2-preview output
                    metric="cosine",
                    spec=ServerlessSpec(
                        cloud="aws",
                        region="us-east-1"
                    )
                )
                time.sleep(3)
                
            return client

        _pinecone_client = _create_client()
    return _pinecone_client

def search_documents(question, user_id, document_ids=None, retrieve_top_k=8):
    """
    Search for relevant document chunks using Google Cloud embeddings and Pinecone.
    """
    start_time = time.time()
    
    try:
        # 1. Generate Query Embedding (Cloud API)
        try:
            question_embedding = get_embedding(question)
        except Exception as e:
            return {
                "query": question, "results": [], "total_results": 0, "error": f"Cloud embedding error: {str(e)}",
                "time_taken": round(time.time() - start_time, 3)
            }
        
        # 2. Retrieve from Pinecone
        try:
            pinecone_client = get_pinecone_client()
            index = pinecone_client.Index(COLLECTION_NAME)
            
            @circuit_breaker("pinecone_search", failure_threshold=3, recovery_timeout=60)
            @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=0.5, max=8))
            def _pinecone_search(vec, limit):
                search_filter = {"user_id": user_id}
                if document_ids and len(document_ids) > 0:
                    search_filter["document_id"] = {"$in": document_ids}
                
                return index.query(
                    vector=vec,
                    top_k=limit,
                    filter=search_filter,
                    include_metadata=True
                )

            results_raw = _pinecone_search(question_embedding, retrieve_top_k)
            matches = results_raw.get('matches', [])
        except Exception as e:
            return {
                "query": question, "results": [], "total_results": 0, "error": f"Pinecone query error: {str(e)}",
                "time_taken": round(time.time() - start_time, 3)
            }
        
        # 3. Format Response
        final_results = []
        for idx, match in enumerate(matches):
            final_results.append({
                "id": idx + 1,
                "text": match.metadata.get("text", "No content available"),
                "source": match.metadata.get("source", "Unknown source"),
                "page": match.metadata.get("page", "Unknown page"),
                "similarity": round(match.score, 4)
            })
            
        return {
            "query": question,
            "results": final_results,
            "total_results": len(final_results),
            "time_taken": round(time.time() - start_time, 3)
        }
        
    except Exception as e:
        print(f"Error during document search: {str(e)}")
        return {
            "query": question, "results": [], "total_results": 0, "error": str(e),
            "time_taken": round(time.time() - start_time, 3)
        }

if __name__ == '__main__':
    # Barebones local test
    print(search_documents("What is policy?", user_id=1))