import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Play, AlertCircle, BarChart3 } from "lucide-react";
import type { StrategyPlugin, BacktestMetrics, TradeRecord, EquPoint } from "@/types";

// ponytail: inline mock data, API-driven when backend endpoint exists
const MOCK_STRATEGIES: StrategyPlugin[] = [
  {
    name: "indicator_cross",
    description: "均线交叉策略：短期均线上穿长期均线买入，下穿卖出",
    params_schema: {
      short_window: { type: "int", default: 5, description: "短期均线窗口" },
      long_window: { type: "int", default: 20, description: "长期均线窗口" },
    },
    enabled: true,
  },
  {
    name: "pe_percentile",
    description: "PE 百分位策略：PE 处于历史低位买入，高位卖出",
    params_schema: {
      low_pct: { type: "float", default: 0.2, description: "低估阈值" },
      high_pct: { type: "float", default: 0.8, description: "高估阈值" },
    },
    enabled: true,
  },
  {
    name: "grid",
    description: "网格策略：价格在网格区间内穿越网格线时触发买入/卖出",
    params_schema: {
      low: { type: "float", required: true, description: "网格下界" },
      high: { type: "float", required: true, description: "网格上界" },
      n_grids: { type: "int", default: 10, description: "网格分段数" },
    },
    enabled: true,
  },
];

interface MockResult {
  metrics: BacktestMetrics;
  trades: TradeRecord[];
  equity: EquPoint[];
}

// ponytail: deterministic-seeded random, replace with real engine
function generateMockResult(): MockResult {
  const equity: EquPoint[] = [];
  let v = 1.0;
  for (let d = 0; d < 120; d++) {
    v += (Math.random() - 0.48) * 0.02;
    const date = new Date(2024, 0, 1);
    date.setDate(date.getDate() + d);
    equity.push({ date: date.toISOString().slice(0, 10), value: Math.round(v * 10000) / 10000 });
  }

  const trades: TradeRecord[] = [];
  for (let i = 0; i < 18; i++) {
    const d = 5 + i * 6 + Math.floor(Math.random() * 3);
    const date = new Date(2024, 0, 1);
    date.setDate(date.getDate() + d);
    const type: "buy" | "sell" = i % 2 === 0 ? "buy" : "sell";
    const price = 1.0 + Math.random() * 0.3;
    trades.push({
      date: date.toISOString().slice(0, 10),
      type,
      price: Math.round(price * 10000) / 10000,
      shares: Math.round(Math.random() * 5000 + 1000),
      amount: Math.round(Math.random() * 8000 + 2000),
    });
  }

  return {
    metrics: {
      total_return: 0.1523,
      annual_return: 0.0891,
      max_drawdown: -0.124,
      win_rate: 0.611,
      sharpe_ratio: 1.34,
      total_trades: 18,
    },
    trades,
    equity,
  };
}

