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


class SignalResponse(Signal):
    """Signal with enriched fund info for the dashboard."""
    fund_name: str = ""
    daily_change: float = 0.0


class StrategyMeta(BaseModel):
    name: str
    description: str
    params_schema: dict


class FundDetail(Fund):
    """Fund with enriched detail for the detail page."""
    type: Optional[str] = None
    scale: Optional[float] = None
    established_date: Optional[str] = None
    latest_nav: float = 0.0
    latest_nav_date: Optional[str] = None
    daily_change: float = 0.0


class NavPoint(BaseModel):
    date: str
    netvalue: float


class StrategyState(BaseModel):
    name: str
    description: str
    enabled: bool = True
