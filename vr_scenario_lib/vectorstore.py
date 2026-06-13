"""Création d'embeddings, vectorstore FAISS et retriever avec fallback.

Fonctions atomiques pour construire l'index vectoriel
et configurer le retriever MMR avec système de fallback pour les embeddings.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any
from urllib.parse import urlsplit

import requests
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.vectorstores import VectorStoreRetriever

from .config import (
    DEFAULT_EMBEDDING_DEVICE,
    DEFAULT_EMBEDDING_MODEL,
    DEFAULT_FALLBACK_EMBEDDING_MODELS,
    DEFAULT_HUGGINGFACE_EMBEDDING_API_URL,
    DEFAULT_OPENROUTER_EMBEDDING_API_URL,
    DEFAULT_OPENROUTER_EMBEDDING_MODEL,
    DEFAULT_OPENROUTER_FALLBACK_EMBEDDING_MODELS,
    DEFAULT_RETRIEVER_FETCH_K,
    DEFAULT_RETRIEVER_K,
    DEFAULT_RETRIEVER_LAMBDA,
    DEFAULT_FAISS_INDEX_DIR,
)


def resolve_huggingface_inference_endpoint(api_url: str | None = None) -> str:
    """Résout et normalise l'endpoint d'inférence Hugging Face."""
    raw_url = api_url or os.environ.get("HUGGINGFACE_API_URL") or os.environ.get("HF_INFERENCE_ENDPOINT") or DEFAULT_HUGGINGFACE_EMBEDDING_API_URL
    if not raw_url:
        return ""

    parsed_url = urlsplit(raw_url)
    if parsed_url.scheme and parsed_url.netloc:
        endpoint_host = parsed_url.netloc.replace(
            "api-inference.huggingface.co",
            "api-inference.hf.co",
        )
        endpoint_path = parsed_url.path
        if endpoint_path.startswith("/pipeline/feature-extraction"):
            endpoint_path = ""
        if endpoint_path.endswith("/") and endpoint_path != "/":
            endpoint_path = endpoint_path.rstrip("/")
        return f"{parsed_url.scheme}://{endpoint_host}{endpoint_path}"

    return raw_url


# Assurer que du bon endpoint est défini AVANT l'import de huggingface_hub constants.
os.environ["HF_INFERENCE_ENDPOINT"] = resolve_huggingface_inference_endpoint()

logger = logging.getLogger(__name__)


class EmbeddingError(Exception):
    """Erreur lors de la création des embeddings."""
    pass


class EmbeddingFallbackExhaustedError(EmbeddingError):
    """Erreur quand tous les modèles d'embeddings de fallback ont échoué."""
    pass


class OpenRouterEmbeddings(Embeddings):
    """Embeddings OpenRouter via l'API OpenAI-compatible."""

    def __init__(self, model: str, api_key: str, api_url: str) -> None:
        self.model = model
        self.api_key = api_key
        self.api_url = api_url
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _request_embeddings(self, texts: list[str]) -> list[list[float]]:
        # Use a session and handle redirects manually so the Authorization header
        # is preserved when the host redirects (some hosts drop Authorization).
        session = requests.Session()
        try:
            response = session.post(
                self.api_url,
                json={"model": self.model, "input": texts},
                headers=self.headers,
                allow_redirects=False,
                timeout=60,
            )
        except requests.exceptions.RequestException as exc:
            # DNS fallback for OpenRouter: two valid host patterns exist:
            #   - openrouter.ai/api/v1/...  (primary, correct)
            #   - api.openrouter.ai/v1/...   (alternate, some networks resolve this)
            # If one fails to resolve, try the other.
            exc_text = str(exc)
            if "Failed to resolve" in exc_text or "Name or service not known" in exc_text:
                fallback_url = None
                if "openrouter.ai" in self.api_url and "api.openrouter.ai" not in self.api_url:
                    # openrouter.ai/api/v1/ -> api.openrouter.ai/v1/
                    fallback_url = self.api_url.replace("openrouter.ai/api/v1/", "api.openrouter.ai/v1/")
                elif "api.openrouter.ai" in self.api_url:
                    # api.openrouter.ai/v1/ -> openrouter.ai/api/v1/
                    fallback_url = self.api_url.replace("api.openrouter.ai/v1/", "openrouter.ai/api/v1/")

                if fallback_url:
                    try:
                        response = session.post(
                            fallback_url,
                            json={"model": self.model, "input": texts},
                            headers=self.headers,
                            allow_redirects=False,
                            timeout=60,
                        )
                    except Exception as exc2:
                        raise EmbeddingError(f"Requête OpenRouter impossible (fallback): {exc2}") from exc2
                else:
                    raise EmbeddingError(f"Requête OpenRouter impossible : {exc}") from exc
            else:
                raise EmbeddingError(f"Requête OpenRouter impossible : {exc}") from exc

        # If the server responds with a redirect, follow it explicitly
        if response.status_code in (301, 302, 303, 307, 308) and response.headers.get("Location"):
            redirected_url = response.headers.get("Location")
            try:
                response = session.post(
                    redirected_url,
                    json={"model": self.model, "input": texts},
                    headers=self.headers,
                    timeout=60,
                )
            except Exception as exc:
                raise EmbeddingError(f"Requête OpenRouter redirigée impossible : {exc}") from exc

        if response.status_code != 200:
            raise EmbeddingError(
                f"OpenRouter embeddings a échoué ({response.status_code}): {response.text}"
            )

        payload = response.json()
        if not isinstance(payload, dict) or "data" not in payload:
            raise EmbeddingError(
                f"Réponse OpenRouter invalide pour les embeddings : {json.dumps(payload)[:200]}"
            )

        embeddings = []
        for item in payload["data"]:
            if not isinstance(item, dict) or "embedding" not in item:
                raise EmbeddingError(
                    f"Réponse OpenRouter inattendue pour un embedding : {json.dumps(item)[:200]}"
                )
            embeddings.append(item["embedding"])

        return embeddings

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._request_embeddings(texts)

    def embed_query(self, text: str) -> list[float]:
        return self._request_embeddings([text])[0]


