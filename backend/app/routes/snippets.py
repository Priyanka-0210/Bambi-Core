# backend/app/routes/snippets.py
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_service import GeminiService
from app.services.vector_service import VectorService
from app.database import save_local_snippet

router = APIRouter(prefix="/snippets", tags=["snippets"])

# Initialize services
gemini = GeminiService()
vector_db = VectorService()

class SnippetRequest(BaseModel):
    content: str

class SearchRequest(BaseModel):
    query: str

@router.post("/save")
async def save_snippet(request: SnippetRequest):
    try:
        text = request.content
        if not text.strip():
            raise HTTPException(status_code=400, detail="Content cannot be empty")
        
        # 1. Generate unique identifier
        snippet_id = str(uuid.uuid4())
        
        # 2. Bambi categorizes the text
        category = gemini.categorize_content(text)
        
        # 3. Bambi builds semantic vector mapping
        embedding = gemini.get_text_embedding(text)
        
        # 4. Save metadata to Pinecone for vector retrieval
        metadata = {"content": text, "category": category}
        vector_db.store_snippet_vector(snippet_id, embedding, metadata)
        
        # 5. Save structured entry to local machine database
        save_local_snippet(snippet_id, text, category)
        
        return {
            "status": "success",
            "id": snippet_id,
            "category": category,
            "message": "Bambi processed and stored your note securely."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search")
async def search_snippets(request: SearchRequest):
    try:
        # 1. Convert conversational query into search vector
        query_vector = gemini.get_text_embedding(request.query)
        
        # 2. Match meaning across Pinecone index
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