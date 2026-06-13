"""Chargement et découpage de documents (PDF, DOCX) avec fallback.

Fonctions atomiques pour charger des fichiers depuis le filesystem
et les découper en chunks prêts pour l'indexation vectorielle.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from langchain_community.document_loaders import Docx2txtLoader, PyPDFLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from .config import DEFAULT_CHUNK_OVERLAP, DEFAULT_CHUNK_SIZE, SUPPORTED_EXTENSIONS

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class DocumentLoadError(Exception):
    """Erreur lors du chargement d'un document."""
    pass


class DocumentLoadWarning(UserWarning):
    """Avertissement lors du chargement d'un document (non bloquant)."""
    pass


# ---------------------------------------------------------------------------
# Fonctions atomiques
# ---------------------------------------------------------------------------


def _get_loader(path: str) -> PyPDFLoader | Docx2txtLoader:
    """Retourne le loader approprié selon l'extension du fichier.

    Args:
        path: Chemin absolu du fichier.

    Returns:
        Instance du loader LangChain correspondant.

    Raises:
        DocumentLoadError: Si l'extension n'est pas supportée.
    """
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        return PyPDFLoader(path)
    if ext == ".docx":
        return Docx2txtLoader(path)
    raise DocumentLoadError(f"Extension non supportée : {ext}")


def load_document(path: str) -> list[Document]:
    """Charge un document depuis un chemin fichier.

    Args:
        path: Chemin absolu vers un fichier PDF ou DOCX.

    Returns:
        Liste de documents LangChain extraits du fichier.

    Raises:
        DocumentLoadError: Si le fichier ne peut pas être chargé.
        FileNotFoundError: Si le fichier n'existe pas.
    """
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Fichier introuvable : {path}")
    try:
        loader = _get_loader(path)
        docs = loader.load()
        logger.info("Chargé : %s (%d pages/sections)", Path(path).name, len(docs))
        return docs
    except DocumentLoadError:
        raise
    except Exception as exc:
        raise DocumentLoadError(f"Erreur chargement {path} : {exc}") from exc


def _is_supported_file(filename: str) -> bool:
    """Vérifie si un fichier a une extension supportée.

    Args:
        filename: Nom du fichier (avec extension).

    Returns:
        True si l'extension est supportée.
    """
    return Path(filename).suffix.lower() in SUPPORTED_EXTENSIONS


def scan_directory(directory: str) -> list[Document]:
    """Parcourt récursivement un répertoire et charge tous les documents supportés.

    Args:
        directory: Chemin du répertoire à scanner.

    Returns:
        Liste de tous les documents chargés.

    Raises:
        FileNotFoundError: Si le répertoire n'existe pas.
        ValueError: Si aucun document valide n'est trouvé.
    """
    if not os.path.isdir(directory):
        raise FileNotFoundError(f"Répertoire introuvable : {directory}")

    all_docs: list[Document] = []
    errors: list[tuple[str, str]] = []
    
    for root, _dirs, files in os.walk(directory):
        for filename in files:
            if not _is_supported_file(filename):
                continue
            filepath = os.path.join(root, filename)
            try:
                all_docs.extend(load_document(filepath))
            except (DocumentLoadError, FileNotFoundError) as exc:
                error_msg = str(exc)
                errors.append((filename, error_msg))
                logger.warning("Ignoré %s : %s", filename, error_msg)

    logger.info("Scan terminé : %d documents chargés depuis %s", len(all_docs), directory)
    
    # Afficher un résumé des erreurs s'il y en a
    if errors:
        logger.warning("%d fichier(s) ignoré(s) sur %d au total :", len(errors), len(errors) + len(all_docs))
        for filename, error in errors[:5]:  # Limiter à 5 erreurs affichées
            logger.warning("  - %s : %s", filename, error[:80])
        if len(errors) > 5:
            logger.warning("  ... et %d autres", len(errors) - 5)
    
    if not all_docs:
        raise ValueError(
            f"Aucun document valide trouvé dans '{directory}'. "
            f"Vérifiez que le dossier contient des fichiers PDF ou DOCX."
        )
    
    return all_docs


def split_documents(
    documents: list[Document],
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[Document]:
    """Découpe une liste de documents en chunks.

    Args:
        documents: Documents source à découper.
        chunk_size: Taille maximale d'un chunk en caractères.
        chunk_overlap: Chevauchement entre chunks consécutifs.

    Returns:
        Liste de chunks (documents découpés).

    Raises:
        ValueError: Si la liste de documents est vide.
    """
    if not documents:
        raise ValueError("Aucun document à découper.")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    chunks = splitter.split_documents(documents)
    logger.info(
        "%d documents → %d chunks (taille=%d, overlap=%d)",
        len(documents),
        len(chunks),
        chunk_size,
        chunk_overlap,
    )
    return chunks