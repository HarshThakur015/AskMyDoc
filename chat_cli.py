import requests
import json
import sys
import time

PORT = 5000
BASE_URL = f"http://127.0.0.1:{PORT}"

def print_separator():
    print("-" * 50)

def main():
    print("=== Interactive Chatbot CLI ===")
    email = input("Email: ").strip()
    if not email:
        email = "testuser_5b91600b@example.com"
        print(f"Using default testing email: {email}")
        
    password = input("Password: ").strip()
    if not password:
        password = "password123"
        print("Using default testing password")

    print("[Authenticate...]")
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
        if resp.status_code == 200:
            token = resp.json().get("token")
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            print("[OK] Login successful!\n")
        else:
            print(f"[FAIL] Login failed: {resp.text}")
            do_signup = input("Try creating a new account? (y/n): ").lower() == 'y'
            if do_signup:
                username = input("Username: ").strip() or f"user_{int(time.time())}"
                signup_resp = requests.post(f"{BASE_URL}/auth/signup", json={
                    "username": username, "email": email, "password": password
                })
                if signup_resp.status_code == 201:
                    token = signup_resp.json().get("token")
                    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
                    print("[OK] Signup & Login successful!\n")
                else:
                    print(f"❌ Signup failed: {signup_resp.text}")
                    sys.exit(1)
            else:
                sys.exit(1)
    except Exception as e:
        print(f"❌ Connection error: {str(e)}")
        print("Please ensure the server is running (python run.py) first.")
        sys.exit(1)

    print("Welcome to the support AI. You can now chat!")
    print("Type 'exit' or 'quit' to close.")
    print("Type 'clear' to reset conversation history.")
    print_separator()

    history = []

    while True:
        try:
            question = input("\n[USER]: ")
            if not question.strip():
                continue
                
            if question.lower() in ['exit', 'quit']:
                print("Goodbye!")
                break
                
            if question.lower() == 'clear':
                history = []
                print("Conversation history cleared.")
                continue

            # Add a delay to avoid 429 Rate Limiting in Gemini Free Tier (15 RPM)
            time.sleep(10)
            
            payload = {
                "question": question,
                "history": history,
                "top_k": 4,
                "use_llm": True,
                "include_sources": True
            }
            
            start_time = time.time()
            resp = requests.post(f"{BASE_URL}/api/v1/chat/run", json=payload, headers=headers)
            
            if resp.status_code != 200:
                print(f"[FAIL] Error: {resp.status_code} - {resp.text}")
                continue
                
            data = resp.json()
            answer = data.get("answer", "No answer found.")
            latency = round(time.time() - start_time, 2)
            
            # Clear "Thinking..."
            print(" " * 30, end="\r")
            print(f"[AI]: {answer}")
            
            # Show sources if any
            sources = data.get("sources", [])
            provider = data.get("llm_provider", data.get("provider", ""))
            
            if sources:
                source_strings = []
                for s in sources:
                    source_strings.append(f"{s.get('source')} (Pg {s.get('page')})")
                print(f"\n   [Sources: {', '.join(source_strings)}] [{latency}s]")
            else:
                print(f"\n   [No Document Sources Available] [{latency}s]")
            
            # Update history
            history.append({"role": "user", "content": question})
            history.append({"role": "assistant", "content": answer})

        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {str(e)}")

if __name__ == "__main__":
    main()
