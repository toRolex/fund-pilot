"""Strategy registry and built-in indicator_cross strategy.

Each strategy is a function: run(price_df, params=None) -> list[Signal]
Registered in _REGISTRY dict by name.
"""
import datetime

import pandas as pd

from app.models import Signal, SignalType, StrategyLog, StrategyMeta


# ponytail: global dict registry, plugin-based discovery if user-authored strategies needed
_REGISTRY: dict[str, tuple[StrategyMeta, callable]] = {}

# ponytail: in-memory ring buffer, DB-backed log if persistence needed
_MAX_LOG = 200
_logs: list[StrategyLog] = []


def _add_log(message: str):
    _logs.append(StrategyLog(
        timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        message=message,
    ))
    if len(_logs) > _MAX_LOG:
        _logs[:] = _logs[-_MAX_LOG:]


def get_logs(limit: int = 50) -> list[StrategyLog]:
    return _logs[-limit:]

# ponytail: in-memory per-fund strategy enable/disable, file persistence if needs to survive restart
_FUND_ENABLED: dict[str, dict[str, bool]] = {}


def register(name: str, meta: StrategyMeta, fn: callable):
    """Register a strategy function."""
    _REGISTRY[name] = (meta, fn)
    _add_log(f"策略已注册: {name}")


def list_strategies() -> list[StrategyMeta]:
    """Return metadata for all registered strategies."""
    return [meta for meta, _ in _REGISTRY.values()]


def toggle_enabled(name: str, enabled: bool) -> StrategyMeta:
    """Enable or disable a strategy. Raises KeyError if not found."""
    if name not in _REGISTRY:
        raise KeyError(f"Strategy '{name}' not found")
    meta, fn = _REGISTRY[name]
    meta.enabled = enabled
    _add_log(f"策略 {'启用' if enabled else '禁用'}: {name}")
    return meta


def get_strategy(name: str) -> callable:
    """Look up a strategy function by name. Raises KeyError if not found."""
    if name not in _REGISTRY:
        raise KeyError(f"Strategy '{name}' not found")
    return _REGISTRY[name][1]


def get_fund_enabled_strategies(fund_code: str) -> dict[str, bool]:
    """Get enabled/disabled state for all strategies for a fund."""
    if fund_code not in _FUND_ENABLED:
        _FUND_ENABLED[fund_code] = {name: True for name, _ in _REGISTRY.items()}
    return _FUND_ENABLED[fund_code]


def toggle_fund_strategy(fund_code: str, strategy_name: str) -> bool:
    """Toggle a strategy for a fund. Returns the new enabled state."""
    if strategy_name not in _REGISTRY:
        raise KeyError(f"Strategy '{strategy_name}' not found")
    enabled_map = get_fund_enabled_strategies(fund_code)
    enabled_map[strategy_name] = not enabled_map.get(strategy_name, True)
    return enabled_map[strategy_name]


def indicator_cross(price_df: pd.DataFrame, params: dict | None = None) -> list[Signal]:
    """Moving average crossover strategy.

    Generates buy/sell signals when short MA crosses above/below long MA.

    Params:
        short_window: int, default 5
        long_window: int, default 20
        totmoney: int, default 1000 (maps to buy signal magnitude)
    """
    p = {**dict(short_window=5, long_window=20, totmoney=1000), **(params or {})}
    short_w = p["short_window"]
    long_w = p["long_window"]

    if "netvalue" not in price_df.columns:
        raise ValueError("price_df must contain 'netvalue' column")

    df = price_df.copy()
    df = df.sort_values("date").reset_index(drop=True)
    df["short_ma"] = df["netvalue"].rolling(window=short_w).mean()
    df["long_ma"] = df["netvalue"].rolling(window=long_w).mean()

    signals = []
    start_idx = max(short_w, long_w) - 1

    for i in range(start_idx, len(df)):
        row = df.iloc[i]
        if pd.isna(row["short_ma"]) or pd.isna(row["long_ma"]):
            continue

        curr_diff = row["short_ma"] - row["long_ma"]
        prev_diff = df.iloc[i - 1]["short_ma"] - df.iloc[i - 1]["long_ma"]

        signal_type = SignalType.hold
        confidence = 0.0

        if curr_diff > 0 and prev_diff <= 0:
            signal_type = SignalType.buy
            confidence = min(abs(curr_diff) / row["long_ma"], 1.0) if row["long_ma"] != 0 else 0.5
        elif curr_diff < 0 and prev_diff >= 0:
            signal_type = SignalType.sell
            confidence = min(abs(curr_diff) / row["long_ma"], 1.0) if row["long_ma"] != 0 else 0.5

        if signal_type != SignalType.hold:
            signals.append(Signal(
                date=row["date"].strftime("%Y-%m-%d") if hasattr(row["date"], "strftime") else str(row["date"]),
                fund_code="",
                strategy_name="indicator_cross",
                signal_type=signal_type,
                confidence=round(confidence, 4),
            ))

    return signals


