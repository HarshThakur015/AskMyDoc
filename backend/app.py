from flask import Flask, request, jsonify
from dotenv import load_dotenv
from flask_cors import CORS
from auth.routes import auth, get_db_connection, release_db_connection, token_required
from cache import DOCS_CACHE, PREVIEW_FILENAME_CACHE, CACHE_LOCK, invalidate_docs_cache, invalidate_preview_cache
import threading

from werkzeug.utils import secure_filename
from db_init import init_db
from ingestion import trigger_ingestion
import os
import time
import sys
import threading
import logging
import flask.cli

# Import the dependencies safely with error handling
try:
    from retrieval import search_documents
except ImportError as e:
    def search_documents(*args, **kwargs):
        return {"error": f"Retrieval module not available: {str(e)}", "results": []}
        
try:
    from llm_handler import generate_response
except ImportError as e:
    def generate_response(*args, **kwargs):
        return {"answer": "LLM module not available", "sources": [], "provider": "none"}

# print("Python version:", sys.version)

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")

# Initialize PostgreSQL documents table
init_db()

# Create temp uploads directory if not exists
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'temp_uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'doc', 'docx'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Keep logs minimal; only DB connection logging should surface
logging.getLogger("werkzeug").setLevel(logging.ERROR)
logging.getLogger("flask.app").setLevel(logging.ERROR)
app.logger.disabled = True
app.logger.propagate = False
flask.cli.show_server_banner = lambda *args, **kwargs: None

