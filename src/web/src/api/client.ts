// Enquanto a API não expõe os endpoints, o front usa dados simulados.
// Para usar a API real: VITE_USE_MOCKS=false npm run dev
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false';

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`GET /api${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const simulateLatency = <T,>(value: T, ms = 250) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
