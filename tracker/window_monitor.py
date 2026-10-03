import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import ctypes
import win32gui
import win32process
import psutil
import config

class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]

def get_idle_duration():
    """Returns idle duration in seconds since last user input."""
    lii = LASTINPUTINFO()
    lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
    if ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii)):
        millis = ctypes.windll.kernel32.GetTickCount() - lii.dwTime
        return millis / 1000.0
    return 0.0

def get_active_window_info():
    """
    Returns a dict with:
    - process_name (str): e.g. "chrome.exe", "valorant.exe"
    - window_title (str)
    - pid (int)
    - is_idle (bool)
    - idle_seconds (float)
    """
    idle_secs = get_idle_duration()
    is_idle = idle_secs >= config.IDLE_THRESHOLD_SECONDS

    # Ensure thread is attached to the active user desktop
    try:
        user32 = ctypes.windll.user32
        h_desk = user32.OpenDesktopW("Default", 0, False, 0x01FF)
        if h_desk:
            user32.SetThreadDesktop(h_desk)
    except Exception:
        pass

    hwnd = win32gui.GetForegroundWindow()
    if not hwnd:
        return {
            "process_name": "idle" if is_idle else "unknown",
            "window_title": "Idle" if is_idle else "Desktop/No Window",
            "pid": 0,
            "is_idle": is_idle,
            "idle_seconds": idle_secs
        }

    title = win32gui.GetWindowText(hwnd)
    pid = 0
    process_name = "unknown"

    try:
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        if pid > 0:
            proc = psutil.Process(pid)
            process_name = proc.name().lower()
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass

    return {
        "process_name": process_name,
        "window_title": title,
        "pid": pid,
        "is_idle": is_idle,
        "idle_seconds": idle_secs
    }

if __name__ == "__main__":
    import time
    print("Testing Window Monitor (3 samples)...")
    for _ in range(3):
        info = get_active_window_info()
        print(f"Active: {info['process_name']} | Title: {info['window_title'][:40]} | Idle: {info['is_idle']}")
        time.sleep(1)
