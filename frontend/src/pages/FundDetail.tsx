import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SignalBadge } from "@/components/SignalBadge";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import { ErrorState } from "@/components/ErrorState";
import { NavChart } from "@/components/NavChart";
import type { SignalResponse, StrategyState } from "@/types";
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

      {/* Backtest entry */}
      <Link
        to={`/funds/${fund.code}/backtest`}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#2b7fff] text-white hover:bg-[#4a94ff] transition-colors mb-4"
      >
        回测
      </Link>

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
