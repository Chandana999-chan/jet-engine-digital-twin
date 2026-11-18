import { API_BASE_URL } from "./api";

async function request(path, options = {}) {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || `Request failed: ${response.status}`
    );
  }

  return data;
}

export const simulationApi = {
  info: (engineId) =>
    request(`/simulation/${engineId}/info`),

  state: (engineId) =>
    request(`/simulation/${engineId}/state`),

  start: (engineId, speed = 1) =>
    request(`/simulation/${engineId}/start`, {
      method: "POST",
      body: JSON.stringify({ speed }),
    }),

  pause: (engineId) =>
    request(`/simulation/${engineId}/pause`, {
      method: "POST",
    }),

  resume: (engineId) =>
    request(`/simulation/${engineId}/resume`, {
      method: "POST",
    }),

  reset: (engineId) =>
    request(`/simulation/${engineId}/reset`, {
      method: "POST",
    }),

  cycle: (engineId, cycle) =>
    request(`/simulation/${engineId}/cycle`, {
      method: "POST",
      body: JSON.stringify({ cycle }),
    }),

  speed: (engineId, speed) =>
    request(`/simulation/${engineId}/speed`, {
      method: "POST",
      body: JSON.stringify({ speed }),
    }),

  scenario: (engineId, name, overrides, shutdown = false) =>
    request(`/simulation/${engineId}/scenario`, {
      method: "POST",
      body: JSON.stringify({
        name,
        overrides,
        shutdown,
      }),
    }),

  clearScenario: (engineId) =>
    request(`/simulation/${engineId}/scenario`, {
      method: "DELETE",
    }),
};