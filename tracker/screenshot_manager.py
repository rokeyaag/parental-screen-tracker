import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import io
import time
import base64
import ctypes
import traceback
from datetime import datetime
from PIL import Image, ImageGrab, ImageDraw, ImageFont
import config
import database
from tracker import offline_manager

def is_workstation_locked():
    """Checks if the Windows workstation is currently locked or secure desktop is active."""
    try:
        user32 = ctypes.windll.user32
        h_desk = user32.OpenInputDesktop(0, False, 0x01FF)
        if not h_desk:
            return True
        user32.CloseDesktop(h_desk)
        return False
    except Exception:
        return False

def generate_locked_placeholder(process_name="System", window_title="Screen Locked"):
    """Generates an informative dark card image when screen is locked or display is powered off."""
    try:
        w = getattr(config, 'SCREENSHOT_WIDTH', 1024)
        h = getattr(config, 'SCREENSHOT_HEIGHT', 576)
        img = Image.new("RGB", (w, h), color=(15, 23, 42))
        draw = ImageDraw.Draw(img)
        card_w, card_h = 560, 260
        x0, y0 = (w - card_w) // 2, (h - card_h) // 2
        x1, y1 = x0 + card_w, y0 + card_h
        draw.rectangle([x0, y0, x1, y1], fill=(30, 41, 59), outline=(51, 65, 85), width=2)
        
        now_str = datetime.now().strftime("%I:%M:%S %p, %d %b %Y")
        draw.text((x0 + 30, y0 + 35), "[ SCREEN LOCKED / AWAY ]", fill=(239, 68, 68))
        draw.text((x0 + 30, y0 + 80), "Status: Workstation is locked or in sleep mode", fill=(241, 245, 249))
        draw.text((x0 + 30, y0 + 120), f"Active App: {process_name}", fill=(148, 163, 184))
        draw.text((x0 + 30, y0 + 155), f"Window: {window_title[:45]}", fill=(148, 163, 184))
        draw.text((x0 + 30, y0 + 200), f"Timestamp: {now_str}", fill=(56, 189, 248))
        return img
    except Exception:
        return Image.new("RGB", (1024, 576), color=(15, 23, 42))

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
        except Exception as err:
            print(f"[Screenshot Capture Error] {err}")
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
            # If screen capture is blank or desktop is locked/sleeping, generate informative placeholder
            if is_workstation_locked() or process_name in ("csrss.exe", "logonui.exe", "lockapp.exe", "idle"):
                img = generate_locked_placeholder(process_name, window_title)
            else:
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

        # Save to PostgreSQL (retry once if transient connection drop)
        save_err = None
        for attempt in range(2):
            try:
                new_id = database.save_screenshot(
                    device_id=device_id,
                    process_name=process_name,
                    window_title=window_title,
                    category_name=category_name,
                    image_data=image_data,
                    thumbnail_data=thumbnail_data,
                    max_stored=config.SCREENSHOT_MAX_STORED,
                    captured_at=datetime.now()
                )
                print(f"[Screenshot Saved] ID: {new_id} | App: {process_name} | Size: ~{len(image_data)//1024}KB")
                return new_id
            except Exception as e:
                save_err = e
                time.sleep(1.0)

        print(f"[Screenshot Save Error] Failed after retry: {save_err}")
        return None
    except Exception as e:
        print(f"[Screenshot Store Error] {e}")
        traceback.print_exc()
        return None
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
