# backend/app/database.py
import sqlite3
from datetime import datetime

DB_PATH = "bambi_local.db"

def init_db():
    """Initializes the local SQLite database for structured data."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Table for text snippets
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS snippets (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            category TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def save_local_snippet(snippet_id: str, content: str, category: str):
    """Saves snippet record to local sqlite database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cursor.execute(
        "INSERT INTO snippets (id, content, category, created_at) VALUES (?, ?, ?, ?)",
        (snippet_id, content, category, now)
    )
    conn.commit()
    conn.close()