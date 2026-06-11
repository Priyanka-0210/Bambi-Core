# backend/app/services/vector_service.py
from pinecone import Pinecone, ServerlessSpec
from app.config import settings

class VectorService:
    def __init__(self):
        # Initialize Pinecone client
        self.pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        self.index_name = settings.PINECONE_INDEX_NAME
        
        # Automatically create index if it doesn't exist yet
        # models/text-embedding-004 produces 768 dimensions
        if self.index_name not in self.pc.list_indexes().names():
            self.pc.create_index(
                name=self.index_name,
                dimension=768,
                metric='cosine',
                spec=ServerlessSpec(
                    cloud='aws',
                    region='us-east-1' # Change to match your free-tier region
                )
            )
        self.index = self.pc.Index(self.index_name)

    def store_snippet_vector(self, snippet_id: str, embedding: list, metadata: dict):
        """
        Inserts the text vector and metadata into the Pinecone index.
        """
        self.index.upsert(
            vectors=[
                {
                    "id": snippet_id,
                    "values": embedding,
                    "metadata": metadata
                }
            ]
        )

    def query_similar_snippets(self, query_embedding: list, top_k: int = 3):
        """
        Searches Pinecone for the most semantically relevant memories.
        """
        results = self.index.query(
            vector=query_embedding,
            top_k=top_k,
            include_metadata=True
        )
        return results