// Thin typed fetch wrapper around the CRM API.
//
// One place owns the base URL, JSON headers, and error handling so screens call
// e.g. `api.get<Campaign[]>("/api/campaigns")` and get typed results back.

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!resp.ok) {
    // FastAPI returns { detail: "..." } on errors; surface it if present.
    let detail = resp.statusText;
    try {
      const body = await resp.json();
      detail = body.detail ?? detail;
    } catch {
      /* non-JSON error body — keep statusText */
    }
    throw new ApiError(resp.status, detail);
  }

  // 204 No Content guard.
  if (resp.status === 204) return undefined as T;
  return resp.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
};
