"""Persistance des scénarios textuels et historique de discussion LLM."""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

SESSION_FILENAME = "session.json"


@dataclass
class ScenarioSession:
    """Session de scénario : texte source, JSON structuré et historique de discussion."""

    scenario_id: str
    topic: str
    scenario_text: str
    scenario_json: dict[str, Any]
    history: list[dict[str, str]] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ScenarioSession:
        return cls(
            scenario_id=data["scenario_id"],
            topic=data["topic"],
            scenario_text=data["scenario_text"],
            scenario_json=data["scenario_json"],
            history=data.get("history", []),
            created_at=data.get("created_at", ""),
            updated_at=data.get("updated_at", ""),
        )


def _session_path(scenarios_dir: str, scenario_id: str) -> Path:
    return Path(scenarios_dir) / scenario_id / SESSION_FILENAME


def save_session(session: ScenarioSession, scenarios_dir: str) -> str:
    """Sauvegarde une session sur disque.

    Returns:
        Chemin absolu du fichier session.json.
    """
    now = datetime.now(timezone.utc).isoformat()
    if not session.created_at:
        session.created_at = now
    session.updated_at = now

    path = _session_path(scenarios_dir, session.scenario_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(session.to_dict(), f, ensure_ascii=False, indent=2)

    logger.info("Session sauvegardée : %s", path)
    return str(path)


def load_session(path_or_id: str, scenarios_dir: str = "./scenarios") -> ScenarioSession:
    """Charge une session depuis un chemin ou un scenario_id."""
    path = Path(path_or_id)
    if not path.exists():
        path = _session_path(scenarios_dir, path_or_id)
    if not path.exists():
        raise FileNotFoundError(f"Session introuvable : {path_or_id}")

    with open(path, encoding="utf-8") as f:
        return ScenarioSession.from_dict(json.load(f))


def create_session(
    topic: str,
    scenario_text: str,
    scenario_json: dict[str, Any],
    scenarios_dir: str,
) -> ScenarioSession:
    """Crée et persiste une nouvelle session de scénario."""
    scenario_id = scenario_json.get("scenario_id", "scenario")
    session = ScenarioSession(
        scenario_id=scenario_id,
        topic=topic,
        scenario_text=scenario_text,
        scenario_json=scenario_json,
    )
    save_session(session, scenarios_dir)
    return session


def list_sessions(scenarios_dir: str) -> list[str]:
    """Liste les scenario_id des sessions sauvegardées."""
    root = Path(scenarios_dir)
    if not root.exists():
        return []
    return sorted(p.parent.name for p in root.glob(f"*/{SESSION_FILENAME}"))
