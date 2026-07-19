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
