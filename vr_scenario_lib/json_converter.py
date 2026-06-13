"""Conversion de scénario texte en JSON structuré pour Unity VR.

Nettoyage de la sortie LLM, parsing JSON, et validation basique.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from .config import SYSTEM_JSON_CONVERTER, LLMConfig
from .llm import call_llm
from .prompts import build_json_conversion_prompt

logger = logging.getLogger(__name__)


class JsonParsingError(Exception):
    """Erreur lors du parsing du JSON généré par le LLM."""


def clean_llm_json(raw: str) -> str:
    """Nettoie une sortie LLM qui peut contenir des backticks markdown.

    Gère les cas courants :
    - ``\\`\\`\\`json ... \\`\\`\\` ``
    - ``\\`\\`\\` ... \\`\\`\\` ``
    - Backticks traînants

    Args:
        raw: Sortie brute du LLM.

    Returns:
        Chaîne JSON nettoyée.
    """
    clean = raw.strip()
    if "```" in clean:
        clean = clean.split("```")[1]
        if clean.startswith("json"):
            clean = clean[4:]
    return clean.strip().rstrip("`").strip()


def parse_scenario_json(clean_json: str) -> dict[str, Any]:
    """Parse une chaîne JSON et retourne le dictionnaire.

    Args:
        clean_json: Chaîne JSON nettoyée.

    Returns:
        Dictionnaire du scénario parsé.

    Raises:
        JsonParsingError: Si le JSON est invalide.
    """
    try:
        return json.loads(clean_json)
    except json.JSONDecodeError as exc:
        raise JsonParsingError(
            f"JSON invalide : {exc}\nExtrait : {clean_json[:300]}"
        ) from exc


def _log_scenario_stats(result: dict[str, Any]) -> None:
    """Log les statistiques d'un scénario JSON parsé.

    Args:
        result: Dictionnaire du scénario.
    """
    etapes = result.get("etapes", [])
    nb_etapes = len(etapes)
    nb_erreurs = sum(len(e.get("conditions_erreur", [])) for e in etapes)
    etat = result.get("etat_initial", {})

    logger.info("JSON parsé — Étapes: %d, Erreurs: %d", nb_etapes, nb_erreurs)
    logger.info("TYPE_POSTE: %s, METEO: %s", etat.get("TYPE_POSTE"), etat.get("METEO"))


def convert_scenario_to_json(
    scenario_text: str,
    llm_config: LLMConfig,
) -> dict[str, Any]:
    """Convertit un scénario texte en JSON structuré pour Unity VR.

    Orchestre : construction du prompt → appel LLM → nettoyage → parsing.

    Args:
        scenario_text: Texte du scénario à convertir.
        llm_config: Configuration du LLM.

    Returns:
        Dictionnaire JSON du scénario structuré.

    Raises:
        JsonParsingError: Si la sortie LLM ne peut pas être parsée en JSON.
        LLMError: Si l'appel LLM échoue.
    """
    user_prompt = build_json_conversion_prompt(scenario_text)

    raw = call_llm(
        system_prompt=SYSTEM_JSON_CONVERTER,
        user_prompt=user_prompt,
        config=llm_config,
        max_tokens=3000,
    )

    clean = clean_llm_json(raw)
    
    try:
        result = parse_scenario_json(clean)
    except JsonParsingError as exc:
        logger.warning("JSON invalide, tentative de correction...")
        # Demander au LLM de corriger le JSON
        correction_prompt = f"Le JSON suivant est invalide. Corrige-le et renvoie uniquement le JSON valide:\n\n{clean}"
        raw = call_llm(
            system_prompt=SYSTEM_JSON_CONVERTER,
            user_prompt=correction_prompt,
            config=llm_config,
            max_tokens=3000,
        )
        clean = clean_llm_json(raw)
        result = parse_scenario_json(clean)
    
    _log_scenario_stats(result)

    return result
