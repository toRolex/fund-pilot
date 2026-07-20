import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Download } from "lucide-react";
import { api } from "@/lib/api";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import type { HoldingResponse } from "@/types";

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

      <div className="import-section mb-4">
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
          action={
            <button
              onClick={handleFileSelect}
              className="inline-flex items-center gap-2 border border-white/10 bg-transparent px-4 py-2 text-sm text-white transition-colors hover:border-gray-400 hover:bg-white/5"
            >
              <Upload className="h-4 w-4" />
              导入持仓
            </button>
          }
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
                  <td className="p-3 text-right text-xs text-gray-300">
                    {h.shares.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-xs text-gray-300">
                    {h.cost_price.toFixed(4)}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
