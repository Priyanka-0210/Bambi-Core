# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import snippets
from app.database import init_db

app = FastAPI(title="Bambi AI Engine", version="1.0")

# Allow local frontend interfaces to exchange data
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Fine for local development environments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database mappings on startup
@app.on_event("startup")
def startup_event():
    init_db()

# Connect snippet pathways
app.include_router(snippets.router)

@app.get("/")
def read_root():
    return {"message": "Bambi Backend Engine running smoothly."}