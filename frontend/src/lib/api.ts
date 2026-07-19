import type { Fund, SignalResponse, StrategyLog, StrategyPlugin, SystemStatus } from "@/types";

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

async function requestPUT<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
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
  getSignals: (code?: string) =>
    request<SignalResponse[]>(`/signals${code ? `?code=${code}` : ""}`),
  getStrategies: () => request<StrategyPlugin[]>("/strategies"),
  toggleStrategy: (name: string, enabled: boolean) =>
    requestPUT<StrategyPlugin>(`/strategies/${encodeURIComponent(name)}`, { enabled }),
  getStrategyLogs: () => request<StrategyLog[]>("/strategies/logs"),
  getStatus: () => request<SystemStatus>("/status"),
};
