"""Appel au LLM via l'API HuggingFace Router avec système de fallback.

Fonction atomique : envoyer un prompt system + user
et recevoir la réponse textuelle avec fallback automatique sur plusieurs modèles.

Pour un démarrage rapide avec les scénarios VR, voir le module quickstart_vr.
"""

from __future__ import annotations

import logging
import os
import time

import requests

from .config import LLMConfig

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Erreur lors de l'appel au LLM."""
    pass


class LLMFallbackExhaustedError(LLMError):
    """Erreur quand tous les modèles de fallback ont échoué."""
    pass


def sanitize_token(msg: str, token: str | None) -> str:
    """Remplace le token d'authentification par une valeur anonymisée dans les messages.

    Args:
        msg: Message d'erreur brut susceptible de contenir le token.
        token: Le token d'API à masquer.

    Returns:
        Message d'erreur anonymisé.
    """
    if token and token in msg:
        return msg.replace(token, "hf_***[REDACTED]")
    return msg


def _build_headers(token: str) -> dict[str, str]:
    """Construit les headers HTTP pour l'API HuggingFace.

    Args:
        token: Token d'authentification Bearer.

    Returns:
        Dictionnaire des headers HTTP.

    Raises:
        LLMError: Si le token est vide ou None.
    """
    if not token:
        raise LLMError(
            "Token d'authentification manquant. "
            "Vérifiez que OPENROUTER_API_KEY ou HF_TOKEN est défini dans l'environnement. "
            f"Variables d'environnement disponibles : OPENROUTER_API_KEY={'oui' if os.environ.get('OPENROUTER_API_KEY') else 'NON'}, "
            f"HF_TOKEN={'oui' if os.environ.get('HF_TOKEN') else 'NON'}, "
            f"HUGGINGFACE_API_KEY={'oui' if os.environ.get('HUGGINGFACE_API_KEY') else 'NON'}"
        )
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _build_payload(
    model: str,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int,
    temperature: float,
    messages: list[dict[str, str]] | None = None,
) -> dict:
    """Construit le payload JSON pour l'API chat/completions.

    Args:
        model: Identifiant du modèle.
        system_prompt: Prompt système (ignoré si messages fourni).
        user_prompt: Prompt utilisateur (ignoré si messages fourni).
        max_tokens: Nombre max de tokens en sortie.
        temperature: Température de génération.
        messages: Historique complet de messages (prioritaire).

    Returns:
        Payload JSON prêt à envoyer.
    """
    if messages is not None:
        chat_messages = messages
    else:
        chat_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
    return {
        "model": model,
        "messages": chat_messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }


