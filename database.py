import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from datetime import datetime, date
import config

_db_pool = None

def get_pool():
    global _db_pool
    if _db_pool is None:
        if config.DATABASE_URL and ("@" in config.DATABASE_URL or "://" in config.DATABASE_URL):
            clean_url = config.DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://")
            _db_pool = pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=15,
                dsn=clean_url
            )
        else:
            _db_pool = pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=15,
                user=config.DB_USER,
                password=config.DB_PASSWORD,
                host=config.DB_HOST,
                port=config.DB_PORT,
                database=config.DB_NAME
            )
    return _db_pool

@contextmanager
def get_db():
    p = get_pool()
    conn = p.getconn()
    try:
        yield conn
    finally:
        p.putconn(conn)

def init_db():
    if config.DATABASE_URL and ("@" in config.DATABASE_URL or "://" in config.DATABASE_URL):
        clean_url = config.DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://")
        conn = psycopg2.connect(dsn=clean_url)
    else:
        conn = psycopg2.connect(
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            host=config.DB_HOST,
            port=config.DB_PORT,
            database=config.DB_NAME
        )
    conn.autocommit = True
    cur = conn.cursor()

    # Create tables
    cur.execute("""
    CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        device_name VARCHAR(100) UNIQUE NOT NULL,
        assigned_child VARCHAR(100),
        os_name VARCHAR(50) DEFAULT 'Windows',
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description VARCHAR(200),
        is_restricted_by_default BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS app_rules (
        id SERIAL PRIMARY KEY,
        process_name VARCHAR(100) UNIQUE NOT NULL,
        friendly_name VARCHAR(100),
        category_name VARCHAR(50) DEFAULT 'Other',
        daily_limit_minutes INT DEFAULT 60,
        is_blocked BOOLEAN DEFAULT FALSE,
        warning_minutes INT DEFAULT 5
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
        id BIGSERIAL PRIMARY KEY,
        device_id INT REFERENCES devices(id),
        process_name VARCHAR(100) NOT NULL,
        window_title TEXT,
        category_name VARCHAR(50) DEFAULT 'Other',
        duration_seconds INT DEFAULT 3,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(50) PRIMARY KEY,
        value VARCHAR(255) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_alerts (
        id SERIAL PRIMARY KEY,
        device_id INT REFERENCES devices(id),
        process_name VARCHAR(100),
        alert_type VARCHAR(50),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS screenshots (
        id BIGSERIAL PRIMARY KEY,
        device_id INT REFERENCES devices(id) ON DELETE CASCADE,
        process_name VARCHAR(100),
        window_title TEXT,
        category_name VARCHAR(50) DEFAULT 'Other',
        image_data TEXT NOT NULL,
        thumbnail_data TEXT,
        captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS keystroke_logs (
        id BIGSERIAL PRIMARY KEY,
        device_id INT REFERENCES devices(id) ON DELETE CASCADE,
        process_name VARCHAR(100),
        window_title TEXT,
        category_name VARCHAR(50) DEFAULT 'Other',
        content TEXT NOT NULL,
        log_type VARCHAR(30) DEFAULT 'keystroke',
        character_count INT DEFAULT 0,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_activity_device_time ON activity_logs (device_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_activity_process ON activity_logs (process_name);
    CREATE INDEX IF NOT EXISTS idx_alerts_device_time ON system_alerts (device_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_screenshots_device_time ON screenshots (device_id, captured_at DESC);
    CREATE INDEX IF NOT EXISTS idx_keystrokes_device_time ON keystroke_logs (device_id, recorded_at DESC);
    """)

    # Seed categories
    categories = [
        ("Gaming", "PC Games & Online Games", True),
        ("Education/Study", "Educational apps, reading, homework, code", False),
        ("Browsing/Video", "Web browsers & video platforms", False),
        ("Social Media", "Social chats & platforms", True),
        ("System/Utility", "Windows internal tools", False),
        ("Other", "General applications", False)
    ]
    for name, desc, restr in categories:
        cur.execute("""
            INSERT INTO app_categories (name, description, is_restricted_by_default)
            VALUES (%s, %s, %s)
            ON CONFLICT (name) DO NOTHING;
        """, (name, desc, restr))

    # Seed default rules
    default_rules = [
        # Games (Default 60 mins limit)
        ("robloxplayerbeta.exe", "Roblox", "Gaming", 60, False),
        ("robloxplayerlauncher.exe", "Roblox Launcher", "Gaming", 60, False),
        ("roblox.exe", "Roblox (Windows App)", "Gaming", 60, False),
        ("robloxcrashhandler.exe", "Roblox Crash Handler", "Gaming", 60, False),
        ("valorant.exe", "Valorant", "Gaming", 60, False),
        ("minecraft.exe", "Minecraft", "Gaming", 60, False),
        ("javaw.exe", "Minecraft (Java)", "Gaming", 60, False),
        ("gta5.exe", "GTA V", "Gaming", 45, False),
        ("fortniteclient-win64-shipping.exe", "Fortnite", "Gaming", 60, False),
        ("genshinimpact.exe", "Genshin Impact", "Gaming", 60, False),
        ("steam.exe", "Steam Client", "Gaming", 60, False),
        
        # Browsers
        ("chrome.exe", "Google Chrome", "Browsing/Video", 0, False),
        ("msedge.exe", "Microsoft Edge", "Browsing/Video", 0, False),
        ("firefox.exe", "Mozilla Firefox", "Browsing/Video", 0, False),

        # Study (Always allowed)
        ("code.exe", "VS Code (Programming)", "Education/Study", 0, False),
        ("winword.exe", "Microsoft Word", "Education/Study", 0, False),
        ("excel.exe", "Microsoft Excel", "Education/Study", 0, False),
        ("acrobat.exe", "Adobe Acrobat PDF", "Education/Study", 0, False),
        ("zoom.exe", "Zoom Online Class", "Education/Study", 0, False),
        ("notepad.exe", "Notepad (Notes)", "Education/Study", 0, False),

        # Social
        ("discord.exe", "Discord", "Social Media", 45, False),
        ("telegram.exe", "Telegram", "Social Media", 30, False)
    ]
    for proc, friendly, cat, limit, blocked in default_rules:
        cur.execute("""
            INSERT INTO app_rules (process_name, friendly_name, category_name, daily_limit_minutes, is_blocked)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (process_name) DO NOTHING;
        """, (proc, friendly, cat, limit, blocked))

    # Seed Device
    cur.execute("""
        INSERT INTO devices (device_name, assigned_child, os_name)
        VALUES (%s, %s, 'Windows')
        ON CONFLICT (device_name) DO NOTHING;
    """, (config.DEVICE_NAME, config.ASSIGNED_CHILD))

    # Seed Settings
    settings = {
        "study_mode_active": "false",
        "parent_pin": config.PARENT_PIN,
        "emergency_lock": "false",
        "study_start_hour": str(config.STUDY_START_HOUR),
        "study_end_hour": str(config.STUDY_END_HOUR),
        "daily_total_limit_minutes": "240"
    }
    for k, v in settings.items():
        cur.execute("""
            INSERT INTO system_settings (key, value)
            VALUES (%s, %s)
            ON CONFLICT (key) DO NOTHING;
        """, (k, v))

    cur.close()
    conn.close()
    print("[OK] PostgreSQL Database initialized and seeded successfully.")

