
import requests
import time
import os
import sys
import uuid
import threading
from dotenv import load_dotenv

# Ensure we can import from backend
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))

load_dotenv()

BASE_URL = "http://127.0.0.1:5000"
import uuid
TEST_USER_EMAIL = f"final_master_{uuid.uuid4().hex}@example.com"
TEST_USER_PASS = "password123"

# Sample document content for E2E validation
TEST_DOC_CONTENT = """
### SECTION 1: REMOTE WORK POLICY
The company fully supports flexible working. Employees are expected to be in the office on **Tuesdays and Thursdays**. Mondays, Wednesdays, and Fridays are designated as flexible remote days.

### SECTION 2: HEALTH INSURANCE BENEFITS
We provide comprehensive health insurance through **BlueCross BlueShield**. The standard medical plan covers 80% of costs after a $1,500 deductible is met. Emergency room visits require a flat copay of $250.

### SECTION 3: ENGINEERING CODING STANDARDS
All backend Python code must follow PEP 8 standards. We use 'Black' for automatic formatting and 'ruff' for linting.
"""

def log_step(name):
    print(f"\n{'='*20} STEP: {name} {'='*20}")

def run_e2e_tests():
    # Attempt to start server in a background thread for self-contained testing
    # Note: If server is already running on 5006, this might fail, but requests will still work.
    
    headers = {}
    
    # 1. AUTHENTICATION SCENARIOS
    log_step("User Signup")
    uname = TEST_USER_EMAIL.split('@')[0]
    signup_data = {
        "username": uname,
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASS
    }
    resp = requests.post(f"{BASE_URL}/auth/signup", json=signup_data)
    if resp.status_code == 201:
        print(f"[OK] Created unique test user: {TEST_USER_EMAIL}")
    else:
        print(f"[FAIL] Signup failed: {resp.text}")
        return

    log_step("User Login")
    login_data = {"email": TEST_USER_EMAIL, "password": TEST_USER_PASS}
    resp = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    if resp.status_code == 200:
        token = resp.json().get("token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        print("[OK] Logged in and received JWT.")
    else:
        print(f"[FAIL] Login failed: {resp.text}")
        return

    # 2. INGESTION SCENARIO
    log_step("Document Ingestion")
    with open("test_master_doc.txt", "w", encoding="utf-8") as f:
        f.write(TEST_DOC_CONTENT)
    
    with open("test_master_doc.txt", "rb") as f:
        files = {'file': ('test_master_doc.txt', f, 'text/plain')}
        # Headers for multipart/form-data should NOT contain Content-Type if using 'files' arg in requests
        upload_headers = {"Authorization": f"Bearer {token}"}
        resp = requests.post(f"{BASE_URL}/api/v1/upload", headers=upload_headers, files=files)
    
    if resp.status_code == 202:
        doc_id = resp.json().get("document_id")
        print(f"[OK] Ingestion started for Doc ID: {doc_id}. Polling for completion...")
    else:
        print(f"[FAIL] Upload failed: {resp.text}")
        return

    # Poll for doc status
    max_poll = 20  # Increased for stability
    for i in range(max_poll):
        status_resp = requests.get(f"{BASE_URL}/api/v1/documents", headers=headers)
        docs = status_resp.json()
        my_doc = next((d for d in docs if d['id'] == doc_id), None)
        if my_doc and my_doc['status'] == 'completed':
            print(f"[OK] Ingestion COMPLETED after {i*3}s.")
            break
        print(f"Waiting for ingestion... ({i*3}s)")
        time.sleep(3)
    else:
        print("[FAIL] Ingestion timed out.")
        return

    # WAIT for Pinecone Consistency (Free tier requirement)
    print("\nWaiting 20s for Pinecone consistency...")
    time.sleep(20)

    # 3. RETRIEVAL & GROUNDING SCENARIOS
    history = []

    def ask(question, expect_err=False):
        print(f"\nQ: {question}")
        time.sleep(15) # Avoid Gemini Rate Limits
        payload = {"question": question, "history": history, "use_llm": True}
        resp = requests.post(f"{BASE_URL}/api/v1/chat/run", json=payload, headers=headers)
        data = resp.json()
        ans = data.get("answer")
        print(f"A: {ans}")
        # Add to local history simulation
        history.append({"role": "user", "content": question})
        history.append({"role": "assistant", "content": ans})
        return ans

    # TEST: Direct Fact Retrieval
    log_step("Direct Fact Retrieval")
    ans_1 = ask("What are the office days?")
    assert "tuesdays" in ans_1.lower() and "thursdays" in ans_1.lower(), "Should find office days."

    # TEST: Conversational Memory
    log_step("Conversational Memory")
    ans_2 = ask("And what should I use for Python formatting?")
    assert "black" in ans_2.lower() or "formatter" in ans_2.lower(), "Should remember context/document."

    # TEST: Grounding Fallback
    log_step("Grounding & Safety Fallback")
    ans_3 = ask("Who is the president of Mars?")
    assert "can't find" in ans_3.lower() or "not available" in ans_3.lower(), "Should block ungrounded info."

    # TEST: Meta-Conversational Reasoning (The new fix)
    log_step("Meta-Conversational Awareness")
    ans_4 = ask("Why couldn't you answer my previous question about Mars?")
    # Check that it doesn't just say "Can't find answer" but acknowledges it wasn't in the doc
    assert "can't find" not in ans_4.lower() or len(ans_4) > 50, "Should explain itself rather than hit a wall."

    log_step("ALL E2E SCENARIOS PASSED")
    print("\nRemoving temporary test files...")
    os.remove("test_master_doc.txt")

if __name__ == "__main__":
    run_e2e_tests()
