import sys
import uvicorn
from server.app import app
import config

if __name__ == "__main__":
    print(f"=====================================================")
    print(f"  Parental Screen Tracker - Web Dashboard")
    print(f"  URL: http://localhost:{config.SERVER_PORT}")
    print(f"=====================================================")
    uvicorn.run(app, host=config.SERVER_HOST, port=config.SERVER_PORT)