# Helper queries
def get_device_id(device_name=config.DEVICE_NAME):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM devices WHERE device_name = %s", (device_name,))
            row = cur.fetchone()
            if row:
                return row[0]
            cur.execute("INSERT INTO devices (device_name, assigned_child) VALUES (%s, %s) RETURNING id",
                        (device_name, config.ASSIGNED_CHILD))
            conn.commit()
            return cur.fetchone()[0]

def update_device_heartbeat(device_id):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE id = %s", (device_id,))
            conn.commit()

def get_all_rules():
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM app_rules ORDER BY category_name, friendly_name")
            return cur.fetchall()

def get_rule_map():
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT process_name, friendly_name, category_name, daily_limit_minutes, is_blocked, warning_minutes FROM app_rules")
            rows = cur.fetchall()
            return {r["process_name"].lower(): r for r in rows}

def save_activity_batch(device_id, batch):
    """batch is a list of tuples: (process_name, window_title, category_name, duration_seconds)"""
    if not batch:
        return
    with get_db() as conn:
        with conn.cursor() as cur:
            for item in batch:
                cur.execute("""
                    INSERT INTO activity_logs (device_id, process_name, window_title, category_name, duration_seconds)
                    VALUES (%s, %s, %s, %s, %s)
                """, (device_id, item[0], item[1], item[2], item[3]))
            conn.commit()

