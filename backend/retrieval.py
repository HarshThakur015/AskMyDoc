import os
import sys
import time
import threading
from functools import wraps
from dotenv import load_dotenv
from pinecone import Pinecone
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
COLLECTION_NAME = "user-documents"
EMBEDDING_MODEL_NAME = "BAAI/bge-base-en-v1.5"
CROSS_ENCODER_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"

# Initialize clients and models only when needed
_embedding_model = None
_cross_encoder = None
_pinecone_client = None
_model_lock = threading.Lock()

# --- Simple circuit breaker implementation (in-file) ---
_circuit_states = {}

def circuit_breaker(name, failure_threshold=3, recovery_timeout=60):
    """Simple circuit breaker decorator.

    name: key for tracking this circuit
    failure_threshold: failures before opening
    recovery_timeout: seconds to keep circuit open
    """
    state = _circuit_states.setdefault(name, {"failures": 0, "opened_at": None})

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # If circuit is open and recovery timeout not passed, raise
            if state["opened_at"] is not None:
                if time.time() - state["opened_at"] < recovery_timeout:
                    raise Exception(f"Circuit '{name}' is open")
                else:
                    # reset circuit
                    state["failures"] = 0
                    state["opened_at"] = None

            try:
                result = func(*args, **kwargs)
            except Exception as e:
                state["failures"] += 1
                if state["failures"] >= failure_threshold:
                    state["opened_at"] = time.time()
                raise

            # success -> reset failures
            state["failures"] = 0
            state["opened_at"] = None
            return result

        return wrapper
    return decorator

# Lazy loading functions
def get_embedding_model():
    global _embedding_model
    with _model_lock:
        if _embedding_model is None:
            from sentence_transformers import SentenceTransformer

            device = os.getenv("EMBEDDING_DEVICE", "cpu")
            try:
                @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
                def _load():
                    return SentenceTransformer(EMBEDDING_MODEL_NAME, device=device)

                _embedding_model = _load()
                if hasattr(_embedding_model, "to"):
                    try:
                        _embedding_model.to(device)
                    except Exception:
                        pass
            except Exception as e:
                print(f"Error loading embedding model: {str(e)}")
                raise

    return _embedding_model

def get_cross_encoder():
    global _cross_encoder
    with _model_lock:
        if _cross_encoder is None:
            from sentence_transformers import CrossEncoder
    
            device = os.getenv("CROSS_ENCODER_DEVICE", "cpu")
            try:
                @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
                def _load_ce():
                    return CrossEncoder(CROSS_ENCODER_MODEL_NAME, device=device)
    
                _cross_encoder = _load_ce()
            except Exception as e:
                print(f"Error loading cross-encoder model: {str(e)}")
                raise

    return _cross_encoder

def get_pinecone_client():
    global _pinecone_client
    if _pinecone_client is None:
        # Use a short retry when creating client (network issues, DNS)
        @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
        def _create_client():
            from pinecone import ServerlessSpec
            client = Pinecone(api_key=PINECONE_API_KEY)
            
            # Check if index exists, and instantly create it if it doesn't
            existing_indexes = [i.name for i in client.list_indexes()]
            if COLLECTION_NAME not in existing_indexes:
                print(f"Index {COLLECTION_NAME} missing! Creating new Serverless index...")
                client.create_index(
                    name=COLLECTION_NAME,
                    dimension=768,  # Match BAAI/bge-base-en-v1.5 output
                    metric="cosine",
                    spec=ServerlessSpec(
                        cloud="aws",
                        region="us-east-1"
                    )
                )
                # Give pinecone a moment to provision the index
                import time
                time.sleep(3)
                
            return client

        _pinecone_client = _create_client()
    return _pinecone_client

