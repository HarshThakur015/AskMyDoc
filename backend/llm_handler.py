import os
import time
from dotenv import load_dotenv
import google.generativeai as genai

_genai_initialized = False

load_dotenv()

# Get API key from environment variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# REMOVED immediate initialization
# if GEMINI_API_KEY:
#     genai.configure(api_key=GEMINI_API_KEY)

def ensure_genai_initialized():
    """Lazy initialization of Gemini API to save memory at startup"""
    global _genai_initialized
    if not _genai_initialized and GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        _genai_initialized = True
        return True
    return bool(GEMINI_API_KEY)

def generate_response(question, search_results, history=None):
    """
    Generate a comprehensive answer using Gemini based on multiple search results and conversation history.
    
    Args:
        question (str): The user's original question
        search_results (list): List of retrieved document chunks with metadata
        history (list): Optional list of historical message dicts [{"role": "user"/"assistant", "content": "..."}]
        
    Returns:
        dict: LLM response with attribution
    """
    if history is None:
        history = []
        
    # Prepare context from search results
    contexts = []
    sources = []
    
    # Exit early ONLY if no results AND no history (purely a fresh query with no data)
    if not search_results and not history:
        return {
            "answer": "I don't have enough information to answer your question based on the available documents.",
            "sources": [],
            "provider": "none"
        }
    
    # Process each search result
    for result in search_results:
        # Format each result with its source
        context = f"Document: {result['source']}, Page: {result['page']}\n{result['text']}\n"
        contexts.append(context)
        
        # Add source if not already present
        source_info = {"source": result['source'], "page": result['page']}
        if source_info not in sources:
            sources.append(source_info)
    
    # Join all contexts
    all_contexts = "\n---\n".join(contexts) if contexts else "No relevant document excerpts found for this specific query."
    
    # Format the history
    conversation_history = ""
    if history:
        for msg in history:
            role = "User" if msg.get("role") == "user" else "Assistant"
            conversation_history += f"{role}: {msg.get('content')}\n"
    
    # Create the prompt for Gemini with strict ground rules
    prompt = f"""
You are an expert assistant answering questions based on policy document excerpts and conversational history.

CRITICAL RULES:
1. DOCUMENT FACTS: If the user asks for facts, summaries, or descriptions of the documents, you MUST use the provided excerpts below.
2. CONVERSATIONAL CONTEXT: Use the provided conversational history to maintain state and answer follow-up questions accurately.
3. OVERVIEW QUERIES: If the user asks broad questions like "summarize", "key findings", "main issues", or "follow-up steps", assume they want a synthesized overview using all relevant chunks. 
4. STRUCTURE: For "summarize" or "list details", use bullet points and bold headings to make the answer highly readable.
5. ABSENCE OF DATA: If the answer is NOT available in the excerpts AND cannot be answered via conversational history, you MUST reply exactly with: "I can't find the answer in the uploaded documents."
5. Be conversational, concise but thorough, and format your output cleanly. Use Markdown.

CONVERSATIONAL HISTORY:
{conversation_history if conversation_history else "No prior history."}

POLICY DOCUMENT EXCERPTS:
{all_contexts}

USER QUESTION: {question}

YOUR ANSWER:
"""
    
    # UPDATED: Check if Gemini API key is set using lazy initialization
    if not ensure_genai_initialized():
        return {
            "answer": "Google Gemini API key is not configured. Please add your GEMINI_API_KEY to the .env file.",
            "sources": sources,
            "provider": "none"
        }
    
    try:
        # Reverting to the user-confirmed alias 'gemini-flash-latest'
        model = genai.GenerativeModel('gemini-flash-latest')
        
        # Enhanced retry and error logic for 429/quota issues
        max_retries = 3
        for attempt in range(max_retries + 1):
            try:
                # Generate response
                response = model.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.2, 
                        max_output_tokens=1024,
                        top_p=0.95,
                        top_k=40
                    )
                )
                
                # Handle cases where response might be blocked or empty
                if not response or not hasattr(response, 'text'):
                    if hasattr(response, 'candidates') and response.candidates:
                        # Check if it was blocked
                        finish_reason = response.candidates[0].finish_reason
                        if finish_reason:
                            return {
                                "answer": f"The response was filtered (Reason: {finish_reason.name}). Please try rephrasing your question.",
                                "sources": sources,
                                "provider": "gemini-flash-latest"
                            }
                    return {
                        "answer": "The AI could not generate a response. Please try again.",
                        "sources": sources,
                        "provider": "gemini-flash-latest"
                    }

                return {
                    "answer": response.text.strip(),
                    "sources": sources,
                    "provider": "gemini-flash-latest"
                }
                
            except Exception as inner_e:
                error_msg = str(inner_e).lower()
                # If it's a quota/rate limit error, wait longer or fail gracefully
                if ("429" in error_msg or "quota" in error_msg) and attempt < max_retries:
                    wait_time = (2 ** attempt) * 5 # Wait 5, 10, 20 seconds
                    print(f"DEBUG: Quota hit (429), retrying in {wait_time}s... (Attempt {attempt+1}/{max_retries})", flush=True)
                    time.sleep(wait_time)
                    continue
                raise inner_e
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "quota" in error_msg:
            return {
                "answer": "Sorry, you've reached the Gemini API daily quota limit (429). Please try again later or check your API configuration in Google AI Studio.",
                "sources": sources,
                "provider": "error"
            }
        return {
            "answer": f"Sorry, I couldn't generate a response. Error: {error_msg}",
            "sources": sources,
            "provider": "error"
        }
    
    # Return a graceful error message if generation fails
    return {
        "answer": "Sorry, I couldn't generate a response. The Gemini service may be unavailable.",
        "sources": sources,
        "provider": "none"
    }
