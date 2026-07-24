"""Backtest engine — single-fund strategy backtesting.

Ponytail: no fees, no slippage, no momentum support.
"""
import pandas as pd

from app.models import (
    BacktestMetrics,
    BacktestResult,
    BacktestTrade,
    EquityPoint,
    SignalType,
)


def run_backtest(
    price_df: pd.DataFrame,
    strategy_fn: callable,
    params: dict | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    initial_capital: float = 100_000,
) -> BacktestResult:
    """Run a backtest for a single fund using the given strategy.

    Args:
        price_df: DataFrame with 'date' and 'netvalue' columns.
        strategy_fn: Function that takes (price_df, params) -> list[Signal].
        params: Strategy parameters.
        start_date: Inclusive start date string (YYYY-MM-DD). Defaults to first date.
        end_date: Inclusive end date string (YYYY-MM-DD). Defaults to last date.
        initial_capital: Starting cash.

    Returns:
        BacktestResult with metrics, trades, and equity curve.
    """
    # Date range slicing
    df = price_df.copy()
    df = df.sort_values("date").reset_index(drop=True)

    if start_date:
        df = df[df["date"] >= start_date]
    if end_date:
        df = df[df["date"] <= end_date]

    if df.empty:
        return BacktestResult(
            metrics=BacktestMetrics(
                total_return=0.0,
                annualized_return=0.0,
                max_drawdown=0.0,
                win_rate=0.0,
                sharpe_ratio=0.0,
                total_trades=0,
            ),
            trades=[],
            equity_curve=[],
        )

    # ponytail: momentum check by attribute marker
    if getattr(strategy_fn, "multi_fund", False):
        raise ValueError("Momentum strategy is not supported in backtest")

    # Generate signals
    signals = strategy_fn(df, params)

    # Simulate trading
    cash = float(initial_capital)
    shares = 0.0
    trades: list[BacktestTrade] = []
    equity_curve: list[EquityPoint] = []
    signal_by_date: dict[str, SignalType] = {}
    for sig in signals:
        signal_by_date[sig.date] = sig.signal_type

    for _, row in df.iterrows():
        date_str = row["date"].strftime("%Y-%m-%d") if hasattr(row["date"], "strftime") else str(row["date"])
        price = float(row["netvalue"])
        sig = signal_by_date.get(date_str)

        if sig == SignalType.buy and cash > 0:
            buy_shares = cash / price
            shares += buy_shares
            trades.append(BacktestTrade(
                date=date_str,
                type=SignalType.buy,
                price=price,
                shares=buy_shares,
                cash_remaining=0.0,
                total_value=shares * price,
            ))
            cash = 0.0
        elif sig == SignalType.sell and shares > 0:
            sell_value = shares * price
            cash += sell_value
            trades.append(BacktestTrade(
                date=date_str,
                type=SignalType.sell,
                price=price,
                shares=shares,
                cash_remaining=cash,
                total_value=cash,
            ))
            shares = 0.0

        total_value = cash + shares * price
        equity_curve.append(EquityPoint(date=date_str, total_value=round(total_value, 4)))

    # Compute metrics
    total_return = _calc_total_return(equity_curve, initial_capital)
    annualized_return = _calc_annualized_return(equity_curve, initial_capital)
    max_drawdown = _calc_max_drawdown(equity_curve)
    win_rate = _calc_win_rate(trades)
    sharpe_ratio = _calc_sharpe_ratio(equity_curve)
    total_trades = len([t for t in trades if t.type == SignalType.sell])

    return BacktestResult(
        metrics=BacktestMetrics(
            total_return=round(total_return, 6),
            annualized_return=round(annualized_return, 6),
            max_drawdown=round(max_drawdown, 6),
            win_rate=round(win_rate, 6),
            sharpe_ratio=round(sharpe_ratio, 6),
            total_trades=total_trades,
        ),
        trades=trades,
        equity_curve=equity_curve,
    )


def _calc_total_return(equity_curve: list[EquityPoint], initial_capital: float) -> float:
    if not equity_curve or initial_capital == 0:
        return 0.0
    return (equity_curve[-1].total_value - initial_capital) / initial_capital


def _calc_annualized_return(equity_curve: list[EquityPoint], initial_capital: float) -> float:
    if len(equity_curve) < 2 or initial_capital == 0:
        return 0.0
    n_days = len(equity_curve)
    total_ret = equity_curve[-1].total_value / initial_capital - 1
    # ponytail: 252 trading days per year
    return (1 + total_ret) ** (252 / n_days) - 1


def _calc_max_drawdown(equity_curve: list[EquityPoint]) -> float:
    if len(equity_curve) < 2:
        return 0.0
    peak = equity_curve[0].total_value
    max_dd = 0.0
    for ep in equity_curve:
        if ep.total_value > peak:
            peak = ep.total_value
        dd = (peak - ep.total_value) / peak if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd
    return max_dd


def _calc_win_rate(trades: list[BacktestTrade]) -> float:
    sell_trades = [t for t in trades if t.type == SignalType.sell]
    if not sell_trades:
        return 0.0
    # ponytail: simple share-based win — sell total > buy cost
    # For single-fund backtest with all-in buy / all-out sell, each sell
    # corresponds to a prior buy. Compare sell value vs buy cost.
    buy_trades = [t for t in trades if t.type == SignalType.buy]
    wins = 0
    total = min(len(sell_trades), len(buy_trades))
    if total == 0:
        return 0.0
    for i in range(total):
        buy_cost = buy_trades[i].shares * buy_trades[i].price
        sell_value = sell_trades[i].shares * sell_trades[i].price
        if sell_value > buy_cost:
            wins += 1
    return wins / total


def _calc_sharpe_ratio(equity_curve: list[EquityPoint]) -> float:
    if len(equity_curve) < 2:
        return 0.0
    returns = []
    for i in range(1, len(equity_curve)):
        prev = equity_curve[i - 1].total_value
        curr = equity_curve[i].total_value
        if prev > 0:
            returns.append(curr / prev - 1)
    if len(returns) < 2:
        return 0.0
    mean_ret = sum(returns) / len(returns)
    variance = sum((r - mean_ret) ** 2 for r in returns) / (len(returns) - 1)
    std = variance ** 0.5
    if std == 0:
        return 0.0
    # ponytail: daily Sharpe, no risk-free rate, annualize with sqrt(252)
    return (mean_ret / std) * (252 ** 0.5)
