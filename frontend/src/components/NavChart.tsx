import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { NavPoint, SignalResponse, SignalType } from "@/types";
import {
  SignalBuyMarker,
  SignalSellMarker,
  SignalHoldMarker,
} from "@/components/SignalBadge";

// ── 交互状态形状（spec）：区间 key + brush 选区 [startIdx, endIdx] ───────────
export type RangeKey = "1m" | "3m" | "6m" | "1y" | "all";

// T6 键盘快捷键：详情页通过 ref 调用 NavChart 的区间切换 / 平移
export interface NavChartHandle {
  setRange(key: RangeKey): void;
  pan(direction: -1 | 1): void;
}

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "1m", label: "近1月" },
  { key: "3m", label: "近3月" },
  { key: "6m", label: "近半年" },
  { key: "1y", label: "近1年" },
  { key: "all", label: "全部" },
];

// 交易日数（对齐原型 QUICK 常量）：近1月 21 · 近3月 63 · 近半年 126 · 近1年 252 · 全部 0
const QUICK_DAYS: Record<RangeKey, number> = {
  "1m": 21,
  "3m": 63,
  "6m": 126,
  "1y": 252,
  all: 0,
};
const MIN_WIN = 5;

// ── 几何常量 ────────────────────────────────────────────────────────────────
const CHART_W = 700;
const CHART_H = 280;
const PAD_L = 52;
const PAD_R = 14;
const PAD_T = 18;
const PAD_B = 26;

const BRUSH_W = 700;
const BRUSH_H = 48;

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

function rangeWindow(range: RangeKey, n: number): [number, number] {
  if (n <= 0) return [0, 0];
  const e = n - 1;
  const days = QUICK_DAYS[range];
  if (days === 0) return [0, e];
  return [Math.max(0, e - (days - 1)), e];
}

function fmtTick(v: number): string {
  if (Math.abs(v) >= 100) return v.toFixed(1);
  if (Math.abs(v) >= 10) return v.toFixed(2);
  if (Math.abs(v) >= 1) return v.toFixed(3);
  return v.toFixed(4);
}

interface ChartLayout {
  linePts: string;
  areaPts: string;
  yTicks: { v: number; y: number }[];
  xLabels: { label: string; x: number }[];
  markers: { x: number; y: number; type: SignalType }[];
  firstDate: string;
  lastDate: string;
  xAt: (i: number) => number;
  yAt: (v: number) => number;
}

function computeChartLayout(
  nav: NavPoint[],
  signals: SignalResponse[],
  win: [number, number],
): ChartLayout | null {
  const n = nav.length;
  if (n === 0) return null;
  const startIdx = Math.max(0, Math.min(win[0], n - 1));
  const endIdx = Math.max(startIdx, Math.min(win[1], n - 1));
  const sliced = nav.slice(startIdx, endIdx + 1);
  if (sliced.length === 0) return null;

  const vals = sliced.map((p) => p.netvalue);
  const dMin = Math.min(...vals);
  const dMax = Math.max(...vals);
  const dRng = dMax - dMin || 1;
  const pad = dRng * 0.1;
  const yMin = dMin - pad;
  const yMax = dMax + pad;
  const yRng = yMax - yMin;

  const cw = CHART_W - PAD_L - PAD_R;
  const ch = CHART_H - PAD_T - PAD_B;
  const m = sliced.length;

  const x = (i: number) => PAD_L + (m > 1 ? (i / (m - 1)) * cw : cw / 2);
  const y = (v: number) => PAD_T + ch - ((v - yMin) / yRng) * ch;

  const linePts = sliced.map((p, i) => `${x(i)},${y(p.netvalue)}`).join(" ");
  const areaPts = `${x(0)},${PAD_T + ch} ${linePts} ${x(m - 1)},${PAD_T + ch}`;

  const yTicks = Array.from({ length: 6 }, (_, i) => ({
    v: yMin + yRng * (1 - i / 5),
    y: PAD_T + (ch * i) / 5,
  }));

  const maxLabels = Math.min(8, m);
  const step = Math.max(1, Math.floor((m - 1) / Math.max(1, maxLabels - 1)));
  const xLabels: { label: string; x: number }[] = [];
  for (let i = 0; i < m; i += step) {
    xLabels.push({ label: sliced[i].date.slice(5), x: x(i) });
  }
  if (xLabels.length > 0 && xLabels[xLabels.length - 1].x < x(m - 1) - 10) {
    xLabels.push({ label: sliced[m - 1].date.slice(5), x: x(m - 1) });
  }

  const navMap = new Map(nav.map((p, i) => [p.date, i]));
  const markers: { x: number; y: number; type: SignalType }[] = [];
  for (const s of signals) {
    const gi = navMap.get(s.date);
    if (gi != null && gi >= startIdx && gi <= endIdx) {
      markers.push({ x: x(gi - startIdx), y: y(nav[gi].netvalue), type: s.signal_type });
    }
  }

  return {
    linePts,
    areaPts,
    yTicks,
    xLabels,
    markers,
    firstDate: sliced[0].date,
    lastDate: sliced[m - 1].date,
    xAt: x,
    yAt: y,
  };
}