def get_today_usage_by_app(device_id):
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    a.process_name,
                    COALESCE(r.friendly_name, a.process_name) as app_name,
                    COALESCE(r.category_name, a.category_name) as category_name,
                    COALESCE(r.daily_limit_minutes, 0) as daily_limit_minutes,
                    COALESCE(r.is_blocked, FALSE) as is_blocked,
                    SUM(a.duration_seconds) as total_seconds
                FROM activity_logs a
                LEFT JOIN app_rules r ON LOWER(a.process_name) = LOWER(r.process_name)
                WHERE a.device_id = %s AND a.recorded_at >= CURRENT_DATE
                GROUP BY a.process_name, r.friendly_name, r.category_name, r.daily_limit_minutes, r.is_blocked, a.category_name
                ORDER BY total_seconds DESC
            """, (device_id,))
            return cur.fetchall()

def get_today_summary(device_id):
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    COALESCE(SUM(duration_seconds), 0) as total_seconds,
                    COALESCE(SUM(CASE WHEN category_name = 'Gaming' THEN duration_seconds ELSE 0 END), 0) as gaming_seconds,
                    COALESCE(SUM(CASE WHEN category_name = 'Education/Study' THEN duration_seconds ELSE 0 END), 0) as study_seconds,
                    COALESCE(SUM(CASE WHEN category_name = 'Browsing/Video' THEN duration_seconds ELSE 0 END), 0) as browsing_seconds,
                    COALESCE(SUM(CASE WHEN category_name NOT IN ('Gaming', 'Education/Study', 'Browsing/Video') THEN duration_seconds ELSE 0 END), 0) as other_seconds
                FROM activity_logs
                WHERE device_id = %s AND recorded_at >= CURRENT_DATE
            """, (device_id,))
            return cur.fetchone()

def get_setting(key, default="false"):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM system_settings WHERE key = %s", (key,))
            row = cur.fetchone()
            return row[0] if row else default

def set_setting(key, value):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO system_settings (key, value)
                VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            """, (key, str(value)))
            conn.commit()

def upsert_rule(process_name, friendly_name, category_name, limit_minutes, is_blocked):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO app_rules (process_name, friendly_name, category_name, daily_limit_minutes, is_blocked)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (process_name) DO UPDATE SET
                    friendly_name = EXCLUDED.friendly_name,
                    category_name = EXCLUDED.category_name,
                    daily_limit_minutes = EXCLUDED.daily_limit_minutes,
                    is_blocked = EXCLUDED.is_blocked
            """, (process_name.lower().strip(), friendly_name, category_name, limit_minutes, is_blocked))
            conn.commit()

def delete_rule(process_name):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM app_rules WHERE LOWER(process_name) = LOWER(%s)", (process_name.strip(),))
            conn.commit()

def log_alert(device_id, process_name, alert_type, message):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO system_alerts (device_id, process_name, alert_type, message)
                    VALUES (%s, %s, %s, %s)
                """, (device_id, process_name, alert_type, message))
                conn.commit()
    except Exception as e:
        print(f"[DB log_alert error] {e}")

def get_recent_alerts(device_id, limit=20):
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, process_name, alert_type, message, 
                       to_char(created_at, 'HH12:MI AM') as time_str,
                       to_char(created_at, 'YYYY-MM-DD') as date_str
                FROM system_alerts
                WHERE device_id = %s
                ORDER BY created_at DESC
                LIMIT %s
            """, (device_id, limit))
            return cur.fetchall()

