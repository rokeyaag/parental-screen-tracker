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
  // Current active LAN Wi-Fi IP of host PC
  return 'http://192.168.0.103:8000';
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

const fetchWithTimeout = async (url, options = {}, timeoutMs = 7000) => {
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
  }
};
