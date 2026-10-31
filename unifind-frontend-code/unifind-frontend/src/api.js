const API_URL = "http://localhost:4000/api";
const TOKEN_KEY = "unifind_token";

// Login token helpers (stored in the browser so users stay logged in)
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable: user stays logged in until refresh */
  }
}

export function logout() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

// Create a new account and log in
export async function register(fullName, email, password) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: fullName, email, password }),
  });
  const result = await readJson(response);
  if (!response.ok) throw new Error(result.error || "Could not create the account.");
  saveToken(result.token);
  return result.user;
}

// Log in with email and password
export async function login(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const result = await readJson(response);
  if (!response.ok) throw new Error(result.error || "Could not log in.");
  saveToken(result.token);
  return result.user;
}

// Restore the logged-in user from the saved token
export async function getMe() {
  const response = await fetch(`${API_URL}/auth/me`, { headers: authHeaders() });
  const result = await readJson(response);
  if (!response.ok) throw new Error(result.error || "Not logged in.");
  return result.user;
}

// Reports created by the logged-in user
export async function getMyItems() {
  const response = await fetch(`${API_URL}/my/items`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Failed to load your reports");
  return response.json();
}

// Get reports from the backend
export async function getItems(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.append(key, value);
    }
  });

  const response = await fetch(
    `${API_URL}/items?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Failed to load reports");
  }

  return response.json();
}

// Submit a new Lost or Found report (with an optional photo)
export async function createItem(item, imageFile = null) {
  const body = new FormData();

  Object.entries(item).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      body.append(key, value);
    }
  });

  if (imageFile) {
    body.append("image", imageFile);
  }

  // Do not set Content-Type: the browser adds the multipart boundary.
  const response = await fetch(`${API_URL}/items`, {
    method: "POST",
    headers: authHeaders(),
    body,
  });

  const result = await readJson(response);

  if (!response.ok) {
    throw new Error(result.error || "Failed to submit report");
  }

  return result;
}

// Check backend status
export async function checkBackend() {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new Error("Backend is not responding");
  }

  return response.json();
}