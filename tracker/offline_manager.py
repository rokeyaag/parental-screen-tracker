import os
import sqlite3
import time
from datetime import datetime, date
from pathlib import Path
import config

def get_offline_db_path():
    appdata = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or str(Path.home())
    data_dir = Path(appdata) / "ParentalScreenTracker"
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        data_dir = Path.home() / ".parental_screen_tracker"
        data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "local_offline_cache.db"

DB_PATH = get_offline_db_path()

def get_sqlite_conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    conn.row_factory = sqlite3.Row
    return conn

def init_offline_storage():
    """Initializes local SQLite database for offline buffering and rule caching."""
    try:
        conn = get_sqlite_conn()
        with conn:
            conn.executescript("""
        CREATE TABLE IF NOT EXISTS offline_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id INTEGER NOT NULL,
            process_name TEXT NOT NULL,
            window_title TEXT,
            category_name TEXT DEFAULT 'Other',
            duration_seconds INTEGER DEFAULT 5,
            recorded_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS offline_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id INTEGER NOT NULL,
            process_name TEXT,
            alert_type TEXT,
            message TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cached_rules (
            process_name TEXT PRIMARY KEY,
            friendly_name TEXT,
            category_name TEXT DEFAULT 'Other',
            daily_limit_minutes INTEGER DEFAULT 60,
            is_blocked INTEGER DEFAULT 0,
            warning_minutes INTEGER DEFAULT 5
        );

        CREATE TABLE IF NOT EXISTS cached_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cached_daily_usage (
            process_name TEXT PRIMARY KEY,
            total_seconds INTEGER DEFAULT 0,
            usage_date TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS local_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        """)
        conn.close()
    except Exception as e:
        print(f"[Offline Storage Init Error] {e}")

# Initialize immediately
init_offline_storage()

def is_postgres_available():
    """Checks if PostgreSQL is currently reachable."""
    try:
        import database
        with database.get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
                return True
    except Exception:
        return False

def sync_rules_and_settings_from_postgres():
    """Downloads current rules and settings from PostgreSQL to local SQLite cache."""
    try:
        import database
        rules = database.get_all_rules()
        settings = database.get_all_settings()

        conn = get_sqlite_conn()
        with conn:
            # 1. Update rules cache
            for r in rules:
                conn.execute("""
                INSERT INTO cached_rules (process_name, friendly_name, category_name, daily_limit_minutes, is_blocked, warning_minutes)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(process_name) DO UPDATE SET
                    friendly_name=excluded.friendly_name,
                    category_name=excluded.category_name,
                    daily_limit_minutes=excluded.daily_limit_minutes,
                    is_blocked=excluded.is_blocked,
                    warning_minutes=excluded.warning_minutes;
                """, (
                    r["process_name"].lower(),
                    r["friendly_name"],
                    r["category_name"],
                    r["daily_limit_minutes"],
                    1 if r["is_blocked"] else 0,
                    r.get("warning_minutes", 5)
                ))

            # 2. Update settings cache
            for k, v in settings.items():
                conn.execute("""
                INSERT INTO cached_settings (key, value)
                VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value;
                """, (k, str(v)))

        conn.close()
        return True
    except Exception as e:
        return False

def sync_daily_usage_from_postgres(device_id):
    """Syncs today's PostgreSQL usage totals into local SQLite cache."""
    try:
        import database
        usage_list = database.get_today_usage_by_app(device_id)
        today_str = date.today().isoformat()

        conn = get_sqlite_conn()
        with conn:
            # Clean up old dates
            conn.execute("DELETE FROM cached_daily_usage WHERE usage_date != ?", (today_str,))
            for u in usage_list:
                conn.execute("""
                INSERT INTO cached_daily_usage (process_name, total_seconds, usage_date)
                VALUES (?, ?, ?)
                ON CONFLICT(process_name) DO UPDATE SET
                    total_seconds=excluded.total_seconds,
                    usage_date=excluded.usage_date;
                """, (u["process_name"].lower(), u["total_seconds"], today_str))
        conn.close()
        return True
    except Exception:
        return False

def get_cached_rule_map():
    """Returns rule dictionary { process_name: rule_dict } from local SQLite."""
    conn = get_sqlite_conn()
    cur = conn.cursor()
    cur.execute("SELECT process_name, friendly_name, category_name, daily_limit_minutes, is_blocked, warning_minutes FROM cached_rules;")
    rows = cur.fetchall()
    conn.close()
    
    rule_map = {}
    for r in rows:
        rule_map[r["process_name"].lower()] = {
            "process_name": r["process_name"],
            "friendly_name": r["friendly_name"],
            "category_name": r["category_name"],
            "daily_limit_minutes": r["daily_limit_minutes"],
            "is_blocked": bool(r["is_blocked"]),
            "warning_minutes": r["warning_minutes"]
        }
    return rule_map

