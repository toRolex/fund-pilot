import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
      className={`strategy-card border border-[#323248] bg-[#16161E] p-4 ${
        strategy.enabled ? "" : "opacity-50"
      }`}
    >
      <div className="strategy-name mb-1 text-sm font-medium text-[#EDEDF0]">
        {strategy.name}
      </div>
      <div className="strategy-meta mb-1 text-xs text-[#A7A7B5]">
        {strategy.description}
      </div>
      {strategy.params_schema && Object.keys(strategy.params_schema).length > 0 && (
        <div className="strategy-params mb-3 space-y-1 text-xs text-[#6F6F82]">
          {Object.entries(strategy.params_schema).map(([key, val]) => {
            const p = val as { type?: string; default?: unknown };
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="font-mono text-[#2B7FFF]">{key}</span>
                <span>
                  {p.type ?? ""}{p.default !== undefined ? ` = ${p.default}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="toggle-wrap flex items-center gap-2">
        <div
          role="switch"
          aria-checked={strategy.enabled}
          onClick={onToggle}
          className={`toggle relative h-4 w-8 shrink-0 cursor-pointer border transition-colors duration-150 ${
            strategy.enabled
              ? "border-[#2B7FFF] bg-[rgba(43,127,255,0.12)]"
              : "border-[#323248] bg-[#1F1F29]"
          }`}
        >
          <span
            className={`absolute left-[1px] top-[1px] h-3 w-3 transition-all duration-150 ${
              strategy.enabled
                ? "translate-x-4 bg-[#2B7FFF]"
                : "bg-[#6F6F82]"
            }`}
          />
        </div>
        <span className="toggle-label text-xs text-[#A7A7B5]">
          {strategy.enabled ? "已启用" : "已禁用"}
        </span>
      </div>
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
        <div className="strategy-header mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[#EDEDF0]">策略管理</h1>
        </div>
        <div className="animate-pulse">
          <div
            className="strategy-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}
          >
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 border border-[#323248] bg-[#16161E]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-lg font-semibold text-[#EDEDF0]">策略管理</h1>
        <div className="flex flex-col items-center gap-4 border border-[#323248] bg-[#16161E] p-12">
          <p className="text-[#A7A7B5]">加载失败，请重试</p>
          <button
            onClick={() => refetch()}
            className="bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
          >
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
      <div className="strategy-header mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[#EDEDF0]">策略管理</h1>
        <a
          href="https://github.com/rolex/fund-signal-workbench/wiki/strategies"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[rgba(43,127,255,0.12)] px-4 py-2 text-sm text-[#2B7FFF] transition-colors hover:bg-[rgba(43,127,255,0.2)]"
        >
          添加策略
        </a>
      </div>

      {safeStrategies.length === 0 ? (
        <div className="mb-6 flex flex-col items-center gap-4 border border-[#323248] bg-[#16161E] p-12">
          <p className="text-[#A7A7B5]">暂无已注册策略</p>
          <a
            href="https://github.com/rolex/fund-signal-workbench/wiki/strategies"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#2B7FFF] px-4 py-2 text-sm text-white transition-colors hover:bg-[#4A94FF]"
          >
            查阅文档
          </a>
        </div>
      ) : (
        <div
          className="strategy-grid mb-6"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}
        >
          {safeStrategies.map((s) => (
            <StrategyCard
              key={s.name}
              strategy={s}
              onToggle={() => toggleMutation.mutate({ name: s.name, enabled: !s.enabled })}
            />
          ))}
        </div>
      )}

      <div className="run-log border border-[#323248] bg-[#16161E]">
        <div className="run-log-title border-b border-[#323248] px-4 py-3 text-sm font-bold text-[#EDEDF0]">
          运行日志
        </div>
        {safeLogs.length === 0 ? (
          <div className="p-4 text-center text-xs text-[#6F6F82]">暂无日志</div>
        ) : (
          <div className="max-h-48 overflow-y-auto p-4">
            {safeLogs.map((log, i) => (
              <div key={i} className="log-entry flex gap-3 border-b border-[#323248] py-1 text-xs last:border-b-0">
                <span className="log-time shrink-0 text-[#6F6F82]">{log.timestamp}</span>
                <span className="text-[#A7A7B5]">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
