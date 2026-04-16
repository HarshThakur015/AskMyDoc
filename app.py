import os
import sys

# Make backend-local imports (auth, retrieval, etc.) resolvable in all entrypoints.
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from backend.app import app
