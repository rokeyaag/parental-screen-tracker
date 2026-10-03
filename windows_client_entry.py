"""
Parental Screen Tracker - Windows Background Client Entry
Can be compiled to a standalone executable (.exe) using PyInstaller.
"""
import sys
import os
import time
import winreg
import ctypes
from pathlib import Path

# Redirect stdout/stderr if frozen or running under pythonw to avoid NoneType errors and maintain local log file
if getattr(sys, 'frozen', False) or sys.stdout is None or sys.stderr is None or "pythonw" in sys.executable.lower():
    appdata = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or str(Path.home())
    log_dir = Path(appdata) / "ParentalScreenTracker"
    try:
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = open(log_dir / "client.log", "a", encoding="utf-8", buffering=1)
        sys.stdout = log_file
        sys.stderr = log_file
    except Exception:
        sys.stdout = open(os.devnull, "w")
        sys.stderr = open(os.devnull, "w")

# Ensure root folder is in sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

import config
from tracker.client import TrackerClient

REG_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
APP_NAME = "ParentalScreenTracker"

def show_popup(title, message, is_error=False):
    """Shows a Windows system modal message box."""
    try:
        flags = 0x51010 if is_error else 0x51040 # MB_OK | MB_ICONERROR/MB_ICONINFORMATION | MB_SYSTEMMODAL | MB_TOPMOST
        ctypes.windll.user32.MessageBoxW(0, message, title, flags)
    except Exception:
        pass

import threading

def acquire_single_instance_mutex():
    """Ensures only one instance of the tracker client runs at a time."""
    mutex_name = "Global\\ParentalScreenTracker_SingleInstance_Mutex_v1"
    try:
        mutex = ctypes.windll.kernel32.CreateMutexW(None, True, mutex_name)
        last_error = ctypes.windll.kernel32.GetLastError()
        ERROR_ALREADY_EXISTS = 183
        if last_error == ERROR_ALREADY_EXISTS:
            return None
        return mutex
    except Exception:
        return True

def install_autostart():
    """Adds the application executable to Windows Startup Registry."""
    try:
        if getattr(sys, 'frozen', False):
            cmd_str = f'"{sys.executable}" --silent'
        else:
            pythonw = sys.executable.replace("python.exe", "pythonw.exe")
            script_path = os.path.abspath(__file__)
            cmd_str = f'"{pythonw}" "{script_path}" --silent'
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_KEY, 0, winreg.KEY_SET_VALUE)
        winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, cmd_str)
        winreg.CloseKey(key)
        print(f"[Autostart] Successfully registered {APP_NAME} to Windows startup.")
        return True
    except Exception as e:
        print(f"[Autostart Error] {e}")
        return False

def uninstall_autostart():
    """Removes the application executable from Windows Startup Registry."""
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_KEY, 0, winreg.KEY_SET_VALUE)
        winreg.DeleteValue(key, APP_NAME)
        winreg.CloseKey(key)
        print(f"[Autostart] Removed {APP_NAME} from Windows startup.")
        return True
    except Exception as e:
        print(f"[Autostart Error] {e}")
        return False

def main():
    try:
        args = [a.lower() for a in sys.argv[1:]]

        if any(a in ("--install", "-i", "install") for a in args):
            install_autostart()
            show_popup(
                "Parental Screen Tracker",
                "Parental Screen Tracker সফলভাবে উইন্ডোজ স্টার্টআপে ইনস্টল করা হয়েছে এবং ব্যাকগ্রাউন্ডে সক্রিয় থাকবে।"
            )
            return
        elif any(a in ("--uninstall", "-u", "uninstall") for a in args):
            uninstall_autostart()
            show_popup("Parental Screen Tracker", "সফলভাবে আনইনস্টল করা হয়েছে।")
            return

        is_silent = "--silent" in args or "-s" in args

        # Check single instance
        mutex = acquire_single_instance_mutex()
        if mutex is None:
            print("[SingleInstance] Another instance is already running.")
            if not is_silent:
                show_popup(
                    "Parental Screen Tracker",
                    "Parental Screen Tracker ইতিমধ্যে আপনার ব্যাকগ্রাউন্ডে সক্রিয় রয়েছে এবং কাজ করছে।"
                )
            return

        # Auto register on first execution
        install_autostart()

        # Show visual confirmation when user manually double clicks
        if not is_silent:
            threading.Thread(
                target=show_popup,
                args=(
                    "Parental Screen Tracker",
                    "Parental Screen Tracker সফলভাবে ব্যাকগ্রাউন্ডে চালু হয়েছে!\n\n"
                    "✓ শিশুদের স্ক্রিন ও অ্যাপ ব্যবহার স্বয়ংক্রিয়ভাবে ট্র্যাক হচ্ছে।\n"
                    "✓ উইন্ডোজ স্টার্টআপে স্বয়ংক্রিয়ভাবে সক্রিয় থাকবে।\n"
                    "✓ এটি ব্যাকগ্রাউন্ডে সম্পূর্ণ সাইলেন্টলি চলবে।"
                ),
                daemon=True
            ).start()

        # Start tracking agent
        client = TrackerClient()
        client.start()
    except Exception as e:
        print(f"[Fatal Error] {e}")
        show_popup("Parental Screen Tracker Error", f"সিস্টেমে সমস্যা হয়েছে: {e}", is_error=True)

if __name__ == "__main__":
    main()

