import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BacktestMetrics, EquPoint, TradeRecord } from "@/types";

interface RunBacktestParams {
  fund_code: string;
  strategy: string;
  params: Record<string, string>;
  start_date: string;
  end_date: string;
}

interface BacktestResult {
  metrics: BacktestMetrics;
  trades: TradeRecord[];
  equity: EquPoint[];
}

export function useBacktest() {
  return useMutation<BacktestResult, Error, RunBacktestParams>({
    mutationFn: async (input) => {
      const raw = await api.runBacktest(input);
      return {
        metrics: {
          total_return: raw.metrics.total_return,
          annual_return: raw.metrics.annualized_return,
          max_drawdown: raw.metrics.max_drawdown,
          win_rate: raw.metrics.win_rate,
          sharpe_ratio: raw.metrics.sharpe_ratio,
          total_trades: raw.metrics.total_trades,
        },
        trades: raw.trades,
        equity: raw.equity_curve.map((p) => ({ date: p.date, value: p.total_value })),
      };
    },
  });
}
