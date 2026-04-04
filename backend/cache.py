import threading

# Global caches for optimized performance
DOCS_CACHE = {} # user_id -> [list of docs]
PREVIEW_FILENAME_CACHE = {} # doc_id -> filename
CACHE_LOCK = threading.Lock()

def invalidate_docs_cache(user_id):
    with CACHE_LOCK:
        if user_id in DOCS_CACHE:
            del DOCS_CACHE[user_id]
            print(f"DEBUG: Invalidated docs cache for user {user_id}")

def invalidate_preview_cache(doc_id):
    with CACHE_LOCK:
        if doc_id in PREVIEW_FILENAME_CACHE:
            del PREVIEW_FILENAME_CACHE[doc_id]
            print(f"DEBUG: Invalidated preview cache for doc {doc_id}")