def get_cached_setting(key, default=""):
    """Reads setting from local SQLite cache."""
    conn = get_sqlite_conn()
    cur = conn.cursor()
    cur.execute("SELECT value FROM cached_settings WHERE key = ?;", (key,))
    row = cur.fetchone()
    conn.close()
    if row:
        return row["value"]
    return default

def get_cached_usage_map():
    """Returns usage dictionary { process_name: total_seconds } for today."""
    today_str = date.today().isoformat()
    conn = get_sqlite_conn()
    cur = conn.cursor()
    cur.execute("SELECT process_name, total_seconds FROM cached_daily_usage WHERE usage_date = ?;", (today_str,))
    rows = cur.fetchall()
    conn.close()
    return {r["process_name"].lower(): r["total_seconds"] for r in rows}

def increment_local_usage(process_name, seconds):
    """Increments runtime seconds locally so offline enforcement triggers limits."""
    today_str = date.today().isoformat()
    pname = process_name.lower()
    conn = get_sqlite_conn()
    with conn:
        conn.execute("""
        INSERT INTO cached_daily_usage (process_name, total_seconds, usage_date)
        VALUES (?, ?, ?)
        ON CONFLICT(process_name) DO UPDATE SET
            total_seconds = total_seconds + excluded.total_seconds,
            usage_date = excluded.usage_date;
        """, (pname, seconds, today_str))
    conn.close()

def queue_offline_activity_batch(device_id, log_batch):
    """Queues activity logs into SQLite when PostgreSQL is offline or failing."""
    if not log_batch:
        return
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_sqlite_conn()
    with conn:
        for item in log_batch:
            # item: (process_name, title, category, duration)
            pname, title, cat, dur = item
            conn.execute("""
            INSERT INTO offline_logs (device_id, process_name, window_title, category_name, duration_seconds, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?);
            """, (device_id, pname, title, cat, dur, now_str))
    conn.close()

def queue_offline_alert(device_id, process_name, alert_type, message):
    """Queues an alert message locally in SQLite."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_sqlite_conn()
    with conn:
        conn.execute("""
        INSERT INTO offline_alerts (device_id, process_name, alert_type, message, created_at)
        VALUES (?, ?, ?, ?, ?);
        """, (device_id, process_name, alert_type, message, now_str))
    conn.close()

def drain_offline_queue_to_postgres():
    """Flushes all queued offline logs and alerts into PostgreSQL."""
    conn = get_sqlite_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, device_id, process_name, window_title, category_name, duration_seconds, recorded_at FROM offline_logs ORDER BY id ASC LIMIT 500;")
    rows = cur.fetchall()

    if rows:
        try:
            import database
            with database.get_db() as pg_conn:
                with pg_conn.cursor() as pg_cur:
                    for r in rows:
                        pg_cur.execute("""
                        INSERT INTO activity_logs (device_id, process_name, window_title, category_name, duration_seconds, recorded_at)
                        VALUES (%s, %s, %s, %s, %s, %s);
                        """, (r["device_id"], r["process_name"], r["window_title"], r["category_name"], r["duration_seconds"], r["recorded_at"]))
                pg_conn.commit()

            # Delete drained rows from SQLite
            ids = [r["id"] for r in rows]
            with conn:
                conn.execute(f"DELETE FROM offline_logs WHERE id IN ({','.join(['?']*len(ids))});", ids)
            print(f"[Offline Sync] Successfully synced {len(rows)} offline activity records to PostgreSQL!")
        except Exception as e:
            conn.close()
            # print(f"[Offline Sync Error] PostgreSQL sync failed: {e}")
            return False

    # Also drain offline alerts
    cur.execute("SELECT id, device_id, process_name, alert_type, message, created_at FROM offline_alerts ORDER BY id ASC LIMIT 100;")
    alert_rows = cur.fetchall()
    if alert_rows:
        try:
            import database
            with database.get_db() as pg_conn:
                with pg_conn.cursor() as pg_cur:
                    for a in alert_rows:
                        pg_cur.execute("""
                        INSERT INTO system_alerts (device_id, process_name, alert_type, message, created_at)
                        VALUES (%s, %s, %s, %s, %s);
                        """, (a["device_id"], a["process_name"], a["alert_type"], a["message"], a["created_at"]))
                pg_conn.commit()

            a_ids = [a["id"] for a in alert_rows]
            with conn:
                conn.execute(f"DELETE FROM offline_alerts WHERE id IN ({','.join(['?']*len(a_ids))});", a_ids)
            print(f"[Offline Sync] Successfully synced {len(alert_rows)} offline alert records to PostgreSQL!")
        except Exception:
            pass

    conn.close()
    return True
