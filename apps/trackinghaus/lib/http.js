export function setNoStore(response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
}

export function json(response, status, body) {
  setNoStore(response);
  return response.status(status).json(body);
}

export function parseBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body);
  return {};
}

export function methodNotAllowed(response, allowed) {
  response.setHeader("Allow", allowed.join(", "));
  return json(response, 405, { error: "method_not_allowed" });
}
