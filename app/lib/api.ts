export function getApiBase() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window === "undefined") return "http://localhost:4000";
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "Không thể kết nối máy chủ." }));
    throw new Error(payload.message || "Không thể kết nối máy chủ.");
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
