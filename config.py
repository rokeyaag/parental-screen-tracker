import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# PostgreSQL Database Configuration
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "screen_tracker_db")

DATABASE_URL = (
    f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
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

# Web Dashboard Settings
SERVER_HOST = "0.0.0.0"
SERVER_PORT = 8000
