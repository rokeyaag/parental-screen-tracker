import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import time
import signal
import threading
import config
import database
from tracker.window_monitor import get_active_window_info
from tracker.enforcer import Enforcer
from tracker import offline_manager
from tracker import screenshot_manager
from tracker.keystroke_manager import KeystrokeManager

def infer_category(process_name, title, default_category="Other"):
    title_lower = title.lower()
    pname_lower = process_name.lower()
    if any(k in pname_lower for k in ["roblox", "minecraft", "valorant", "fortnite", "genshin", "gta5", "steam"]):
        return "Gaming"
    if any(k in pname_lower for k in ["discord", "telegram", "whatsapp", "tiktok"]):
        return "Social Media"
    if pname_lower in ("chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe"):
        if any(k in title_lower for k in ["roblox", "poki", "crazygames", "krunker", "miniclip", "chess.com", "lichess", "free fire"]):
            return "Gaming"
        if any(k in title_lower for k in ["facebook", "instagram", "tiktok", "twitter", "reddit", "whatsapp", "discord"]):
            return "Social Media"
        if any(k in title_lower for k in ["classroom", "khan academy", "wikipedia", "coursera", "udemy", "github", "stack overflow", "10 minute school", "w3schools"]):
            return "Education/Study"
        if any(k in title_lower for k in ["youtube", "netflix", "twitch", "prime video"]):
            return "Browsing/Video"
    return default_category

