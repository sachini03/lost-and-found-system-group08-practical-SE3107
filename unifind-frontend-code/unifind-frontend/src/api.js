const API_URL = "http://localhost:4000/api";

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

// Submit a new Lost or Found report
export async function createItem(item) {
  const response = await fetch(`${API_URL}/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(item),
  });

  const result = await response.json();

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