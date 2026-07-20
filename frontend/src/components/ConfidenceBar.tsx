export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const level = pct >= 70 ? "high" : pct >= 50 ? "mid" : "low";
  return (
    <span className="conf-bar inline-flex items-center gap-1.5 min-w-[80px]">
      <span className="conf-track flex-1 h-1 rounded-full bg-[var(--elevated)]">
        <span
          className={`conf-fill block h-full rounded-full transition-all ${level} ${
            level === "high"
              ? "bg-[var(--signal-buy)]"
              : level === "mid"
                ? "bg-[var(--signal-hold)]"
                : "bg-[var(--signal-sell)]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="conf-val text-xs text-[var(--fg-2)] min-w-[28px] text-right">
        {pct}%
      </span>
    </span>
  );
}
