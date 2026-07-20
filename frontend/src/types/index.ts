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
  enabled: boolean;
}

export interface StrategyLog {
  timestamp: string;
  message: string;
}

export interface SystemStatus {
  last_update: string | null;
  strategies_running: number;
  funds_watched: number;
  connected: boolean;
}

export interface FundDetail extends Fund {
  type: string;
  scale: number | null;
  established_date: string | null;
  latest_nav: number;
  latest_nav_date: string | null;
  daily_change: number;
}

export interface NavPoint {
  date: string;
  netvalue: number;
}

export interface StrategyState {
  name: string;
  description: string;
  enabled: boolean;
}

export interface Holding {
  fund_code: string;
  fund_name: string;
  shares: number;
  cost_price: number;
  current_value: number;
}

export interface HoldingResponse extends Holding {
  cost_basis: number;
  pl_amount: number;
  pl_percent: number;
  has_signal: boolean;
}
