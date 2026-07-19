import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { SignalBadge } from "./SignalBadge";

type SortKey = "fund_code" | "fund_name" | "signal_type" | "confidence" | "daily_change";

function useSignals() {
  return useQuery({
    queryKey: ["signals"],
    queryFn: () => api.getSignals(),
  });
}

function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-lg bg-[#16161E] border border-white/5 p-4 flex flex-col items-center gap-1">
      <span className={`text-2xl font-bold ${color}`}>{count}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-[#16161E] border border-white/5" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-[#16161E] border border-white/5" />
    </div>
  );
}

const SORT_LABELS: Record<SortKey, string> = {
  fund_code: "基金代码",
  fund_name: "基金名称",
  signal_type: "信号",
  confidence: "置信度",
  daily_change: "日涨跌",
};

export function Dashboard() {
  const { data: signals, isLoading, isError, refetch } = useSignals();
  const [sortKey, setSortKey] = useState<SortKey>("fund_code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-xl font-bold text-white">信号仪表盘</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-xl font-bold text-white">信号仪表盘</h1>
        <div className="flex flex-col items-center gap-4 rounded-lg bg-[#16161E] border border-white/5 p-12">
          <p className="text-gray-400">加载失败，请重试</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            重试
          </button>
        </div>
      </div>
    );
  }

  const safeSignals = signals ?? [];
  const buyCount = safeSignals.filter((s) => s.signal_type === "buy").length;
  const sellCount = safeSignals.filter((s) => s.signal_type === "sell").length;
  const holdCount = safeSignals.filter((s) => s.signal_type === "hold").length;
  const totalFunds = new Set(safeSignals.map((s) => s.fund_code)).size;
  // If some funds have no signal, they count as hold
  const displayHoldCount = holdCount; // ponytail: simple count, cross-ref with watchlist total if accuracy matters

  const sorted = [...safeSignals].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "fund_code":
        cmp = a.fund_code.localeCompare(b.fund_code);
        break;
      case "fund_name":
        cmp = a.fund_name.localeCompare(b.fund_name);
        break;
      case "signal_type":
        cmp = a.signal_type.localeCompare(b.signal_type);
        break;
      case "confidence":
        cmp = a.confidence - b.confidence;
        break;
      case "daily_change":
        cmp = a.daily_change - b.daily_change;
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortHeader({ sortKey: key }: { sortKey: SortKey }) {
    const active = sortKey === key;
    return (
      <button
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-white transition-colors"
      >
        {SORT_LABELS[key]}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold text-white">信号仪表盘</h1>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <SummaryCard label="基金总数" count={totalFunds} color="text-white" />
        <SummaryCard label="买入" count={buyCount} color="text-emerald-400" />
        <SummaryCard label="卖出" count={sellCount} color="text-orange-400" />
        <SummaryCard label="持有" count={displayHoldCount} color="text-yellow-400" />
      </div>

      {/* Table */}
      {safeSignals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-[#16161E] border border-white/5 p-12">
          <p className="text-gray-400">策略运行中，暂无信号</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-[#16161E] border border-white/5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="p-3">
                  <SortHeader sortKey="fund_code" />
                </th>
                <th className="p-3">
                  <SortHeader sortKey="fund_name" />
                </th>
                <th className="p-3">
                  <SortHeader sortKey="daily_change" />
                </th>
                <th className="p-3">
                  <SortHeader sortKey="signal_type" />
                </th>
                <th className="p-3 text-xs font-medium text-gray-400">策略</th>
                <th className="p-3">
                  <SortHeader sortKey="confidence" />
                </th>
                <th className="p-3 text-xs font-medium text-gray-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((signal) => (
                <tr
                  key={`${signal.fund_code}-${signal.strategy_name}`}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => {
                    // ponytail: navigate to fund detail, link when that page exists
                    window.location.href = `/funds/${signal.fund_code}`;
                  }}
                >
                  <td className="p-3 text-white font-mono text-xs">{signal.fund_code}</td>
                  <td className="p-3 text-white text-xs">{signal.fund_name}</td>
                  <td className="p-3">
                    <span
                      className={`text-xs font-medium ${
                        signal.daily_change > 0
                          ? "text-red-400"
                          : signal.daily_change < 0
                            ? "text-green-400"
                            : "text-gray-400"
                      }`}
                    >
                      {signal.daily_change > 0 ? "+" : ""}
                      {signal.daily_change}%
                    </span>
                  </td>
                  <td className="p-3">
                    <SignalBadge
                      type={signal.signal_type}
                      confidence={signal.confidence}
                      strategy={signal.strategy_name}
                    />
                  </td>
                  <td className="p-3 text-gray-400 text-xs">{signal.strategy_name}</td>
                  <td className="p-3">
                    <ConfidenceBar value={signal.confidence} />
                  </td>
                  <td className="p-3">
                    <a
                      href={`/funds/${signal.fund_code}`}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      详情
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? "bg-emerald-400" : pct >= 40 ? "bg-yellow-400" : "bg-gray-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400">{pct}%</span>
    </div>
  );
}
