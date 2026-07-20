import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Download, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { HoldingResponse } from "@/types";

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 rounded-lg bg-[#16161E] border border-white/5 w-40" />
      <div className="h-64 rounded-lg bg-[#16161E] border border-white/5" />
    </div>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg bg-[#16161E] border border-white/5 p-12">
      <Upload className="h-10 w-10 text-gray-500" />
      <p className="text-gray-400">暂无持仓数据</p>
      <p className="text-sm text-gray-500">导入 CSV 或 JSON 格式的持仓数据开始分析</p>
      <button
        onClick={onImport}
        className="inline-flex items-center gap-2 rounded bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition-colors"
      >
        <Upload className="h-4 w-4" />
        导入持仓
      </button>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg bg-[#16161E] border border-white/5 p-12">
      <AlertCircle className="h-10 w-10 text-red-400" />
      <p className="text-gray-400">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition-colors"
      >
        重试
      </button>
    </div>
  );
}

export function Holdings() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const {
    data: holdings,
    isLoading,
    isError,
    refetch,
  } = useQuery<HoldingResponse[]>({
    queryKey: ["holdings"],
    queryFn: () => api.getHoldings(),
  });

  const importMutation = useMutation({
    mutationFn: (body: unknown) => api.importHoldings(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      setImportError(null);
    },
    onError: (err: Error) => {
      setImportError(`导入失败: ${err.message}`);
    },
  });

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
      // CSV detected — send as file upload
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/holdings/import", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Import failed" }));
          throw new Error(err.detail || "Import failed");
        }
        queryClient.invalidateQueries({ queryKey: ["holdings"] });
        setImportError(null);
      } catch (err: unknown) {
        setImportError(`导入失败: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    } else {
      setImportError("CSV 格式错误: 需要 fund_code, fund_name, shares, cost_price, current_value 列");
    }

    // Reset file input so the same file can be re-selected
    e.target.value = "";
  };

  const handleExportSampleCSV = () => {
    const csv = "fund_code,fund_name,shares,cost_price,current_value\n000001,示例基金A,1000,1.25,1.35\n110001,示例基金B,500,2.0,1.8";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "holdings_sample.csv";
    a.click();
    URL.revokeObjectURL(url);
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
        <ErrorState message="加载失败，请重试" onRetry={() => refetch()} />
      </div>
    );
  }

  const safeHoldings = holdings ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">持仓</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportSampleCSV}
            className="inline-flex items-center gap-2 rounded bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="下载示例 CSV"
          >
            <Download className="h-3.5 w-3.5" />
            示例
          </button>
          <button
            onClick={handleFileSelect}
            className="inline-flex items-center gap-2 rounded bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 transition-colors"
          >
            <Upload className="h-4 w-4" />
            导入持仓
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {importError && (
        <div className="mb-4 rounded-lg bg-red-400/10 border border-red-400/20 px-4 py-2 text-sm text-red-400">
          {importError}
        </div>
      )}

      {safeHoldings.length === 0 ? (
        <EmptyState onImport={handleFileSelect} />
      ) : (
        <div className="overflow-x-auto rounded-lg bg-[#16161E] border border-white/5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="p-3 text-xs font-medium text-gray-400">代码</th>
                <th className="p-3 text-xs font-medium text-gray-400">名称</th>
                <th className="p-3 text-xs font-medium text-gray-400 text-right">持有份额</th>
                <th className="p-3 text-xs font-medium text-gray-400 text-right">成本均价</th>
                <th className="p-3 text-xs font-medium text-gray-400 text-right">当前市值</th>
                <th className="p-3 text-xs font-medium text-gray-400 text-right">成本金额</th>
                <th className="p-3 text-xs font-medium text-gray-400 text-right">盈亏</th>
                <th className="p-3 text-xs font-medium text-gray-400 text-right">盈亏%</th>
                <th className="p-3 text-xs font-medium text-gray-400">信号</th>
              </tr>
            </thead>
            <tbody>
              {safeHoldings.map((h) => (
                <tr
                  key={h.fund_code}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="p-3 text-white font-mono text-xs">{h.fund_code}</td>
                  <td className="p-3 text-white text-xs">{h.fund_name}</td>
                  <td className="p-3 text-gray-300 text-xs text-right">{h.shares.toLocaleString()}</td>
                  <td className="p-3 text-gray-300 text-xs text-right">{h.cost_price.toFixed(4)}</td>
                  <td className="p-3 text-gray-300 text-xs text-right">{h.current_value.toFixed(4)}</td>
                  <td className="p-3 text-gray-300 text-xs text-right">{h.cost_basis.toFixed(2)}</td>
                  <td className={`p-3 text-xs font-medium text-right ${h.pl_amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {h.pl_amount >= 0 ? "+" : ""}
                    {h.pl_amount.toFixed(2)}
                  </td>
                  <td className={`p-3 text-xs font-medium text-right ${h.pl_percent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {h.pl_percent >= 0 ? "+" : ""}
                    {h.pl_percent.toFixed(2)}%
                  </td>
                  <td className="p-3">
                    {h.has_signal ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-400/20 text-emerald-400 border border-emerald-400/30 px-2 py-0.5 text-xs font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        信号
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">--</span>
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
