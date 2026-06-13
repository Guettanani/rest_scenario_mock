"""Génération de scénarios de formation VR via RAG.

Retrieval → Formatage contexte → Appel LLM → Scénario texte.
"""

from __future__ import annotations

import logging

from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStoreRetriever

from .config import SYSTEM_SCENARIO, SYSTEM_SCENARIO_DISCUSSION, LLMConfig
from .llm import call_llm, call_llm_messages
from .prompts import build_scenario_prompt, build_announcement_prompt
from .scenario_store import ScenarioSession

logger = logging.getLogger(__name__)


def retrieve_context(retriever: VectorStoreRetriever, topic: str) -> list[Document]:
    """Récupère les documents pertinents pour un sujet donné.

    Args:
        retriever: Retriever vectoriel configuré.
        topic: Sujet de recherche.

    Returns:
        Liste de documents pertinents.
    """
    docs = retriever.invoke(topic)
    logger.info("Retrieval : %d documents trouvés pour '%s'", len(docs), topic[:80])
    for i, doc in enumerate(docs):
        logger.info("  Doc #%d — source: %s, contenu: %d car.", i + 1, doc.metadata.get('source', 'inconnu'), len(doc.page_content))
    return docs


def format_context(docs: list[Document]) -> str:
    """Formate une liste de documents en contexte textuel numéroté.

    Args:
        docs: Documents à formater.

    Returns:
        Contexte formaté avec sources numérotées, séparées par ``---``.
    """
    return "\n\n---\n\n".join(
        f"[Source {i + 1} — {doc.metadata.get('source', 'inconnu')}]\n{doc.page_content}"
        for i, doc in enumerate(docs)
    )


def generate_scenario(
    topic: str,
    retriever: VectorStoreRetriever,
    llm_config: LLMConfig,
    custom_prompt: str = "",
) -> tuple[str, list[Document]]:
    """Génère un scénario de formation VR texte via RAG.

    Orchestre le flux : retrieval → formatage → appel LLM.

    Args:
        topic: Thème du scénario à générer.
        retriever: Retriever vectoriel pour le contexte documentaire.
        llm_config: Configuration du LLM.

    Returns:
        Tuple (texte du scénario, documents sources utilisés).
    """
    logger.info("=" * 60)
    logger.info("GÉNÉRATION DE SCÉNARIO — ÉTAPE 1/3 : Retrieval")
    logger.info("=" * 60)
    docs = retrieve_context(retriever, topic)

    logger.info("GÉNÉRATION DE SCÉNARIO — ÉTAPE 2/3 : Formatage contexte")
    context = format_context(docs)
    logger.info("  Contexte formaté : %d caractères", len(context))
    user_prompt = build_scenario_prompt(topic, context)
    if custom_prompt:
        logger.info("  Custom prompt injecté : %s", custom_prompt[:200])
        user_prompt += "\n\n---\n\nCONSIGNES SUPPLÉMENTAIRES DE L'UTILISATEUR :\n" + custom_prompt
    logger.info("  User prompt final : %d caractères", len(user_prompt))

    logger.info("GÉNÉRATION DE SCÉNARIO — ÉTAPE 3/3 : Appel LLM")
    logger.info("  Modèle LLM   : %s", llm_config.get("model", "inconnu"))
    logger.info("  API URL       : %s", llm_config.get("api_url", "inconnu"))
    logger.info("  Max tokens    : %d", 2000)
    scenario_text = call_llm(
        system_prompt=SYSTEM_SCENARIO,
        user_prompt=user_prompt,
        config=llm_config,
        max_tokens=2000,
    )

    logger.info("=" * 60)
    logger.info("SCÉNARIO GÉNÉRÉ AVEC SUCCÈS")
    logger.info("=" * 60)
    logger.info(
        "  Taille : %d caractères, %d sources",
        len(scenario_text),
        len(docs),
    )
    logger.info("  Aperçu (200 premiers car.) : %s", scenario_text[:200])
    return scenario_text, docs


def generate_narrative(scenario: dict, llm_config: LLMConfig) -> str:
    """Génère un texte narratif fluide à partir d'un scénario structuré.

    Args:
        scenario: Dictionnaire du scénario structuré (sortie JSON).
        llm_config: Configuration du LLM.

    Returns:
        Texte narratif prêt à être annoncé à voix haute.
    """
    logger.info("=" * 60)
    logger.info("GÉNÉRATION DU TEXTE NARRATIF")
    logger.info("=" * 60)

    user_prompt = build_announcement_prompt(scenario)
    logger.info("  Prompt d'annonce : %d caractères", len(user_prompt))

    narrative = call_llm(
        system_prompt=SYSTEM_SCENARIO,
        user_prompt=user_prompt,
        config=llm_config,
        max_tokens=2000,
    )

    logger.info("  Texte narratif généré : %d caractères", len(narrative))
    logger.info("  Aperçu : %s", narrative[:200])
    return narrative


def discuss_scenario(
    session: ScenarioSession,
    user_message: str,
    llm_config: LLMConfig,
    retriever: VectorStoreRetriever | None = None,
) -> str:
    """Discute du scénario textuel avec le LLM (multi-tours avec historique).

    Met à jour l'historique de la session en place.

    Args:
        session: Session persistée contenant le scénario textuel.
        user_message: Question ou description d'action de l'utilisateur.
        llm_config: Configuration du LLM.
        retriever: Retriever optionnel pour enrichir avec le contexte documentaire.

    Returns:
        Réponse du LLM.
    """
    extra_context = ""
    if retriever is not None:
        docs = retrieve_context(retriever, user_message)
        if docs:
            extra_context = (
                "\n\n---\n\nCONTEXTE DOCUMENTAIRE COMPLÉMENTAIRE:\n"
                + format_context(docs)
            )

    system_content = (
        f"{SYSTEM_SCENARIO_DISCUSSION}\n\n"
        f"--- SCÉNARIO EN COURS ---\n{session.scenario_text}"
    )

    messages: list[dict[str, str]] = [{"role": "system", "content": system_content}]
    messages.extend(session.history)

    user_content = user_message + extra_context if extra_context else user_message
    messages.append({"role": "user", "content": user_content})

    reply = call_llm_messages(messages, llm_config, max_tokens=1500)

    session.history.append({"role": "user", "content": user_message})
    session.history.append({"role": "assistant", "content": reply})

    logger.info("Discussion scénario — échange #%d, réponse : %d car.",
                len(session.history) // 2, len(reply))
    return reply