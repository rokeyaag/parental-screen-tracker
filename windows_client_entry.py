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

# Ensure logs are saved to client.log with immediate flush
class AutoFlushLogger:
    def __init__(self, filename, original_stream=None):
        self.original_stream = original_stream
        try:
            self.file = open(filename, "a", encoding="utf-8")
        except Exception:
            self.file = None

    def write(self, message):
        if self.original_stream:
            try:
                self.original_stream.write(message)
                self.original_stream.flush()
            except Exception:
                pass
        if self.file:
            try:
                self.file.write(message)
                self.file.flush()
            except Exception:
                pass

    def flush(self):
        if self.original_stream:
            try:
                self.original_stream.flush()
            except Exception:
                pass
        if self.file:
            try:
                self.file.flush()
            except Exception:
                pass

appdata = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or str(Path.home())
log_dir = Path(appdata) / "ParentalScreenTracker"
try:
    log_dir.mkdir(parents=True, exist_ok=True)
    client_log_path = log_dir / "client.log"
    sys.stdout = AutoFlushLogger(client_log_path, sys.stdout)
    sys.stderr = AutoFlushLogger(client_log_path, sys.stderr)
except Exception:
    pass

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

def handle_pairing(code):
    """Pairs this computer with a parent's account using the 6-digit pairing code."""
    try:
        import platform
        import database
        from tracker import offline_manager
        paired = database.pair_device_by_code(code, hardware_uuid=f"Win-{platform.node()}", os_name="Windows")
        if paired:
            conn = offline_manager.get_sqlite_conn()
            with conn:
                conn.execute("INSERT OR REPLACE INTO local_meta (key, value) VALUES ('device_id', ?);", (str(paired["device_id"]),))
                conn.execute("INSERT OR REPLACE INTO local_meta (key, value) VALUES ('device_token', ?);", (paired["device_token"],))
                conn.execute("INSERT OR REPLACE INTO local_meta (key, value) VALUES ('device_name', ?);", (paired["device_name"],))
            conn.close()
            print(f"[Pairing Success] Device linked to {paired['device_name']} (ID: {paired['device_id']})")
            show_popup("Device Paired Successfully", f"This computer has been successfully linked to '{paired['device_name']}'!")
            return True
        else:
            show_popup("Pairing Failed", "Invalid or expired 6-digit pairing code. Please generate a new code from your dashboard.", is_error=True)
            return False
    except Exception as e:
        show_popup("Pairing Error", f"Error during pairing: {e}", is_error=True)
        return False

def prompt_pairing_gui():
    """Shows a clean input dialog asking for the 6-digit pairing code."""
    try:
        import tkinter as tk
        from tkinter import simpledialog
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        code = simpledialog.askstring("Parental Screen Tracker - Pair PC", "Enter 6-digit Pairing Code from your Mobile Dashboard:")
        root.destroy()
        if code and code.strip():
            return handle_pairing(code.strip())
    except Exception as e:
        print(f"[GUI Prompt Error] {e}")
    return False

def main():
    try:
        raw_args = sys.argv[1:]
        args = [a.lower() for a in raw_args]

        if any(a in ("--help", "-h", "help", "/?") for a in args):
            print("Parental Screen Tracker - Windows Background Client")
            print("Usage:")
            print("  windows_client_entry.exe              : Run tracker in background (installs to startup)")
            print("  windows_client_entry.exe --pair [CODE]: Pair PC to parent account with 6-digit code")
            print("  windows_client_entry.exe --install    : Register auto-start in Windows Startup")
            print("  windows_client_entry.exe --uninstall  : Remove auto-start registration")
            print("  windows_client_entry.exe --silent     : Start silently without confirmation popup")
            return
        elif any(a in ("--install", "-i", "install") for a in args):
            install_autostart()
            show_popup(
                "Parental Screen Tracker",
                "Parental Screen Tracker has been successfully installed to Windows Startup and will run in the background."
            )
            return
        elif any(a in ("--uninstall", "-u", "uninstall") for a in args):
            uninstall_autostart()
            show_popup("Parental Screen Tracker", "Parental Screen Tracker has been uninstalled successfully.")
            return
        elif any(a in ("--pair", "-p", "pair") for a in args):
            # Check if code was passed next to --pair
            idx = -1
            for flag in ("--pair", "-p", "pair"):
                if flag in args:
                    idx = args.index(flag)
                    break
            if idx != -1 and idx + 1 < len(raw_args):
                code = raw_args[idx + 1]
                handle_pairing(code)
            else:
                prompt_pairing_gui()
            return

        is_silent = "--silent" in args or "-s" in args

        # Check single instance
        mutex = acquire_single_instance_mutex()
        if mutex is None:
            print("[SingleInstance] Another instance is already running.")
            if not is_silent:
                show_popup(
                    "Parental Screen Tracker",
                    "Parental Screen Tracker is already running and active in the background."
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
                    "Parental Screen Tracker is now running in the background!\n\n"
                    "✓ Child screen time and app monitoring is active.\n"
                    "✓ Registered to Windows Startup for automatic execution.\n"
                    "✓ Running silently in the background."
                ),
                daemon=True
            ).start()

        # Start tracking agent with automatic watchdog resurrection
        while True:
            try:
                client = TrackerClient()
                client.start()
            except Exception as e:
                print(f"[Tracker Watchdog Warning] Client stopped with error: {e}. Restarting in 5s...")
                time.sleep(5)
    except Exception as e:
        print(f"[Fatal Error] {e}")
        show_popup("Parental Screen Tracker Error", f"System error occurred: {e}", is_error=True)

if __name__ == "__main__":
    main()