def get_recent_activity_logs(device_id, limit=30):
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    a.id, 
                    a.process_name, 
                    COALESCE(r.friendly_name, a.process_name) as app_name,
                    a.window_title, 
                    a.category_name, 
                    a.duration_seconds,
                    to_char(a.recorded_at, 'HH12:MI:SS AM') as time_str
                FROM activity_logs a
                LEFT JOIN app_rules r ON LOWER(a.process_name) = LOWER(r.process_name)
                WHERE a.device_id = %s
                ORDER BY a.recorded_at DESC
                LIMIT %s
            """, (device_id, limit))
            return cur.fetchall()

def get_weekly_trend(device_id):
    """Returns past 7 days usage data aggregated per day."""
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    to_char(recorded_at, 'YYYY-MM-DD') as log_date,
                    to_char(recorded_at, 'Dy') as day_name,
                    COALESCE(SUM(duration_seconds), 0) as total_seconds,
                    COALESCE(SUM(CASE WHEN category_name = 'Gaming' THEN duration_seconds ELSE 0 END), 0) as gaming_seconds,
                    COALESCE(SUM(CASE WHEN category_name = 'Education/Study' THEN duration_seconds ELSE 0 END), 0) as study_seconds,
                    COALESCE(SUM(CASE WHEN category_name = 'Browsing/Video' THEN duration_seconds ELSE 0 END), 0) as browsing_seconds,
                    COALESCE(SUM(CASE WHEN category_name NOT IN ('Gaming', 'Education/Study', 'Browsing/Video') THEN duration_seconds ELSE 0 END), 0) as other_seconds
                FROM activity_logs
                WHERE device_id = %s AND recorded_at >= (CURRENT_DATE - INTERVAL '6 days')
                GROUP BY to_char(recorded_at, 'YYYY-MM-DD'), to_char(recorded_at, 'Dy'), DATE(recorded_at)
                ORDER BY DATE(recorded_at) ASC
            """, (device_id,))
            return cur.fetchall()

def get_live_device_status(device_id):
    """Returns device online status, current window title, current app, and last seen."""
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT device_name, assigned_child, last_seen FROM devices WHERE id = %s", (device_id,))
            dev = cur.fetchone()
            if not dev:
                return {"online": False, "app": "None", "title": "", "last_seen_str": "Never"}

            # Get latest activity
            cur.execute("""
                SELECT a.process_name, COALESCE(r.friendly_name, a.process_name) as app_name, 
                       a.window_title, a.category_name, a.recorded_at
                FROM activity_logs a
                LEFT JOIN app_rules r ON LOWER(a.process_name) = LOWER(r.process_name)
                WHERE a.device_id = %s
                ORDER BY a.recorded_at DESC
                LIMIT 1
            """, (device_id,))
            latest_act = cur.fetchone()

            now = datetime.now()
            last_seen = dev["last_seen"]
            is_online = False
            if last_seen:
                diff_seconds = (now - last_seen).total_seconds()
                is_online = diff_seconds < 60  # Heartbeat within 60s means online

            return {
                "online": is_online,
                "device_name": dev["device_name"],
                "assigned_child": dev["assigned_child"],
                "last_seen_str": last_seen.strftime("%I:%M %p") if last_seen else "Never",
                "current_app": latest_act["app_name"] if latest_act else "None",
                "current_process": latest_act["process_name"] if latest_act else "idle",
                "current_title": (latest_act["window_title"][:80] + "...") if latest_act and len(latest_act["window_title"]) > 80 else (latest_act["window_title"] if latest_act else ""),
                "current_category": latest_act["category_name"] if latest_act else "Other",
                "last_activity_time": latest_act["recorded_at"].strftime("%I:%M:%S %p") if latest_act and latest_act["recorded_at"] else ""
            }

def get_all_settings():
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT key, value FROM system_settings")
            rows = cur.fetchall()
            return {r["key"]: r["value"] for r in rows}

# --- Screenshot Operations ---

