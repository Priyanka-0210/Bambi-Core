# backend/app/services/gemini_service.py
from google import genai
from google.genai import types
from app.config import settings

class GeminiService:
    def __init__(self):
        # The new SDK automatically discovers GEMINI_API_KEY from environment or config pass
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        # Standard model string for rapid tasks
        self.model_id = 'gemini-2.5-flash'

    def categorize_content(self, text: str) -> str:
        """
        Analyzes text and returns a strict single-word category label.
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
        response = self.client.models.generate_content(
            model=self.model_id,
            contents=prompt
        )
        return response.text.strip()

    def get_text_embedding(self, text: str) -> list:
        """
        Generates a 768-dimensional vector embedding for semantic search.
        """
        result = self.client.models.embed_content(
            model="text-embedding-004",
            contents=text
        )
        # The new SDK structures responses with an embeddings list array attribute
        return result.embeddings[0].values