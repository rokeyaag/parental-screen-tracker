import sys
import io
import csv
import os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI, Request, Form, Body
from fastapi.responses import HTMLResponse, JSONResponse, Response, FileResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import config
import database

app = FastAPI(title="Parental Screen & Activity Tracker", version="2.0.0")

# Enable Cross-Origin Resource Sharing (CORS) for Mobile App & External Network Browsing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent / "templates"))

@app.on_event("startup")
async def startup_event():
    try:
        database.init_db()
        print("[Startup] Database initialized successfully.")
    except Exception as e:
        print(f"[Startup Warning] Could not initialize database on startup: {e}")

def format_time(seconds):
    if not seconds:
        return "0 min"
    mins = int(seconds // 60)
    hours = int(mins // 60)
    rem_mins = mins % 60
    if hours > 0:
        return f"{hours}h {rem_mins}m"
    return f"{rem_mins} min"

@app.get("/", response_class=HTMLResponse)
async def dashboard_view(request: Request):
    device_id = database.get_device_id(config.DEVICE_NAME)
    summary = database.get_today_summary(device_id)
    apps = database.get_today_usage_by_app(device_id)
    rules = database.get_all_rules()
    settings = database.get_all_settings()
    
    study_mode = settings.get("study_mode_active", "false").lower() == "true"
    emergency_lock = settings.get("emergency_lock", "false").lower() == "true"
    live_status = database.get_live_device_status(device_id)
    weekly_trend = database.get_weekly_trend(device_id)
    recent_logs = database.get_recent_activity_logs(device_id, limit=25)
    recent_alerts = database.get_recent_alerts(device_id, limit=15)
    latest_screenshot = database.get_latest_screenshot(device_id)
    recent_screenshots = database.get_recent_screenshots(device_id, limit=12)
    recent_keystrokes = database.get_recent_keystroke_logs(device_id, limit=35)

    daily_total_limit_mins = int(settings.get("daily_total_limit_minutes", "240"))
    total_sec = summary["total_seconds"]
    total_limit_sec = daily_total_limit_mins * 60
    total_pct = min(100, int((total_sec / total_limit_sec) * 100)) if total_limit_sec > 0 else 0

    formatted_summary = {
        "total": format_time(summary["total_seconds"]),
        "total_seconds": summary["total_seconds"],
        "gaming": format_time(summary["gaming_seconds"]),
        "gaming_seconds": summary["gaming_seconds"],
        "study": format_time(summary["study_seconds"]),
        "study_seconds": summary["study_seconds"],
        "browsing": format_time(summary["browsing_seconds"]),
        "browsing_seconds": summary["browsing_seconds"],
        "other": format_time(summary["other_seconds"]),
        "other_seconds": summary["other_seconds"],
        "daily_limit_mins": daily_total_limit_mins,
        "total_pct": total_pct
    }

    formatted_apps = []
    for app_item in apps:
        used_sec = app_item["total_seconds"]
        limit_mins = app_item["daily_limit_minutes"]
        limit_sec = limit_mins * 60
        pct = 0
        if limit_sec > 0:
            pct = min(100, int((used_sec / limit_sec) * 100))

        formatted_apps.append({
            "process_name": app_item["process_name"],
            "name": app_item["app_name"],
            "category": app_item["category_name"],
            "time_str": format_time(used_sec),
            "used_seconds": used_sec,
            "limit_mins": limit_mins,
            "is_blocked": app_item["is_blocked"],
            "pct": pct
        })

    ctx = {
        "device_name": config.DEVICE_NAME,
        "assigned_child": config.ASSIGNED_CHILD,
        "summary": formatted_summary,
        "apps": formatted_apps,
        "rules": rules,
        "settings": settings,
        "study_mode": study_mode,
        "emergency_lock": emergency_lock,
        "live_status": live_status,
        "weekly_trend": weekly_trend,
        "recent_logs": recent_logs,
        "recent_alerts": recent_alerts,
        "latest_screenshot": latest_screenshot,
        "recent_screenshots": recent_screenshots,
        "recent_keystrokes": recent_keystrokes
    }
    return templates.TemplateResponse(request=request, name="dashboard.html", context=ctx)

@app.get("/api/stats")
async def get_stats():
    device_id = database.get_device_id(config.DEVICE_NAME)
    summary = database.get_today_summary(device_id)
    apps = database.get_today_usage_by_app(device_id)
    live_status = database.get_live_device_status(device_id)
    weekly_trend = database.get_weekly_trend(device_id)
    settings = database.get_all_settings()
    latest_screenshot = database.get_latest_screenshot(device_id)
    recent_keystrokes = database.get_recent_keystroke_logs(device_id, limit=20)

    return {
        "summary": summary,
        "apps": apps,
        "live_status": live_status,
        "weekly_trend": weekly_trend,
        "latest_screenshot": latest_screenshot,
        "recent_keystrokes": recent_keystrokes,
        "study_mode": settings.get("study_mode_active", "false").lower() == "true",
        "emergency_lock": settings.get("emergency_lock", "false").lower() == "true"
    }

@app.get("/api/live-status")
async def get_live_status():
    device_id = database.get_device_id(config.DEVICE_NAME)
    return database.get_live_device_status(device_id)

@app.post("/api/study-mode/toggle")
async def toggle_study_mode(request: Request, device_id: int = None):
    target_id = device_id
    if target_id is None:
        try:
            body = await request.json()
            target_id = body.get("device_id")
        except Exception:
            pass
    new_state = database.toggle_study_mode(target_id)
    return {"success": True, "study_mode_active": new_state, "device_id": target_id}

@app.post("/api/emergency-lock/toggle")
async def toggle_emergency_lock(request: Request, device_id: int = None):
    target_id = device_id
    if target_id is None:
        try:
            body = await request.json()
            target_id = body.get("device_id")
        except Exception:
            pass
    new_state = database.toggle_emergency_lock(target_id)
    try:
        resolved_target = database._resolve_device_id(target_id) if target_id is not None else None
        host_id = database.get_device_id(config.DEVICE_NAME)
        if new_state and (resolved_target is None or resolved_target in (host_id, 1, 163)):
            import ctypes
            user32 = ctypes.windll.user32
            h_desk = user32.OpenInputDesktop(0, False, 0x01FF)
            if h_desk:
                user32.CloseDesktop(h_desk)
                user32.LockWorkStation()
    except Exception:
        pass
    return {"success": True, "emergency_lock": new_state, "device_id": target_id}

@app.post("/api/settings/update")
async def update_settings(
    study_start_hour: int = Form(...),
    study_end_hour: int = Form(...),
    daily_total_limit_minutes: int = Form(...)
):
    database.set_setting("study_start_hour", str(study_start_hour))
    database.set_setting("study_end_hour", str(study_end_hour))
    database.set_setting("daily_total_limit_minutes", str(daily_total_limit_minutes))
    return {"success": True, "message": "Settings updated successfully"}

@app.post("/api/rules/save")
async def save_rule(
    process_name: str = Form(...),
    friendly_name: str = Form(...),
    category_name: str = Form(...),
    daily_limit_minutes: int = Form(...),
    is_blocked: bool = Form(False)
):
    database.upsert_rule(process_name, friendly_name, category_name, daily_limit_minutes, is_blocked)
    return {"success": True, "message": f"Rule updated for {process_name}"}

@app.post("/api/rules/delete")
async def delete_rule_api(process_name: str = Form(...)):
    database.delete_rule(process_name)
    return {"success": True, "message": f"Rule deleted for {process_name}"}

@app.get("/api/export/csv")
async def export_csv():
    device_id = database.get_device_id(config.DEVICE_NAME)
    logs = database.get_recent_activity_logs(device_id, limit=2000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Application", "Process File", "Category", "Duration (Seconds)", "Window Title"])
    for row in logs:
        writer.writerow([
            row["time_str"],
            row["app_name"],
            row["process_name"],
            row["category_name"],
            row["duration_seconds"],
            row["window_title"]
        ])
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="activity_report_{config.DEVICE_NAME}.csv"'}
    )

# --- Screenshot API Endpoints ---
@app.get("/api/screenshots/recent")
async def get_recent_screenshots_api(limit: int = 15, device_id: int = None):
    """Returns recent screenshots with thumbnails and metadata."""
    dev_id = device_id or database.get_device_id(config.DEVICE_NAME)
    return database.get_recent_screenshots(dev_id, limit=limit)

@app.get("/api/screenshots/latest")
async def get_latest_screenshot_api(device_id: int = None):
    """Returns the most recent screenshot."""
    dev_id = device_id or database.get_device_id(config.DEVICE_NAME)
    latest = database.get_latest_screenshot(dev_id)
    if not latest:
        return JSONResponse(status_code=404, content={"error": "No screenshot available yet"})
    return latest

@app.get("/api/screenshots/{screenshot_id}")
async def get_screenshot_detail_api(screenshot_id: int):
    """Returns full-resolution screenshot by ID."""
    shot = database.get_screenshot_by_id(screenshot_id)
    if not shot:
        return JSONResponse(status_code=404, content={"error": "Screenshot not found"})
    return shot

@app.post("/api/screenshots/request")
async def request_screenshot_capture_api(request: Request, device_id: int = None):
    """Triggers an on-demand screenshot request for the tracker to capture immediately."""
    target_id = device_id
    if target_id is None:
        try:
            body = await request.json()
            target_id = body.get("device_id")
        except Exception:
            pass
    database.request_on_demand_screenshot(target_id)
    return {"success": True, "message": f"Screenshot capture request sent to tracker client for device {target_id or 'default'}."}


# --- Windows Setup Executable Download Endpoint ---
@app.get("/api/download/tracker.exe")
async def download_tracker_exe():
    """Serves the compiled standalone Windows installer/executable."""
    exe_path = Path(__file__).resolve().parent.parent / "dist" / "ParentalScreenTracker.exe"
    if not exe_path.exists():
        return JSONResponse(status_code=404, content={"error": "Executable not found. Please compile it first."})
    return FileResponse(
        path=str(exe_path),
        filename="ParentalScreenTrackerSetup.exe",
        media_type="application/vnd.microsoft.portable-executable"
    )

# --- Android Mobile App APK Download Endpoint ---
@app.get("/api/download/tracker.apk")
async def download_tracker_apk():
    """Serves or redirects to the compiled Android Mobile App APK."""
    # 1. Check local precompiled APK file candidates
    local_candidates = [
        Path(__file__).resolve().parent / "static" / "downloads" / "ParentalScreenTracker.apk",
        Path(r"F:\ICTBD_02\soft\ParentalScreenTracker.apk"),
        Path(__file__).resolve().parent.parent / "mobile_app" / "ParentalScreenTracker.apk",
    ]
    apk_path = next((p for p in local_candidates if p.exists()), None)

    # Vercel serverless functions have a 4.5MB payload limit; large binaries cannot stream directly
    is_vercel = bool(os.getenv("VERCEL") or os.getenv("VERCEL_ENV"))
    if apk_path and not is_vercel:
        return FileResponse(
            path=str(apk_path),
            filename="ParentalScreenTracker.apk",
            media_type="application/vnd.android.package-archive"
        )

    # 2. If explicit cloud download URL is configured, redirect
    cloud_apk_url = getattr(config, "APK_DOWNLOAD_URL", "").strip() or os.getenv("APK_DOWNLOAD_URL", "").strip()
    if cloud_apk_url:
        return RedirectResponse(url=cloud_apk_url, status_code=307)

    # 3. If APK cannot be directly streamed, return an intuitive setup & installation guide
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Android Mobile App Setup - Parental Screen Tracker</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        body { background: #0b0f19; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 25px 15px; }
        .setup-card { background: rgba(30, 41, 59, 0.85); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 20px; max-width: 620px; width: 100%; padding: 32px; box-shadow: 0 25px 50px rgba(0,0,0,0.6); }
        .badge-android { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.35); padding: 6px 14px; border-radius: 999px; font-size: 0.82rem; font-weight: 600; display: inline-block; }
        .step-circle { width: 32px; height: 32px; border-radius: 50%; background: #3b82f6; color: white; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
        .path-box { background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 10px 14px; font-family: Consolas, monospace; font-size: 0.85rem; color: #38bdf8; word-break: break-all; }
        .btn-action { font-weight: 600; border-radius: 999px; padding: 8px 20px; }
    </style>
</head>
<body>
    <div class="setup-card text-center">
        <div class="mb-3">
            <span class="badge-android"><i class="fa-brands fa-android me-1"></i> Android Mobile App Setup</span>
        </div>
        <h4 class="fw-bold mb-2">Parental Screen Tracker APK</h4>
        <p class="text-secondary small mb-4">The Android companion app allows real-time child screen monitoring, live screenshot feeds, and instant emergency lock right from your phone.</p>

        <div class="text-start mb-4">
            <div class="d-flex align-items-start gap-3 mb-3">
                <span class="step-circle">1</span>
                <div>
                    <h6 class="fw-bold mb-1">Local APK Available on Your PC</h6>
                    <p class="text-secondary small mb-1">The precompiled <code>.apk</code> is saved in your local workspace:</p>
                    <div class="path-box">server/static/downloads/ParentalScreenTracker.apk</div>
                    <small class="text-info mt-1 d-block"><i class="fa-solid fa-circle-info me-1"></i> Connect your Android phone via USB cable or share via WhatsApp / Google Drive to install directly.</small>
                </div>
            </div>

            <div class="d-flex align-items-start gap-3 mb-3">
                <span class="step-circle">2</span>
                <div>
                    <h6 class="fw-bold mb-1">Build Updated APK (1-Click Script)</h6>
                    <p class="text-secondary small mb-1">To compile a fresh APK with all newly added pairing & keystroke features, run in project root:</p>
                    <div class="path-box">Build_Mobile_APK.bat</div>
                </div>
            </div>

            <div class="d-flex align-items-start gap-3">
                <span class="step-circle">3</span>
                <div>
                    <h6 class="fw-bold mb-1">Run Instantly with Expo Go (No APK Needed)</h6>
                    <p class="text-secondary small mb-1">Download <strong>Expo Go</strong> from Google Play Store on your Android phone, then run:</p>
                    <div class="path-box">run_mobile_app.bat</div>
                    <small class="text-secondary mt-1 d-block">Scan the terminal QR code to open the full app live on your phone without building an APK!</small>
                </div>
            </div>
        </div>

        <div class="d-flex justify-content-center gap-2">
            <a href="/" class="btn btn-outline-light btn-action"><i class="fa-solid fa-arrow-left me-1"></i> Back to Dashboard</a>
        </div>
    </div>
</body>
</html>
"""
    return HTMLResponse(content=html_content, status_code=200)

# --- React Native Mobile App API Endpoints ---
@app.get("/api/mobile/dashboard")
async def get_mobile_dashboard(device_id: int = None, parent_id: int = None):
    """Consolidated JSON state endpoint for the React Native mobile app with multi-device support."""
    devices = database.get_parent_devices(parent_id)

    target_dev = None
    if device_id:
        target_dev = next((d for d in devices if d["id"] == device_id), None)

    if not target_dev:
        if devices:
            target_dev = devices[0]
            device_id = target_dev["id"]
        else:
            device_id = database.get_device_id(config.DEVICE_NAME)
            target_dev = {
                "id": device_id,
                "device_name": config.DEVICE_NAME,
                "assigned_child": config.ASSIGNED_CHILD,
                "os_name": "Windows",
                "is_online": False,
                "last_seen_str": "Never"
            }
    else:
        device_id = target_dev["id"]

    summary = database.get_today_summary(device_id)
    apps = database.get_today_usage_by_app(device_id)
    rules = database.get_all_rules()
    settings = database.get_all_settings()
    live_status = database.get_live_device_status(device_id)
    weekly_trend = database.get_weekly_trend(device_id)
    recent_logs = database.get_recent_activity_logs(device_id, limit=30)
    recent_alerts = database.get_recent_alerts(device_id, limit=20)
    device_status = database.get_device_lock_and_study_status(device_id)

    daily_total_limit_mins = int(settings.get("daily_total_limit_minutes", "240"))
    total_sec = summary["total_seconds"]
    total_limit_sec = daily_total_limit_mins * 60
    total_pct = min(100, int((total_sec / total_limit_sec) * 100)) if total_limit_sec > 0 else 0

    return {
        "device": {
            "id": device_id,
            "name": target_dev.get("device_name", config.DEVICE_NAME),
            "assigned_child": target_dev.get("assigned_child", config.ASSIGNED_CHILD),
            "os_name": target_dev.get("os_name", "Windows"),
            "online": live_status.get("online", False),
            "current_app": live_status.get("current_app", "None"),
            "current_title": live_status.get("current_title", ""),
            "current_category": live_status.get("current_category", "Other"),
            "last_activity_time": live_status.get("last_activity_time", "")
        },
        "devices": devices,
        "summary": {
            "total_seconds": summary["total_seconds"],
            "total_formatted": format_time(summary["total_seconds"]),
            "gaming_seconds": summary["gaming_seconds"],
            "gaming_formatted": format_time(summary["gaming_seconds"]),
            "study_seconds": summary["study_seconds"],
            "study_formatted": format_time(summary["study_seconds"]),
            "browsing_seconds": summary["browsing_seconds"],
            "browsing_formatted": format_time(summary["browsing_seconds"]),
            "other_seconds": summary["other_seconds"],
            "other_formatted": format_time(summary["other_seconds"]),
            "daily_limit_mins": daily_total_limit_mins,
            "total_pct": total_pct
        },
        "apps": [
            {
                "process_name": a["process_name"],
                "name": a["app_name"],
                "category": a["category_name"],
                "used_seconds": a["total_seconds"],
                "time_formatted": format_time(a["total_seconds"]),
                "limit_mins": a["daily_limit_minutes"],
                "is_blocked": a["is_blocked"],
                "pct": min(100, int((a["total_seconds"] / (a["daily_limit_minutes"] * 60)) * 100)) if a["daily_limit_minutes"] > 0 else 0
            }
            for a in apps
        ],
        "rules": rules,
        "settings": {
            "study_mode_active": device_status["study_mode_active"],
            "emergency_lock": device_status["emergency_lock"],
            "study_start_hour": int(settings.get("study_start_hour", "19")),
            "study_end_hour": int(settings.get("study_end_hour", "22")),
            "daily_total_limit_minutes": daily_total_limit_mins
        },
        "weekly_trend": weekly_trend,
        "recent_logs": recent_logs,
        "recent_alerts": recent_alerts,
        "latest_screenshot": database.get_latest_screenshot(device_id),
        "recent_screenshots": database.get_recent_screenshots(device_id, limit=30),
        "recent_keystrokes": database.get_recent_keystroke_logs(device_id, limit=30)
    }

@app.get("/api/keystrokes")
async def get_keystrokes_api(limit: int = 50, q: str = None, log_type: str = None, device_id: int = None):
    """Fetches recent keystroke and clipboard logs with optional search filtering."""
    dev_id = device_id or database.get_device_id(config.DEVICE_NAME)
    logs = database.get_recent_keystroke_logs(dev_id, limit=limit, search_query=q, log_type=log_type)
    return {"keystrokes": logs}

@app.post("/api/keystrokes")
async def save_keystroke_api(payload: dict = Body(...)):
    """Receives single or batch keystroke / clipboard logs from tracker client."""
    device_name = payload.get("device_name", config.DEVICE_NAME)
    device_id = database.get_device_id(device_name)
    batch = payload.get("batch") or payload.get("logs")
    if batch:
        count = database.save_keystroke_batch(device_id, batch)
        return {"success": True, "saved": count}
    elif "content" in payload:
        log_id = database.save_keystroke_log(
            device_id=device_id,
            process_name=payload.get("process_name", "unknown"),
            window_title=payload.get("window_title", ""),
            category_name=payload.get("category_name", "Other"),
            content=payload.get("content", ""),
            log_type=payload.get("log_type", "keystroke"),
            recorded_at=payload.get("recorded_at")
        )
        return {"success": True, "id": log_id}
    return JSONResponse(status_code=400, content={"error": "Invalid keystroke payload"})

@app.post("/api/mobile/rules/save")
async def save_rule_mobile(payload: dict = Body(...)):
    """Accepts JSON payload for creating/editing rules from mobile app."""
    process_name = payload.get("process_name", "").strip()
    friendly_name = payload.get("friendly_name", process_name).strip()
    category_name = payload.get("category_name", "Other")
    daily_limit_minutes = int(payload.get("daily_limit_minutes", 60))
    is_blocked = bool(payload.get("is_blocked", False))

    if not process_name:
        return JSONResponse(status_code=400, content={"error": "process_name is required"})

    database.upsert_rule(process_name, friendly_name, category_name, daily_limit_minutes, is_blocked)
    return {"success": True, "message": f"Rule saved for {process_name}"}

@app.post("/api/mobile/rules/delete")
async def delete_rule_mobile(payload: dict = Body(...)):
    process_name = payload.get("process_name", "").strip()
    if process_name:
        database.delete_rule(process_name)
    return {"success": True, "message": "Rule deleted"}

@app.post("/api/mobile/settings/update")
async def update_settings_mobile(payload: dict = Body(...)):
    """Accepts JSON payload for updating schedules and limits from mobile app."""
    if "study_start_hour" in payload:
        database.set_setting("study_start_hour", str(payload["study_start_hour"]))
    if "study_end_hour" in payload:
        database.set_setting("study_end_hour", str(payload["study_end_hour"]))
    if "daily_total_limit_minutes" in payload:
        database.set_setting("daily_total_limit_minutes", str(payload["daily_total_limit_minutes"]))
    return {"success": True, "message": "Settings updated"}

# =====================================================================
# SaaS Multi-Tenant Authentication & Device Pairing API Endpoints
# =====================================================================

@app.post("/api/auth/register")
async def api_register_parent(payload: dict = Body(...)):
    name = payload.get("name", "").strip()
    email = payload.get("email", "").strip()
    password = payload.get("password", "")
    if not name or not email or not password:
        return JSONResponse(status_code=400, content={"error": "Name, email, and password are required."})
    try:
        parent = database.register_parent(name, email, password)
        return {"success": True, "parent": parent}
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": f"Registration failed (Email might already be registered): {e}"})

@app.post("/api/auth/login")
async def api_login_parent(payload: dict = Body(...)):
    email = payload.get("email", "").strip()
    password = payload.get("password", "")
    parent = database.authenticate_parent(email, password)
    if not parent:
        return JSONResponse(status_code=401, content={"error": "Invalid email or password."})
    devices = database.get_parent_devices(parent["id"])
    return {"success": True, "parent": parent, "devices": devices}

@app.post("/api/devices/generate-pairing-code")
async def api_generate_pairing_code(request: Request, payload: dict = Body(...)):
    auth = request.headers.get("authorization", "")
    parent = None
    if auth.startswith("Bearer "):
        token = auth.split("Bearer ", 1)[1].strip()
        parent = database.get_parent_by_api_key(token)
    parent_id = parent["id"] if parent else payload.get("parent_id", 1)
    device_name = payload.get("device_name", "Child PC").strip()
    assigned_child = payload.get("assigned_child", "").strip()
    os_name = payload.get("os_name", "Laptop").strip()

    result = database.create_pairing_code(parent_id, device_name, assigned_child, os_name)
    return {"success": True, **result}

@app.post("/api/devices/pair")
async def api_pair_device(payload: dict = Body(...)):
    pairing_code = payload.get("pairing_code", "").strip()
    hardware_uuid = payload.get("hardware_uuid", "").strip()
    os_name = payload.get("os_name", "Windows").strip()
    if not pairing_code:
        return JSONResponse(status_code=400, content={"error": "Pairing code is required."})

    paired = database.pair_device_by_code(pairing_code, hardware_uuid, os_name)
    if not paired:
        return JSONResponse(status_code=404, content={"error": "Invalid or expired pairing code. Please generate a new one from your dashboard."})
    return {"success": True, "device": paired}

@app.get("/api/devices")
@app.get("/api/devices/my-devices")
async def api_get_my_devices(request: Request, parent_id: int = None):
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth.split("Bearer ", 1)[1].strip()
        p = database.get_parent_by_api_key(token)
        if p:
            parent_id = p["id"]
    devices = database.get_parent_devices(parent_id)
    return {"success": True, "devices": devices}

@app.post("/api/devices/delete")
async def api_delete_device(payload: dict = Body(...)):
    device_id = payload.get("device_id")
    if not device_id:
        return JSONResponse(status_code=400, content={"error": "device_id is required"})
    database.delete_device(device_id)
    return {"success": True, "message": f"Device {device_id} deleted successfully."}

@app.post("/api/devices/update")
async def api_update_device(payload: dict = Body(...)):
    device_id = payload.get("device_id")
    device_name = payload.get("device_name", "").strip()
    assigned_child = payload.get("assigned_child", "").strip()
    os_name = payload.get("os_name", "").strip()
    if not device_id or not device_name:
        return JSONResponse(status_code=400, content={"error": "device_id and device_name are required"})
    database.update_device_info(device_id, device_name, assigned_child, os_name or None)
    return {"success": True, "message": "Device updated successfully."}

@app.post("/api/devices/sub-heartbeat")
async def api_sub_heartbeat(payload: dict = Body(...)):
    device_token_or_id = payload.get("device_token") or payload.get("device_id")
    if not device_token_or_id:
        return JSONResponse(status_code=400, content={"error": "device_token or device_id is required"})
    current_app = payload.get("current_app", "Mobile Active")
    duration_seconds = int(payload.get("duration_seconds", 15))
    is_active = bool(payload.get("is_active", True))
    result = database.record_sub_mobile_heartbeat(
        device_token_or_id=device_token_or_id,
        current_app=current_app,
        duration_seconds=duration_seconds,
        is_active=is_active
    )
    if not result:
        return JSONResponse(status_code=404, content={"error": "Device not found"})
    return {"success": True, **result}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.app:app", host=config.SERVER_HOST, port=config.SERVER_PORT, reload=True)