function computeRangeStats(
  nav: NavPoint[],
  signals: SignalResponse[],
  win: [number, number],
): { rangePct: number; maxDrawdown: number; signalCount: number } {
  const n = nav.length;
  const startIdx = Math.max(0, Math.min(win[0], n - 1));
  const endIdx = Math.max(startIdx, Math.min(win[1], n - 1));
  const sliced = nav.slice(startIdx, endIdx + 1);
  const vals = sliced.map((p) => p.netvalue);
  if (vals.length === 0) return { rangePct: 0, maxDrawdown: 0, signalCount: 0 };

  const firstVal = vals[0];
  const lastVal = vals[vals.length - 1];
  const rangePct = firstVal !== 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0;

  let peak = vals[0];
  let maxDrawdown = 0;
  for (const v of vals) {
    if (v > peak) peak = v;
    const dd = (v / peak - 1) * 100;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }

  const navMap = new Map(nav.map((p, i) => [p.date, i]));
  let signalCount = 0;
  for (const s of signals) {
    const gi = navMap.get(s.date);
    if (gi != null && gi >= startIdx && gi <= endIdx) signalCount++;
  }

  return { rangePct, maxDrawdown, signalCount };
}

interface BrushDrag {
  mode: "l" | "r" | "move";
  startX: number;
  s0: number;
  e0: number;
  span: number;
}

// ── NavChart：快捷区间 + brush 缩放 + 十字光标 + 区间统计 ─────────────────────
type NavChartProps = { nav: NavPoint[]; signals: SignalResponse[] };