// ── SVG Chart ─────────────────────────────────────────────────────────────
function EquityChart({ equity }: { equity: EquPoint[] }) {
  if (equity.length === 0) return null;

  const vals = equity.map((p) => p.value);
  const dMin = Math.min(...vals);
  const dMax = Math.max(...vals);
  const dRng = dMax - dMin || 1;
  const pad = dRng * 0.08;
  const yMin = dMin - pad;
  const yMax = dMax + pad;
  const yRng = yMax - yMin;

  const cw = 700 - 52 - 14;
  const ch = 220 - 14 - 22;
  const n = equity.length;

  const x = (i: number) => 52 + (n > 1 ? (i / (n - 1)) * cw : cw / 2);
  const yPos = (v: number) => 14 + ch - ((v - yMin) / yRng) * ch;

  const linePts = equity.map((p, i) => `${x(i)},${yPos(p.value)}`).join(" ");
  const areaPts = `${x(0)},${14 + ch} ${linePts} ${x(n - 1)},${14 + ch}`;

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = yMin + yRng * (1 - i / 4);
    return { v: val, y: 14 + (ch * i) / 4 };
  });

  const maxLabels = 6;
  const step = Math.max(1, Math.floor((n - 1) / Math.max(1, maxLabels - 1)));
  const xLabels: { label: string; x: number }[] = [];
  for (let i = 0; i < n; i += step) {
    xLabels.push({ label: equity[i].date.slice(5), x: x(i) });
  }
  if (xLabels.length > 0 && xLabels[xLabels.length - 1].x < x(n - 1) - 10) {
    xLabels.push({ label: equity[n - 1].date.slice(5), x: x(n - 1) });
  }

  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <div className="p-3 border-b border-[var(--border)] text-xs text-gray-400 tracking-wider">净值曲线</div>
      <div className="p-2" style={{ height: 220 }}>
        <svg viewBox="0 0 700 220" className="w-full h-full" role="img">
          <defs>
            <linearGradient id="eq-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={52} y1={t.y} x2={700 - 14} y2={t.y} stroke="var(--border)" strokeWidth={0.5} />
              <text x={46} y={t.y + 4} textAnchor="end" fill="var(--muted)" fontSize="10" fontFamily="JetBrains Mono, monospace">
                {t.v.toFixed(4)}
              </text>
            </g>
          ))}
          {xLabels.map((l, i) => (
            <text key={i} x={l.x} y={206} textAnchor="middle" fill="var(--muted)" fontSize="10" fontFamily="JetBrains Mono, monospace">
              {l.label}
            </text>
          ))}
          <polygon fill="url(#eq-area)" stroke="none" points={areaPts} />
          <polyline fill="none" stroke="var(--accent)" strokeWidth={1.5} points={linePts} />
        </svg>
      </div>
    </div>
  );
}