def create_embeddings(
    model_name: str = DEFAULT_EMBEDDING_MODEL,
    device: str = DEFAULT_EMBEDDING_DEVICE,
    provider: str | None = None,
    api_key: str | None = None,
    api_url: str | None = None,
    fallback_models: list[str] | None = None,
    openrouter_embedding_model: str | None = None,
    openrouter_embedding_api_url: str | None = None,
) -> Embeddings:
    """Crée une instance d'embeddings pour HuggingFace ou OpenRouter.

    Args:
        model_name: Nom du modèle principal.
        device: Ignoré pour l'API. Conserve le contrat de fonction.
        provider: Fournisseur d'embeddings : 'huggingface' ou 'openrouter'.
        api_key: Clé API pour le fournisseur choisi.
        api_url: URL du endpoint d'embeddings.
        fallback_models: Liste de modèles de secours.
        openrouter_embedding_model: Modèle OpenRouter spécifique.
        openrouter_embedding_api_url: URL OpenRouter spécifique.

    Returns:
        Une instance d'Embeddings prête à l'emploi.

    Raises:
        EmbeddingError: Si aucune clé API n'est fournie ou si la requête échoue.
        EmbeddingFallbackExhaustedError: Si tous les modèles échouent.
    """
    resolved_provider = (provider or os.environ.get("EMBEDDING_PROVIDER") or "huggingface").strip().lower()
    logger.info("=" * 60)
    logger.info("CONFIGURATION EMBEDDINGS DÉTAILLÉE")
    logger.info("=" * 60)
    logger.info("  Provider       : %s", resolved_provider)
    logger.info("  Modèle demandé : %s", model_name)
    if resolved_provider == "openrouter":
        resolved_api_key = api_key or os.environ.get("OPENROUTER_EMBEDDING_API_KEY") or os.environ.get("OPENROUTER_API_KEY")
        if not resolved_api_key:
            raise EmbeddingError(
                "Une clé API OpenRouter est requise pour les embeddings OpenRouter. "
                "Définissez OPENROUTER_EMBEDDING_API_KEY ou OPENROUTER_API_KEY."
            )

        resolved_api_url = (
            openrouter_embedding_api_url
            or os.environ.get("OPENROUTER_EMBEDDING_API_URL")
            or os.environ.get("OPENROUTER_API_URL")
            or DEFAULT_OPENROUTER_EMBEDDING_API_URL
        )
        resolved_model = (
            openrouter_embedding_model
            or os.environ.get("OPENROUTER_EMBEDDING_MODEL")
            or model_name
            or DEFAULT_OPENROUTER_EMBEDDING_MODEL
        )
        masked_key = resolved_api_key[:8] + '***' + resolved_api_key[-4:] if len(resolved_api_key) > 12 else '***REDACTED***'
        logger.info("  API URL        : %s", resolved_api_url)
        logger.info("  Modèle résolu  : %s", resolved_model)
        logger.info("  Clé API (masq.): %s", masked_key)
        logger.info("  Fallback models: %s", fallback_models or DEFAULT_OPENROUTER_FALLBACK_EMBEDDING_MODELS)
        logger.info("=" * 60)

        models_to_try = [resolved_model] + [
            m for m in (fallback_models or DEFAULT_OPENROUTER_FALLBACK_EMBEDDING_MODELS) if m != resolved_model
        ]
        errors: list[tuple[str, str]] = []

        for model in models_to_try:
            try:
                embeddings = OpenRouterEmbeddings(
                    model=model,
                    api_key=resolved_api_key,
                    api_url=resolved_api_url,
                )
                logger.info("OpenRouter embeddings configurés : %s", model)
                return embeddings
            except Exception as exc:
                errors.append((model, str(exc)))
                logger.warning(
                    "Échec du modèle OpenRouter embeddings %s : %s. Essai du modèle suivant...",
                    model,
                    str(exc)[:100],
                )
                continue

        error_summary = "\n".join(f"  - {m}: {e[:100]}" for m, e in errors)
        raise EmbeddingFallbackExhaustedError(
            f"Tous les modèles d'embeddings OpenRouter ont échoué.\n"
            f"Détails des erreurs :\n{error_summary}"
        )

    # Par défaut, HuggingFace embeddings
    resolved_api_key = api_key or os.environ.get("HUGGINGFACE_API_KEY") or os.environ.get("HF_TOKEN")
    if not resolved_api_key:
        raise EmbeddingError(
            "Une clé API HuggingFace est requise pour les embeddings. "
            "Définissez HUGGINGFACE_API_KEY ou HF_TOKEN."
        )

    resolved_api_url = api_url or os.environ.get("HUGGINGFACE_API_URL") or os.environ.get("HF_INFERENCE_ENDPOINT") or DEFAULT_HUGGINGFACE_EMBEDDING_API_URL
    masked_key = resolved_api_key[:8] + '***' + resolved_api_key[-4:] if len(resolved_api_key) > 12 else '***REDACTED***'
    logger.info("  API URL        : %s", resolved_api_url)
    logger.info("  Modèle résolu  : %s", model_name)
    logger.info("  Clé API (masq.): %s", masked_key)
    logger.info("  Fallback models: %s", fallback_models or DEFAULT_FALLBACK_EMBEDDING_MODELS)
    logger.info("=" * 60)
    hf_api_base = resolve_huggingface_inference_endpoint(resolved_api_url)
    if hf_api_base:
        os.environ["HF_INFERENCE_ENDPOINT"] = hf_api_base
        logger.info("Endpoint Hugging Face configuré sur : %s", hf_api_base)

    models_to_try = [model_name] + [
        m for m in (fallback_models or DEFAULT_FALLBACK_EMBEDDING_MODELS) if m != model_name
    ]
    errors: list[tuple[str, str]] = []

    from langchain_huggingface import HuggingFaceEndpointEmbeddings

    for model in models_to_try:
        try:
            embeddings = HuggingFaceEndpointEmbeddings(
                model=model,
                task="feature-extraction",
                huggingfacehub_api_token=resolved_api_key,
            )
            logger.info("Embeddings API créés : %s", model)
            return embeddings
        except Exception as exc:
            error_msg = str(exc)
            if "402" in error_msg or "Payment Required" in error_msg:
                raise EmbeddingError(
                    "Hugging Face a retourné 402 Payment Required pour le modèle d'embeddings. "
                    "Cela signifie que votre token HF a épuisé ses crédits d'inférence. "
                    "Ce projet utilise un endpoint distant, pas un modèle local. "
                    "Rechargez votre compte Hugging Face, utilisez un token avec crédits valides, "
                    "ou changez de modèle/endpoint distant."
                ) from exc

            errors.append((model, error_msg))
            logger.warning(
                "Échec du modèle d'embeddings API %s : %s. Essai du modèle suivant...",
                model,
                error_msg[:100],
            )
            continue

    error_summary = "\n".join(f"  - {m}: {e[:100]}" for m, e in errors)
    raise EmbeddingFallbackExhaustedError(
        f"Tous les modèles d'embeddings API ont échoué.\n"
        f"Détails des erreurs :\n{error_summary}"
    )


