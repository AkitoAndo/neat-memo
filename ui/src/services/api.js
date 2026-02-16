import { auth } from './auth.js';

const API_ENDPOINT = (window.ENV && window.ENV.API_ENDPOINT) || "";

export const Api = {
  async request(method, path, body = null) {
    if (!API_ENDPOINT) {
        console.warn("API Endpoint not set. Using LocalStorage fallback (not fully implemented).");
        return null;
    }

    let token;
    try {
        const session = await auth.fetchAuthSession();
        token = session.tokens?.idToken?.toString();
    } catch (e) {
        console.error("Session error", e);
        throw new Error("Not authenticated");
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': token
    };

    const response = await fetch(`${API_ENDPOINT}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });

    if (!response.ok) {
        if (response.status === 401) {
            await auth.signOut();
            window.location.reload();
        }
        throw new Error(`API Error: ${response.status}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }
};
