"""Application configuration helpers."""
from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional


_SETTINGS_CACHE: Optional["AppSettings"] = None


@dataclass
class MemorySettings:
    """Settings for mem0 and supermemory."""

    mem0_api_key: str | None = None
    supermemory_api_key: str | None = None
    namespace: str = "obsidian"


@dataclass
class OpenSearchSettings:
    """OpenSearch connection details."""

    host: str = "http://localhost:9200"
    index: str = "obsidian-notes"
    username: str | None = None
    password: str | None = None
    verify_certs: bool = True


@dataclass
class LLMSettings:
    """DSPy language model configuration."""

    provider: str = "openai/gpt-4o-mini"
    api_key: str | None = None
    temperature: float = 0.2


@dataclass
class AppSettings:
    """Top-level application settings."""

    llm: LLMSettings = field(default_factory=LLMSettings)
    memories: MemorySettings = field(default_factory=MemorySettings)
    opensearch: OpenSearchSettings = field(default_factory=OpenSearchSettings)
    allow_cross_origin: bool = True
    api_key: str | None = None

    @classmethod
    def load(cls, path: Path | None = None) -> "AppSettings":
        """Load configuration from ``settings.toml`` and environment variables."""

        global _SETTINGS_CACHE
        if _SETTINGS_CACHE is not None:
            return _SETTINGS_CACHE

        data: Dict[str, Any] = {}
        if path is None:
            path = Path(__file__).with_name("settings.toml")
        if path.exists():
            with path.open("rb") as fh:
                data = tomllib.load(fh)

        def override(prefix: str, key: str, default: Any) -> Any:
            env_key = f"DSPY_OBSIDIAN_{prefix}_{key}".upper()
            return os.getenv(env_key, default)

        llm_cfg = data.get("llm", {})
        memories_cfg = data.get("memories", {})
        os_cfg = data.get("opensearch", {})
        app_cfg = data.get("app", {})

        raw_allow_cross_origin = override(
            "APP",
            "ALLOW_CROSS_ORIGIN",
            app_cfg.get("allow_cross_origin", data.get("allow_cross_origin", True)),
        )
        raw_api_key = override("APP", "API_KEY", app_cfg.get("api_key", data.get("api_key")))
        if raw_api_key is None:
            api_key = None
        else:
            api_key = str(raw_api_key).strip() or None

        settings = cls(
            llm=LLMSettings(
                provider=override("LLM", "PROVIDER", llm_cfg.get("provider", "openai/gpt-4o-mini")),
                api_key=override("LLM", "API_KEY", llm_cfg.get("api_key")),
                temperature=float(override("LLM", "TEMPERATURE", llm_cfg.get("temperature", 0.2))),
            ),
            memories=MemorySettings(
                mem0_api_key=override("MEMORY", "MEM0_API_KEY", memories_cfg.get("mem0_api_key")),
                supermemory_api_key=override(
                    "MEMORY", "SUPERMEMORY_API_KEY", memories_cfg.get("supermemory_api_key")
                ),
                namespace=override("MEMORY", "NAMESPACE", memories_cfg.get("namespace", "obsidian")),
            ),
            opensearch=OpenSearchSettings(
                host=override("OPENSEARCH", "HOST", os_cfg.get("host", "http://localhost:9200")),
                index=override("OPENSEARCH", "INDEX", os_cfg.get("index", "obsidian-notes")),
                username=override("OPENSEARCH", "USERNAME", os_cfg.get("username")),
                password=override("OPENSEARCH", "PASSWORD", os_cfg.get("password")),
                verify_certs=str(override("OPENSEARCH", "VERIFY_CERTS", os_cfg.get("verify_certs", True))).lower()
                in {"true", "1", "yes"},
            ),
            allow_cross_origin=str(raw_allow_cross_origin).lower() in {"true", "1", "yes"},
            api_key=api_key,
        )

        _SETTINGS_CACHE = settings
        return settings


settings = AppSettings.load()