def build_vectorstore(
    chunks: list[Document],
    embeddings: Embeddings,
) -> FAISS:
    """Construit un vectorstore FAISS à partir de chunks et d'embeddings.

    Args:
        chunks: Liste de documents découpés à indexer.
        embeddings: Instance d'embeddings pour la vectorisation.

    Returns:
        Vectorstore FAISS indexé.

    Raises:
        ValueError: Si la liste de chunks est vide.
    """
    if not chunks:
        raise ValueError("Aucun chunk à indexer.")

    vectorstore = FAISS.from_documents(chunks, embeddings)
    logger.info("FAISS créé : %d vecteurs indexés", vectorstore.index.ntotal)
    return vectorstore


def save_vectorstore(vectorstore: FAISS, folder_path: str = DEFAULT_FAISS_INDEX_DIR) -> None:
    """Sauvegarde le vectorstore FAISS localement sur le disque.

    Args:
        vectorstore: Instance de FAISS à sauvegarder.
        folder_path: Chemin du dossier de sauvegarde.
    """
    os.makedirs(folder_path, exist_ok=True)
    vectorstore.save_local(folder_path)
    logger.info("Vectorstore FAISS sauvegardé localement dans : %s", folder_path)


def load_vectorstore(
    folder_path: str = DEFAULT_FAISS_INDEX_DIR,
    embeddings: Embeddings | None = None,
) -> FAISS | None:
    """Charge un vectorstore FAISS depuis le disque s'il existe.

    Args:
        folder_path: Chemin du dossier contenant l'index FAISS sauvegardé.
        embeddings: Instance d'embeddings pour la recherche vectorielle.

    Returns:
        Instance de FAISS chargée, ou None si le dossier n'existe pas.
    """
    if not os.path.exists(folder_path) or not os.path.exists(
        os.path.join(folder_path, "index.faiss")
    ):
        logger.info("Aucun index FAISS local trouvé dans : %s", folder_path)
        return None
    
    if embeddings is None:
        logger.warning("Aucun embedding fourni pour charger le vectorstore.")
        return None
    
    try:
        vectorstore = FAISS.load_local(
            folder_path,
            embeddings,
            allow_dangerous_deserialization=True,
        )
        # Validate loaded index dimension against the embedding dimension to
        # avoid runtime AssertionError when searching with mismatched vectors.
        index_dim = getattr(vectorstore.index, "d", None)
        if index_dim is not None:
            logger.info("FAISS index dimension detected: %s", index_dim)

        try:
            sample_vec = embeddings.embed_query("test")
        except Exception as emb_exc:
            # Cannot verify dimension compatibility — returning a potentially
            # mismatched index would cause an AssertionError at search time.
            # Force a rebuild instead.
            logger.warning(
                "Impossible de vérifier la dimension des embeddings (%s). "
                "Reconstruction de l'index forcée.",
                str(emb_exc)[:150],
            )
            return None

        emb_dim = len(sample_vec)
        logger.info("Sample embedding dimension: %s", emb_dim)

        if index_dim is not None and emb_dim != index_dim:
            logger.warning(
                "Dimension mismatch: FAISS index dim=%s but embedding dim=%s. "
                "Forcing index rebuild.",
                index_dim,
                emb_dim,
            )
            return None

        logger.info(
            "Vectorstore FAISS chargé depuis le disque : %d vecteurs",
            vectorstore.index.ntotal,
        )
        return vectorstore
    except Exception as exc:
        logger.warning(
            "Erreur lors du chargement de l'index FAISS depuis %s : %s",
            folder_path,
            exc,
        )
        return None


def create_retriever(
    vectorstore: FAISS,
    search_type: str = "mmr",
    k: int = DEFAULT_RETRIEVER_K,
    fetch_k: int = DEFAULT_RETRIEVER_FETCH_K,
    lambda_mult: float = DEFAULT_RETRIEVER_LAMBDA,
) -> VectorStoreRetriever:
    """Crée un retriever MMR à partir d'un vectorstore.

    Args:
        vectorstore: Vectorstore FAISS source.
        search_type: Type de recherche (``mmr``, ``similarity``).
        k: Nombre de documents retournés.
        fetch_k: Nombre de candidats initiaux pour MMR.
        lambda_mult: Facteur de diversité MMR (0=max diversité, 1=max pertinence).

    Returns:
        Retriever configuré.
    """
    search_kwargs: dict[str, Any] = {
        "k": k,
        "fetch_k": fetch_k,
        "lambda_mult": lambda_mult,
    }
    retriever = vectorstore.as_retriever(
        search_type=search_type,
        search_kwargs=search_kwargs,
    )
    logger.info(
        "Retriever créé : type=%s, k=%d, fetch_k=%d, lambda=%.2f",
        search_type,
        k,
        fetch_k,
        lambda_mult,
    )
    return retriever