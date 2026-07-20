"""Pydantic models for Fund Signal Workbench."""
import enum
from typing import Optional

from pydantic import BaseModel


class Fund(BaseModel):
    code: str
    name: str
    type: Optional[str] = None


class SearchResult(Fund):
    is_watched: bool = False


class AddFundRequest(BaseModel):
    code: str


class SignalType(str, enum.Enum):
    buy = "buy"
    sell = "sell"
    hold = "hold"


class Signal(BaseModel):
    date: str
    fund_code: str
    strategy_name: str
    signal_type: SignalType
    confidence: float = 0.0
    detail: str = ""


class SignalResponse(Signal):
    """Signal with enriched fund info for the dashboard."""
    fund_name: str = ""
    daily_change: float = 0.0


class StrategyMeta(BaseModel):
    name: str
    description: str
    params_schema: dict
    enabled: bool = True


class StrategyToggleRequest(BaseModel):
    enabled: bool


class StrategyLog(BaseModel):
    timestamp: str
    message: str


class SystemStatus(BaseModel):
    last_update: str | None = None
    strategies_running: int = 0
    funds_watched: int = 0
    connected: bool = True


class FundDetail(Fund):
    """Fund with enriched detail for the detail page."""
    type: Optional[str] = None
    scale: Optional[float] = None
    established_date: Optional[str] = None
    latest_nav: float = 0.0
    latest_nav_date: Optional[str] = None
    daily_change: float = 0.0


class WatchlistFund(Fund):
    """Fund with signal enrichment for the watchlist page."""
    daily_change: float = 0.0
    signal_type: SignalType = SignalType.hold
    strategy_name: str = ""
    confidence: float = 0.0


class NavPoint(BaseModel):
    date: str
    netvalue: float


class StrategyState(BaseModel):
    name: str
    description: str
    enabled: bool = True


class Holding(BaseModel):
    fund_code: str
    fund_name: str
    shares: float
    cost_price: float
    current_value: float


class HoldingResponse(Holding):
    cost_basis: float = 0.0
    pl_amount: float = 0.0
    pl_percent: float = 0.0
    has_signal: bool = False


class QdiiPredictResponse(BaseModel):
    code: str
    t1_value: float
    t1_date: str
    t0_value: float
    t0_date: str
