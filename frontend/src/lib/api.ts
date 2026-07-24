import type { Fund, FundDetail, FundDetailResponse, Holding, HoldingResponse, NavPoint, QdiiPredictResponse, SearchResult, SignalResponse, StrategyLog, StrategyPlugin, StrategyState, SystemStatus } from "@/types";

const BASE = "/api";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function requestJSON<T>(path: string, body: unknown, method: string = "POST"): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
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

async function requestFormData<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", body });
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
  searchFunds: (q: string) => request<SearchResult[]>(`/funds/search?q=${encodeURIComponent(q)}`),
  getSignals: (code?: string) =>
    request<SignalResponse[]>(`/signals${code ? `?fund_code=${code}` : ""}`),
  getStrategies: () => request<StrategyPlugin[]>("/strategies"),
  toggleStrategy: (name: string, enabled: boolean) =>
    requestPUT<StrategyPlugin>(`/strategies/${encodeURIComponent(name)}`, { enabled }),
  getStrategyLogs: () => request<StrategyLog[]>("/strategies/logs"),
  getStatus: () => request<SystemStatus>("/status"),
  getFundDetail: (code: string) => request<FundDetail>(`/funds/${code}`),
  getFundDetailMerged: (code: string) => request<FundDetailResponse>(`/funds/${code}/detail`),
  getFundSignals: (code: string) => request<SignalResponse[]>(`/funds/${code}/signals`),
  getFundNav: (code: string) => request<NavPoint[]>(`/funds/${code}/nav`),
  getFundStrategies: (code: string) => request<StrategyState[]>(`/funds/${code}/strategies`),
  toggleFundStrategy: (code: string, strategy: string) =>
    requestJSON<{ name: string; enabled: boolean }>(
      `/funds/${code}/strategies/${strategy}`,
      {},
    ),
  getHoldings: () => request<HoldingResponse[]>("/holdings"),
  addHolding: (data: { fund_code: string; fund_name: string; shares: number; cost_price: number; current_value: number }) =>
    requestJSON<Holding>("/holdings", data),
  updateHolding: (code: string, data: { shares: number; cost_price: number }) =>
    requestPUT<Holding>(`/holdings/${code}`, data),
  deleteHolding: (code: string) => requestDel(`/holdings/${code}`),
  importHoldings: (body: unknown) => requestJSON<{ imported: number }>("/holdings/import", body),
  importHoldingsFormData: (formData: FormData) =>
    requestFormData<{ imported: number }>("/holdings/import", formData),
  getQdiiPredict: (code: string) => request<QdiiPredictResponse>(`/qdii/${code}`),
  runSignals: () => requestJSON<{ status: string }>("/signals/run", {}),
};
