# Parental Screen & Activity Tracker 2.0 (PostgreSQL 16)

An automated, cross-platform parental monitoring and screen-time management system designed to monitor children's computer activities, enforce game and entertainment limits, encourage study habits, and provide comprehensive real-time analytics.

---

## Key Features

1. **Active Application & Smart Browser Monitoring**:
   - Accurately tracks foreground windows and executable names (e.g., `robloxplayerbeta.exe`, `valorant.exe`, `chrome.exe`, `code.exe`).
   - **Smart Category Inference**: Analyzes browser tab titles across Chrome, Edge, and Firefox to automatically categorize activity into Education, Gaming, Browsing, and Social Media (e.g., YouTube, Khan Academy, Wikipedia, Roblox, Poki).
   - **Idle Detection**: Automatically pauses time accumulation when no keyboard or mouse activity is detected for 3+ minutes.

2. **Game & App Quota Enforcement**:
   - Dedicated daily time allowances per game or entertainment application (e.g., Roblox maximum 60 minutes/day).
   - Visual advance warning popup before time expiration.
   - Enforced graceful termination when daily quota is exceeded.
   - Total daily screen-time quota enforcement across all activities.

3. **Study Mode & Instant Emergency Lock**:
   - **Scheduled Study Mode**: Blocks gaming, chat, and distraction apps during designated study hours (e.g., 7:00 PM – 10:00 PM).
   - **Instant Remote Lock**: Parents can lock the child's workstation instantly from the web or mobile dashboard.

4. **Live Screen Monitoring & Periodic Screenshot Captures**:
   - **Visual Proof & Monitoring**: Automatically captures crisp, lightweight HD screenshots (1024x576 JPEG) periodically (every 3 minutes) while the child is active.
   - **Instant On-Demand Capture**: Parents can click "📸 Capture Screen Now" from either the Web Dashboard or React Native Mobile App to capture what's on screen within 3 seconds.
   - **Smart Idle Exemption**: Screen capture automatically pauses when the child is idle or away from the workstation.
   - **Screenshot Gallery & Lightbox**: Interactive gallery with click-to-zoom Lightbox modal and download options on both Web and Mobile.
   - **Bounded Storage Management**: Automatically prunes older screenshots to keep database and memory footprint extremely small (~50KB per capture).

5. **Typed Text & Keystroke History (Never-Lost Memory)**:
   - **Persistent Text Memory**: Automatically captures and reconstructs typed sentences, search queries, notes, and messages in any application (Notepad, Chrome, Edge, Discord, chat, games) and clipboard copies.
   - **Closed Window Protection**: Even if the child deletes the text, closes the browser tab, or exits the application, the typed content remains permanently preserved in PostgreSQL and viewable in the parent dashboard.
   - **Smart Word/Sentence Aggregation**: Buffers keystrokes into readable, coherent text blocks upon sentence completion, Enter press, window switch, or 3-second pause instead of noisy raw keypresses.
   - **Search & Filter Feed**: Parents can search through typed history by keyword or filter by typed text vs. clipboard copy.

6. **Offline Resilience & Auto-Sync**:
   - Zero data loss architecture. Activity logs and keystrokes are buffered in a local SQLite database whenever the network or PostgreSQL server is offline.
   - Automatically synchronizes and drains cached records to PostgreSQL 16 upon reconnection.

7. **Parent Web Dashboard**:
   - Real-time pie charts and 7-day comparative screen time trend bar charts powered by Chart.js.
   - **Live Window Inspector & Screen Viewer**: Monitor active apps, window titles, live screenshots, and typed text in real time.
   - One-click CSV export and report download.
   - Full rule management: add, edit, or remove time limits and process restrictions on the fly.

8. **Cross-Platform Mobile App (React Native)**:
   - Companion mobile application for Android and iOS providing remote monitoring, live screen preview, typed text feed, rule configuration, and instant controls for parents.

9. **Windows Background Client**:
   - Runs silently in the background with automatic Windows Startup registration.
   - Compatible with Windows 11 Smart App Control via signed execution runtime.


---

## Project Structure

```
parental-screen-tracker/
├── config.py                 # Configuration settings and environment parameters
├── database.py               # PostgreSQL connection pool, queries, and migrations
├── models.py                 # SQLAlchemy schemas and database models
├── requirements.txt          # Python dependencies
├── start.bat                 # One-click startup script for server and tracker
├── test_system.py            # End-to-end verification and pipeline test script
├── run_dashboard.py          # Web dashboard FastAPI server entry point
├── run_tracker.py            # Windows background tracking agent entry point
├── windows_client_entry.py   # Windows background runner with autostart and single-instance mutex
├── tracker/
│   ├── window_monitor.py     # Foreground window inspector and idle detection
│   ├── enforcer.py           # Quota enforcer, warning popups, and process controller
│   ├── client.py             # Main tracker client, web categorizer, and database sync
│   └── offline_manager.py    # Local SQLite buffer and offline synchronization engine
├── server/
│   ├── app.py                # FastAPI web backend, REST APIs, and endpoints
│   └── templates/
│       └── dashboard.html    # Modern responsive dashboard web interface
└── mobile_app/               # React Native companion mobile dashboard (Expo)
    ├── App.js                # Mobile app entry and navigation
    ├── package.json          # Mobile dependencies
    └── src/
        ├── api/client.js     # REST API client
        └── screens/          # Home, Rules, Alerts, Timeline, and Settings screens
```

---

## Getting Started

### Prerequisites:
- Python 3.10+
- PostgreSQL 16
- Node.js 18+ (for mobile app)

### 1. Installation
Clone the repository and install the dependencies:
```bash
git clone https://github.com/rokeyaag/parental-screen-tracker.git
cd parental-screen-tracker
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Database
Ensure PostgreSQL 16 is running, then configure your database connection in `config.py` or through environment variables:
```python
DB_NAME = "parental_tracker"
DB_USER = "postgres"
DB_PASSWORD = "your_password"
DB_HOST = "localhost"
DB_PORT = "5432"
```

### 3. Run Pipeline Test
Verify the database connection and tracking pipeline:
```bash
python test_system.py
```

### 4. Start the Web Dashboard
Launch the FastAPI parent dashboard:
```bash
python run_dashboard.py
```
Open your browser and navigate to: [http://localhost:8000](http://localhost:8000)

### 5. Start the Background Tracker
Run the background agent on the child's PC:
```bash
python windows_client_entry.py
```
Or double-click `Start-Tracker.bat` to launch the background service with automatic Windows Startup registration.

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.
