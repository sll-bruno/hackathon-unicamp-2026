const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim();

/**
 * Origem da API. Vazio significa caminhos relativos — é o modo usado em deploy,
 * porque o rewrite de /api do vercel.json encaminha para a Railway sem depender
 * de CORS (a API só libera a origem de produção, não as de preview).
 * Preencher VITE_API_URL só faz sentido com a origem já liberada no backend.
 */
export const API_BASE_URL = configuredBaseUrl?.replace(/\/+$/, '') ?? '';

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}

// Enquanto a API não expõe os endpoints no formato que estas telas esperam,
// o front usa dados simulados. Para usar a API real: VITE_USE_MOCKS=false npm run dev
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false';

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(`/api${path}`);
  if (!res.ok) throw new Error(`GET /api${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const simulateLatency = <T,>(value: T, ms = 250) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
