import { useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SignalBadge, SignalBuyMarker, SignalSellMarker, SignalHoldMarker } from "@/components/SignalBadge";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import { ErrorState } from "@/components/ErrorState";
import type { NavPoint, SignalResponse, SignalType, StrategyState } from "@/types";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useFundDetail,
  useToggleFundStrategy,
} from "@/hooks/useFund";
import { api } from "@/lib/api";

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 w-48 bg-white/5" />
      <div className="flex gap-3 flex-wrap">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-16 min-w-[130px] flex-1 bg-white/5 border border-white/5" />
        ))}
      </div>
      <div className="h-72 bg-white/5 border border-white/5" />
      <div className="h-48 bg-white/5 border border-white/5" />
    </div>
  );
}

function round(v: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

// ── SVG Chart ──────────────────────────────────────────────────────────────
const CHART_W = 700;
const CHART_H = 280;
const PAD_L = 52;
const PAD_R = 14;
const PAD_T = 18;
const PAD_B = 26;

function fmtTick(v: number): string {
  if (Math.abs(v) >= 100) return v.toFixed(1);
  if (Math.abs(v) >= 10) return v.toFixed(2);
  if (Math.abs(v) >= 1) return v.toFixed(3);
  return v.toFixed(4);
}

interface ChartLayout {
  linePts: string;
  areaPts: string;
  yTicks: { v: number; y: number }[];
  xLabels: { label: string; x: number }[];
  markers: { x: number; y: number; type: SignalType }[];
  firstVal: number;
  lastVal: number;
  firstDate: string;
  lastDate: string;
}

function computeChartLayout(nav: NavPoint[], signals: SignalResponse[]): ChartLayout | null {
  if (nav.length === 0) return null;

  const vals = nav.map((p) => p.netvalue);
  const dMin = Math.min(...vals);
  const dMax = Math.max(...vals);
  const dRng = dMax - dMin || 1;
  const pad = dRng * 0.1;
  const yMin = dMin - pad;
  const yMax = dMax + pad;
  const yRng = yMax - yMin;

  const cw = CHART_W - PAD_L - PAD_R;
  const ch = CHART_H - PAD_T - PAD_B;
  const n = nav.length;

  const x = (i: number) => PAD_L + (n > 1 ? (i / (n - 1)) * cw : cw / 2);
  const y = (v: number) => PAD_T + ch - ((v - yMin) / yRng) * ch;

  const linePts = nav.map((p, i) => `${x(i)},${y(p.netvalue)}`).join(" ");
  const areaPts = `${x(0)},${PAD_T + ch} ${linePts} ${x(n - 1)},${PAD_T + ch}`;

  const yTicks = Array.from({ length: 6 }, (_, i) => ({
    v: yMin + yRng * (1 - i / 5),
    y: PAD_T + (ch * i) / 5,
  }));

  const maxLabels = Math.min(8, n);
  const step = Math.max(1, Math.floor((n - 1) / Math.max(1, maxLabels - 1)));
  const xLabels: { label: string; x: number }[] = [];
  for (let i = 0; i < n; i += step) {
    xLabels.push({ label: nav[i].date.slice(5), x: x(i) });
  }
  if (xLabels.length > 0 && xLabels[xLabels.length - 1].x < x(n - 1) - 10) {
    xLabels.push({ label: nav[n - 1].date.slice(5), x: x(n - 1) });
  }

  const navMap = new Map(nav.map((p, i) => [p.date, i]));
  const markers: { x: number; y: number; type: SignalType }[] = [];
  for (const s of signals) {
    const idx = navMap.get(s.date);
    if (idx != null) {
      markers.push({ x: x(idx), y: y(nav[idx].netvalue), type: s.signal_type });
    }
  }

  return { linePts, areaPts, yTicks, xLabels, markers, firstVal: vals[0], lastVal: vals[vals.length - 1], firstDate: nav[0].date, lastDate: nav[n - 1].date };
}

function NavChart({ nav, signals }: { nav: NavPoint[]; signals: SignalResponse[] }) {
  const layout = useMemo(() => computeChartLayout(nav, signals), [nav, signals]);

  if (!layout) {
    return (
      <div style={{ border: "1px solid var(--border)", background: "var(--surface)", padding: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="chart-title">净值走势（含信号标记）</div>
        <div className="flex items-center justify-center" style={{ height: 260, fontSize: "var(--fs-tiny)", color: "var(--muted)" }}>
          暂无净值数据
        </div>
      </div>
    );
  }

  const rangePct = layout.firstVal !== 0 ? round(((layout.lastVal - layout.firstVal) / layout.firstVal) * 100, 2) : 0;
  const rangeColor = rangePct >= 0 ? "#26c99e" : "#e8844a";

  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--surface)", padding: "var(--space-4)", marginBottom: "var(--space-4)" }}>
      <div className="chart-title">净值走势（含信号标记）</div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label="净值走势图">
          <defs>
            <linearGradient id="nav-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.15} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {layout.yTicks.map((t, i) => (
            <g key={`yt-${i}`}>
              <line x1={PAD_L} y1={t.y} x2={CHART_W - PAD_R} y2={t.y} stroke="var(--border)" strokeWidth={0.5} />
              <text x={PAD_L - 6} y={t.y + 4} textAnchor="end" fill="var(--muted)" fontSize="10" fontFamily="JetBrains Mono, monospace">
                {fmtTick(t.v)}
              </text>
            </g>
          ))}
          {layout.xLabels.map((l, i) => (
            <text key={`xl-${i}`} x={l.x} y={CHART_H - 6} textAnchor="middle" fill="var(--muted)" fontSize="10" fontFamily="JetBrains Mono, monospace">
              {l.label}
            </text>
          ))}
          <polyline fill="url(#nav-area-grad)" stroke="none" points={layout.areaPts} />
          <polyline fill="none" stroke="var(--accent)" strokeWidth={1.5} points={layout.linePts} />
          {layout.markers.map((m, i) => {
            switch (m.type) {
              case "buy": return <SignalBuyMarker key={i} cx={m.x} cy={m.y} />;
              case "sell": return <SignalSellMarker key={i} cx={m.x} cy={m.y} />;
              case "hold": return <SignalHoldMarker key={i} cx={m.x} cy={m.y} />;
            }
          })}
        </svg>
      </div>
      <div className="chart-legend">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, background: "var(--signal-buy)", display: "inline-block" }} /> 买入
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "8px solid var(--signal-sell)" }} /> 卖出
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, background: "var(--signal-hold)", display: "inline-block" }} /> 持有
        </span>
      </div>
      <div className="chart-footer">
        <span>{layout.firstDate} ~ {layout.lastDate}</span>
        <span style={{ color: rangeColor }}>
          区间涨跌: {rangePct > 0 ? "+" : ""}{rangePct}%
        </span>
      </div>
    </div>
  );
}