export const NavChart = forwardRef<NavChartHandle, NavChartProps>(function NavChart(
  { nav, signals },
  ref,
) {
  const [range, setRange] = useState<RangeKey | null>("all");
  const [win, setWin] = useState<[number, number]>([0, 0]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const dragRef = useRef<BrushDrag | null>(null);

  // 数据加载或快捷区间变化时，重算主图窗口
  useEffect(() => {
    if (range !== null) setWin(rangeWindow(range, nav.length));
  }, [range, nav.length]);

  const n = nav.length;
  const startIdx = n === 0 ? 0 : Math.max(0, Math.min(win[0], n - 1));
  const endIdx = n === 0 ? 0 : Math.max(startIdx, Math.min(win[1], n - 1));
  const curWin: [number, number] = [startIdx, endIdx];

  const layout = useMemo(
    () => computeChartLayout(nav, signals, curWin),
    [nav, signals, startIdx, endIdx],
  );
  const stats = useMemo(
    () => computeRangeStats(nav, signals, curWin),
    [nav, signals, startIdx, endIdx],
  );

  // ── brush 几何 ──
  const brushCw = BRUSH_W - PAD_L - PAD_R;
  const bx = (i: number) =>
    n <= 1 ? PAD_L + brushCw / 2 : PAD_L + (i / (n - 1)) * brushCw;
  const bValues = nav.map((p) => p.netvalue);
  const bMin = bValues.length ? Math.min(...bValues) : 0;
  const bMax = bValues.length ? Math.max(...bValues) : 1;
  const bPad = (bMax - bMin) * 0.1 || 0.005;
  const bLo = bMin - bPad;
  const bHi = bMax + bPad;
  const by = (v: number) => 8 + (1 - (v - bLo) / (bHi - bLo || 1e-9)) * (BRUSH_H - 16);
  const bPts = nav.map((p, i) => `${bx(i)},${by(p.netvalue)}`).join(" ");

  const toVbX = (clientX: number, el: SVGSVGElement) => {
    const rect = el.getBoundingClientRect();
    if (!rect.width) return 0;
    return ((clientX - rect.left) / rect.width) * BRUSH_W;
  };
  const toIndex = (x: number) =>
    clamp(Math.round(((x - PAD_L) / brushCw) * Math.max(1, n - 1)), 0, Math.max(0, n - 1));

  function handleRange(key: RangeKey) {
    setRange(key);
    setHoverIdx(null);
  }

  // T6 键盘平移：将可见窗口左/右移动窗口宽度的 10%（至少 1 格），并清除快捷区间选中态
  function pan(direction: -1 | 1) {
    if (n === 0) return;
    const span = endIdx - startIdx;
    const step = Math.max(1, Math.round(span * 0.1));
    let s = startIdx + direction * step;
    let e = endIdx + direction * step;
    if (s < 0) {
      s = 0;
      e = Math.min(span, n - 1);
    }
    if (e > n - 1) {
      e = n - 1;
      s = Math.max(0, e - span);
    }
    setWin([s, e]);
    setRange(null);
    setHoverIdx(null);
  }

  useImperativeHandle(ref, () => ({
    setRange: handleRange,
    pan,
  }));

  function onBrushPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (n === 0) return;
    const x = toVbX(e.clientX, e.currentTarget);
    const x0 = bx(startIdx);
    const x1 = bx(endIdx);
    let mode: BrushDrag["mode"];
    if (Math.abs(x - x0) <= 9) mode = "l";
    else if (Math.abs(x - x1) <= 9) mode = "r";
    else if (x > x0 && x < x1) mode = "move";
    else mode = x <= x0 ? "l" : "r";
    dragRef.current = { mode, startX: x, s0: startIdx, e0: endIdx, span: endIdx - startIdx };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* jsdom 不实现 pointer capture */
    }
  }

  function onBrushPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const x = toVbX(e.clientX, e.currentTarget);
    const idx = toIndex(x);
    let s = drag.s0;
    let end = drag.e0;
    if (drag.mode === "l") {
      s = clamp(idx, 0, drag.e0 - MIN_WIN);
    } else if (drag.mode === "r") {
      end = clamp(idx, drag.s0 + MIN_WIN, n - 1);
    } else {
      const dxIdx = Math.round(((x - drag.startX) / brushCw) * Math.max(1, n - 1));
      s = clamp(drag.s0 + dxIdx, 0, n - 1 - drag.span);
      end = s + drag.span;
    }
    if (s !== startIdx || end !== endIdx) {
      setWin([s, end]);
      setRange(null);
      setHoverIdx(null);
    }
  }

  function onBrushPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* jsdom 不实现 pointer capture */
    }
  }

  function onChartPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const x = ((e.clientX - rect.left) / rect.width) * CHART_W;
    const y = ((e.clientY - rect.top) / rect.height) * CHART_H;
    if (x < PAD_L || x > CHART_W - PAD_R || y < PAD_T || y > CHART_H - PAD_B) {
      setHoverIdx(null);
      return;
    }
    const chartCw = CHART_W - PAD_L - PAD_R;
    const span = endIdx - startIdx;
    const idx = clamp(startIdx + Math.round(((x - PAD_L) / chartCw) * span), startIdx, endIdx);
    setHoverIdx(idx);
  }

  function onChartPointerLeave() {
    setHoverIdx(null);
  }

  const rangePct = stats.rangePct;
  const rangeColor = rangePct >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";

  // 十字光标几何
  let crosshair: { x: number; y: number; point: NavPoint } | null = null;
  if (hoverIdx != null && layout && n > 0) {
    const idx = clamp(hoverIdx, startIdx, endIdx);
    crosshair = {
      x: layout.xAt(idx - startIdx),
      y: layout.yAt(nav[idx].netvalue),
      point: nav[idx],
    };
  }

  const crossBadgeX = crosshair
    ? Math.min(crosshair.x + 8, CHART_W - PAD_R - 132)
    : 0;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        background: "var(--surface)",
        padding: "var(--space-4)",
        marginBottom: "var(--space-4)",
      }}
    >
      <div className="chart-title">净值走势（含信号标记）</div>

      {/* 快捷区间分段控件 */}
      <div className="range-btns" role="group" aria-label="快捷时间区间">
        {RANGE_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`range-btn${range === key ? " active" : ""}`}
            aria-pressed={range === key}
            onClick={() => handleRange(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 区间统计：随区间/brush 实时联动 */}
      <div className="range-stats" data-testid="range-stats">
        <div className="range-stat">
          <span className="range-stat-label">区间涨跌</span>
          <span
            className="range-stat-value"
            data-testid="range-return"
            style={{ color: rangeColor }}
          >
            {rangePct > 0 ? "+" : ""}
            {rangePct.toFixed(2)}%
          </span>
        </div>
        <div className="range-stat">
          <span className="range-stat-label">最大回撤</span>
          <span
            className="range-stat-value"
            data-testid="range-mdd"
            style={{ color: "var(--signal-sell)" }}
          >
            {stats.maxDrawdown.toFixed(2)}%
          </span>
        </div>
        <div className="range-stat">
          <span className="range-stat-label">区间信号数</span>
          <span className="range-stat-value" data-testid="range-signal-count">
            {stats.signalCount}
          </span>
        </div>
      </div>

      {!layout ? (
        <div
          className="flex items-center justify-center"
          style={{ height: 260, fontSize: "var(--fs-tiny)", color: "var(--muted)" }}
        >
          暂无净值数据
        </div>
      ) : (
        <>
          <div className="chart-wrap">
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              role="img"
              aria-label="净值走势图"
              data-testid="nav-main-chart"
              onPointerMove={onChartPointerMove}
              onPointerLeave={onChartPointerLeave}
              style={{ touchAction: "none", cursor: "crosshair" }}
            >
              <defs>
                <linearGradient id="nav-area-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              {layout.yTicks.map((t, i) => (
                <g key={`yt-${i}`}>
                  <line
                    x1={PAD_L}
                    y1={t.y}
                    x2={CHART_W - PAD_R}
                    y2={t.y}
                    stroke="var(--border)"
                    strokeWidth={0.5}
                  />
                  <text
                    x={PAD_L - 6}
                    y={t.y + 4}
                    textAnchor="end"
                    fill="var(--muted)"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {fmtTick(t.v)}
                  </text>
                </g>
              ))}
              {layout.xLabels.map((l, i) => (
                <text
                  key={`xl-${i}`}
                  x={l.x}
                  y={CHART_H - 6}
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {l.label}
                </text>
              ))}
              <polyline fill="url(#nav-area-grad)" stroke="none" points={layout.areaPts} />
              <polyline
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.5}
                points={layout.linePts}
              />
              {layout.markers.map((m, i) => {
                switch (m.type) {
                  case "buy":
                    return <SignalBuyMarker key={i} cx={m.x} cy={m.y} />;
                  case "sell":
                    return <SignalSellMarker key={i} cx={m.x} cy={m.y} />;
                  case "hold":
                    return <SignalHoldMarker key={i} cx={m.x} cy={m.y} />;
                }
              })}
              {crosshair && (
                <g data-testid="nav-crosshair" pointerEvents="none">
                  <line
                    x1={crosshair.x}
                    y1={PAD_T}
                    x2={crosshair.x}
                    y2={CHART_H - PAD_B}
                    stroke="var(--muted)"
                    strokeWidth={0.75}
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={PAD_L}
                    y1={crosshair.y}
                    x2={CHART_W - PAD_R}
                    y2={crosshair.y}
                    stroke="var(--muted)"
                    strokeWidth={0.75}
                    strokeDasharray="3 3"
                  />
                  <g>
                    <rect
                      x={crossBadgeX}
                      y={PAD_T}
                      width={132}
                      height={18}
                      rx={2}
                      fill="var(--surface)"
                      stroke="var(--border)"
                    />
                    <text
                      x={crossBadgeX + 6}
                      y={PAD_T + 13}
                      fill="var(--fg)"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {crosshair.point.date} · {crosshair.point.netvalue.toFixed(4)}
                    </text>
                  </g>
                </g>
              )}
            </svg>
          </div>
          <div className="chart-footer">
            <span data-testid="chart-date-range">
              {layout.firstDate} ~ {layout.lastDate}
            </span>
            <span style={{ color: rangeColor }}>
              区间涨跌: {rangePct > 0 ? "+" : ""}
              {rangePct.toFixed(2)}%
            </span>
          </div>
        </>
      )}

      {/* 底部时间轴 brush：拖拽把手/选区缩放主图 */}
      <div className="brush" style={{ marginTop: "var(--space-3)" }}>
        <svg
          viewBox={`0 0 ${BRUSH_W} ${BRUSH_H}`}
          role="img"
          aria-label="底部时间轴范围选择器，可拖拽把手缩放主图"
          data-testid="nav-brush"
          onPointerDown={onBrushPointerDown}
          onPointerMove={onBrushPointerMove}
          onPointerUp={onBrushPointerUp}
          onPointerCancel={onBrushPointerUp}
          style={{
            width: "100%",
            height: BRUSH_H,
            display: "block",
            touchAction: "none",
            cursor: "grab",
          }}
        >
          {n > 0 && (
            <>
              <defs>
                <linearGradient id="brush-area-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.14} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <polygon
                fill="url(#brush-area-grad)"
                stroke="none"
                points={`${bx(0)},${BRUSH_H - 8} ${bPts} ${bx(n - 1)},${BRUSH_H - 8}`}
              />
              <polyline fill="none" stroke="var(--accent)" strokeWidth={1.25} points={bPts} />
              <rect
                x={0}
                y={0}
                width={Math.max(0, bx(startIdx))}
                height={BRUSH_H}
                fill="rgba(10,10,16,0.55)"
              />
              <rect
                x={Math.min(bx(endIdx), BRUSH_W)}
                y={0}
                width={Math.max(0, BRUSH_W - bx(endIdx))}
                height={BRUSH_H}
                fill="rgba(10,10,16,0.55)"
              />
              <rect
                x={bx(startIdx)}
                y={0}
                width={Math.max(0, bx(endIdx) - bx(startIdx))}
                height={BRUSH_H}
                fill="rgba(43,127,255,0.10)"
              />
              <rect x={bx(startIdx) - 3} y={0} width={6} height={BRUSH_H} fill="var(--accent)" />
              <rect x={bx(endIdx) - 3} y={0} width={6} height={BRUSH_H} fill="var(--accent)" />
            </>
          )}
        </svg>
        <div className="brush-foot">
          {n > 0
            ? `${nav[startIdx].date} → ${nav[endIdx].date} · ${endIdx - startIdx + 1} 个交易日`
            : ""}
        </div>
      </div>

      {/* 图例 */}
      <div className="chart-legend">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              background: "var(--signal-buy)",
              display: "inline-block",
            }}
          />{" "}
          买入
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              display: "inline-block",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "8px solid var(--signal-sell)",
            }}
          />{" "}
          卖出
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span
            style={{ width: 8, height: 8, background: "var(--signal-hold)", display: "inline-block" }}
          />{" "}
          持有
        </span>
      </div>
    </div>
  );
});
