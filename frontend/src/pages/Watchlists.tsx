import { useState, useEffect, useRef } from "react";
import { Search, Plus, X } from "lucide-react";
import { SignalBadge } from "@/components/SignalBadge";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useWatchlist, useAddFund, useRemoveFund } from "@/hooks/useWatchlist";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFundSearch } from "@/hooks/useFundSearch";

export function Watchlists() {
  const [searchQuery, setSearchQuery] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const addPanelRef = useRef<HTMLDivElement>(null);

  const { data: items, isLoading, isError, refetch } = useWatchlist();
  const removeMutation = useRemoveFund();
  const addMutation = useAddFund();

  const debouncedAddSearch = useDebouncedValue(addSearch, 300);
  const trimmedAddSearch = debouncedAddSearch.trim();
  const { data: addResults = [] } = useFundSearch(trimmedAddSearch);

  // Close add panel on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addPanelRef.current && !addPanelRef.current.contains(e.target as Node)) {
        setShowAddPanel(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleAddFund = (code: string) => {
    addMutation.mutate(code, {
      onSuccess: () => {
        setAddSearch("");
        setShowAddPanel(false);
      },
    });
  };

  const safeItems = items ?? [];
  const filtered = searchQuery.trim()
    ? safeItems.filter(
        (f) =>
          f.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : safeItems;

  return (
    <div className="p-6">
      <h1 className="page-heading">观察列表</h1>

      {/* Header: search + add button */}
      <div className="wl-header flex gap-3 mb-4 items-center">
        <div className="wl-search flex-1 max-w-[400px]">
          <input
            className="w-full h-7 px-2 bg-[var(--elevated)] border border-transparent text-[var(--fg)] font-mono text-xs outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
            placeholder="筛选基金..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          className="btn text-xs"
          style={{
            color: "var(--accent)",
            borderColor: "var(--accent)",
            background: "transparent",
          }}
          onClick={() => setShowAddPanel((v) => !v)}
        >
          <Plus size={14} />
          添加基金
        </button>
      </div>

      {/* Add fund panel */}
      {showAddPanel && (
        <div ref={addPanelRef} className="relative mb-4">
          <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] px-3 py-2">
            <Search size={16} className="text-[var(--muted)] shrink-0" />
            <input
              className="flex-1 bg-transparent text-[var(--fg)] outline-none text-xs placeholder:text-[var(--muted)] font-mono"
              placeholder="搜索基金代码或名称..."
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              autoFocus
            />
            {addSearch && (
              <button
                onClick={() => {
                  setAddSearch("");
                }}
              >
                <X size={14} className="text-[var(--muted)]" />
              </button>
            )}
          </div>
          {addResults.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full bg-[var(--surface)] border border-[var(--border)] shadow-lg max-h-48 overflow-y-auto">
              {addResults.map((fund) => (
                <button
                  key={fund.code}
                  className="w-full text-left px-3 py-2 text-[var(--fg)] hover:bg-[var(--hover)] flex justify-between items-center text-xs"
                  onClick={() => handleAddFund(fund.code)}
                >
                  <span className="font-mono">{fund.code}</span>
                  <span className="text-[var(--fg-2)]">{fund.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content area */}
      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : safeItems.length === 0 ? (
        <EmptyState
          icon={"≡"}
          title="观察列表为空"
          description="开始你的量化信号之旅 — 搜索并添加你的第一只基金到观察列表。"
          action={
            <button className="btn btn-primary" onClick={() => setShowAddPanel(true)}>
              添加基金
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={"⇓"}
          title="无匹配结果"
          description="没有找到匹配的基金。尝试使用基金代码或名称关键词搜索。"
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th data-col="code">代码 <span className="sort-arrow">&#8593;</span></th>
                <th data-col="name">基金名称 <span className="sort-arrow">&#8597;</span></th>
                <th data-col="change" className="num">日涨跌 <span className="sort-arrow">&#8597;</span></th>
                <th data-col="signal">最新信号 <span className="sort-arrow">&#8597;</span></th>
                <th data-col="strategy">策略来源 <span className="sort-arrow">&#8597;</span></th>
                <th data-col="confidence" className="num">置信度 <span className="sort-arrow">&#8597;</span></th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.code}>
                  <td className="font-mono">{item.code}</td>
                  <td>{item.name}</td>
                  <td className={`num ${item.daily_change >= 0 ? "green" : "red"}`}>
                    {item.daily_change > 0 ? "+" : ""}
                    {item.daily_change.toFixed(2)}%
                  </td>
                  <td>
                    <SignalBadge
                      type={item.signal_type}
                      confidence={item.confidence}
                      strategy={item.strategy_name}
                    />
                  </td>
                  <td>{item.strategy_name}</td>
                  <td className="num">
                    <ConfidenceBar value={item.confidence} />
                  </td>
                  <td>
                    {removeConfirm === item.code ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--fg-2)]">确认删除？</span>
                        <button
                          className="px-2 py-1 text-xs bg-red-500 text-white hover:bg-red-600"
                          onClick={() => {
                            removeMutation.mutate(item.code, {
                              onSuccess: () => setRemoveConfirm(null),
                            });
                          }}
                          disabled={removeMutation.isPending}
                        >
                          确认
                        </button>
                        <button
                          className="px-2 py-1 text-xs bg-gray-600 text-white hover:bg-gray-500"
                          onClick={() => setRemoveConfirm(null)}
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        className="remove-btn"
                        onClick={() => setRemoveConfirm(item.code)}
                        title="移除"
                      >
                        移除
                      </button>
                    )}
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
