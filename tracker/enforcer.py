import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import time
import threading
from datetime import datetime
import psutil
import database
from tracker import offline_manager

# Cache for warnings sent today: { (process_name, date_str): True }
_warned_today = {}
_last_blocked_time = {}

def show_alert_window(title, message):
    """Displays a modal alert box on the active interactive desktop."""
    def _run():
        try:
            import ctypes
            user32 = ctypes.windll.user32
            try:
                h_desk = user32.OpenDesktopW("Default", 0, False, 0x01FF)
                if h_desk:
                    user32.SetThreadDesktop(h_desk)
            except Exception:
                pass
            # MB_OK | MB_ICONWARNING | MB_SYSTEMMODAL | MB_TOPMOST | MB_SETFOREGROUND
            user32.MessageBoxW(0, message, title, 0x51030)
        except Exception as e:
            print(f"[Alert Error] {e}")

    t = threading.Thread(target=_run, daemon=True)
    t.start()

class Enforcer:
    def __init__(self, device_id):
        self.device_id = device_id
        self.rules = {}
        self.today_usage_cache = {}  # { process_name: total_seconds }
        self.last_cache_update = 0

    def refresh_rules_and_usage(self, force=False):
        now = time.time()
        # Refresh from DB every 10 seconds
        if force or (now - self.last_cache_update > 10):
            try:
                # Try Postgres first and refresh local SQLite cache
                if offline_manager.is_postgres_available():
                    offline_manager.sync_rules_and_settings_from_postgres()
                    offline_manager.sync_daily_usage_from_postgres(self.device_id)
                    self.rules = database.get_rule_map()
                    usage_list = database.get_today_usage_by_app(self.device_id)
                    self.today_usage_cache = {u["process_name"].lower(): u["total_seconds"] for u in usage_list}
                else:
                    # Fallback to local SQLite cache
                    self.rules = offline_manager.get_cached_rule_map()
                    self.today_usage_cache = offline_manager.get_cached_usage_map()
                self.last_cache_update = now
            except Exception as e:
                # In case of any network or db error, load local cached rules
                self.rules = offline_manager.get_cached_rule_map()
                self.today_usage_cache = offline_manager.get_cached_usage_map()
                self.last_cache_update = now

    def add_runtime_seconds(self, process_name, seconds):
        pname = process_name.lower()
        self.today_usage_cache[pname] = self.today_usage_cache.get(pname, 0) + seconds
        # Keep local SQLite usage synced
        offline_manager.increment_local_usage(pname, seconds)

    def _get_setting(self, key, default="false"):
        try:
            if offline_manager.is_postgres_available():
                return database.get_setting(key, default)
            return offline_manager.get_cached_setting(key, default)
        except Exception:
            return offline_manager.get_cached_setting(key, default)

    def _log_alert(self, pname, alert_type, msg):
        try:
            if offline_manager.is_postgres_available():
                database.log_alert(self.device_id, pname, alert_type, msg)
            else:
                offline_manager.queue_offline_alert(self.device_id, pname, alert_type, msg)
        except Exception:
            offline_manager.queue_offline_alert(self.device_id, pname, alert_type, msg)

    def _lock_screen(self):
        """Immediately locks the Windows screen (Workstation)."""
        now = time.time()
        if now - getattr(self, "_last_lock_call", 0) > 5:
            self._last_lock_call = now
            try:
                import ctypes
                ctypes.windll.user32.LockWorkStation()
                print("[Enforcer Action] Windows workstation locked via LockWorkStation.")
            except Exception as e:
                print(f"[Lock Screen Error] {e}")

    def _close_process(self, pid, pname):
        if pid <= 0 and not pname:
            return
        try:
            if pid > 0:
                p = psutil.Process(pid)
                p.terminate()
        except Exception:
            pass
        try:
            if pid > 0:
                p = psutil.Process(pid)
                p.kill()
        except Exception:
            pass
        try:
            import subprocess
            if pname:
                subprocess.run(f"taskkill /F /T /IM {pname}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            elif pid > 0:
                subprocess.run(f"taskkill /F /T /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"[Enforcer Action] Force-killed restricted process {pname} (PID: {pid})")
        except Exception as e:
            print(f"[Enforcer Action Error] Could not terminate {pname}: {e}")

    def check_and_enforce(self, active_info):
        """
        Evaluates active window against limits and study mode.
        Returns: (is_allowed: bool, reason: str)
        """
        pname = active_info.get("process_name", "").lower()
        pid = active_info.get("pid", 0)

        if not pname or pname in ("unknown", "idle", "explorer.exe", "lockapp.exe"):
            return True, "System / Idle"

        self.refresh_rules_and_usage()

        # 1. Check Global Emergency Lock
        if self._get_setting("emergency_lock", "false").lower() == "true":
            self._lock_screen()
            self._close_process(pid, pname)
            now = time.time()
            if now - _last_blocked_time.get("emergency_lock", 0) > 15:
                _last_blocked_time["emergency_lock"] = now
                msg = "অভিভাবক সাময়িকভাবে ল্যাপটপের ব্যবহার বন্ধ রেখেছেন।"
                show_alert_window("প্যারেন্টাল লক (Parental Lock)", msg)
                self._log_alert(pname, "emergency_lock", msg)
            return False, "Emergency Lock"

        # 2. Check Study Mode (Manual or Scheduled)
        study_mode_manual = self._get_setting("study_mode_active", "false").lower() == "true"
        current_hour = datetime.now().hour
        study_start = int(self._get_setting("study_start_hour", "19"))
        study_end = int(self._get_setting("study_end_hour", "22"))
        is_scheduled_study_time = (study_start <= current_hour < study_end)
        is_study_active = study_mode_manual or is_scheduled_study_time

        rule = self.rules.get(pname)
        category = rule["category_name"] if rule else "Other"
        daily_limit_mins = rule["daily_limit_minutes"] if rule else 0
        is_blocked = rule["is_blocked"] if rule else False
        is_restricted_game_or_social = category in ("Gaming", "Social Media") or any(k in pname for k in ["roblox", "minecraft", "valorant", "fortnite", "genshin", "steam", "discord", "game"])

        # If app is explicitly marked blocked
        if is_blocked:
            self._close_process(pid, pname)
            now = time.time()
            if now - _last_blocked_time.get(pname, 0) > 15:
                _last_blocked_time[pname] = now
                msg = f"'{rule.get('friendly_name', pname)}' অভিভাবক ব্লক করে রেখেছেন।"
                show_alert_window("অ্যাপটি ব্লক করা (App Blocked)", msg)
                self._log_alert(pname, "app_blocked", msg)
            return False, "Rule: Explicitly Blocked"

        # If Study Mode is ON and this is a game/social app
        if is_study_active and is_restricted_game_or_social:
            self._close_process(pid, pname)
            now = time.time()
            if now - _last_blocked_time.get(pname, 0) > 15:
                _last_blocked_time[pname] = now
                msg = f"এখন পড়ার সময়! গেম ও চ্যাট অ্যাপ ({rule.get('friendly_name', pname) if rule else pname}) এখন বন্ধ থাকবে।"
                show_alert_window("পড়ার সময়! (Study Mode Active)", msg)
                self._log_alert(pname, "study_mode_block", msg)
            return False, "Study Mode Active"

        # 3. Check Daily Time Limit for this app
        if daily_limit_mins > 0:
            used_seconds = self.today_usage_cache.get(pname, 0)
            limit_seconds = daily_limit_mins * 60
            remaining_seconds = limit_seconds - used_seconds
            today_str = datetime.now().strftime("%Y-%m-%d")

            # Warning: 5 mins left
            warn_key = (pname, today_str)
            if 0 < remaining_seconds <= 300 and warn_key not in _warned_today:
                _warned_today[warn_key] = True
                remaining_mins = max(1, int(remaining_seconds / 60))
                msg = f"'{rule.get('friendly_name', pname)}' ব্যবহারের আর মাত্র {remaining_mins} মিনিট বাকি আছে।"
                show_alert_window("সময় শেষ হয়ে আসছে! (Time Warning)", msg)
                self._log_alert(pname, "limit_warning", msg)

            # Limit Exceeded
            if remaining_seconds <= 0:
                self._close_process(pid, pname)
                now = time.time()
                if now - _last_blocked_time.get(pname, 0) > 15:
                    _last_blocked_time[pname] = now
                    msg = f"আজকের জন্য '{rule.get('friendly_name', pname)}'-এর অনুমোদিত {daily_limit_mins} মিনিট শেষ হয়েছে।"
                    show_alert_window("আজকের সময় শেষ! (Daily Limit Reached)", msg)
                    self._log_alert(pname, "limit_exceeded", msg)
                return False, f"Daily limit of {daily_limit_mins} mins reached"

        return True, "Allowed"

    def enforce_all_running_processes(self):
        """Scans running processes and terminates any blocked apps, study-mode violations, or emergency locks."""
        self.refresh_rules_and_usage()

        study_mode_manual = self._get_setting("study_mode_active", "false").lower() == "true"
        current_hour = datetime.now().hour
        study_start = int(self._get_setting("study_start_hour", "19"))
        study_end = int(self._get_setting("study_end_hour", "22"))
        is_scheduled_study_time = (study_start <= current_hour < study_end)
        is_study_active = study_mode_manual or is_scheduled_study_time
        emergency_lock = self._get_setting("emergency_lock", "false").lower() == "true"

        whitelist = {
            "explorer.exe", "lockapp.exe", "searchhost.exe", "startmenuexperiencehost.exe",
            "taskmgr.exe", "python.exe", "antigravity ide.exe", "code.exe", "pycharm64.exe",
            "system", "registry", "smss.exe", "csrss.exe", "wininit.exe", "services.exe",
            "lsass.exe", "svchost.exe", "fontdrvhost.exe", "dwm.exe", "spoolsv.exe"
        }

        try:
            for proc in psutil.process_iter(['pid', 'name']):
                try:
                    pname = (proc.info['name'] or '').lower()
                    pid = proc.info['pid']
                    if not pname or pname in whitelist or pid <= 4:
                        continue

                    rule = self.rules.get(pname)
                    category = rule["category_name"] if rule else "Other"
                    is_blocked = rule["is_blocked"] if rule else False
                    daily_limit_mins = rule["daily_limit_minutes"] if rule else 0
                    is_game_or_social = (category in ("Gaming", "Social Media")) or any(k in pname for k in ["roblox", "minecraft", "valorant", "fortnite", "genshin", "steam", "discord", "game"])

                    # 1. Emergency Lock check
                    if emergency_lock:
                        self._lock_screen()
                        if category in ("Gaming", "Social Media", "Browsing/Video") or is_game_or_social or any(k in pname for k in ["discord", "steam", "telegram"]):
                            self._close_process(pid, pname)
                            now = time.time()
                            if now - _last_blocked_time.get(pname, 0) > 15:
                                _last_blocked_time[pname] = now
                                msg = "অভিভাবক সাময়িকভাবে ল্যাপটপের ব্যবহার বন্ধ রেখেছেন।"
                                show_alert_window("প্যারেন্টাল লক (Parental Lock)", msg)
                                self._log_alert(pname, "emergency_lock", msg)
                            continue

                    # 2. Blocked by rule
                    if is_blocked:
                        self._close_process(pid, pname)
                        now = time.time()
                        if now - _last_blocked_time.get(pname, 0) > 15:
                            _last_blocked_time[pname] = now
                            msg = f"'{rule.get('friendly_name', pname)}' অভিভাবক ব্লক করে রেখেছেন।"
                            show_alert_window("অ্যাপটি ব্লক করা (App Blocked)", msg)
                            self._log_alert(pname, "app_blocked", msg)
                        continue

                    # 3. Study Mode check (Gaming / Social Media)
                    if is_study_active and is_game_or_social:
                        self._close_process(pid, pname)
                        now = time.time()
                        if now - _last_blocked_time.get(pname, 0) > 15:
                            _last_blocked_time[pname] = now
                            msg = f"এখন পড়ার সময়! গেম ও চ্যাট অ্যাপ ({rule.get('friendly_name', pname) if rule else pname}) এখন বন্ধ থাকবে।"
                            show_alert_window("পড়ার সময়! (Study Mode Active)", msg)
                            self._log_alert(pname, "study_mode_block", msg)
                        continue

                    # 4. Daily limit exceeded
                    if daily_limit_mins > 0:
                        used_seconds = self.today_usage_cache.get(pname, 0)
                        if used_seconds >= daily_limit_mins * 60:
                            self._close_process(pid, pname)
                            now = time.time()
                            if now - _last_blocked_time.get(pname, 0) > 15:
                                _last_blocked_time[pname] = now
                                msg = f"আজকের জন্য '{rule.get('friendly_name', pname)}'-এর অনুমোদিত {daily_limit_mins} মিনিট শেষ হয়েছে।"
                                show_alert_window("আজকের সময় শেষ! (Daily Limit Reached)", msg)
                                self._log_alert(pname, "limit_exceeded", msg)
                            continue

                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        except Exception as e:
            print(f"[Enforcer Background Scan Error] {e}")

