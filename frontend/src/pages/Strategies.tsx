import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { StrategyPlugin } from "@/types";

function StrategyCard({
  strategy,
  onToggle,
}: {
  strategy: StrategyPlugin;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        strategy.enabled
          ? "border-white/5 bg-[#16161E]"
          : "border-white/5 bg-[#16161E] opacity-50"
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">{strategy.name}</h3>
          <p className="mt-1 text-xs text-gray-400">{strategy.description}</p>
        </div>
        <button
          role="switch"
          aria-checked={strategy.enabled}
          onClick={onToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            strategy.enabled ? "bg-blue-500" : "bg-white/20"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              strategy.enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {strategy.params_schema && Object.keys(strategy.params_schema).length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">参数</p>
          {Object.entries(strategy.params_schema).map(([key, val]) => {
            const param = val as { type?: string; default?: unknown; description?: string };
            return (
              <div key={key} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-blue-400">{key}</span>
                <span className="text-gray-500">
                  {param.type} = {String(param.default ?? "")}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs font-medium">
        {strategy.enabled ? (
          <span className="text-emerald-400">已启用</span>
        ) : (
          <span className="text-gray-500">已禁用</span>
        )}
      </p>
    </div>
  );
}

export function Strategies() {
  const queryClient = useQueryClient();

  const { data: strategies, isLoading, isError, refetch } = useQuery({
    queryKey: ["strategies"],
    queryFn: () => api.getStrategies(),
  });

  const { data: logs } = useQuery({
    queryKey: ["strategy-logs"],
    queryFn: () => api.getStrategyLogs(),
    refetchInterval: 10_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      api.toggleStrategy(name, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      queryClient.invalidateQueries({ queryKey: ["strategy-logs"] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-xl font-bold text-white">策略管理</h1>
        <div className="animate-pulse space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 rounded-lg bg-[#16161E] border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-xl font-bold text-white">策略管理</h1>
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

  const safeStrategies = strategies ?? [];
  const safeLogs = logs ?? [];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">策略管理</h1>
        <a
          href="https://github.com/rolex/fund-signal-workbench/wiki/strategies"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded bg-blue-500/10 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/20 transition-colors"
        >
          <BookOpen className="h-4 w-4" />
          添加策略
        </a>
      </div>

      {safeStrategies.length === 0 ? (
        <div className="mb-6 flex flex-col items-center gap-4 rounded-lg bg-[#16161E] border border-white/5 p-12">
          <p className="text-gray-400">暂无已注册策略</p>
          <a
            href="https://github.com/rolex/fund-signal-workbench/wiki/strategies"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded bg-blue-500/10 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            查阅文档
          </a>
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {safeStrategies.map((s) => (
            <StrategyCard
              key={s.name}
              strategy={s}
              onToggle={() => toggleMutation.mutate({ name: s.name, enabled: !s.enabled })}
            />
          ))}
        </div>
      )}

      <div className="rounded-lg bg-[#16161E] border border-white/5">
        <h2 className="border-b border-white/5 px-4 py-3 text-sm font-bold text-white">
          运行日志
        </h2>
        {safeLogs.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-500">暂无日志</div>
        ) : (
          <div className="max-h-48 overflow-y-auto p-4">
            {safeLogs.map((log, i) => (
              <div key={i} className="flex gap-3 py-1 text-xs font-mono">
                <span className="shrink-0 text-gray-500">{log.timestamp}</span>
                <span className="text-gray-300">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