def pe_percentile(price_df: pd.DataFrame, params: dict | None = None) -> list[Signal]:
    """PE percentile strategy.

    Current PE's rank among historical values → signal:
      percentile < low_pct  → buy (undervalued)
      percentile > high_pct → sell (overvalued)
      otherwise             → hold (neutral)

    Params:
        low_pct: float, default 0.20
        high_pct: float, default 0.80
    """
    p = {**dict(low_pct=0.20, high_pct=0.80), **(params or {})}
    low_pct = p["low_pct"]
    high_pct = p["high_pct"]

    if "pe" not in price_df.columns or len(price_df) < 2:
        return []

    values = price_df["pe"].dropna().tolist()
    if len(values) < 2:
        return []

    current = values[-1]
    historical = values[:-1]
    rank = sum(1 for v in historical if v < current)
    percentile = rank / len(historical) if historical else 0.5

    if percentile < low_pct:
        signal_type = SignalType.buy
    elif percentile > high_pct:
        signal_type = SignalType.sell
    else:
        signal_type = SignalType.hold

    last_date = price_df.iloc[-1]["date"]
    date_str = last_date.strftime("%Y-%m-%d") if hasattr(last_date, "strftime") else str(last_date)

    return [Signal(
        date=date_str,
        fund_code="",
        strategy_name="pe_percentile",
        signal_type=signal_type,
        confidence=round(percentile, 4),
    )]


def grid(price_df: pd.DataFrame, params: dict | None = None) -> list[Signal]:
    """Grid trading strategy.

    Divides [low, high] into n_grids equal segments. When price crosses a
    grid line upward → buy; downward → sell.

    Params:
        low: float, required (omit returns no signals)
        high: float, required (omit returns no signals)
        n_grids: int, default 10
    """
    p = {**dict(n_grids=10), **(params or {})}
    low = p.get("low")
    high = p.get("high")
    n_grids = p["n_grids"]

    if low is None or high is None:
        return []
    if "netvalue" not in price_df.columns or len(price_df) < 2:
        return []
    if high <= low or n_grids < 1:
        return []

    lines = [low + i * (high - low) / n_grids for i in range(1, n_grids)]
    df = price_df.sort_values("date").reset_index(drop=True)

    signals: list[Signal] = []
    for i in range(1, len(df)):
        prev = df.iloc[i - 1]["netvalue"]
        curr = df.iloc[i]["netvalue"]
        for line in lines:
            crossed_up = prev < line <= curr
            crossed_down = prev > line >= curr
            if crossed_up or crossed_down:
                sig_type = SignalType.buy if crossed_up else SignalType.sell
                raw_date = df.iloc[i]["date"]
                date_str = raw_date.strftime("%Y-%m-%d") if hasattr(raw_date, "strftime") else str(raw_date)
                signals.append(Signal(
                    date=date_str,
                    fund_code="",
                    strategy_name="grid",
                    signal_type=sig_type,
                    confidence=round(abs(curr - line) / line, 4),
                ))

    return signals


def momentum(funds_data: dict[str, pd.DataFrame], params: dict | None = None) -> list[Signal]:
    """Momentum rotation strategy across multiple funds.

    Ranks funds by N-day return rate (descending). signal_type=hold, detail=rank_N,
    confidence=return rate.

    Params:
        n_days: int, default 20
    """
    p = {**dict(n_days=20), **(params or {})}
    n_days = p["n_days"]

    if not funds_data:
        return []

    rankings: list[tuple[str, float, str]] = []
    for code, df in funds_data.items():
        if df is None or "netvalue" not in df.columns or len(df) < n_days + 1:
            continue
        sorted_df = df.sort_values("date").reset_index(drop=True)
        recent = sorted_df.iloc[-1]["netvalue"]
        past = sorted_df.iloc[-n_days - 1]["netvalue"]
        if past == 0:
            continue
        ret = (recent - past) / past
        last_date = sorted_df.iloc[-1]["date"]
        date_str = last_date.strftime("%Y-%m-%d") if hasattr(last_date, "strftime") else str(last_date)
        rankings.append((code, ret, date_str))

    rankings.sort(key=lambda x: x[1], reverse=True)

    signals: list[Signal] = []
    for rank, (code, ret, date_str) in enumerate(rankings, start=1):
        signals.append(Signal(
            date=f"rank_{rank}",
            fund_code=code,
            strategy_name="momentum",
            signal_type=SignalType.hold,
            confidence=round(ret, 6),
        ))
    return signals


# ponytail: marker for main.py dispatcher to pass multi-fund data
momentum.multi_fund = True


# Register built-in strategies
register("indicator_cross", StrategyMeta(
    name="indicator_cross",
    description="均线交叉策略：短期均线上穿长期均线买入，下穿卖出",
    params_schema={
        "short_window": {"type": "int", "default": 5, "description": "短期均线窗口"},
        "long_window": {"type": "int", "default": 20, "description": "长期均线窗口"},
        "totmoney": {"type": "int", "default": 1000, "description": "每次买入金额"},
    },
), indicator_cross)

register("pe_percentile", StrategyMeta(
    name="pe_percentile",
    description="PE 百分位策略：PE 处于历史低位买入，高位卖出",
    params_schema={
        "low_pct": {"type": "float", "default": 0.20, "description": "低于该百分位视为低估(买入)"},
        "high_pct": {"type": "float", "default": 0.80, "description": "高于该百分位视为高估(卖出)"},
    },
), pe_percentile)

register("grid", StrategyMeta(
    name="grid",
    description="网格策略：价格在网格区间内穿越网格线时触发买入/卖出",
    params_schema={
        "low": {"type": "float", "required": True, "description": "网格下界"},
        "high": {"type": "float", "required": True, "description": "网格上界"},
        "n_grids": {"type": "int", "default": 10, "description": "网格分段数"},
    },
), grid)

register("momentum", StrategyMeta(
    name="momentum",
    description="动量轮动策略：按 N 日收益率排名多只基金，rank_1 持有、rank_2+ 观望",
    params_schema={
        "n_days": {"type": "int", "default": 20, "description": "回看天数"},
    },
), momentum)
