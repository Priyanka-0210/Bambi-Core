# backend/app/services/gemini_service.py
import time
from google import genai
from google.genai import types
from google.genai.errors import ServerError, ClientError
from app.config import settings

class GeminiService:
    def __init__(self):
        # Initializing the modern Google GenAI Client
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.text_model = 'gemini-2.5-flash' 
        # Using the standard modern endpoint identifier natively supported by the SDK
        self.embed_model = 'gemini-embedding-001'

    def categorize_content(self, text: str) -> str:
        """
        Analyzes text and returns a strict single-word category label.
        Includes automated wait retry logic to gracefully bypass rate limits.
        """
        prompt = f"""
        You are Bambi, an intelligent digital second brain.
        Analyze the following text snippet and classify it into exactly one category.
        If it is a quote, reply with 'Quote'.
        If it discusses artificial intelligence, machine learning, or software, reply with 'AI'.
        If it discusses food, recipes, or cooking, reply with 'Food'.
        If it doesn't fit these, choose a fitting 1-word category name based on the content.

        Return ONLY the single-word category label, nothing else. No punctuation.

        Text: "{text}"
        """
        
        for attempt in range(2):
            try:
                response = self.client.models.generate_content(
                    model=self.text_model,
                    contents=prompt
                )
                return response.text.strip()
            except (ServerError, ClientError) as e:
                if "503" in str(e) or "429" in str(e) or "demand" in str(e).lower():
                    if attempt == 0:
                        print("   [Bambi Notice] Server cluster busy or rate limit hit. Waiting 3 seconds before retrying...")
                        time.sleep(3)
                        continue
                raise e
        return "Uncategorized"

    def get_text_embedding(self, text: str) -> list:
        """
        Generates a native embedding vector, explicitly constrained to 768 dimensions
        to safely match your existing Pinecone Index tracking configuration.
        """
        result = self.client.models.embed_content(
            model=self.embed_model,
            contents=text,
            config=types.EmbedContentConfig(
                output_dimensionality=768
            )
        )
        return result.embeddings[0].values