def _extract_content(response_json: dict) -> str:
    """Extrait le contenu textuel de la réponse LLM.

    Args:
        response_json: Réponse JSON brute de l'API.

    Returns:
        Texte du message assistant, nettoyé.

    Raises:
        LLMError: Si la structure de réponse est inattendue.
    """
    try:
        return response_json["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError) as exc:
        raise LLMError(f"Structure de réponse LLM inattendue : {exc}") from exc


def _call_llm_single_model(
    system_prompt: str,
    user_prompt: str,
    config: LLMConfig,
    model: str,
    max_tokens: int | None = None,
    messages: list[dict[str, str]] | None = None,
) -> str:
    """Appelle le LLM avec un seul modèle (sans fallback interne).

    Args:
        system_prompt: Prompt système définissant le rôle du LLM.
        user_prompt: Prompt utilisateur avec la requête.
        config: Configuration LLM (URL, token, etc.).
        model: Modèle spécifique à utiliser.
        max_tokens: Override du nombre max de tokens.

    Returns:
        Réponse textuelle du LLM.

    Raises:
        LLMError: Si l'appel HTTP échoue ou la réponse est invalide.
    """
    headers = _build_headers(config["token"])
    payload = _build_payload(
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        max_tokens=max_tokens or config["max_tokens"],
        temperature=config["temperature"],
        messages=messages,
    )

    api_url = config["api_url"]
    token = config.get("token")
    masked_token = token[:8] + '***' + token[-4:] if token and len(token) > 12 else '***REDACTED***'
    logger.info("=" * 60)
    logger.info("APPEL LLM DÉTAILLÉ")
    logger.info("=" * 60)
    logger.info("  API URL       : %s", api_url)
    logger.info("  Modèle        : %s", model)
    logger.info("  Token (masqué): %s", masked_token)
    logger.info("  Max tokens    : %d", max_tokens or config["max_tokens"])
    logger.info("  Température   : %.2f", config["temperature"])
    logger.info("  System prompt : %d car.", len(system_prompt))
    logger.info("  User prompt   : %d car.", len(user_prompt))
    if messages is not None:
        logger.info("  Messages chat : %d entrées", len(messages))
    # Debug: log headers (with token masked)
    debug_headers = {k: (v if k != "Authorization" else "Bearer " + masked_token) for k, v in headers.items()}
    logger.debug("  Headers       : %s", debug_headers)
    logger.info("=" * 60)

    max_retries = config.get("max_retries", 3)
    backoff_factor = config.get("retry_backoff_factor", 2.0)
    initial_delay = 1.0

    token = config.get("token")
    last_exception: Exception | None = None

    # DNS fallback for OpenRouter: two valid host patterns exist:
    #   - openrouter.ai/api/v1/...  (primary, correct)
    #   - api.openrouter.ai/v1/...   (alternate, some networks resolve this)
    # If one fails to resolve, try the other.
    fallback_api_url = None
    if "api.openrouter.ai" in api_url:
        # api.openrouter.ai/v1/ -> openrouter.ai/api/v1/
        fallback_api_url = api_url.replace("api.openrouter.ai/v1/", "openrouter.ai/api/v1/")
    elif "openrouter.ai" in api_url and "api.openrouter.ai" not in api_url:
        # openrouter.ai/api/v1/ -> api.openrouter.ai/v1/
        fallback_api_url = api_url.replace("openrouter.ai/api/v1/", "api.openrouter.ai/v1/")

    for attempt in range(1, max_retries + 1):
        try:
            logger.info("Appel LLM (modèle: %s, tentative %d/%d)...", model.split("/")[-1], attempt, max_retries)
            attempt_start = time.monotonic()
            logger.info(
                "LLM request start model=%s api_url=%s timeout=%ss",
                model.split("/")[-1],
                api_url,
                config["timeout"],
            )
            try:
                response = requests.post(
                    api_url,
                    headers=headers,
                    json=payload,
                    timeout=config["timeout"],
                )
            except requests.ConnectionError as conn_exc:
                # If DNS resolution fails, try the fallback URL
                if fallback_api_url and ("Failed to resolve" in str(conn_exc) or "Name or service not known" in str(conn_exc) or "NameResolutionError" in str(conn_exc)):
                    logger.info("DNS échoué pour %s, tentative avec %s", api_url, fallback_api_url)
                    response = requests.post(
                        fallback_api_url,
                        headers=headers,
                        json=payload,
                        timeout=config["timeout"],
                    )
                else:
                    raise

            attempt_elapsed = time.monotonic() - attempt_start
            logger.info(
                "LLM response received model=%s status_code=%s elapsed=%.2fs",
                model.split("/")[-1],
                response.status_code,
                attempt_elapsed,
            )
            if response.ok:
                content = _extract_content(response.json())
                logger.info("LLM réponse reçue de %s (%d caractères)", model.split("/")[-1], len(content))
                return content

            if response.status_code == 402:
                error_msg = (
                    "Hugging Face a retourné 402 Payment Required pour le modèle LLM. "
                    "Ce service utilise un endpoint distant et votre token a probablement épuisé "
                    "ses crédits d'inférence. Rechargez votre compte Hugging Face ou utilisez un token "
                    "avec des crédits valides."
                )
                logger.error("Erreur 402 Payment Required pour %s : %s", model.split("/")[-1], error_msg)
                raise LLMError(error_msg)

            if response.status_code in (429, 500, 502, 503, 504):
                error_msg = f"Erreur HTTP {response.status_code} : {response.text[:300]}"
                error_msg = sanitize_token(error_msg, token)
                logger.warning(
                    "Tentative %d/%d échouée pour %s (code %d). Pause avant nouvel essai.",
                    attempt, max_retries, model.split("/")[-1], response.status_code
                )
                last_exception = LLMError(error_msg)
            else:
                error_msg = f"Erreur HTTP {response.status_code} : {response.text[:300]}"
                error_msg = sanitize_token(error_msg, token)
                logger.error("Erreur HTTP non récupérable %d pour %s : %s", response.status_code, model.split("/")[-1], error_msg)
                raise LLMError(error_msg)

        except requests.RequestException as exc:
            exc_msg = sanitize_token(str(exc), token)
            logger.warning(
                "Tentative %d/%d échouée pour %s (erreur réseau) : %s",
                attempt, max_retries, model.split("/")[-1], exc_msg
            )
            last_exception = LLMError(f"Erreur réseau lors de l'appel LLM : {exc_msg}")

        if attempt < max_retries:
            sleep_time = initial_delay * (backoff_factor ** (attempt - 1))
            logger.info("Attente de %.1f secondes avant la prochaine tentative...", sleep_time)
            time.sleep(sleep_time)

    if last_exception:
        raise last_exception
    raise LLMError(f"Échec de l'appel LLM après toutes les tentatives pour {model}.")


def call_llm(
    system_prompt: str,
    user_prompt: str,
    config: LLMConfig,
    max_tokens: int | None = None,
) -> str:
    """Appelle le LLM avec système de fallback automatique sur plusieurs modèles.

    Essaie d'abord le modèle principal, puis les modèles de fallback configurés.

    Args:
        system_prompt: Prompt système définissant le rôle du LLM.
        user_prompt: Prompt utilisateur avec la requête.
        config: Configuration LLM (URL, modèle, fallback_models, token, etc.).
        max_tokens: Override du nombre max de tokens (prioritaire sur config).

    Returns:
        Réponse textuelle du LLM.

    Raises:
        LLMFallbackExhaustedError: Si tous les modèles (principal + fallback) échouent.
    """
    # Construire la liste complète : modèle principal + fallbacks
    primary_model = config["model"]
    fallback_models = config.get("fallback_models", [])
    
    # Éviter les doublons
    all_models = [primary_model] + [m for m in fallback_models if m != primary_model]
    
    logger.info("Appel LLM avec fallback - Modèles disponibles : %d", len(all_models))
    for idx, m in enumerate(all_models):
        label = "PRINCIPAL" if idx == 0 else f"fallback #{idx}"
        logger.info("  [%s] %s", label, m)
    
    errors: list[tuple[str, str]] = []
    
    for model in all_models:
        try:
            return _call_llm_single_model(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                config=config,
                model=model,
                max_tokens=max_tokens,
            )
        except LLMError as exc:
            error_msg = str(exc)
            errors.append((model, error_msg))
            logger.warning("Modèle %s échoué, tentative avec le modèle suivant...", model.split("/")[-1])
            continue
    
    # Tous les modèles ont échoué
    error_summary = "\n".join(f"  - {m.split('/')[-1]}: {e[:100]}" for m, e in errors)
    raise LLMFallbackExhaustedError(
        f"Tous les modèles LLM ont échoué après toutes les tentatives.\n"
        f"Détails des erreurs :\n{error_summary}"
    )


def call_llm_messages(
    messages: list[dict[str, str]],
    config: LLMConfig,
    max_tokens: int | None = None,
) -> str:
    """Appelle le LLM avec un historique de messages multi-tours.

    Args:
        messages: Liste de messages {"role": "system"|"user"|"assistant", "content": "..."}.
        config: Configuration LLM.
        max_tokens: Override du nombre max de tokens.

    Returns:
        Réponse textuelle du LLM.
    """
    primary_model = config["model"]
    fallback_models = config.get("fallback_models", [])
    all_models = [primary_model] + [m for m in fallback_models if m != primary_model]

    errors: list[tuple[str, str]] = []

    for model in all_models:
        try:
            return _call_llm_single_model(
                system_prompt="",
                user_prompt="",
                config=config,
                model=model,
                max_tokens=max_tokens,
                messages=messages,
            )
        except LLMError as exc:
            errors.append((model, str(exc)))
            logger.warning("Modèle %s échoué, tentative avec le modèle suivant...", model.split("/")[-1])
            continue

    error_summary = "\n".join(f"  - {m.split('/')[-1]}: {e[:100]}" for m, e in errors)
    raise LLMFallbackExhaustedError(
        f"Tous les modèles LLM ont échoué après toutes les tentatives.\n"
        f"Détails des erreurs :\n{error_summary}"
    )