class TrackerClient:
    def __init__(self):
        self.running = False
        self.device_id = self._init_device_id()
        self.enforcer = Enforcer(self.device_id)
        self.log_batch = []
        self.last_save_time = time.time()
        self.last_heartbeat_time = 0
        self.last_sync_time = 0
        self.last_screenshot_time = 0
        self.last_screenshot_app = None
        self.keystroke_mgr = KeystrokeManager(self.device_id)


    def _init_device_id(self):
        """Fetches device ID from local SQLite cache if paired, or Postgres if online."""
        try:
            # 1. Prioritize paired device in local SQLite meta cache
            conn = offline_manager.get_sqlite_conn()
            cur = conn.cursor()
            cur.execute("SELECT key, value FROM local_meta WHERE key IN ('device_id', 'device_name');")
            rows = {r["key"]: r["value"] for r in cur.fetchall()}
            conn.close()

            if "device_id" in rows:
                dev_id = int(rows["device_id"])
                if "device_name" in rows and rows["device_name"]:
                    config.DEVICE_NAME = rows["device_name"]
                return dev_id
        except Exception:
            pass

        # 2. Fallback to Postgres by DEVICE_NAME
        try:
            if offline_manager.is_postgres_available():
                dev_id = database.get_device_id(config.DEVICE_NAME)
                # Cache locally in SQLite
                conn = offline_manager.get_sqlite_conn()
                with conn:
                    conn.execute("INSERT OR REPLACE INTO local_meta (key, value) VALUES ('device_id', ?);", (str(dev_id),))
                conn.close()
                return dev_id
        except Exception:
            pass

        return 1

    def start(self):
        self.running = True
        print(f"[Tracker Started] Device: {config.DEVICE_NAME} (ID: {self.device_id})")
        print(f"[Tracker Config] Check interval: {config.CHECK_INTERVAL_SECONDS}s, Batch save: {config.BATCH_SAVE_INTERVAL_SECONDS}s")
        print("[Tracker Status] Offline-ready: Activity logs buffered to local SQLite if network is offline.")

        self.enforcer.refresh_rules_and_usage(force=True)
        self.keystroke_mgr.start()

        while self.running:
            try:
                now = time.time()
                
                # 1. Heartbeat & periodic sync of offline queue
                if now - self.last_heartbeat_time > 15:
                    try:
                        if offline_manager.is_postgres_available():
                            database.update_device_heartbeat(self.device_id)
                            if self.device_id != 1:
                                database.update_device_heartbeat(1)
                            offline_manager.drain_offline_queue_to_postgres()
                    except Exception:
                        pass
                    self.last_heartbeat_time = now

                # 2. Enforce restrictions across all running processes (background & foreground)
                try:
                    self.enforcer.enforce_all_running_processes()
                except Exception as e:
                    print(f"[Enforcer Background Error] {e}")

                # 3. Get active window for screen time tracking and foreground enforcement
                info = get_active_window_info()
                pname = info["process_name"]
                title = info["window_title"]
                is_idle = info["is_idle"]
                cat_name = "Other"
                if not is_idle and pname not in ("unknown", "idle"):
                    # Check and enforce rules
                    allowed, reason = self.enforcer.check_and_enforce(info)
                    
                    # Determine category with smart web inspection
                    rule = self.enforcer.rules.get(pname)
                    base_cat = rule["category_name"] if rule else "Other"
                    cat_name = infer_category(pname, title, base_cat)

                    if allowed:
                        # Append to batch
                        self.log_batch.append((
                            pname,
                            title[:250],
                            cat_name,
                            config.CHECK_INTERVAL_SECONDS
                        ))
                        self.enforcer.add_runtime_seconds(pname, config.CHECK_INTERVAL_SECONDS)
                    else:
                        print(f"[Enforcer Blocked] {pname}: {reason}")

                # 4. Periodic or On-Demand Screenshot Capture
                try:
                    if config.SCREENSHOT_ENABLED:
                        on_demand = False
                        if offline_manager.is_postgres_available():
                            on_demand = (
                                database.check_and_clear_screenshot_request(self.device_id)
                                or (self.device_id != 1 and database.check_and_clear_screenshot_request(1))
                            )

                        time_due = (not is_idle) and ((now - self.last_screenshot_time) >= config.SCREENSHOT_INTERVAL_SECONDS)
                        app_changed = (not is_idle) and (self.last_screenshot_app != pname) and ((now - self.last_screenshot_time) >= 10)
                        idle_periodic = is_idle and ((now - self.last_screenshot_time) >= 60)

                        if on_demand or time_due or app_changed or idle_periodic:
                            self.last_screenshot_time = now
                            self.last_screenshot_app = pname
                            disp_pname = pname if pname not in ("unknown", "idle") else "Windows Desktop"
                            disp_title = title if title else ("Idle / Away" if is_idle else "Desktop")
                            disp_cat = cat_name if not is_idle else "Idle"
                            threading.Thread(
                                target=screenshot_manager.capture_and_store,
                                args=(self.device_id, disp_pname, disp_title, disp_cat),
                                daemon=True
                            ).start()
                except Exception as e:
                    print(f"[Screenshot Trigger Error] {e}")

                # 5. Batch commit to PostgreSQL (or SQLite offline queue if offline)
                if now - self.last_save_time >= config.BATCH_SAVE_INTERVAL_SECONDS:
                    self._flush_batch()

                time.sleep(config.CHECK_INTERVAL_SECONDS)


            except KeyboardInterrupt:
                print("\n[Tracker] Stopping...")
                self.stop()
                break
            except Exception as e:
                print(f"[Tracker Loop Error] {e}")
                time.sleep(config.CHECK_INTERVAL_SECONDS)

    def _flush_batch(self):
        if self.log_batch:
            count = len(self.log_batch)
            try:
                if offline_manager.is_postgres_available():
                    database.save_activity_batch(self.device_id, self.log_batch)
                    self.log_batch.clear()
                    self.last_save_time = time.time()
                    # Drain any older offline queued records
                    offline_manager.drain_offline_queue_to_postgres()
                else:
                    # Offline mode: save into local SQLite queue
                    offline_manager.queue_offline_activity_batch(self.device_id, self.log_batch)
                    self.log_batch.clear()
                    self.last_save_time = time.time()
                    print(f"[Tracker Offline] Buffered {count} records locally to SQLite.")
            except Exception as e:
                print(f"[Tracker Flush Fallback] Switching to local SQLite buffer: {e}")
                offline_manager.queue_offline_activity_batch(self.device_id, self.log_batch)
                self.log_batch.clear()
                self.last_save_time = time.time()

    def stop(self):
        self.running = False
        try:
            self.keystroke_mgr.stop()
        except Exception:
            pass
        self._flush_batch()
        print("[Tracker Stopped] Cleaned up and exited.")

if __name__ == "__main__":
    client = TrackerClient()
    client.start()
