import Constants from 'expo-constants';

export const detectInitialBaseUrl = () => {
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      Constants.manifest?.debuggerHost ||
      Constants.manifest2?.extra?.expoGo?.debuggerHost;

    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:8000`;
      }
    }
  } catch (e) {
    // fallback
  }
  // Production Cloud URL on Vercel
  return 'https://parental-screen-tracker.vercel.app';
};

let API_BASE_URL = detectInitialBaseUrl();

export const setApiBaseUrl = (url) => {
  if (!url) return;
  API_BASE_URL = url.trim().replace(/\/$/, '');
};

export const getApiBaseUrl = () => API_BASE_URL;

export const resetToDetectedBaseUrl = () => {
  API_BASE_URL = detectInitialBaseUrl();
  return API_BASE_URL;
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Connection timed out (${timeoutMs / 1000}s). Verify server is running at ${API_BASE_URL}`);
    }
    throw err;
  }
};

export const api = {
  async getDashboard() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/mobile/dashboard`);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  },

  async toggleStudyMode() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/study-mode/toggle`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  },

  async toggleEmergencyLock() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/emergency-lock/toggle`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  },

  async saveRule(rule) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/mobile/rules/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  },

  async deleteRule(processName) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/mobile/rules/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ process_name: processName }),
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  },

  async updateSettings(settings) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/mobile/settings/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  },

  async requestScreenshot() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/screenshots/request`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  },

  async getRecentScreenshots(limit = 15) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/screenshots/recent?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  },

  async getLatestScreenshot() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/screenshots/latest`);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  },

  async getKeystrokes(limit = 30, query = '', logType = '') {
    let url = `${API_BASE_URL}/api/keystrokes?limit=${limit}`;
    if (query) url += `&q=${encodeURIComponent(query)}`;
    if (logType) url += `&log_type=${encodeURIComponent(logType)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  }
};