// ── Signal Table ───────────────────────────────────────────────────────────
function SignalTable({ signals }: { signals: SignalResponse[] }) {
  if (signals.length === 0) {
    return (
      <div className=" bg-[#16161E] border border-white/5 p-8 text-center text-sm text-gray-500">
        暂无历史信号
      </div>
    );
  }

  return (
    <div className=" bg-[#16161E] border border-white/5 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/5">
            <th className="p-3 text-xs font-medium text-gray-400">日期时间</th>
            <th className="p-3 text-xs font-medium text-gray-400">策略</th>
            <th className="p-3 text-xs font-medium text-gray-400">信号</th>
            <th className="p-3 text-xs font-medium text-gray-400 text-right">置信度</th>
            <th className="p-3 text-xs font-medium text-gray-400">详情</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((s, i) => (
            <tr key={`${s.date}-${s.strategy_name}-${i}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="p-3 text-white font-mono text-xs">{s.date}</td>
              <td className="p-3 text-gray-300 text-xs">{s.strategy_name}</td>
              <td className="p-3">
                <SignalBadge type={s.signal_type} confidence={s.confidence} strategy={s.strategy_name} />
              </td>
              <td className="p-3 text-right">
                <ConfidenceBar value={s.confidence} />
              </td>
              <td className="p-3 text-gray-400 text-xs">{s.daily_change ? `${s.daily_change > 0 ? "+" : ""}${s.daily_change}%` : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Strategy Sidebar (CSS toggle) ────────────────────────────────────────────
function StrategiesSidebar({ strategies, code }: { strategies: StrategyState[]; code: string }) {
  const toggleMutation = useToggleFundStrategy(code);

  return (
    <div className=" bg-[#16161E] border border-white/5 p-4">
      <div className="text-xs text-gray-400 mb-4 tracking-wider">运行策略</div>
      {(!strategies || strategies.length === 0) ? (
        <p className="text-xs text-gray-500">暂无策略</p>
      ) : (
        <div>
          {strategies.map((s) => (
            <div key={s.name} style={{ padding: "var(--space-3) 0", borderBottom: "1px solid var(--border)" }}>
              <div className="text-sm font-medium text-white mb-1">{s.name}</div>
              <div className="text-xs text-gray-400 mb-2">{s.description}</div>
              <div className="toggle-wrap">
                <div
                  className={`toggle${s.enabled ? " active" : ""}`}
                  onClick={() => toggleMutation.mutate(s.name)}
                  role="switch"
                  aria-checked={s.enabled}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleMutation.mutate(s.name); } }}
                />
                <span className="toggle-label">{s.enabled ? "已启用" : "已禁用"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── QDII Prediction Card ─────────────────────────────────────────────────────
function QdiiPredictCard({ code }: { code: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["qdii-predict", code],
    queryFn: () => api.getQdiiPredict(code),
    enabled: !!code,
  });

  if (isLoading) {
    return (
      <div className="bg-[#16161E] border border-white/5 rounded p-4 mb-4 animate-pulse">
        <div className="h-3 w-24 bg-white/5 mb-3" />
        <div className="h-4 w-40 bg-white/5" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-[#16161E] border border-white/5 rounded p-4 mb-4" data-testid="qdii-error">
        <div className="text-xs text-gray-400 mb-1">QDII 净值预测</div>
        <div className="text-xs text-gray-500">预测数据暂时不可用</div>
      </div>
    );
  }

  return (
    <div className="bg-[#16161E] border border-white/5 rounded p-4 mb-4" data-testid="qdii-card">
      <div className="text-xs text-gray-400 mb-3 tracking-wider">QDII 净值预测</div>
      <div className="flex gap-6">
        <div>
          <span className="text-xs text-gray-500">T-1 预测</span>
          <div className="text-sm text-white font-mono mt-0.5">
            {data.t1_value.toFixed(4)}
            <span className="text-xs text-gray-500 ml-2">{data.t1_date}</span>
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-500">T-0 预测</span>
          <div className="text-sm text-white font-mono mt-0.5">
            {data.t0_value.toFixed(4)}
            <span className="text-xs text-gray-500 ml-2">{data.t0_date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Fund Detail Page ────────────────────────────────────────────────────────
export function FundDetail() {
  const { code } = useParams<{ code: string }>();
  const { data: merged, isLoading, isError, error, refetch } = useFundDetail(code ?? "");

  if (isLoading) return <LoadingSkeleton />;

  if (isError) {
    const is404 = error instanceof Error && error.message.includes("404");
    return (
      <div className="p-6">
        <a href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> 返回仪表盘
        </a>
        <ErrorState
          message={is404 ? `基金 ${code} 不存在` : "加载失败，请重试"}
          onRetry={is404 ? undefined : () => refetch()}
        />
      </div>
    );
  }

  if (!merged) return null;

  const fund = merged.detail;
  const nav = merged.nav;
  const signals = merged.signals;
  const strategies = merged.strategies;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back link */}
      <a href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> 返回仪表盘
      </a>

      {/* Meta info bar – prototype style */}
      <div className="meta-bar">
        <div className="meta-item">
          <span className="meta-label">基金名称</span>
          <span className="meta-value">{fund.name}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">代码</span>
          <span className="meta-value" style={{ color: "var(--accent)" }}>{fund.code}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">类型</span>
          <span className="meta-value">{fund.type || "-"}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">规模</span>
          <span className="meta-value">{fund.scale != null ? `${fund.scale}亿` : "-"}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">成立日期</span>
          <span className="meta-value">{fund.established_date ?? "-"}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">最新净值</span>
          <span className="meta-value">{fund.latest_nav.toFixed(4)}</span>
        </div>
      </div>

      {/* Main content area */}
      {fund.type?.includes("QDII") && <QdiiPredictCard code={fund.code} />}
      <div className="content-grid">
        <div className="main-col">
          <NavChart nav={nav ?? []} signals={signals ?? []} />
          <div>
            <h2 className="mb-3 text-sm font-semibold text-white">历史信号</h2>
            <SignalTable signals={signals ?? []} />
          </div>
        </div>
        <div>
          <StrategiesSidebar strategies={strategies} code={code ?? ""} />
        </div>
      </div>
    </div>
  );
}