# Enable CORS with origins from .env or default to localhost
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
CORS(app, resources={r"/*": {
    "origins": [frontend_url, "http://localhost:3000"]
}}, supports_credentials=True, allow_headers=["Content-Type", "Authorization"], methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Register authentication blueprint
app.register_blueprint(auth, url_prefix='/auth')

# Pre-warm is no longer needed because we use Google Cloud API (no heavy local models to load)
def _prewarm_models():
    try:
        from retrieval import get_pinecone_client
        get_pinecone_client()
        print("Pinecone client initialized [OK]")
    except Exception as e:
        print(f"Warning: Pre-warm failed: {e}")

_prewarm_models()


@app.route('/')
def home():
    return "✅ Chatbot Backend Running"

@app.route('/ping')
def ping():
    return "pong"

@app.route('/api/health/pinecone')
def check_pinecone():
    """Health check for Pinecone connection"""
    print("DEBUG: Hit /api/health/pinecone route", flush=True)
    import logging
    logger = logging.getLogger(__name__)
    logger.error("DEBUG LOG: check_pinecone route was called")
    try:
        from retrieval import Pinecone, PINECONE_API_KEY
        
        # Create client and test connection
        print("DEBUG: Checking Pinecone auth", flush=True)
        pc = Pinecone(api_key=PINECONE_API_KEY)
        indexes = pc.list_indexes()
        
        return jsonify({
            "status": "connected",
            "indexes": [index.name for index in indexes]
        })
    except Exception as e:
        print(f"DEBUG Error: {str(e)}", flush=True)
        logger.error(f"Pinecone health check error: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/v1/chat/run', methods=['POST'])
@token_required
def chat_run():
    print("DEBUG: chat_run called", flush=True)
    data = request.get_json()
    
    if not data or 'question' not in data:
        return jsonify({"error": "Question is required"}), 400
    
    question = data['question']
    history = data.get('history', [])
    top_k = data.get('top_k', 4)
    use_llm = data.get('use_llm', True)
    include_raw = data.get('include_raw', False)
    
    # Handle single string or array of strings for document filtering
    document_ids = []
    if 'document_ids' in data and isinstance(data['document_ids'], list):
        document_ids = data['document_ids']
    elif 'document_id' in data and data['document_id']:
        document_ids = [data['document_id']]
    
    start_time = time.time()
    
    try:
        user_id = request.user['id']
        # First get raw search results
        search_result = search_documents(question, user_id, document_ids=document_ids, retrieve_top_k=top_k)
        
        results = search_result.get('results', [])
        
        print(f"DEBUG: Found {len(results)} initial candidates.", flush=True)
        for idx, r in enumerate(results[:3]):
            print(f"  [{idx}] Score: {r.get('reranked_score')} | ID: {r.get('id')} | Text: {r.get('text')[:60]}...", flush=True)
            
        # If no results and LLM requested, return a standard fallback answer
        # If LLM not requested, return raw results
        if not use_llm:
            return jsonify(search_result), 200
            
        best_score = results[0].get('reranked_score', -999) if results else -999
        print(f"DEBUG: Retrieval complete. Results: {len(results)}, Best Rerank Score: {best_score}")
        
        has_history = history is not None and len(history) > 0
        
        # We let the LLM handle all questions instead of forcing a rigid fallback
        llm_response = generate_response(question, results, history)
        
        # Ensure we ALWAYS have a dict
        if not isinstance(llm_response, dict):
            print(f"ERROR: generate_response returned {type(llm_response)}", flush=True)
            llm_response = {"answer": str(llm_response) if llm_response else "No response generated.", "sources": [], "provider": "error"}
            
        # Maintain the raw markdown answer text
        clean_answer = str(llm_response.get("answer", ""))
        print(f"DEBUG: Final answer retrieved (len: {len(clean_answer)})", flush=True)
        
        # Save Chat History to DB
        session_id = data.get('session_id')
        if session_id:
            conn = get_db_connection()
            try:
                cur = conn.cursor()
                # 1. User Message
                cur.execute(
                    "INSERT INTO messages (user_id, session_id, role, content) VALUES (%s, %s, %s, %s)",
                    (user_id, session_id, "user", question)
                )
                # 2. Assistant Message
                cur.execute(
                    "INSERT INTO messages (user_id, session_id, role, content) VALUES (%s, %s, %s, %s)",
                    (user_id, session_id, "assistant", clean_answer.strip())
                )
                conn.commit()
                cur.close()
            finally:
                release_db_connection(conn)

        # Create clean response
        response = {
            "query": question,
            "answer": clean_answer.strip(),
            "time_taken": round(time.time() - start_time, 3)
        }
        
        # Add provider info optionally
        include_provider = data.get('include_provider', False)
        if include_provider:
            response["llm_provider"] = llm_response["provider"]
        
        if include_raw:
            response["raw_results"] = search_result['results']

        # Only include sources if explicitly requested
        include_sources = data.get('include_sources', False)
        if include_sources:
            response["sources"] = llm_response["sources"]

        return jsonify(response), 200
    except Exception as e:
        return jsonify({
            "error": str(e),
            "query": question,
            "time_taken": round(time.time() - start_time, 3)
        }), 500


@app.route('/api/v1/chat/history', methods=['GET'])
@token_required
def get_chat_history():
    user_id = request.user['id']
    session_id = request.args.get('session_id')
    limit = request.args.get('limit', 100, type=int)
    
    if not session_id:
        return jsonify({"history": []}), 200

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT role, content, timestamp FROM messages WHERE user_id = %s AND session_id = %s ORDER BY timestamp ASC LIMIT %s",
            (user_id, session_id, limit)
        )
        msgs = cur.fetchall()
        cur.close()
        
        history = [
            {"role": m[0], "content": m[1], "timestamp": m[2].isoformat() if m[2] else None}
            for m in msgs
        ]
        return jsonify(history), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        release_db_connection(conn)

@app.route('/api/v1/sessions', methods=['POST'])
@token_required
def create_session():
    user_id = request.user['id']
    data = request.get_json()
    title = data.get('title', 'New Chat')
    document_ids = data.get('document_ids', [])

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO sessions (user_id, title) VALUES (%s, %s) RETURNING id", (user_id, title))
        session_id = cur.fetchone()[0]
        
        # Link documents
        for doc_id in document_ids:
            cur.execute("INSERT INTO session_documents (session_id, document_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (session_id, doc_id))
            
        conn.commit()
        cur.close()
        return jsonify({"session_id": session_id, "title": title}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        release_db_connection(conn)

@app.route('/api/v1/sessions', methods=['GET'])
@token_required
def get_sessions():
    user_id = request.user['id']
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, title, created_at FROM sessions WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
        rows = cur.fetchall()
        cur.close()
        return jsonify([{"id":r[0], "title":r[1], "created_at":r[2].isoformat()} for r in rows]), 200
    finally:
        release_db_connection(conn)

@app.route('/api/v1/sessions/<int:session_id>/documents', methods=['GET'])
@token_required
def get_session_documents(session_id):
    user_id = request.user['id']
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT d.id, d.filename 
            FROM documents d
            JOIN session_documents sd ON d.id = sd.document_id
            WHERE sd.session_id = %s AND d.user_id = %s
        """, (session_id, user_id))
        rows = cur.fetchall()
        cur.close()
        return jsonify([{"id":r[0], "filename":r[1]} for r in rows]), 200
    finally:
        release_db_connection(conn)

@app.route('/api/v1/upload', methods=['POST'])
@token_required
def upload_file():
    try:
        files = request.files.getlist('files')  # Accept 'files' (plural) field
        # Fallback: also support legacy single 'file' field
        if not files or all(f.filename == '' for f in files):
            single = request.files.get('file')
            if single and single.filename != '':
                files = [single]
            else:
                return jsonify({"error": "No files provided. Use 'files' or 'file' field."}), 400

        user_id = request.user['id']
        queued = []
        errors = []

        for file in files:
            if file.filename == '':
                continue
            if not allowed_file(file.filename):
                errors.append(f"{file.filename}: unsupported file type")
                continue

            try:
                # 1. First insert into DB to get the ID
                filename = secure_filename(file.filename)
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute(
                    "INSERT INTO documents (user_id, filename, status) VALUES (%s, %s, %s) RETURNING id",
                    (user_id, filename, 'processing')
                )
                document_id = cur.fetchone()[0]
                conn.commit()
                cur.close()
                release_db_connection(conn)

                # 2. Save file with document_id as prefix for easy retrieval later
                unique_filename = f"{document_id}_{filename}"
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(file_path)

                # 3. Trigger background processing
                # Invalidate Cache
                invalidate_docs_cache(user_id)
                            
                trigger_ingestion(file_path, filename, user_id, document_id)
                queued.append({"filename": filename, "document_id": document_id})

            except Exception as file_err:
                if os.path.exists(file_path):
                    os.remove(file_path)
                errors.append(f"{file.filename}: {str(file_err)}")

        if not queued:
            return jsonify({"error": "No valid files were uploaded.", "details": errors}), 400

        return jsonify({
            "message": f"{len(queued)} file(s) uploaded and queued for processing.",
            "documents": queued,
            # Backwards-compat: expose first doc_id as top-level for old clients
            "document_id": queued[0]["document_id"],
            "errors": errors
        }), 202

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Internal Server Error: {str(e)}"}), 500




@app.route('/api/v1/documents', methods=['GET'])
@token_required
def get_documents():
    user_id = request.user['id']
    
    # Try cache first
    with CACHE_LOCK:
        if user_id in DOCS_CACHE:
            return jsonify(DOCS_CACHE[user_id]), 200
            
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, filename, status, error_message, created_at FROM documents WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,)
        )
        docs = cur.fetchall()
        cur.close()
        
        doc_list = []
        for d in docs:
            doc_info = {
                "id": d[0],
                "filename": d[1],
                "status": d[2],
                "error_message": d[3],
                "created_at": d[4].isoformat() if d[4] else None
            }
            doc_list.append(doc_info)
            # Pre-warm the filename cache too
            with CACHE_LOCK:
                PREVIEW_FILENAME_CACHE[d[0]] = d[1]
            
        with CACHE_LOCK:
            DOCS_CACHE[user_id] = doc_list
            
        return jsonify(doc_list), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        release_db_connection(conn)

@app.route('/api/v1/documents/<doc_id>', methods=['DELETE'])
@token_required
def delete_document(doc_id):
    user_id = request.user['id']
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Verify ownership
        cur.execute("SELECT id, filename FROM documents WHERE id = %s AND user_id = %s", (doc_id, user_id))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return jsonify({"error": "Document not found or unauthorized"}), 404
            
        filename = row[1]
        
        cur.execute("DELETE FROM documents WHERE id = %s AND user_id = %s", (doc_id, user_id))
        conn.commit()
        cur.close()
        release_db_connection(conn)
        
        # Invalidate Cache
        with CACHE_LOCK:
            if user_id in DOCS_CACHE:
                del DOCS_CACHE[user_id]
            if doc_id in PREVIEW_FILENAME_CACHE:
                del PREVIEW_FILENAME_CACHE[doc_id]
        
        # Delete file from local storage
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{doc_id}_{filename}")
        if os.path.exists(file_path):
            os.remove(file_path)
        
        # Delete from Pinecone
        try:
            from retrieval import get_pinecone_client, COLLECTION_NAME
            index = get_pinecone_client().Index(COLLECTION_NAME)
            index.delete(filter={"document_id": doc_id, "user_id": user_id})
        except Exception as pe:
            print(f"Warning: Failed to delete vectors from Pinecone: {pe}")

        return jsonify({"message": "Document deleted"}), 200
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route('/api/v1/documents/<doc_id>/file', methods=['GET'])
@token_required
def serve_document_file(doc_id):
    """Serves the actual file for preview purposes"""
    user_id = request.user['id']
    
    # 1. Try Filename Cache First
    with CACHE_LOCK:
        if doc_id in PREVIEW_FILENAME_CACHE:
            filename = PREVIEW_FILENAME_CACHE[doc_id]
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{doc_id}_{filename}")
            if os.path.exists(file_path):
                from flask import send_file
                return send_file(file_path)

    # 2. Cache miss, go to DB
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT filename FROM documents WHERE id = %s AND user_id = %s", (doc_id, user_id))
        row = cur.fetchone()
        cur.close()
        
        if not row:
            return jsonify({"error": "Document not found or unauthorized"}), 404
            
        filename = row[0]
        # Update Cache
        with CACHE_LOCK:
            PREVIEW_FILENAME_CACHE[doc_id] = filename
            
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{doc_id}_{filename}")
        
        if not os.path.exists(file_path):
            return jsonify({"error": "File not found on disk"}), 404
            
        from flask import send_file
        return send_file(file_path)
            
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    finally:
        release_db_connection(conn)


# Start a background thread to preload models
def preload_models():
    try:
        from retrieval import get_embedding_model, get_cross_encoder, get_pinecone_client
        # Import llm_handler conditionally as it might not be needed immediately
        try:
            from llm_handler import ensure_genai_initialized
        except ImportError:
            ensure_genai_initialized = None
        
        # Load models in background with proper error handling
        try:
            get_embedding_model()
        except Exception as e:
            pass
            
        try:
            get_cross_encoder()
        except Exception as e:
            pass
            
        try:
            get_pinecone_client()
        except Exception as e:
            pass
            
        # Only try to load Gemini if available
        if ensure_genai_initialized:
            try:
                ensure_genai_initialized()
            except Exception as e:
                pass
    except Exception as e:
        pass

# Start preloading after app is created but before it runs
threading.Thread(target=preload_models, daemon=True).start()

if __name__ == "__main__":
    init_db() # Run DB initialization on startup
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

    # Test DB connection before starting server
    # conn = get_db_connection()
    # cur = conn.cursor()
    # cur.execute("SELECT version();")
    # print(cur.fetchone())
    # cur.close()
    # conn.close()