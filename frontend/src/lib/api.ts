import type { Fund } from "@/types";

const BASE = "/api";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function requestJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function requestDel(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  getFunds: (
    sortBy: string = "code",
    sortDir: string = "asc",
  ) => request<Fund[]>(`/funds?sort_by=${sortBy}&sort_dir=${sortDir}`),
  addFund: (code: string) => requestJSON<Fund>("/funds", { code }),
  removeFund: (code: string) => requestDel(`/funds/${code}`),
  searchFunds: (q: string) => request<Fund[]>(`/funds/search?q=${encodeURIComponent(q)}`),
};
