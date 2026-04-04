import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
try:
    genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
    print("Listing models for API key ending in:", os.getenv('GEMINI_API_KEY', '')[-4:])
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name} ({m.display_name})")
except Exception as e:
    print(f"Error: {e}")
