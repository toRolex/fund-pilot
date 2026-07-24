import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Download, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import { useHoldings } from "@/hooks/useHoldings";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-40 border border-white/5 bg-[#16161E]" />
      <div className="overflow-hidden border border-white/5">
        <div className="space-y-3 bg-[#16161E] p-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-7 gap-3">
              <div className="h-3.5 bg-[#292936]" />
              <div className="h-3.5 bg-[#292936]" />
              <div className="h-3.5 bg-[#292936]" />
              <div className="h-3.5 bg-[#292936]" />
              <div className="h-3.5 bg-[#292936]" />
              <div className="h-3.5 bg-[#292936]" />
              <div className="h-3.5 bg-[#292936]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Holdings() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Add panel state
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedFund, setSelectedFund] = useState<{ code: string; name: string } | null>(null);
  const [addShares, setAddShares] = useState("");
  const [addCostPrice, setAddCostPrice] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Edit state
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editShares, setEditShares] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");

  // Delete state
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  const {
    data: holdings,
    isLoading,
    isError,
    refetch,
  } = useHoldings();

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim());

    if (headers.includes("fund_code") && headers.includes("shares")) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        await api.importHoldingsFormData(formData);
        queryClient.invalidateQueries({ queryKey: ["holdings"] });
        setImportError(null);
      } catch (err: unknown) {
        setImportError(`导入失败: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    } else {
      setImportError("CSV 格式错误: 需要 fund_code, fund_name, shares, cost_price, current_value 列");
    }

    e.target.value = "";
  };

  const handleExportSampleCSV = () => {
    const csv =
      "fund_code,fund_name,shares,cost_price,current_value\n000001,示例基金A,1000,1.25,1.35\n110001,示例基金B,500,2.0,1.8";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "holdings_sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openAddPanel = () => {
    setSelectedFund(null);
    setAddShares("");
    setAddCostPrice("");
    setAddError(null);
    setShowAddPanel(true);
  };

  const closeAddPanel = () => {
    setShowAddPanel(false);
    setSelectedFund(null);
    setAddShares("");
    setAddCostPrice("");
    setAddError(null);
  };

  const handleAddHolding = async () => {
    if (!selectedFund) return;
    const shares = parseFloat(addShares);
    const costPrice = parseFloat(addCostPrice);
    if (!shares || shares <= 0) { setAddError("请输入有效的持有份额"); return; }
    if (!costPrice || costPrice <= 0) { setAddError("请输入有效的成本均价"); return; }
    setAddLoading(true);
    setAddError(null);
    try {
      await api.addHolding({
        fund_code: selectedFund.code,
        fund_name: selectedFund.name,
        shares,
        cost_price: costPrice,
        current_value: 0,
      });
      closeAddPanel();
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setAddLoading(false);
    }
  };

  const startEdit = (code: string, shares: number, costPrice: number) => {
    setEditingCode(code);
    setEditShares(String(shares));
    setEditCostPrice(String(costPrice));
  };

  const cancelEdit = () => {
    setEditingCode(null);
  };

  const saveEdit = async (code: string) => {
    const shares = parseFloat(editShares);
    const costPrice = parseFloat(editCostPrice);
    if (!shares || shares <= 0) return;
    if (!costPrice || costPrice <= 0) return;
    try {
      await api.updateHolding(code, { shares, cost_price: costPrice });
      setEditingCode(null);
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    } catch (err: unknown) {
      // ponytail: inline error for edit would be nice; toast for now
      console.error("Update failed:", err);
    }
  };

  const handleDelete = async (code: string) => {
    try {
      await api.deleteHolding(code);
      setDeletingCode(null);
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    } catch (err: unknown) {
      console.error("Delete failed:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-xl font-bold text-white">持仓</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-xl font-bold text-white">持仓</h1>
        <ErrorState message="数据加载失败，请检查后端状态后重试" onRetry={() => refetch()} />
      </div>
    );
  }

  const safeHoldings = holdings ?? [];

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold text-white">持仓</h1>

      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={openAddPanel}
          className="btn inline-flex items-center gap-2 border border-white/10 bg-transparent px-3 py-1.5 text-xs text-white transition-colors hover:border-gray-400 hover:bg-white/5"
        >
          <Plus className="h-3.5 w-3.5" />
          添加持仓
        </button>
        <button
          onClick={handleFileSelect}
          className="btn-outline inline-flex items-center gap-2 border border-white/10 bg-transparent px-3 py-1.5 text-xs text-white transition-colors hover:border-gray-400 hover:bg-white/5"
        >
          <Upload className="h-3.5 w-3.5" />
          导入持仓数据
        </button>
        <button
          onClick={handleExportSampleCSV}
          className="ml-2 inline-flex items-center gap-2 border border-white/10 bg-transparent px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-400 hover:bg-white/5 hover:text-white"
          title="下载示例 CSV"
        >
          <Download className="h-3.5 w-3.5" />
          示例
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {importError && (
        <div className="mb-4 border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-400">
          {importError}
        </div>
      )}

      {safeHoldings.length === 0 ? (
        <EmptyState
          icon={<Upload className="h-10 w-10 text-gray-500" />}
          title="持仓数据为空"
          description="导入你的持仓数据以查看盈亏及信号联动分析。支持 CSV 和 JSON 格式。"
          action={null}
        />
      ) : (
        <div className="table-wrap overflow-x-auto border border-white/5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="p-3 text-xs font-medium text-gray-400">代码</th>
                <th className="p-3 text-xs font-medium text-gray-400">名称</th>
                <th className="p-3 text-right text-xs font-medium text-gray-400">持有份额</th>
                <th className="p-3 text-right text-xs font-medium text-gray-400">成本均价</th>
                <th className="p-3 text-right text-xs font-medium text-gray-400">当前市值</th>
                <th className="p-3 text-right text-xs font-medium text-gray-400">盈亏</th>
                <th className="p-3 text-xs font-medium text-gray-400">信号提醒</th>
                <th className="p-3 text-xs font-medium text-gray-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {safeHoldings.map((h) => (
                <tr
                  key={h.fund_code}
                  className="border-b border-white/5 transition-colors hover:bg-white/5"
                >
                  <td className="p-3 font-mono text-xs text-white">{h.fund_code}</td>
                  <td className="p-3 text-xs text-white">{h.fund_name}</td>
                  <td className="p-3 text-right text-xs">
                    {editingCode === h.fund_code ? (
                      <input
                        type="number"
                        value={editShares}
                        onChange={(e) => setEditShares(e.target.value)}
                        className="w-24 bg-root border border-gray-700 px-2 py-1 text-xs text-white text-right"
                      />
                    ) : (
                      <span className="text-gray-300">{h.shares.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="p-3 text-right text-xs">
                    {editingCode === h.fund_code ? (
                      <input
                        type="number"
                        value={editCostPrice}
                        onChange={(e) => setEditCostPrice(e.target.value)}
                        className="w-24 bg-root border border-gray-700 px-2 py-1 text-xs text-white text-right"
                        step="0.0001"
                      />
                    ) : (
                      <span className="text-gray-300">{h.cost_price.toFixed(4)}</span>
                    )}
                  </td>
                  <td className="p-3 text-right text-xs text-gray-300">
                    {h.current_value.toFixed(4)}
                  </td>
                  <td
                    className={`p-3 text-right text-xs font-medium ${
                      h.pl_percent >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {h.pl_percent >= 0 ? "+" : ""}
                    {h.pl_percent.toFixed(2)}%
                  </td>
                  <td className="p-3">
                    {h.has_signal ? (
                      <span
                        className="inline-block h-2 w-2"
                        style={{ backgroundColor: "var(--accent)" }}
                        title="有活跃信号"
                      />
                    ) : (
                      <span className="text-xs text-gray-500">&mdash;</span>
                    )}
                  </td>
                  <td className="p-3">
                    {editingCode === h.fund_code ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(h.fund_code)}
                          className="text-xs text-emerald-400 hover:text-emerald-300"
                        >
                          保存
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-xs text-gray-400 hover:text-white"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(h.fund_code, h.shares, h.cost_price)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => setDeletingCode(h.fund_code)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add holding side panel ── */}
      {showAddPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={closeAddPanel} />
          <div className="relative w-[400px] bg-surface border-l border-white/10 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <h2 className="text-sm font-semibold text-white">添加持仓</h2>
              <button onClick={closeAddPanel} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              <GlobalSearch
                onSelect={(fund) => {
                  setSelectedFund(fund);
                  setAddError(null);
                }}
              />
              {selectedFund && (
                <div className="mt-4 space-y-3">
                  <div className="rounded border border-white/5 bg-root px-3 py-2">
                    <div className="text-xs text-gray-400">已选基金</div>
                    <div className="text-sm text-white">
                      {selectedFund.code} — {selectedFund.name}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">持有份额</label>
                    <input
                      type="number"
                      value={addShares}
                      onChange={(e) => setAddShares(e.target.value)}
                      className="w-full border border-gray-700 bg-root px-3 py-1.5 text-sm text-white outline-none focus:border-gray-500"
                      placeholder="输入持有份额"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">成本均价</label>
                    <input
                      type="number"
                      value={addCostPrice}
                      onChange={(e) => setAddCostPrice(e.target.value)}
                      className="w-full border border-gray-700 bg-root px-3 py-1.5 text-sm text-white outline-none focus:border-gray-500"
                      placeholder="输入成本均价"
                      step="0.0001"
                    />
                  </div>
                  {addError && (
                    <div className="border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-400">
                      {addError}
                    </div>
                  )}
                  <button
                    onClick={handleAddHolding}
                    disabled={addLoading}
                    className="btn-primary w-full px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    {addLoading ? "提交中..." : "确认添加"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation overlay ── */}
      {deletingCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeletingCode(null)} />
          <div className="relative border border-white/10 bg-surface p-6 shadow-2xl">
            <p className="mb-4 text-sm text-white">确认删除该持仓记录？</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingCode(null)}
                className="border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deletingCode)}
                className="border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/30"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