def search_documents(question, user_id, document_ids=None, retrieve_top_k=10, rerank_top_k=4):
    """
    Search for relevant document chunks using a two-stage retrieve-and-rerank pipeline.
    
    Args:
        question (str): The user's question.
        user_id (int): The user id to filter chunks by.
        document_ids (list): Optional list of document UUIDs to filter the search space.
        retrieve_top_k (int): Number of initial candidates to retrieve from Pinecone.
        rerank_top_k (int): Final number of results to return after re-ranking.
        
    Returns:
        dict: Search results with metadata and improved relevance scores.
    """
    start_time = time.time()
    
    try:
        # Initialize models only when needed
        try:
            embedding_model = get_embedding_model()
            cross_encoder = get_cross_encoder()
            pinecone_client = get_pinecone_client()
            index = pinecone_client.Index(COLLECTION_NAME)
        except Exception as e:
            return {
                "query": question, 
                "results": [], 
                "total_results": 0,
                "error": f"Model loading error: {str(e)}",
                "time_taken": round(time.time() - start_time, 3)
            }
        
        # === STAGE 1: RETRIEVAL ===
        # Generate embedding for the question using the base embedding model.
        try:
            # Retry embedding generation on transient failures
            @retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=4), retry=retry_if_exception_type(Exception))
            def _encode(q):
                emb = embedding_model.encode(q, convert_to_tensor=False)
                # Normalize to list
                if not isinstance(emb, list):
                    try:
                        emb = emb.tolist()
                    except Exception:
                        emb = list(emb)
                return emb

            question_embedding = _encode(question)
        except Exception as e:
            print(f"Error generating embedding: {str(e)}")
            return {
                "query": question, 
                "results": [], 
                "total_results": 0,
                "error": f"Embedding generation error: {str(e)}",
                "time_taken": round(time.time() - start_time, 3)
            }
        
        # Retrieve a larger set of initial candidates from Pinecone.
        try:
            # Wrap Pinecone search with retry and circuit breaker
            @circuit_breaker("pinecone_search", failure_threshold=3, recovery_timeout=int(os.getenv("PINECONE_CB_RECOVERY", "60")))
            @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=0.5, max=8), retry=retry_if_exception_type(Exception))
            def _pinecone_search(vec, limit):
                search_filter = {"user_id": user_id}
                if document_ids and len(document_ids) > 0:
                    search_filter["document_id"] = {"$in": document_ids}
                print(f"DEBUG: Pinecone Query with filter: {search_filter}", flush=True)
                return index.query(
                    vector=vec,
                    top_k=limit,
                    filter=search_filter,
                    include_metadata=True
                )

            initial_results_raw = _pinecone_search(question_embedding, retrieve_top_k)
            initial_results = initial_results_raw.get('matches', [])
        except Exception as e:
            return {
                "query": question, 
                "results": [], 
                "total_results": 0,
                "error": f"Pinecone query error: {str(e)}",
                "time_taken": round(time.time() - start_time, 3)
            }
        
        if not initial_results:
            return {
                "query": question, "results": [], "total_results": 0,
                "time_taken": round(time.time() - start_time, 3)
            }

        # === STAGE 2: RE-RANKING ===
        try:
            # Prepare pairs of [question, document_text] for the cross-encoder.
            cross_inp = [[question, match.metadata.get("text", "")] for match in initial_results]

            # Wrap cross-encoder predict with retry and circuit breaker
            @circuit_breaker("cross_encoder", failure_threshold=3, recovery_timeout=int(os.getenv("CE_CB_RECOVERY", "60")))
            @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, min=0.5, max=4), retry=retry_if_exception_type(Exception))
            def _predict(pairs):
                return cross_encoder.predict(pairs)

            cross_scores = _predict(cross_inp)
        except Exception as e:
            # If re-ranking fails, we can still return initial results without re-ranking
            
            # Format the initial results
            final_results = []
            for idx, match in enumerate(initial_results[:min(rerank_top_k, len(initial_results))]):
                result_item = {
                    "id": idx + 1,
                    "text": match.metadata.get("text", "No content available"),
                    "source": match.metadata.get("source", "Unknown source"),
                    "page": match.metadata.get("page", "Unknown page"),
                    "original_similarity": round(match.score, 4),
                }
                final_results.append(result_item)
            
            return {
                "query": question,
                "results": final_results,
                "total_results": len(final_results),
                "error": f"Re-ranking error (using fallback results): {str(e)}",
                "time_taken": round(time.time() - start_time, 3)
            }
        
        # Create a list of tuples with (result, rerank_score) instead of modifying ScoredPoint objects
        reranked_results = []
        for idx, match in enumerate(initial_results):
            reranked_results.append({
                "original_result": match,
                "rerank_score": float(cross_scores[idx])
            })
            
        # Sort the results based on the new cross-encoder scores in descending order.
        reranked_results = sorted(reranked_results, key=lambda x: x["rerank_score"], reverse=True)
        
        # --- Format and return the final, top-k results ---
        final_results = []
        for idx, item in enumerate(reranked_results[:rerank_top_k]):
            match = item["original_result"]
            # Debug metadata structure
            # print(f"DEBUG Match Metadata: {match.metadata}", flush=True)
            result_item = {
                "id": idx + 1,
                "text": match.metadata.get("text", "No content available"),
                "source": match.metadata.get("source", "Unknown source"),
                "page": match.metadata.get("page", "Unknown page"),
                "original_similarity": round(match.score, 4),  # From Pinecone's vector search
                "reranked_score": round(item["rerank_score"], 4)  # More accurate score from CrossEncoder
            }
            final_results.append(result_item)
            
        return {
            "query": question,
            "results": final_results,
            "total_results": len(final_results),
            "time_taken": round(time.time() - start_time, 3)
        }
        
    except Exception as e:
        print(f"Error during document search with re-ranking: {str(e)}")
        return {
            "query": question, "results": [], "total_results": 0, "error": str(e),
            "time_taken": round(time.time() - start_time, 3)
        }

# --- Example Usage ---
if __name__ == 'main':
    test_question = "What is the waiting period for knee surgery with a 3 month old policy?"
    search_result = search_documents(test_question, user_id=1)
    
    import json
    print("\n--- Search Results ---")
    print(json.dumps(search_result, indent=2))