import os
import psycopg2
from dotenv import load_dotenv

def init_db():
    load_dotenv()
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        print("Warning: DATABASE_URL is not set. Skipping DB initialization.")
        return
        
    try:
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        # Create the users table first
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Create the sessions table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) DEFAULT 'New Chat',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Create the documents table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                filename VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'processing',
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Junction table for sessions and documents
        cur.execute("""
            CREATE TABLE IF NOT EXISTS session_documents (
                session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
                document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
                PRIMARY KEY (session_id, document_id)
            );
        """)
        
        # Create the messages table with session_id
        cur.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
                role VARCHAR(20) NOT NULL,
                content TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        conn.commit()
        cur.close()
        conn.close()
        print("Database initialized successfully.")
    except Exception as e:
        print(f"Error initializing database: {e}")
