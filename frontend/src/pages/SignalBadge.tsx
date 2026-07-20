import type { SignalType } from "@/types";

const STYLES: Record<SignalType, { bg: string; label: string }> = {
  buy: { bg: "bg-emerald-400/20 text-emerald-400 border-emerald-400/30", label: "买入" },
  sell: { bg: "bg-orange-400/20 text-orange-400 border-orange-400/30", label: "卖出" },
  hold: { bg: "bg-yellow-400/20 text-yellow-400 border-yellow-400/30", label: "持有" },
};

interface Props {
  type: SignalType;
  confidence?: number;
  strategy?: string;
}

const SHAPES: Record<SignalType, { className: string; style?: React.CSSProperties }> = {
  buy: { className: "buy-shape inline-block w-2 h-2 bg-[var(--signal-buy)]" },
  sell: {
    className: "sell-shape inline-block",
    style: {
      width: 0,
      height: 0,
      borderLeft: "5px solid transparent",
      borderRight: "5px solid transparent",
      borderTop: `8px solid var(--signal-sell)`,
    } as React.CSSProperties,
  },
  hold: { className: "hold-shape inline-block w-2 h-2 rounded-full bg-[var(--signal-hold)]" },
};

// ponytail: CSS-only tooltip, migrate to @headlessui Popover if richer interaction needed
export function SignalBadge({ type, confidence, strategy }: Props) {
  const s = STYLES[type];
  const shape = SHAPES[type];
  const tooltip = [strategy && `策略: ${strategy}`, confidence != null && `置信度: ${Math.round(confidence * 100)}%`]
    .filter(Boolean)
    .join(" | ");

  return (
    <span className="group relative inline-flex">
      <span
        className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium border ${s.bg}`}
      >
        <span className={shape.className} style={shape.style} />
        {s.label}
      </span>
      {tooltip && (
        <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#16161E] px-2 py-1 text-xs text-gray-300 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity group-hover:opacity-100">
          {tooltip}
        </span>
      )}
    </span>
  );
}