def save_screenshot(device_id, process_name, window_title, category_name, image_data, thumbnail_data, max_stored=50):
    """Saves a screenshot and prunes older ones for the device."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO screenshots (device_id, process_name, window_title, category_name, image_data, thumbnail_data)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id;
            """, (device_id, process_name, window_title, category_name, image_data, thumbnail_data))
            new_id = cur.fetchone()[0]

            # Prune older screenshots beyond max_stored to keep database compact
            cur.execute("""
                DELETE FROM screenshots
                WHERE device_id = %s
                  AND id NOT IN (
                      SELECT id FROM screenshots
                      WHERE device_id = %s
                      ORDER BY captured_at DESC
                      LIMIT %s
                  );
            """, (device_id, device_id, max_stored))
            conn.commit()
            return new_id

def get_recent_screenshots(device_id, limit=20):
    """Fetches list of recent screenshots with thumbnails and metadata."""
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, device_id, process_name, window_title, category_name, thumbnail_data, captured_at
                FROM screenshots
                WHERE device_id = %s
                ORDER BY captured_at DESC
                LIMIT %s;
            """, (device_id, limit))
            rows = cur.fetchall()
            results = []
            for r in rows:
                ts = r["captured_at"]
                results.append({
                    "id": r["id"],
                    "device_id": r["device_id"],
                    "process_name": r["process_name"] or "unknown",
                    "window_title": r["window_title"] or "",
                    "category_name": r["category_name"] or "Other",
                    "thumbnail_data": r["thumbnail_data"] or "",
                    "captured_at": ts.isoformat() if ts else "",
                    "time_str": ts.strftime("%I:%M %p") if ts else ""
                })
            return results

def get_screenshot_by_id(screenshot_id):
    """Fetches a specific full screenshot by ID."""
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, device_id, process_name, window_title, category_name, image_data, thumbnail_data, captured_at
                FROM screenshots
                WHERE id = %s;
            """, (screenshot_id,))
            row = cur.fetchone()
            if not row:
                return None
            ts = row["captured_at"]
            return {
                "id": row["id"],
                "device_id": row["device_id"],
                "process_name": row["process_name"] or "unknown",
                "window_title": row["window_title"] or "",
                "category_name": row["category_name"] or "Other",
                "image_data": row["image_data"],
                "thumbnail_data": row["thumbnail_data"],
                "captured_at": ts.isoformat() if ts else "",
                "time_str": ts.strftime("%I:%M %p") if ts else ""
            }