// ── Strategy Params ────────────────────────────────────────────────────────
function StrategyDetails({ strategy, params, onChange }: {
  strategy: StrategyPlugin;
  params: Record<string, string>;
  onChange: (key: string, val: string) => void;
}) {
  const schema = strategy.params_schema as Record<string, { type: string; default?: unknown; description: string; required?: boolean }>;
  const entries = Object.entries(schema);

  return (
    <div>
      <p className="text-xs text-gray-400 mb-4">{strategy.description}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-gray-500">此策略无需额外参数</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([key, meta]) => (
            <div key={key}>
              <label className="block text-xs text-gray-400 mb-1">
                {key}
                {meta.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <input
                type={meta.type === "int" ? "number" : "text"}
                step={meta.type === "float" ? "0.01" : "1"}
                placeholder={String(meta.default ?? meta.description)}
                value={params[key] ?? ""}
                onChange={(e) => onChange(key, e.target.value)}
                className="w-full bg-[#0d0d11] border border-white/10 text-white text-sm px-3 py-2 outline-none focus:border-[#2b7fff] font-mono"
              />
              <p className="text-xs text-gray-600 mt-0.5">{meta.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Metrics ──────────────────────────────────────────────────────────────
function MetricsCompact({ m }: { m: BacktestMetrics }) {
  const items = [
    { label: "总收益", value: `${(m.total_return * 100).toFixed(2)}%`, c: m.total_return >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "年化", value: `${(m.annual_return * 100).toFixed(2)}%`, c: m.annual_return >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "最大回撤", value: `${(m.max_drawdown * 100).toFixed(2)}%`, c: "text-red-400" },
    { label: "胜率", value: `${(m.win_rate * 100).toFixed(1)}%`, c: "text-white" },
    { label: "夏普", value: m.sharpe_ratio.toFixed(2), c: "text-white" },
    { label: "交易次数", value: String(m.total_trades), c: "text-white" },
  ];
  return (
    <div className="flex gap-2 flex-wrap">
      {items.map((x) => (
        <div key={x.label} className="meta-item flex-1" style={{ minWidth: 90 }}>
          <span className="meta-label">{x.label}</span>
          <span className={`text-sm font-bold font-mono ${x.c}`}>{x.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Trades Table ──────────────────────────────────────────────────────────
function TradesTable({ trades }: { trades: TradeRecord[] }) {
  if (trades.length === 0) {
    return <div className="p-8 text-center text-sm text-gray-500">暂无交易记录</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/5">
            <th className="p-2.5 text-xs font-medium text-gray-400">日期</th>
            <th className="p-2.5 text-xs font-medium text-gray-400">类型</th>
            <th className="p-2.5 text-xs font-medium text-gray-400 text-right">价格</th>
            <th className="p-2.5 text-xs font-medium text-gray-400 text-right">份额</th>
            <th className="p-2.5 text-xs font-medium text-gray-400 text-right">金额</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="p-2.5 text-white font-mono text-xs">{t.date}</td>
              <td className="p-2.5">
                <span className={`text-xs font-medium ${t.type === "buy" ? "text-emerald-400" : "text-red-400"}`}>
                  {t.type === "buy" ? "买入" : "卖出"}
                </span>
              </td>
              <td className="p-2.5 text-gray-300 text-xs text-right font-mono">{t.price.toFixed(4)}</td>
              <td className="p-2.5 text-gray-300 text-xs text-right font-mono">{t.shares.toLocaleString()}</td>
              <td className="p-2.5 text-gray-300 text-xs text-right font-mono">{t.amount.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────
export function Backtest() {
  const { code = "" } = useParams<{ code: string }>();
  const [strategy, setStrategy] = useState("indicator_cross");
  const [params, setParams] = useState<Record<string, string>>({});
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2024-12-31");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MockResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = MOCK_STRATEGIES.find((s) => s.name === strategy)!;

  const handleStrategyChange = (name: string) => {
    setStrategy(name);
    setParams({});
    setResult(null);
    setError(null);
  };

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    await new Promise((r) => setTimeout(r, 800));
    setResult(generateMockResult());
    setRunning(false);
  };

  const canRun = !running;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link to={`/funds/${code}`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> 返回基金详情
      </Link>

      <div className="flex gap-4 items-start" style={{ minHeight: "calc(100vh - 140px)" }}>
        {/* LEFT: config panel */}
        <div className="shrink-0" style={{ width: 300 }}>
          <div className="bg-[#16161E] border border-white/5">
            <div className="p-4 border-b border-white/5 flex items-center gap-2">
              <span className="text-xs text-gray-400 tracking-wider">回测配置</span>
            </div>

            <div className="p-4 space-y-4">
              {/* Strategy select */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5" id="strategy-label">策略</label>
                <select
                  aria-labelledby="strategy-label"
                  value={strategy}
                  onChange={(e) => handleStrategyChange(e.target.value)}
                  className="w-full bg-[#0d0d11] border border-white/10 text-white text-sm px-3 py-2 outline-none focus:border-[#2b7fff] font-mono"
                >
                  {MOCK_STRATEGIES.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <StrategyDetails strategy={current} params={params} onChange={(key, val) => setParams((p) => ({ ...p, [key]: val }))} />

              {/* Date range */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">时间范围</label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full bg-[#0d0d11] border border-white/10 text-white text-sm px-3 py-2 outline-none focus:border-[#2b7fff] font-mono"
                  />
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full bg-[#0d0d11] border border-white/10 text-white text-sm px-3 py-2 outline-none focus:border-[#2b7fff] font-mono"
                  />
                </div>
              </div>

              {/* Run */}
              <button
                onClick={handleRun}
                disabled={!canRun}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  canRun
                    ? "bg-[#2b7fff] text-white hover:bg-[#4a94ff]"
                    : "bg-white/5 text-gray-600 cursor-not-allowed"
                }`}
              >
                <Play size={14} />
                {running ? "运行中..." : "运行回测"}
              </button>

              {running && (
                <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
                  <span className="inline-block w-3 h-3 border-2 border-[#2b7fff] border-t-transparent rounded-full animate-spin" />
                  回测运行中...
                </div>
              )}

              {error && (
                <div className="rounded bg-red-400/10 border border-red-400/20 px-3 py-2 flex items-center gap-2 text-xs text-red-400">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: results */}
        <div className="flex-1 min-w-0 space-y-4">
          {result ? (
            <>
              <MetricsCompact m={result.metrics} />
              <EquityChart equity={result.equity} />
              <div className="bg-[#16161E] border border-white/5">
                <div className="p-3 border-b border-white/5 text-xs text-gray-400 tracking-wider">交易记录</div>
                <TradesTable trades={result.trades} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-sm text-gray-500">在左侧面板配置策略后运行回测</p>
                <p className="text-xs text-gray-600 mt-1">结果将在此处展示</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
