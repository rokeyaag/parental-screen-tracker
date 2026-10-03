# 📱 Parental Screen Tracker - React Native Mobile App

A cross-platform (Android / iOS / Web) mobile application that interfaces directly with the PostgreSQL 16 database and FastAPI server backend for seamless parental oversight.

---

## ✨ Key Features:
1. **Live Monitoring (Home Screen):**
   - Device online/offline pulse indicator.
   - Real-time display of the currently active app and window caption with 5-second polling.
   - **Emergency Screen Lock:** Lock and freeze child's laptop screen from phone with a single tap.
   - **Study Mode Toggle:** Instantly disable gaming and social media apps during homework/study hours.
   - Breakdown cards for Total Screen Time, Gaming, Study & Productivity, and Media.
2. **Rules & Limits Enforcement (Rules Screen):**
   - View and modify daily time limits per application.
   - Quick toggle to permanently block or unblock apps.
   - In-app modal to create rules for newly detected games or applications.
3. **Live Timeline Audit (Timeline Screen):**
   - Chronological audit log of all opened windows (app name, title, category, and session duration).
4. **Alerts & Violation History (Alerts Screen):**
   - Real-time log of 5-minute quota warnings, study mode blocks, and daily time limit enforcements.
5. **Server Connection (Settings Screen):**
   - Configure local IP (e.g., `http://192.168.1.100:8000`) or cloud/tunnel URL with instant latency testing.

---

## 🚀 How to Run Mobile App:

### 1. Install Dependencies:
```bash
cd mobile_app
npm install
```

### 2. Launch the App (Expo / React Native):
```bash
npx expo start
```
- **Android Device:** Download `Expo Go` from Google Play and scan the terminal QR code.
- **Web Browser:** Press `w` in terminal.
- **Android Emulator:** Press `a` in terminal.

### 3. Connect to the Backend Server:
Navigate to the **Settings (🛠️)** tab in the mobile app and configure your host PC's local IP address:
```text
http://[YOUR-PC-LOCAL-IP]:8000
```
Example: `http://192.168.0.105:8000`
*(Ensure both mobile device and PC are on the same local Wi-Fi network, or use ngrok/Cloudflare Tunnel for remote internet access).*
