# backend/app/main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routes import snippets
from app.database import init_db

# 1. Initialize the Core FastAPI App Application Instance
app = FastAPI(title="Bambi AI Engine", version="1.5")

# 2. Allow Local Frontend Interfaces to Exchange Data Streams (CORS Policies)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Fine for local development environments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Initialize Database Mappings on Core Engine Startup
@app.on_event("startup")
def startup_event():
    print("Synchronizing local SQLite schema records...")
    init_db()

# 4. Mount the Static Assets Directory to Serve Saved Screenshot Sticker Files
# This maps the physical storage folder directly onto http://127.0.0.1:8000/static/
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
os.makedirs(os.path.join(STATIC_DIR, "stickers"), exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
print(f"Static directory server asset node mounted at: {STATIC_DIR}")

# 5. Connect Dynamic Routing Snippet Pathways
app.include_router(snippets.router)

@app.get("/")
def read_root():
    return {"message": "Bambi Backend Engine running smoothly with Static Core capabilities."}