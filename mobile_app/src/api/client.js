// Mobile API Client for Parental Screen Tracker

let API_BASE_URL = 'http://10.0.2.2:8000'; // Default for Android emulator (or LAN IP for physical device)

export const setApiBaseUrl = (url) => {
  API_BASE_URL = url.replace(/\/$/, '');
};

export const getApiBaseUrl = () => API_BASE_URL;

export const api = {
  async getDashboard() {
    const res = await fetch(`${API_BASE_URL}/api/mobile/dashboard`);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  },

  async toggleStudyMode() {
    const res = await fetch(`${API_BASE_URL}/api/study-mode/toggle`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  },

  async toggleEmergencyLock() {
    const res = await fetch(`${API_BASE_URL}/api/emergency-lock/toggle`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  },

  async saveRule(rule) {
    const res = await fetch(`${API_BASE_URL}/api/mobile/rules/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  },

  async deleteRule(processName) {
    const res = await fetch(`${API_BASE_URL}/api/mobile/rules/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ process_name: processName }),
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  },

  async updateSettings(settings) {
    const res = await fetch(`${API_BASE_URL}/api/mobile/settings/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  }
};
