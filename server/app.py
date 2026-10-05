import sys
import io
import csv
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI, Request, Form, Body
from fastapi.responses import HTMLResponse, JSONResponse, Response, FileResponse
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
        "recent_alerts": recent_alerts
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

    return {
        "summary": summary,
        "apps": apps,
        "live_status": live_status,
        "weekly_trend": weekly_trend,
        "study_mode": settings.get("study_mode_active", "false").lower() == "true",
        "emergency_lock": settings.get("emergency_lock", "false").lower() == "true"
    }

@app.get("/api/live-status")
async def get_live_status():
    device_id = database.get_device_id(config.DEVICE_NAME)
    return database.get_live_device_status(device_id)

@app.post("/api/study-mode/toggle")
async def toggle_study_mode():
    current = database.get_setting("study_mode_active", "false").lower() == "true"
    new_state = "false" if current else "true"
    database.set_setting("study_mode_active", new_state)
    return {"success": True, "study_mode_active": new_state == "true"}

@app.post("/api/emergency-lock/toggle")
async def toggle_emergency_lock():
    current = database.get_setting("emergency_lock", "false").lower() == "true"
    new_state = "false" if current else "true"
    database.set_setting("emergency_lock", new_state)
    if new_state == "true":
        try:
            import ctypes
            ctypes.windll.user32.LockWorkStation()
        except Exception:
            pass
    return {"success": True, "emergency_lock": new_state == "true"}

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
    """Serves the compiled Android Mobile App APK."""
    apk_path = Path(__file__).resolve().parent / "static" / "downloads" / "ParentalScreenTracker.apk"
    if not apk_path.exists():
        apk_path = Path(r"F:\ICTBD_02\soft\ParentalScreenTracker.apk")
    if not apk_path.exists():
        return JSONResponse(status_code=404, content={"error": "APK not found."})
    return FileResponse(
        path=str(apk_path),
        filename="ParentalScreenTracker.apk",
        media_type="application/vnd.android.package-archive"
    )

# --- React Native Mobile App API Endpoints ---
@app.get("/api/mobile/dashboard")
async def get_mobile_dashboard():
    """Consolidated JSON state endpoint for the React Native mobile app."""
    device_id = database.get_device_id(config.DEVICE_NAME)
    summary = database.get_today_summary(device_id)
    apps = database.get_today_usage_by_app(device_id)
    rules = database.get_all_rules()
    settings = database.get_all_settings()
    live_status = database.get_live_device_status(device_id)
    weekly_trend = database.get_weekly_trend(device_id)
    recent_logs = database.get_recent_activity_logs(device_id, limit=30)
    recent_alerts = database.get_recent_alerts(device_id, limit=20)

    daily_total_limit_mins = int(settings.get("daily_total_limit_minutes", "240"))
    total_sec = summary["total_seconds"]
    total_limit_sec = daily_total_limit_mins * 60
    total_pct = min(100, int((total_sec / total_limit_sec) * 100)) if total_limit_sec > 0 else 0

    return {
        "device": {
            "name": config.DEVICE_NAME,
            "assigned_child": config.ASSIGNED_CHILD,
            "online": live_status.get("online", False),
            "current_app": live_status.get("current_app", "None"),
            "current_title": live_status.get("current_title", ""),
            "current_category": live_status.get("current_category", "Other"),
            "last_activity_time": live_status.get("last_activity_time", "")
        },
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
            "study_mode_active": settings.get("study_mode_active", "false").lower() == "true",
            "emergency_lock": settings.get("emergency_lock", "false").lower() == "true",
            "study_start_hour": int(settings.get("study_start_hour", "19")),
            "study_end_hour": int(settings.get("study_end_hour", "22")),
            "daily_total_limit_minutes": daily_total_limit_mins
        },
        "weekly_trend": weekly_trend,
        "recent_logs": recent_logs,
        "recent_alerts": recent_alerts
    }

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.app:app", host=config.SERVER_HOST, port=config.SERVER_PORT, reload=True)
