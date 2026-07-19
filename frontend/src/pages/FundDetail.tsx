import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceDot, CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";
import { SignalBadge } from "./SignalBadge";
import type { NavPoint, SignalResponse, SignalType } from "@/types";

function useFundDetail(code: string) {
  return useQuery({
    queryKey: ["fund", code],
    queryFn: () => api.getFundDetail(code),
    enabled: !!code,
  });
}

function useFundNav(code: string) {
  return useQuery({
    queryKey: ["fund-nav", code],
    queryFn: () => api.getFundNav(code),
    enabled: !!code,
  });
}

function useFundSignals(code: string) {
  return useQuery({
    queryKey: ["fund-signals", code],
    queryFn: () => api.getFundSignals(code),
    enabled: !!code,
  });
}

function useFundStrategies(code: string) {
  return useQuery({
    queryKey: ["fund-strategies", code],
    queryFn: () => api.getFundStrategies(code),
    enabled: !!code,
  });
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 w-48 rounded bg-white/5" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-white/5 border border-white/5" />
        ))}
      </div>
      <div className="h-72 rounded-lg bg-white/5 border border-white/5" />
      <div className="h-48 rounded-lg bg-white/5 border border-white/5" />
    </div>
  );
}

function formatNavDate(dateStr: string): string {
  // Show MM-DD for compact x-axis labels
  return dateStr.slice(5);
}

function computeRangeChange(points: NavPoint[]): { first: number; last: number; pct: number } {
  if (points.length < 2) return { first: 0, last: 0, pct: 0 };
  const first = points[0].netvalue;
  const last = points[points.length - 1].netvalue;
  const pct = first !== 0 ? round(((last - first) / first) * 100, 2) : 0;
  return { first, last, pct };
}

