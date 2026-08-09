import { useState } from "react";
import type { StrategyState } from "@/types";
import { useSetFundStrategy } from "@/hooks/useFund";

// 详情页面板策略：非 multi_fund 的按需运行策略。
// momentum 是批量排名类（multi_fund），不在详情页出现。
// hint 为该策略默认参数说明（与后端 params_schema 默认值一致）。
export const DETAIL_PANEL_STRATEGIES: Record<string, { label: string; hint: string }> = {
  indicator_cross: { label: "均线", hint: "均线 5/20" },
  pe_percentile: { label: "PE 估值", hint: "PE 百分位 20/80" },
  grid: { label: "网格", hint: "网格 10 段" },
};

function StrategySwitch({
  strategy,
  hint,
  onToggle,
}: {
  strategy: StrategyState;
  hint: string;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  const label = DETAIL_PANEL_STRATEGIES[strategy.name]?.label ?? strategy.name;

  return (
    <div
      data-testid={`strategy-item-${strategy.name}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: "var(--space-3) 0", borderBottom: "1px solid var(--border)" }}
    >
      <div className="text-sm font-medium text-white mb-1">{label}</div>
      <div className="text-xs text-gray-400 mb-2">{strategy.description}</div>
      <div className="toggle-wrap">
        <div
          className={`toggle${strategy.enabled ? " active" : ""}`}
          role="switch"
          aria-checked={strategy.enabled}
          aria-label={label}
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggle();
            }
          }}
        />
        <span className="toggle-label">{strategy.enabled ? "已启用" : "已禁用"}</span>
      </div>
      {hover && (
        <div className="mt-2 text-xs text-gray-500" data-testid={`strategy-hint-${strategy.name}`}>
          {hint}
        </div>
      )}
    </div>
  );
}

// 按需开关面板：开启 → run 端点打标；关闭 → 禁用端点隐去。无内联参数表单。
export function StrategyPanel({
  strategies,
  code,
}: {
  strategies: StrategyState[];
  code: string;
}) {
  const setMutation = useSetFundStrategy(code);
  const panel = (strategies ?? []).filter((s) => s.name in DETAIL_PANEL_STRATEGIES);

  return (
    <div className="bg-[#16161E] border border-white/5 p-4" data-testid="strategy-panel">
      <div className="text-xs text-gray-400 mb-4 tracking-wider">运行策略</div>
      {panel.length === 0 ? (
        <p className="text-xs text-gray-500">暂无策略</p>
      ) : (
        <div>
          {panel.map((s) => (
            <StrategySwitch
              key={s.name}
              strategy={s}
              hint={DETAIL_PANEL_STRATEGIES[s.name].hint}
              onToggle={() => setMutation.mutate({ name: s.name, enabled: !s.enabled })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
