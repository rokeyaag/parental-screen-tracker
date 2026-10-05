import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import io
import base64
import ctypes
import traceback
from PIL import Image, ImageGrab
import config
import database
from tracker import offline_manager

def attach_desktop_station():
    """Attaches current thread to default interactive desktop station on Windows."""
    try:
        user32 = ctypes.windll.user32
        h_desk = user32.OpenDesktopW("Default", 0, False, 0x01FF)
        if h_desk:
            user32.SetThreadDesktop(h_desk)
            return True
    except Exception:
        pass
    return False

def capture_screen_image():
    """Captures screenshot using ImageGrab after attaching to desktop station."""
    attach_desktop_station()
    try:
        return ImageGrab.grab()
    except Exception as e:
        # Fallback using GDI BitBlt if ImageGrab encounters any issue
        try:
            import win32gui
            import win32ui
            import win32con
            import win32api

            hwnd = win32gui.GetDesktopWindow()
            width = win32api.GetSystemMetrics(win32con.SM_CXVIRTUALSCREEN) or 1920
            height = win32api.GetSystemMetrics(win32con.SM_CYVIRTUALSCREEN) or 1080
            left = win32api.GetSystemMetrics(win32con.SM_XVIRTUALSCREEN) or 0
            top = win32api.GetSystemMetrics(win32con.SM_YVIRTUALSCREEN) or 0

            hwindc = win32gui.GetWindowDC(hwnd)
            srcdc = win32ui.CreateDCFromHandle(hwindc)
            memdc = srcdc.CreateCompatibleDC()
            bmp = win32ui.CreateBitmap()
            bmp.CreateCompatibleBitmap(srcdc, width, height)
            memdc.SelectObject(bmp)
            memdc.BitBlt((0, 0), (width, height), srcdc, (left, top), win32con.SRCCOPY)

            bmpinfo = bmp.GetInfo()
            bmpstr = bmp.GetBitmapBits(True)
            img = Image.frombuffer('RGB', (bmpinfo['bmWidth'], bmpinfo['bmHeight']), bmpstr, 'raw', 'BGRX', 0, 1)

            win32gui.DeleteObject(bmp.GetHandle())
            memdc.DeleteDC()
            srcdc.DeleteDC()
            win32gui.ReleaseDC(hwnd, hwindc)
            return img
        except Exception:
            print(f"[Screenshot Capture Error] {e}")
            return None

def process_and_encode(img, target_width=1024, target_height=576, quality=65):
    """Resizes and encodes PIL Image into a base64 Data URI."""
    try:
        copy_img = img.copy()
        if copy_img.mode != "RGB":
            copy_img = copy_img.convert("RGB")
        
        # Rescale maintaining aspect ratio
        copy_img.thumbnail((target_width, target_height), Image.Resampling.LANCZOS)
        
        buffer = io.BytesIO()
        copy_img.save(buffer, format="JPEG", quality=quality, optimize=True)
        raw_bytes = buffer.getvalue()
        b64 = base64.b64encode(raw_bytes).decode("ascii")
        return f"data:image/jpeg;base64,{b64}"
    except Exception as e:
        print(f"[Screenshot Encode Error] {e}")
        return None

def capture_and_store(device_id, process_name, window_title, category_name):
    """
    Captures screen, generates full-res image and thumbnail,
    and stores into database or offline buffer.
    """
    if not config.SCREENSHOT_ENABLED:
        return None

    try:
        img = capture_screen_image()
        if not img:
            return None

        # Full image (1024x576, 65% quality)
        image_data = process_and_encode(
            img,
            target_width=config.SCREENSHOT_WIDTH,
            target_height=config.SCREENSHOT_HEIGHT,
            quality=config.SCREENSHOT_QUALITY
        )
        if not image_data:
            return None

        # Lightweight thumbnail (320x180, 55% quality)
        thumbnail_data = process_and_encode(
            img,
            target_width=320,
            target_height=180,
            quality=55
        )

        # Save to PostgreSQL if online
        if offline_manager.is_postgres_available():
            new_id = database.save_screenshot(
                device_id=device_id,
                process_name=process_name,
                window_title=window_title,
                category_name=category_name,
                image_data=image_data,
                thumbnail_data=thumbnail_data,
                max_stored=config.SCREENSHOT_MAX_STORED
            )
            print(f"[Screenshot Saved] ID: {new_id} | App: {process_name} | Size: ~{len(image_data)//1024}KB")
            return new_id
        else:
            print("[Screenshot Offline] PostgreSQL unavailable; skipping offline image persistence.")
            return None
    except Exception as e:
        print(f"[Screenshot Store Error] {e}")
        traceback.print_exc()
        return None

if __name__ == "__main__":
    print("Testing capture_screen_image...")
    img = capture_screen_image()
    if img:
        print(f"Captured: {img.size}")
        b64 = process_and_encode(img)
        print(f"Encoded length: {len(b64)}")
    else:
        print("Capture returned None")
