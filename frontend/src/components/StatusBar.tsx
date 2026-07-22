import { useSystemStatus } from "@/hooks/useSystemStatus";

export function StatusBar() {
  const { data, isError } = useSystemStatus();

  const connected = !isError;

  return (
    <div className="flex items-center justify-between px-4 py-1 text-xs text-gray-400 bg-surface border-b border-gray-800">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 ${connected ? "bg-green-400" : "bg-gray-500"}`}
        />
        <span>{connected ? "运行中" : "离线"}</span>
      </div>
      <div className="flex items-center gap-4">
        {data && (
          <>
            <span>上次更新: {formatTime(data.last_update)}</span>
            <span>策略: {data.strategies_running} 个运行中</span>
            <span>基金: {data.funds_watched} 只关注</span>
          </>
        )}
      </div>
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "暂无";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
