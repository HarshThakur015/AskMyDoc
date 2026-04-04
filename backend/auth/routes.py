from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2
import os
import jwt
import datetime
from dotenv import load_dotenv
from functools import wraps

load_dotenv()
auth = Blueprint('auth', __name__)

# Simple in-memory token blacklist
# In production, use Redis or database storage for blacklisted tokens
token_blacklist = set()

def cleanup_expired_tokens():
    """
    Remove expired tokens from blacklist to prevent memory leaks.
    Returns the number of tokens removed.
    """
    tokens_to_remove = set()
    
    for token in token_blacklist:
        try:
            # If this succeeds, token is still valid
            jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            # Token is expired, can be removed from blacklist
            tokens_to_remove.add(token)
        except Exception:
            # Keep token in blacklist if any other error
            pass
            
    # Remove expired tokens from blacklist
    token_blacklist.difference_update(tokens_to_remove)
    return len(tokens_to_remove)

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_EXPIRES = int(os.getenv("JWT_EXPIRES", 3600))  # default 1 hour

# def get_db_connection():
#     return psycopg2.connect(
#         host=os.getenv("DB_HOST"),
#         port=os.getenv("DB_PORT"),
#         database=os.getenv("DB_NAME"),
#         user=os.getenv("DB_USER"),
#         password=os.getenv("DB_PASSWORD")
#     )


from psycopg2 import pool

db_pool = None

def init_db_pool():
    global db_pool
    if db_pool is None:
        dsn = os.getenv("DATABASE_URL")
        if not dsn:
            raise RuntimeError("DATABASE_URL is not set")
        db_pool = pool.SimpleConnectionPool(1, 20, dsn)
        print("Database connection pool initialized")

def get_db_connection():
    init_db_pool()
    return db_pool.getconn()

def release_db_connection(conn):
    if db_pool:
        db_pool.putconn(conn)

# Middleware to protect routes
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # DEBUG: Check where the token might be
        print(f"DEBUG: Request Path: {request.path}")
        print(f"DEBUG: Request Args: {request.args}")
        # Always allow OPTIONS requests for CORS preflight
        if request.method == 'OPTIONS':
            return jsonify({}), 200

        token = None
        if 'token' in request.args:
            token = request.args.get('token')
            print(f"DEBUG: Found token in args: {token[:10]}...")

        if not token and 'Authorization' in request.headers:
            bearer = request.headers['Authorization']
            if bearer.startswith("Bearer "):
                token = bearer.split(" ")[1]
                print(f"DEBUG: Found token in headers: {token[:10]}...")

        if not token:
            print(f"DEBUG: No token found in request to {request.path}")
            return jsonify({"error": "Token is missing!"}), 401
            
        # Check if token is blacklisted (logged out)
        if token in token_blacklist:
            return jsonify({"error": "Token has been revoked. Please login again."}), 401

        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

            # Ensure token user still exists in DB (handles stale tokens after DB resets/deletions).
            conn = get_db_connection()
            try:
                cur = conn.cursor()
                cur.execute("SELECT id, username, email FROM users WHERE id = %s", (data.get("id"),))
                user_row = cur.fetchone()
                cur.close()
            finally:
                release_db_connection(conn)

            if not user_row:
                return jsonify({"error": "User session is no longer valid. Please login again."}), 401

            request.user = {
                "id": user_row[0],
                "username": user_row[1],
                "email": user_row[2],
                "exp": data.get("exp")
            }
        except jwt.ExpiredSignatureError:
            print(f"DEBUG: Token expired for user requesting {request.path}")
            return jsonify({"error": "Token expired!"}), 401
        except jwt.InvalidTokenError:
            print(f"DEBUG: Invalid token presented for {request.path}")
            return jsonify({"error": "Invalid token!"}), 401

        return f(*args, **kwargs)
    return decorated


@auth.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    hashed_password = generate_password_hash(password)

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM users WHERE email = %s OR username = %s", (email, username))
        existing = cur.fetchone()
        if existing:
            return jsonify({"error": "User already exists"}), 409

        cur.execute("INSERT INTO users (username, email, password) VALUES (%s, %s, %s) RETURNING id",
                    (username, email, hashed_password))
        user_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        release_db_connection(conn)
        
        # Generate JWT token upon signup
        payload = {
            "id": user_id,
            "username": username,
            "email": email,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(seconds=JWT_EXPIRES)
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

        return jsonify({
            "message": "Signup successful!",
            "token": token,
            "user": {"id": user_id, "username": username, "email": email}
        }), 201

    except psycopg2.Error as e:
        return jsonify({"error": str(e)}), 500


@auth.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, username, password FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        cur.close()
        release_db_connection(conn)

        if user and check_password_hash(user[2], password):
            payload = {
                "id": user[0],
                "username": user[1],
                "email": email,
                "exp": datetime.datetime.utcnow() + datetime.timedelta(seconds=JWT_EXPIRES)
            }
            token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

            return jsonify({
                "message": "Login successful!",
                "token": token,
                "user": {
                    "id": user[0],
                    "username": user[1],
                    "email": email
                }
            }), 200
        else:
            return jsonify({"error": "Invalid credentials"}), 401

    except psycopg2.Error as e:
        return jsonify({"error": str(e)}), 500


@auth.route('/users', methods=['GET'])
@token_required
def get_users():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, username, email, password FROM users")
        users = cur.fetchall()
        cur.close()
        release_db_connection(conn)

        user_list = [{"id": u[0], "username": u[1], "email": u[2], "password": u[3]} for u in users]
        return jsonify(user_list), 200

    except psycopg2.Error as e:
        return jsonify({"error": str(e)}), 500


@auth.route('/logout', methods=['POST'])
@token_required
def logout():
    """
    Logout endpoint - invalidates the current token by adding it to a blacklist
    
    The token is added to the blacklist and the client should also
    delete the token from local storage for a complete logout.
    """
    # Get token from Authorization header
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        
        # Add to blacklist
        token_blacklist.add(token)
        
        # Periodically clean up expired tokens (every 10 logouts)
        if len(token_blacklist) % 10 == 0:
            removed = cleanup_expired_tokens()
            
        return jsonify({
            "message": "Successfully logged out",
            "info": "Token has been invalidated"
        }), 200
    
    return jsonify({"error": "Invalid token format"}), 400


@auth.route('/blacklist/status', methods=['GET'])
@token_required
def blacklist_status():
    """Administrative endpoint to check blacklist status"""
    # Only allow admin users (in a real app you would check admin status)
    # For demo, we'll just check if the user requesting is user ID 1
    if request.user.get('id') == 1:
        return jsonify({
            "blacklisted_tokens_count": len(token_blacklist),
            # Don't return actual tokens in production for security reasons
            "sample": list(token_blacklist)[:3] if token_blacklist else []
        }), 200
    return jsonify({"error": "Unauthorized access"}), 403