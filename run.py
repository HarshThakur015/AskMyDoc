
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from backend.app import app
from backend.auth.routes import get_db_connection

if __name__ == "__main__":
    try:
        conn = get_db_connection()
        conn.close()
    except Exception:
        # DB connection failures are logged inside get_db_connection
        pass
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)