import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SignalBadge } from "@/components/SignalBadge";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import { ErrorState } from "@/components/ErrorState";
import { NavChart, type NavChartHandle } from "@/components/NavChart";
import { StrategyPanel, DETAIL_PANEL_STRATEGIES } from "@/components/StrategyPanel";
import type { SignalResponse } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { useFundDetail, useSetFundStrategy } from "@/hooks/useFund";
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

  // T6 键盘快捷键：←/→ 平移 · 1–5 切换区间 · E/V/N 开关策略 · ? 帮助
  const [showShortcuts, setShowShortcuts] = useState(false);
  const navRef = useRef<NavChartHandle>(null);
  const setStrategy = useSetFundStrategy(code ?? "");

  // 通过 ref 读取最新策略态，避免键盘监听器反复重挂
  const strategiesRef = useRef(merged?.strategies);
  strategiesRef.current = merged?.strategies;

  const toggleStrategyRef = useRef<(name: string) => void>(() => {});
  toggleStrategyRef.current = (name: string) => {
    const list = strategiesRef.current ?? [];
    if (!list.some((s) => s.name === name)) return;
    const s = list.find((x) => x.name === name);
    setStrategy.mutate({ name, enabled: !(s?.enabled ?? false) });
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "ArrowLeft":
          if (navRef.current) {
            e.preventDefault();
            navRef.current.pan(-1);
          }
          break;
        case "ArrowRight":
          if (navRef.current) {
            e.preventDefault();
            navRef.current.pan(1);
          }
          break;
        case "1":
          navRef.current?.setRange("1m");
          break;
        case "2":
          navRef.current?.setRange("3m");
          break;
        case "3":
          navRef.current?.setRange("6m");
          break;
        case "4":
          navRef.current?.setRange("1y");
          break;
        case "5":
          navRef.current?.setRange("all");
          break;
        case "e":
        case "E":
          toggleStrategyRef.current("indicator_cross");
          break;
        case "v":
        case "V":
          toggleStrategyRef.current("pe_percentile");
          break;
        case "n":
        case "N":
          toggleStrategyRef.current("grid");
          break;
        case "?":
          setShowShortcuts((v) => !v);
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  // 仅渲染已启用的面板策略信号：关闭策略 → 图上标记与右侧信号流隐去；
  // multi_fund（momentum）信号不在详情页展示。
  const enabledPanelStrategies = new Set(
    (strategies ?? [])
      .filter((s) => s.enabled && s.name in DETAIL_PANEL_STRATEGIES)
      .map((s) => s.name),
  );
  const visibleSignals = (signals ?? []).filter((s) =>
    enabledPanelStrategies.has(s.strategy_name),
  );

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

      {/* 键盘快捷键帮助（T6） */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowShortcuts((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-300 border border-white/10 hover:text-white transition-colors"
        >
          快捷键 <span className="text-gray-500">?</span>
        </button>
        {showShortcuts && (
          <div
            data-testid="shortcut-help"
            className="mt-2 max-w-md space-y-1 border border-white/10 bg-[#16161E] p-3 text-xs text-gray-400"
          >
            <div>
              <kbd>←</kbd>/<kbd>→</kbd> 平移净值图时间窗口
            </div>
            <div>
              <kbd>1</kbd>–<kbd>5</kbd> 切换快捷区间：近1月 / 近3月 / 近半年 / 近1年 / 全部
            </div>
            <div>
              <kbd>E</kbd> 均线 · <kbd>V</kbd> PE 估值 · <kbd>N</kbd> 网格（再次按下关闭）
            </div>
            <div>
              <kbd>?</kbd> 打开/关闭本帮助
            </div>
          </div>
        )}
      </div>

      {/* Main content area */}
      {fund.type?.includes("QDII") && <QdiiPredictCard code={fund.code} />}
      <div className="content-grid">
        <div className="main-col">
          <NavChart ref={navRef} nav={nav ?? []} signals={visibleSignals} />
          <div>
            <h2 className="mb-3 text-sm font-semibold text-white">历史信号</h2>
            <SignalTable signals={visibleSignals} />
          </div>
        </div>
        <div>
          <StrategyPanel strategies={strategies ?? []} code={code ?? ""} />
        </div>
      </div>
    </div>
  );
}
