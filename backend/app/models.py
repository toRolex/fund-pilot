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
