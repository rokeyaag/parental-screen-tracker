import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Load .env file if present
env_file = BASE_DIR / ".env"
if env_file.exists():
    try:
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k and k not in os.environ:
                        os.environ[k] = v
    except Exception as e:
        print(f"[Config Warning] Error reading .env file: {e}")

# PostgreSQL Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL")

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "screen_tracker_db")

if not DATABASE_URL:
    DATABASE_URL = (
        f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

# Tracker Settings
DEVICE_NAME = os.getenv("DEVICE_NAME", "Laptop-Children")
ASSIGNED_CHILD = os.getenv("ASSIGNED_CHILD", "Brothers (Study PC)")
CHECK_INTERVAL_SECONDS = 3  # Check active window every 3 seconds
BATCH_SAVE_INTERVAL_SECONDS = 15  # Commit logs to DB every 15 seconds
IDLE_THRESHOLD_SECONDS = 180  # Consider idle if no keyboard/mouse input for 3 minutes

# Default Rules
DEFAULT_GAME_LIMIT_MINUTES = 60  # 1 hour per day for games
STUDY_START_HOUR = 19  # 7:00 PM (19:00)
STUDY_END_HOUR = 22  # 10:00 PM (22:00)
PARENT_PIN = os.getenv("PARENT_PIN", "1234")

# Screenshot Monitoring Settings
SCREENSHOT_ENABLED = os.getenv("SCREENSHOT_ENABLED", "true").lower() == "true"
SCREENSHOT_INTERVAL_SECONDS = int(os.getenv("SCREENSHOT_INTERVAL_SECONDS", "180"))  # Auto-capture every 3 minutes
SCREENSHOT_MAX_STORED = int(os.getenv("SCREENSHOT_MAX_STORED", "50"))  # Retain latest 50 screenshots per device
SCREENSHOT_QUALITY = int(os.getenv("SCREENSHOT_QUALITY", "65"))  # JPEG quality 65% for lean storage (~50KB)
SCREENSHOT_WIDTH = int(os.getenv("SCREENSHOT_WIDTH", "1024"))
SCREENSHOT_HEIGHT = int(os.getenv("SCREENSHOT_HEIGHT", "576"))

# Keystroke & Clipboard Logging Settings
KEYSTROKE_LOGGING_ENABLED = os.getenv("KEYSTROKE_LOGGING_ENABLED", "true").lower() == "true"
KEYSTROKE_FLUSH_INTERVAL_SECONDS = float(os.getenv("KEYSTROKE_FLUSH_INTERVAL_SECONDS", "3.0"))  # Inactivity pause before sentence flush
KEYSTROKE_MAX_STORED = int(os.getenv("KEYSTROKE_MAX_STORED", "1500"))  # Retain latest 1,500 keystroke logs per device
CLIPBOARD_LOGGING_ENABLED = os.getenv("CLIPBOARD_LOGGING_ENABLED", "true").lower() == "true"

# Web Dashboard Settings
SERVER_HOST = "0.0.0.0"
SERVER_PORT = 8000

