# backend/app/routes/snippets.py
import uuid
import datetime
import traceback
import sqlite3
import os
import base64
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from app.services.gemini_service import GeminiService
from app.services.vector_service import VectorService
from app.database import save_local_snippet, DB_PATH
from google.genai import types

router = APIRouter(prefix="/snippets", tags=["snippets"])

# Define persistent local assets directory relative to project structural architecture
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STICKER_DIR = os.path.join(BASE_DIR, "static", "stickers")
os.makedirs(STICKER_DIR, exist_ok=True)

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
            match_metadata = match.get("metadata", {})
            formatted_results.append({
                "score": match.get("score"),
                "content": match_metadata.get("content"),
                "category": match_metadata.get("category"),
                "image_url": match_metadata.get("image_url") 
            })
            
        return {"status": "success", "results": formatted_results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recent")
async def get_recent_snippets():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Verify the database schema explicitly has our new column to prevent statement runtime errors
        cursor.execute("PRAGMA table_info(snippets)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if "image_url" not in columns:
            cursor.execute("ALTER TABLE snippets ADD COLUMN image_url TEXT")
            conn.commit()

        cursor.execute("SELECT id, content, category, created_at, image_url FROM snippets ORDER BY created_at DESC LIMIT 50")
        rows = cursor.fetchall()
        
        results = []
        for row in rows:
            results.append({
                "id": row["id"],
                "content": row["content"],
                "category": row["category"],
                "created_at": row["created_at"],
                "image_url": row["image_url"]
            })
            
        return {"status": "success", "results": results}
    except Exception as e:
        print(f"Error encountered in /recent mapping: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

# MULTIMODAL CROP STICKER PROCESSING ENGINE
@router.post("/upload-sticker")
async def upload_sticker(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        
        print("\n--- Processing Visual Screenshot Sticker ---")
        print("1. Routing image framing payload to Gemini Vision...")
        
        # Safe universal Base64 serialization handling to prevent type casting drop collisions
        base64_image = base64.b64encode(image_bytes).decode("utf-8")
        
        analysis_prompt = """
        You are Bambi's visual intelligence core. Analyze this screenshot sticker.
        1. If it contains machine learning code or math formulas, write down the clean Markdown/LaTeX representation.
        2. If it is an image, code block, or text document, summarize its core technical meaning or descriptions.
        3. Assign exactly one short category identifier label (like AI, Code, Math, Disney, Design).
        
        Provide your output in this format:
        CATEGORY: <Single-Word-Category>
        DESCRIPTION: <Extracted text or semantic summary of the screenshot contents>
        """
        
        response = gemini.client.models.generate_content(
            model=gemini.text_model,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=file.content_type),
                analysis_prompt
            ]
        )
        
        raw_output = response.text
        category = "Visual"
        content_summary = raw_output
        
        for line in raw_output.split("\n"):
            if line.startswith("CATEGORY:"):
                category = line.replace("CATEGORY:", "").strip()
            elif line.startswith("DESCRIPTION:"):
                content_summary = line.replace("DESCRIPTION:", "").strip()

        # FIXED: STICKER_DIR is now globally established and tracked at the top of the file
        filename = f"{uuid.uuid4()}.png"
        file_path = os.path.join(STICKER_DIR, filename)
        with open(file_path, "wb") as f:
            f.write(image_bytes)
        
        image_url = f"http://127.0.0.1:8000/static/stickers/{filename}"
        formatted_content = f"[Visual Sticker] {content_summary}"

        print("2. Vectorizing image context text description tracks...")
        embedding = gemini.get_text_embedding(formatted_content)
        
        print("3. Syncing visual tracking matrix parameters to Pinecone...")
        snippet_id = str(uuid.uuid4())
        
        metadata = {
            "content": formatted_content, 
            "category": category,
            "image_url": image_url
        }
        vector_db.store_snippet_vector(snippet_id, embedding, metadata)

        print("4. Logging permanent trace node inside SQLite Database...")
        created_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            cursor.execute("ALTER TABLE snippets ADD COLUMN image_url TEXT")
        except sqlite3.OperationalError:
            pass # Structural parameter is already active

        cursor.execute(
            "INSERT INTO snippets (id, content, category, created_at, image_url) VALUES (?, ?, ?, ?, ?)",
            (snippet_id, formatted_content, category, created_at, image_url)
        )
        conn.commit()
        conn.close()
        
        print("Visual sticker storage tracking verified.")
        return {
            "status": "success",
            "category": category,
            "image_url": image_url,
            "message": "Visual screenshot sticker analyzed and indexed successfully!"
        }
    except Exception as e:
        print("\n=== STICKER PIPELINE PROCESSING CRASH ===")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{snippet_id}")
async def delete_snippet(snippet_id: str):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
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

class ChatAssistantRequest(BaseModel):
    message: str
    history: list = [] # To track the chat history if needed later

@router.post("/assistant-chat")
async def assistant_chat(request: ChatAssistantRequest):
    try:
        user_message = request.message
        print(f"\n--- Bambi Assistant Interaction: '{user_message}' ---")
        
        # 1. Look up any relevant memory nodes inside Pinecone matching the user's intent
        query_vector = gemini.get_text_embedding(user_message)
        search_results = vector_db.query_similar_snippets(query_vector, top_k=3)
        
        context_chunks = []
        for match in search_results.get("matches", []):
            context_chunks.append(match.get("metadata", {}).get("content"))
            
        context_str = "\n".join(context_chunks) if context_chunks else "No specific matching saved records found."
        print(f"   Context fragments retrieved: {len(context_chunks)} entries mapped.")

        # 2. Frame the specialized Assistant system persona for Gemini
        system_prompt = f"""
        You are Bambi, an authentic, highly advanced AI personal knowledge partner with a touch of wit. 
        You are talking directly to your creator. Be engaging, clear, and concise. Avoid robotic platitudes.
        
        Here is the relevant context retrieved from your personal Vault memory logs regarding their query:
        {context_str}
        
        Answer the user's question naturally using this context if applicable. If the context isn't relevant, reply using your general intelligence but maintain your personality.
        Keep your response brief (2-3 sentences max) so it sounds natural when spoken out loud.
        """

        response = gemini.client.models.generate_content(
            model=gemini.text_model,
            contents=[system_prompt, user_message]
        )
        
        ai_reply = response.text.strip()
        print(f"   Bambi Assistant Response: '{ai_reply}'")
        
        return {
            "status": "success",
            "reply": ai_reply,
            "has_context": len(context_chunks) > 0
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))