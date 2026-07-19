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

export interface SignalResponse {
  date: string;
  fund_code: string;
  fund_name: string;
  strategy_name: string;
  signal_type: SignalType;
  confidence: number;
  daily_change: number;
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
  params_schema: Record<string, unknown>;
}
