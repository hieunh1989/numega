export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "Unable to connect to the server." }));
    throw new Error(payload.message || "Unable to connect to the server.");
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
