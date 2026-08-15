async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "request_failed");
    error.status = response.status;
    error.code = body.error;
    throw error;
  }
  return body;
}

export function loadWeekly() {
  return request("/api/weekly");
}