def get_latest_screenshot(device_id):
    """Fetches the latest full screenshot for a device."""
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, device_id, process_name, window_title, category_name, image_data, thumbnail_data, captured_at
                FROM screenshots
                WHERE device_id = %s
                ORDER BY captured_at DESC
                LIMIT 1;
            """, (device_id,))
            row = cur.fetchone()
            if not row:
                return None
            ts = row["captured_at"]
            return {
                "id": row["id"],
                "device_id": row["device_id"],
                "process_name": row["process_name"] or "unknown",
                "window_title": row["window_title"] or "",
                "category_name": row["category_name"] or "Other",
                "image_data": row["image_data"],
                "thumbnail_data": row["thumbnail_data"],
                "captured_at": ts.isoformat() if ts else "",
                "time_str": ts.strftime("%I:%M %p") if ts else ""
            }

def request_on_demand_screenshot():
    """Sets a request flag for the background tracker to take a screenshot immediately."""
    set_setting("pending_screenshot_request", "true")

def check_and_clear_screenshot_request():
    """Checks if on-demand screenshot was requested and resets the flag."""
    req = get_setting("pending_screenshot_request", "false").lower() == "true"
    if req:
        set_setting("pending_screenshot_request", "false")
        return True
    return False

def save_keystroke_log(device_id, process_name, window_title, category_name, content, log_type="keystroke", recorded_at=None):
    """Saves a single typed text or clipboard entry into PostgreSQL with auto-pruning."""
    if not content or not content.strip():
        return None
    char_count = len(content)
    with get_db() as conn:
        with conn.cursor() as cur:
            if recorded_at:
                cur.execute("""
                    INSERT INTO keystroke_logs (device_id, process_name, window_title, category_name, content, log_type, character_count, recorded_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id;
                """, (device_id, process_name, window_title, category_name, content, log_type, char_count, recorded_at))
            else:
                cur.execute("""
                    INSERT INTO keystroke_logs (device_id, process_name, window_title, category_name, content, log_type, character_count)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id;
                """, (device_id, process_name, window_title, category_name, content, log_type, char_count))
            row = cur.fetchone()
            log_id = row[0] if row else None

            # Bounded auto-pruning to keep DB light
            cur.execute("""
                DELETE FROM keystroke_logs
                WHERE id IN (
                    SELECT id FROM keystroke_logs
                    WHERE device_id = %s
                    ORDER BY recorded_at DESC
                    OFFSET %s
                );
            """, (device_id, config.KEYSTROKE_MAX_STORED))
            conn.commit()
            return log_id

def save_keystroke_batch(device_id, batch):
    """Saves a batch of keystroke/clipboard entries [(process_name, window_title, category_name, content, log_type, recorded_at), ...]"""
    if not batch:
        return 0
    valid_batch = [item for item in batch if item[3] and item[3].strip()]
    if not valid_batch:
        return 0
    with get_db() as conn:
        with conn.cursor() as cur:
            for item in valid_batch:
                pname = item[0]
                title = item[1]
                cat = item[2] if len(item) > 2 else "Other"
                content = item[3]
                ltype = item[4] if len(item) > 4 else "keystroke"
                rec_at = item[5] if len(item) > 5 else None
                char_count = len(content)
                if rec_at:
                    cur.execute("""
                        INSERT INTO keystroke_logs (device_id, process_name, window_title, category_name, content, log_type, character_count, recorded_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                    """, (device_id, pname, title, cat, content, ltype, char_count, rec_at))
                else:
                    cur.execute("""
                        INSERT INTO keystroke_logs (device_id, process_name, window_title, category_name, content, log_type, character_count)
                        VALUES (%s, %s, %s, %s, %s, %s, %s);
                    """, (device_id, pname, title, cat, content, ltype, char_count))

            # Bounded auto-pruning
            cur.execute("""
                DELETE FROM keystroke_logs
                WHERE id IN (
                    SELECT id FROM keystroke_logs
                    WHERE device_id = %s
                    ORDER BY recorded_at DESC
                    OFFSET %s
                );
            """, (device_id, config.KEYSTROKE_MAX_STORED))
            conn.commit()
            return len(valid_batch)

def get_recent_keystroke_logs(device_id, limit=50, search_query=None, log_type=None):
    """Retrieves recent keystroke/clipboard logs with search and filter capabilities."""
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT id, device_id, process_name, window_title, category_name, content, log_type, character_count, recorded_at
                FROM keystroke_logs
                WHERE device_id = %s
            """
            params = [device_id]
            if log_type:
                query += " AND log_type = %s"
                params.append(log_type)
            if search_query and search_query.strip():
                query += " AND (content ILIKE %s OR window_title ILIKE %s OR process_name ILIKE %s)"
                term = f"%{search_query.strip()}%"
                params.extend([term, term, term])
            query += " ORDER BY recorded_at DESC LIMIT %s;"
            params.append(limit)

            cur.execute(query, tuple(params))
            rows = cur.fetchall()
            results = []
            for r in rows:
                ts = r["recorded_at"]
                results.append({
                    "id": r["id"],
                    "device_id": r["device_id"],
                    "process_name": r["process_name"] or "unknown",
                    "window_title": r["window_title"] or "",
                    "category_name": r["category_name"] or "Other",
                    "content": r["content"],
                    "log_type": r["log_type"] or "keystroke",
                    "character_count": r["character_count"],
                    "recorded_at": ts.isoformat() if ts else "",
                    "time_str": ts.strftime("%I:%M %p") if ts else "",
                    "date_str": ts.strftime("%Y-%m-%d") if ts else ""
                })
            return results

if __name__ == "__main__":
    init_db()