function round(v: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

const SIGNAL_COLORS: Record<SignalType, string> = {
  buy: "#34d399",
  sell: "#fb923c",
  hold: "#facc15",
};

interface SignalMarker {
  date: string;
  netvalue: number;
  signal_type: SignalType;
  strategy_name: string;
}

function buildSignalMarkers(nav: NavPoint[], signals: SignalResponse[]): SignalMarker[] {
  const navMap = new Map<string, number>();
  for (const p of nav) navMap.set(p.date, p.netvalue);

  const markers: SignalMarker[] = [];
  for (const s of signals) {
    const netvalue = navMap.get(s.date);
    if (netvalue != null) {
      markers.push({ date: s.date, netvalue, signal_type: s.signal_type, strategy_name: s.strategy_name });
    }
  }
  return markers;
}

function NavChart({ nav, signals }: { nav: NavPoint[]; signals: SignalResponse[] }) {
  const markers = buildSignalMarkers(nav, signals);
  const range = computeRangeChange(nav);
  const rangeColor = range.pct >= 0 ? "text-emerald-400" : "text-orange-400";

  return (
    <div className="rounded-lg bg-[#16161E] border border-white/5 p-4">
      <h2 className="mb-4 text-sm font-semibold text-white">净值走势</h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={nav} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatNavDate}
            stroke="rgba(255,255,255,0.2)"
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={["auto", "auto"]}
            stroke="rgba(255,255,255,0.2)"
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
            width={60}
          />
          <Tooltip
            contentStyle={{
              background: "#1a1a2e",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelFormatter={(d: string) => d}
          />
          <Line
            type="monotone"
            dataKey="netvalue"
            stroke="#818cf8"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#818cf8" }}
          />
          {markers.map((m, i) => (
            <ReferenceDot
              key={`${m.date}-${i}`}
              x={m.date}
              y={m.netvalue}
              r={5}
              fill={SIGNAL_COLORS[m.signal_type]}
              stroke="none"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" /> 买入
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-400" /> 卖出
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400" /> 持有
        </span>
      </div>

      {/* Footer info */}
      {nav.length > 0 && (
        <div className="mt-3 flex items-center gap-3 border-t border-white/5 pt-3 text-xs text-gray-500">
          <span>{nav[0].date} ~ {nav[nav.length - 1].date}</span>
          <span className={rangeColor}>
            区间涨跌: {range.pct > 0 ? "+" : ""}{range.pct}%
          </span>
        </div>
      )}
    </div>
  );
}

function SignalTable({ signals }: { signals: SignalResponse[] }) {
  if (signals.length === 0) {
    return (
      <div className="rounded-lg bg-[#16161E] border border-white/5 p-8 text-center text-sm text-gray-500">
        暂无历史信号
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[#16161E] border border-white/5 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/5">
            <th className="p-3 text-xs font-medium text-gray-400">日期</th>
            <th className="p-3 text-xs font-medium text-gray-400">策略</th>
            <th className="p-3 text-xs font-medium text-gray-400">信号</th>
            <th className="p-3 text-xs font-medium text-gray-400">置信度</th>
            <th className="p-3 text-xs font-medium text-gray-400">策略详情</th>
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
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${
                        s.confidence >= 0.7 ? "bg-emerald-400" : s.confidence >= 0.4 ? "bg-yellow-400" : "bg-gray-400"
                      }`}
                      style={{ width: `${Math.round(s.confidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{Math.round(s.confidence * 100)}%</span>
                </div>
              </td>
              <td className="p-3 text-gray-400 text-xs">{s.strategy_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StrategiesSidebar({ code }: { code: string }) {
  const queryClient = useQueryClient();
  const { data: strategies, isLoading } = useFundStrategies(code);

  const toggleMutation = useMutation({
    mutationFn: (name: string) => api.toggleFundStrategy(code, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fund-strategies", code] });
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-lg bg-[#16161E] border border-white/5 p-4 animate-pulse">
        <div className="h-4 w-24 rounded bg-white/5 mb-4" />
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-12 rounded bg-white/5" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[#16161E] border border-white/5 p-4">
      <h2 className="mb-4 text-sm font-semibold text-white">运行策略</h2>
      {(!strategies || strategies.length === 0) ? (
        <p className="text-xs text-gray-500">暂无策略</p>
      ) : (
        <div className="space-y-3">
          {strategies.map((s) => (
            <div key={s.name} className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{s.name}</p>
                <p className="text-xs text-gray-500 truncate">{s.description}</p>
              </div>
              <button
                onClick={() => toggleMutation.mutate(s.name)}
                disabled={toggleMutation.isPending}
                className="shrink-0 ml-2 text-gray-400 hover:text-white transition-colors"
                title={s.enabled ? "禁用" : "启用"}
              >
                {s.enabled ? <ToggleRight className="h-5 w-5 text-emerald-400" /> : <ToggleLeft className="h-5 w-5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FundDetail() {
  const { code } = useParams<{ code: string }>();
  const { data: fund, isLoading, isError, error, refetch } = useFundDetail(code ?? "");
  const { data: nav } = useFundNav(code ?? "");
  const { data: signals } = useFundSignals(code ?? "");

  if (isLoading) return <LoadingSkeleton />;

  if (isError) {
    const is404 = error instanceof Error && error.message.includes("404");
    return (
      <div className="p-6">
        <a href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> 返回仪表盘
        </a>
        <div className="flex flex-col items-center gap-4 rounded-lg bg-[#16161E] border border-white/5 p-12">
          <p className="text-gray-400">
            {is404 ? `基金 ${code} 不存在` : "加载失败，请重试"}
          </p>
          {!is404 && (
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> 重试
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!fund) return null;

  const changeColor = fund.daily_change > 0
    ? "text-red-400"
    : fund.daily_change < 0
      ? "text-green-400"
      : "text-gray-400";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back link */}
      <a href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> 返回仪表盘
      </a>

      {/* Fund meta info bar */}
      <div className="mb-6 rounded-lg bg-[#16161E] border border-white/5 p-4">
        <div className="flex items-baseline gap-3 mb-4">
          <h1 className="text-xl font-bold text-white">{fund.name}</h1>
          <span className="font-mono text-xs text-gray-500">{fund.code}</span>
          {fund.type && <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-gray-400">{fund.type}</span>}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <MetaItem label="最新净值" value={fund.latest_nav.toFixed(4)} />
          <MetaItem label="日涨跌" value={`${fund.daily_change > 0 ? "+" : ""}${fund.daily_change}%`} className={changeColor} />
          <MetaItem label="净值日期" value={fund.latest_nav_date ?? "-"} />
          <MetaItem label="规模" value={fund.scale != null ? `${fund.scale}亿` : "-"} />
          <MetaItem label="成立日期" value={fund.established_date ?? "-"} />
          <MetaItem label="基金类型" value={fund.type || "-"} />
        </div>
      </div>

      {/* Main content area: chart + table | sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3 space-y-6">
          <NavChart nav={nav ?? []} signals={signals ?? []} />
          <div>
            <h2 className="mb-3 text-sm font-semibold text-white">历史信号</h2>
            <SignalTable signals={signals ?? []} />
          </div>
        </div>
        <div className="lg:col-span-1">
          <StrategiesSidebar code={code ?? ""} />
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-sm font-medium text-white ${className ?? ""}`}>{value}</p>
    </div>
  );
}
