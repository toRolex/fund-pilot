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
