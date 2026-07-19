"""Pydantic models for Fund Signal Workbench."""
from typing import Optional

from pydantic import BaseModel


class Fund(BaseModel):
    code: str
    name: str
    type: Optional[str] = None


class AddFundRequest(BaseModel):
    code: str
