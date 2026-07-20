import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SignalBadge } from "./SignalBadge";
import { ConfidenceBar } from "../components/ConfidenceBar";

type SortKey = "fund_code" | "fund_name" | "signal_type" | "confidence" | "daily_change";

function useSignals() {
  return useQuery({
    queryKey: ["signals"],
    queryFn: () => api.getSignals(),
  });
}

export function Dashboard() {
  const { data: signals, isLoading, isError, refetch } = useSignals();
  const [sortKey, setSortKey] = useState<SortKey>("fund_code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="page-heading">信号仪表盘</h1>
        <div className="skel" style={{ width: 180, height: 22, marginBottom: 16 }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex gap-3 py-2 border-b border-[var(--border)]"
          >
            <div className="skel flex-[2]" />
            <div className="skel flex-1" />
            <div className="skel flex-1" />
            <div className="skel flex-[1.5]" />
            <div className="skel flex-1" />
            <div className="skel" style={{ width: 80 }} />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <h1 className="page-heading">信号仪表盘</h1>
        <div className="error-state visible">
          <div className="error-icon">&#9650;</div>
          <div className="error-title">数据加载失败</div>
          <div className="error-desc">
            无法连接后台服务，请检查后端状态后重试。
          </div>
          <button className="btn btn-primary" onClick={() => refetch()}>
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

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  }

  const hasSignals = buyCount + sellCount + holdCount > 0;

  return (
    <div className="p-6">
      <h1 className="page-heading">信号仪表盘</h1>

      <div className="stats-row">
        <div className="stat-badge buy">
          <span className="count">{buyCount}</span>
          <span className="label">买入</span>
        </div>
        <div className="stat-badge sell">
          <span className="count">{sellCount}</span>
          <span className="label">卖出</span>
        </div>
        <div className="stat-badge hold">
          <span className="count">{holdCount}</span>
          <span className="label">持有</span>
        </div>
        <div className="stat-badge total">
          <span className="label">共 {totalFunds} 只基金</span>
        </div>
      </div>

      {!hasSignals ? (
        <div className="empty-state visible">
          <div className="empty-icon">&#9670;</div>
          <div className="empty-title">暂无信号数据</div>
          <div className="empty-desc">
            策略正在运行，尚未生成信号。请等待策略完成首次分析。
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th
                  data-col="code"
                  className={sortKey === "fund_code" ? "sorted" : ""}
                  onClick={() => toggleSort("fund_code")}
                >
                  代码 <span className="sort-arrow">{sortArrow("fund_code")}</span>
                </th>
                <th
                  data-col="name"
                  className={sortKey === "fund_name" ? "sorted" : ""}
                  onClick={() => toggleSort("fund_name")}
                >
                  基金名称{" "}
                  <span className="sort-arrow">{sortArrow("fund_name")}</span>
                </th>
                <th
                  data-col="change"
                  className={
                    "num" + (sortKey === "daily_change" ? " sorted" : "")
                  }
                  onClick={() => toggleSort("daily_change")}
                >
                  日涨跌{" "}
                  <span className="sort-arrow">
                    {sortArrow("daily_change")}
                  </span>
                </th>
                <th
                  data-col="signal"
                  className={sortKey === "signal_type" ? "sorted" : ""}
                  onClick={() => toggleSort("signal_type")}
                >
                  最新信号{" "}
                  <span className="sort-arrow">
                    {sortArrow("signal_type")}
                  </span>
                </th>
                <th data-col="strategy">策略来源</th>
                <th
                  data-col="confidence"
                  className={
                    "num" + (sortKey === "confidence" ? " sorted" : "")
                  }
                  onClick={() => toggleSort("confidence")}
                >
                  置信度{" "}
                  <span className="sort-arrow">
                    {sortArrow("confidence")}
                  </span>
                </th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((signal) => (
                <tr
                  key={`${signal.fund_code}-${signal.strategy_name}`}
                  onClick={() => navigate(`/funds/${signal.fund_code}`)}
                >
                  <td>{signal.fund_code}</td>
                  <td>{signal.fund_name}</td>
                  <td
                    className={
                      "num" + (signal.daily_change >= 0 ? " green" : " red")
                    }
                  >
                    {signal.daily_change > 0 ? "+" : ""}
                    {signal.daily_change.toFixed(2)}%
                  </td>
                  <td>
                    <SignalBadge
                      type={signal.signal_type}
                      confidence={signal.confidence}
                      strategy={signal.strategy_name}
                    />
                  </td>
                  <td>{signal.strategy_name}</td>
                  <td className="num">
                    <ConfidenceBar value={signal.confidence} />
                  </td>
                  <td>
                    <a
                      href={`/funds/${signal.fund_code}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        color: "var(--accent)",
                        fontSize: "var(--fs-tiny)",
                        cursor: "pointer",
                      }}
                    >
                      查看
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
