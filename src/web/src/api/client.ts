const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL = configuredBaseUrl?.replace(/\/+$/, '') ?? '';

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(apiUrl(path), init);
}
