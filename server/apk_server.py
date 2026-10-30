import http.server
import socketserver
import os
import socket
from pathlib import Path

PORT = 8080

candidates = [
    Path(__file__).resolve().parent / "static" / "downloads",
    Path(r"C:\Users\HP\Desktop"),
    Path(r"F:\ICTBD_02\soft"),
]
DIRECTORY = str(next((p for p in candidates if (p / "ParentalScreenTracker.apk").exists()), Path(r"C:\Users\HP\Desktop")))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path in ('/', '/index.html'):
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            html = """<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Parental Screen Tracker - Downloads</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px 12px; text-align: center; }
.card { max-width: 440px; margin: 20px auto; background: #1e293b; border-radius: 20px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
h1 { font-size: 20px; color: #38bdf8; margin-bottom: 6px; }
p { font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 4px 0 16px 0; }
.btn { display: block; margin: 12px 0; background: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 18px; font-size: 16px; font-weight: bold; border-radius: 12px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); text-align: center; }
.btn-green { background: #059669; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.4); }
.btn:active { opacity: 0.9; }
.badge { display: inline-block; background: #064e3b; color: #34d399; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; margin-bottom: 10px; }
.section-title { font-size: 14px; font-weight: bold; color: #cbd5e1; margin-top: 16px; text-align: left; }
</style>
</head>
<body>
<div class="card">
    <div style="font-size: 36px; margin-bottom: 6px;">🛡️</div>
    <span class="badge">Multi-Device Setup Center</span>
    <h1>Parental Screen Tracker</h1>
    <p>Download client software for your child's mobile or laptop/desktop to link with the Main Controller.</p>
    
    <div class="section-title">📱 For Child Android Mobile:</div>
    <a href="/ParentalScreenTracker.apk" class="btn" download>📥 Download Android APK (65 MB)</a>
    <p style="font-size: 11px; color: #64748b; margin-top: -6px;">Install on child's phone &gt; Select "Child Sub-Device" &gt; Enter 6-digit code.</p>

    <div style="height: 1px; background: #334155; margin: 20px 0;"></div>

    <div class="section-title">💻 For Child Windows Laptop / Desktop:</div>
    <a href="/ParentalScreenTracker.exe" class="btn btn-green" download>📥 Download Windows Client (22 MB)</a>
    <a href="/Install-Tracker.bat" style="color: #38bdf8; font-size: 12px; text-decoration: underline;" download>Optional: Download Install-Tracker.bat Helper</a>
    <p style="font-size: 11px; color: #64748b; margin-top: 6px;">Run on Windows PC to start background tracking &amp; pair with code.</p>
</div>
</body>
</html>"""
            self.wfile.write(html.encode('utf-8'))
        else:
            return super().do_GET()

if __name__ == '__main__':
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving APK server on port {PORT} from {DIRECTORY}...")
        httpd.serve_forever()
