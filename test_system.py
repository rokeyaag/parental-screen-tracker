import sys
import time
import database
import config

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def test_full_pipeline():
    print("[1] Initializing Database...")
    database.init_db()

    device_id = database.get_device_id(config.DEVICE_NAME)
    print(f"[2] Device ID for {config.DEVICE_NAME}: {device_id}")

    print("[3] Simulating and logging activities...")
    test_batch = [
        ("robloxplayerbeta.exe", "Roblox - Brookhaven", "Gaming", 1200),  # 20 mins
        ("chrome.exe", "YouTube - Science Tutorial", "Browsing/Video", 1800), # 30 mins
        ("code.exe", "index.html - Visual Studio Code", "Education/Study", 2700), # 45 mins
        ("notepad.exe", "Homework.txt - Notepad", "Education/Study", 900), # 15 mins
    ]
    database.save_activity_batch(device_id, test_batch)
    print("   Activity logs inserted into PostgreSQL successfully.")

    print("[4] Testing Today Summary Query...")
    summary = database.get_today_summary(device_id)
    print(f"   Total Screen Time: {summary['total_seconds']} seconds ({summary['total_seconds']//60} mins)")
    print(f"   Gaming Time: {summary['gaming_seconds']} seconds ({summary['gaming_seconds']//60} mins)")
    print(f"   Study Time: {summary['study_seconds']} seconds ({summary['study_seconds']//60} mins)")
    print(f"   Browsing Time: {summary['browsing_seconds']} seconds ({summary['browsing_seconds']//60} mins)")

    assert summary['gaming_seconds'] >= 1200, "Gaming seconds should be at least 1200"
    assert summary['study_seconds'] >= 3600, "Study seconds should be at least 3600"

    print("[5] Testing App Breakdown Query...")
    apps = database.get_today_usage_by_app(device_id)
    for app in apps:
        print(f"   - {app['app_name']} ({app['process_name']}): {app['total_seconds']//60} mins | Limit: {app['daily_limit_minutes']}m | Blocked: {app['is_blocked']}")

    print("[6] Testing Rules Update...")
    database.upsert_rule("robloxplayerbeta.exe", "Roblox", "Gaming", 45, False)
    rules = database.get_rule_map()
    assert rules["robloxplayerbeta.exe"]["daily_limit_minutes"] == 45
    print("   Rule updated successfully: Roblox daily limit set to 45 mins.")

    print("[7] Testing Alert Logging & Retrieval...")
    database.log_alert(device_id, "robloxplayerbeta.exe", "limit_warning", "৫ মিনিট বাকি আছে।")
    alerts = database.get_recent_alerts(device_id, limit=5)
    assert len(alerts) > 0, "Alerts list should not be empty"
    print(f"   Alert logged and retrieved: {alerts[0]['message']}")

    print("[8] Testing Weekly Trend Query...")
    weekly = database.get_weekly_trend(device_id)
    print(f"   Weekly records found: {len(weekly)} days")

    print("[9] Testing Live Device Status...")
    status = database.get_live_device_status(device_id)
    print(f"   Live status: App={status['current_app']}, Online={status['online']}")

    print("[10] Testing System Settings...")
    settings = database.get_all_settings()
    print(f"   Configured settings count: {len(settings)}")

    print("\n[SUCCESS] ALL VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_pipeline()
