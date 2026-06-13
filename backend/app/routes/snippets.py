# backend/app/routes/snippets.py
import uuid
import traceback
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import GeminiService
from app.services.vector_service import VectorService
from app.database import save_local_snippet

router = APIRouter(prefix="/snippets", tags=["snippets"])

print("Initializing Bambi Core Services...")
try:
    gemini = GeminiService()
    vector_db = VectorService()
    print("Bambi Services initialized successfully.")
except Exception as init_err:
    print("CRITICAL: Failed to initialize Bambi Services!")
    traceback.print_exc()

class SnippetRequest(BaseModel):
    content: str

class SearchRequest(BaseModel):
    query: str

@router.post("/save")
async def save_snippet(request: SnippetRequest):
    try:
        text = request.content
        print(f"\n--- Ingesting Snippet: '{text[:30]}...' ---")
        if not text.strip():
            raise HTTPException(status_code=400, detail="Content cannot be empty")
        
        snippet_id = str(uuid.uuid4())
        
        print("1. Contacting Gemini for Category...")
        category = gemini.categorize_content(text)
        print(f"   Categorized as: {category}")
        
        print("2. Generating Embeddings Vector...")
        embedding = gemini.get_text_embedding(text)
        print(f"   Vector generated (Dimensions: {len(embedding)})")
        
        print("3. Syncing to Pinecone...")
        metadata = {"content": text, "category": category}
        vector_db.store_snippet_vector(snippet_id, embedding, metadata)
        print("   Pinecone storage verified.")
        
        print("4. Backing up to SQLite Database...")
        save_local_snippet(snippet_id, text, category)
        print("   SQLite backup saved.")
        
        return {
            "status": "success",
            "id": snippet_id,
            "category": category,
            "message": "Bambi processed and stored your note securely."
        }
    except Exception as e:
        print("\n=== BAMBI CORE SAVING ERROR DETAILS ===")
        traceback.print_exc()
        print("========================================\n")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search")
async def search_snippets(request: SearchRequest):
    try:
        query_vector = gemini.get_text_embedding(request.query)
        search_results = vector_db.query_similar_snippets(query_vector, top_k=3)
        
        formatted_results = []
        for match in search_results.get("matches", []):
            formatted_results.append({
                "score": match.get("score"),
                "content": match.get("metadata", {}).get("content"),
                "category": match.get("metadata", {}).get("category")
            })
            
        return {"status": "success", "results": formatted_results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# Add this endpoint at the very end of backend/app/routes/snippets.py

@router.get("/recent")
async def get_recent_snippets():
    try:
        import sqlite3
        from app.database import DB_PATH
        
        conn = sqlite3.connect(DB_PATH)
        # Convert rows automatically into dictionary key-value items
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Pull records ordered strictly by most recently logged timestamp
        cursor.execute("SELECT id, content, category, created_at FROM snippets ORDER BY created_at DESC LIMIT 50")
        rows = cursor.fetchall()
        conn.close()
        
        results = []
        for row in rows:
            results.append({
                "id": row["id"],
                "content": row["content"],
                "category": row["category"],
                "created_at": row["created_at"]
            })
            
        return {"status": "success", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# Append this directly to the bottom of backend/app/routes/snippets.py

@router.delete("/{snippet_id}")
async def delete_snippet(snippet_id: int):
    try:
        import sqlite3
        from app.database import DB_PATH
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Verify existence
        cursor.execute("SELECT id FROM snippets WHERE id = ?", (snippet_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Snippet node not found.")
            
        cursor.execute("DELETE FROM snippets WHERE id = ?", (snippet_id,))
        conn.commit()
        conn.close()
        
        return {"status": "success", "message": f"Node {snippet_id} dropped."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))