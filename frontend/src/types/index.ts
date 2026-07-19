export type SignalType = "buy" | "sell" | "hold";

export interface Fund {
  code: string;
  name: string;
  type?: string;
}

export interface Signal {
  fund_code: string;
  strategy: string;
  type: SignalType;
  date: string;
  reason?: string;
}

export interface Watchlist {
  id: string;
  name: string;
  fund_codes: string[];
}

export interface SearchResult extends Fund {
  is_watched: boolean;
}

export interface StrategyPlugin {
  name: string;
  description: string;
  params?: Record<string, unknown>;
}
