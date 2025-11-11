"""Minimal FastAPI backend to receive Tampermonkey Inspector selections."""
from __future__ import annotations

import os
import secrets
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, HttpUrl

API_KEY = os.getenv("INSPECTOR_API_KEY", "dev-key")

app = FastAPI(title="Tampermonkey Inspector Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


def verify_api_key(authorization: Optional[str] = Header(default=None)) -> None:
    """Validate an optional bearer token if the API key is configured."""
    if not API_KEY:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    if not secrets.compare_digest(token, API_KEY):
        raise HTTPException(status_code=401, detail="Invalid API key")


class ElementSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tag: str
    id: Optional[str] = None
    classes: List[str] = Field(default_factory=list)
    attributes: Dict[str, str] = Field(default_factory=dict)
    text_preview: Optional[str] = Field(default=None, alias="textPreview")
    text_length: Optional[int] = Field(default=None, alias="textLength")


class SelectorPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    url: HttpUrl
    title: Optional[str] = None
    timestamp: datetime
    selectors: Dict[str, str]
    element: ElementSummary
    notes: Optional[str] = None
    snippet: Optional[str] = None
    trigger: str = Field(default="manual")


EVENTS: List[SelectorPayload] = []


@app.post("/events", status_code=201)
async def create_event(payload: SelectorPayload, _: None = Depends(verify_api_key)) -> dict[str, str]:
    EVENTS.append(payload)
    return {"status": "ok"}


@app.get("/events", response_model=List[SelectorPayload])
async def list_events(_: None = Depends(verify_api_key)) -> List[SelectorPayload]:
    return EVENTS


@app.post("/reset", status_code=204)
async def reset(_: None = Depends(verify_api_key)) -> None:
    EVENTS.clear()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
