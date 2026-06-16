#!/usr/bin/env python3
"""Serveur RESTful pour VR Scenario Library.

Expose le pipeline de génération de scénarios via une API REST FastAPI.

Usage:
    python rest_server.py [--port 8000] [--host 0.0.0.0] [--docs-dir ./documents] [--faiss-dir faiss_index]

Endpoints:
    GET  /health                        - Health check
    POST /api/v1/scenario/generate      - Génère un scénario VR
    GET  /api/v1/scenario/{scenario_id}  - Récupère un scénario sauvegardé
    POST /api/v1/scenario/save          - Sauvegarde un scénario valide
    GET  /api/v1/scenarios              - Liste tous les scénarios
    POST /api/v1/index/refresh          - Reconstruit l'index FAISS
    GET  /api/v1/documents              - Liste les documents indexés
    POST /api/v1/files/upload           - Upload un fichier document
    GET  /api/v1/files                  - Liste les fichiers uploadés
    DELETE /api/v1/files/{file_id}      - Supprime un fichier uploadé
    POST /api/v1/assignments            - Crée une assignation scenario-apprenant
    GET  /api/v1/assignments/me         - Liste les assignations de l'utilisateur
"""

from __future__ import annotations

import json as _json
import logging
import os
import shutil

# import signal
# import sys
import time
import uuid
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile

# , Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from vr_scenario_lib import (
    build_llm_config,
    create_embeddings,
    create_retriever,
    load_vectorstore,
    run_pipeline,
    save_vectorstore,
    scan_directory,
    split_documents,
)
from vr_scenario_lib.scenario_store import list_sessions, load_session
from vr_scenario_lib.vectorstore import build_vectorstore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

# Configuration par défaut
DEFAULT_PORT = 3001
DEFAULT_HOST = "0.0.0.0"
DEFAULT_DOCS_DIR = "./documents"
DEFAULT_FAISS_DIR = "faiss_index"
DEFAULT_SCENARIOS_DIR = "./scenarios"

# =============================================================================
# État global du serveur
# =============================================================================

_server_state: dict[str, Any] = {
    "llm_config": None,
    "embeddings": None,
    "vectorstore": None,
    "retriever": None,
    "initialized": False,
    "docs_dir": DEFAULT_DOCS_DIR,
    "faiss_dir": DEFAULT_FAISS_DIR,
    "scenarios_dir": DEFAULT_SCENARIOS_DIR,
    "start_time": time.time(),
}


def initialize_state(
    docs_dir: str = DEFAULT_DOCS_DIR,
    faiss_dir: str = DEFAULT_FAISS_DIR,
    scenarios_dir: str = DEFAULT_SCENARIOS_DIR,
) -> None:
    """Initialise l'état du serveur (embeddings, vectorstore, retriever)."""
    global _server_state

    _server_state["docs_dir"] = docs_dir
    _server_state["faiss_dir"] = faiss_dir
    _server_state["scenarios_dir"] = scenarios_dir

    # Configuration LLM
    _server_state["llm_config"] = build_llm_config()
    logger.info("LLM config prêt - Modèle: %s", _server_state["llm_config"]["model"])

    # Embeddings
    embedding_fallback_models = None
    if os.environ.get("EMBEDDING_FALLBACK_MODELS"):
        embedding_fallback_models = [
            m.strip()
            for m in os.environ["EMBEDDING_FALLBACK_MODELS"].split(",")
            if m.strip()
        ]

    embedding_provider = os.environ.get("EMBEDDING_PROVIDER")
    if embedding_provider and embedding_provider.strip().lower() == "openrouter":
        embedding_api_key = os.environ.get(
            "OPENROUTER_EMBEDDING_API_KEY"
        ) or os.environ.get("OPENROUTER_API_KEY")
        embedding_api_url = os.environ.get(
            "OPENROUTER_EMBEDDING_API_URL"
        ) or os.environ.get("OPENROUTER_API_URL")
    else:
        embedding_api_key = os.environ.get("HUGGINGFACE_API_KEY") or os.environ.get(
            "HF_TOKEN"
        )
        embedding_api_url = os.environ.get("HF_INFERENCE_ENDPOINT") or os.environ.get(
            "HUGGINGFACE_API_URL"
        )

    _server_state["embeddings"] = create_embeddings(
        model_name=os.environ.get(
            "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
        ),
        device=os.environ.get("DEVICE", "cpu"),
        provider=embedding_provider,
        api_key=embedding_api_key,
        api_url=embedding_api_url,
        fallback_models=embedding_fallback_models,
    )
    logger.info("Embeddings initialisés")

    # Vectorstore (charger ou créer)
    _server_state["vectorstore"] = load_vectorstore(
        faiss_dir, _server_state["embeddings"]
    )
    if _server_state["vectorstore"] is None:
        logger.info("Création de l'index FAISS depuis %s...", docs_dir)
        raw_docs = scan_directory(docs_dir)
        chunks = split_documents(raw_docs)
        _server_state["vectorstore"] = build_vectorstore(
            chunks, _server_state["embeddings"]
        )
        save_vectorstore(_server_state["vectorstore"], faiss_dir)
        logger.info(
            "Index FAISS créé: %d vecteurs", _server_state["vectorstore"].index.ntotal
        )
    else:
        logger.info(
            "Index FAISS chargé: %d vecteurs", _server_state["vectorstore"].index.ntotal
        )

    # Retriever
    _server_state["retriever"] = create_retriever(_server_state["vectorstore"])
    _server_state["initialized"] = True
    logger.info("Serveur REST initialisé et prêt")


def refresh_index() -> None:
    """Reconstruit l'index FAISS depuis les documents."""
    global _server_state

    logger.info("Reconstruction de l'index FAISS...")
    raw_docs = scan_directory(_server_state["docs_dir"])
    chunks = split_documents(raw_docs)
    _server_state["vectorstore"] = build_vectorstore(
        chunks, _server_state["embeddings"]
    )
    save_vectorstore(_server_state["vectorstore"], _server_state["faiss_dir"])
    _server_state["retriever"] = create_retriever(_server_state["vectorstore"])
    logger.info(
        "Index reconstruit: %d vecteurs", _server_state["vectorstore"].index.ntotal
    )


# =============================================================================
# Modèles Pydantic (requêtes / réponses)
# =============================================================================


class GenerateRequest(BaseModel):
    """Requête de génération de scénario."""

    topic: str = Field(..., min_length=1, description="Sujet du scénario à générer")
    custom_prompt: str = Field("", description="Consignes supplémentaires optionnelles")
    store: bool = Field(True, description="Sauvegarder le scénario dans l'historique")


class GenerateResponse(BaseModel):
    """Réponse de génération de scénario."""

    success: bool
    scenario_id: str = ""
    titre: str = ""
    nb_etapes: int = 0
    scenario_json: dict[str, Any] = {}
    error_message: str = ""


class HealthResponse(BaseModel):
    """Réponse du health check."""

    status: str
    uptime_seconds: int
    vectorstore_size: int
    model: str


class ScenarioSummary(BaseModel):
    """Résumé d'un scénario sauvegardé."""

    scenario_id: str
    topic: str
    titre: str = ""
    nb_etapes: int = 0
    created_at: str = ""
    updated_at: str = ""


class ScenarioListResponse(BaseModel):
    """Liste des scénarios sauvegardés."""

    scenarios: list[ScenarioSummary] = []
    total: int = 0


class RefreshResponse(BaseModel):
    """Réponse de reconstruction d'index."""

    success: bool
    vectorstore_size: int = 0
    message: str = ""
    error_message: str = ""


class DocumentInfo(BaseModel):
    """Information sur un document indexé."""

    filename: str
    path: str
    size_bytes: int
    extension: str


class DocumentsResponse(BaseModel):
    """Liste des documents indexés."""

    documents: list[DocumentInfo] = []
    total: int = 0


class FileInfo(BaseModel):
    """Information sur un fichier uploade."""

    id: str
    filename: str
    path: str
    size_bytes: int
    extension: str
    status: str = "processed"


class FileUploadResponse(BaseModel):
    """Reponse d'upload de fichier."""

    success: bool
    file: FileInfo


class FilesResponse(BaseModel):
    """Liste des fichiers uploades."""

    files: list[FileInfo] = []
    total: int = 0


class SaveScenarioRequest(BaseModel):
    """Requete de sauvegarde d'un scenario valide."""

    titre: str = ""
    description: str = ""
    difficulte: str = "intermediaire"
    duree_totale: int = 30
    environnement: str = ""
    etapes: list[dict[str, Any]] = []
    parametres_techniques: dict[str, Any] = {}
    etat_initial: dict[str, Any] = {}


class SaveScenarioResponse(BaseModel):
    """Reponse de sauvegarde de scenario."""

    success: bool
    scenario_id: str = ""
    message: str = ""


class AssignmentRequest(BaseModel):
    """Requete de creation d'une assignation."""

    user_id: int
    scenario_id: int


class AssignmentResponse(BaseModel):
    """Reponse de creation d'assignation."""

    success: bool
    session_id: str = ""
    scenario_id: int = 0
    qr_url: str = ""
    config_url: str = ""
    created_at: str = ""


# =============================================================================
# Gestionnaire de durée de vie (recommandé pour les nouvelles versions de FastAPI)
# =============================================================================

from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestionnaire de durée de vie pour l'initialisation du serveur."""
    docs_dir = os.environ.get("DOCS_DIR", DEFAULT_DOCS_DIR)
    faiss_dir = os.environ.get("FAISS_DIR", DEFAULT_FAISS_DIR)
    scenarios_dir = os.environ.get("SCENARIOS_DIR", DEFAULT_SCENARIOS_DIR)
    initialize_state(
        docs_dir=docs_dir, faiss_dir=faiss_dir, scenarios_dir=scenarios_dir
    )
    yield


# =============================================================================
# Application FastAPI
# =============================================================================

app = FastAPI(
    title="VR Scenario Library - REST API",
    description="API RESTful pour la génération de scénarios de formation VR",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Endpoints
# =============================================================================


@app.get("/", include_in_schema=False)
async def root():
    """Redirige la racine vers la documentation Swagger UI."""
    return RedirectResponse(url="/docs")


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Vérifie l'état de santé du serveur."""
    uptime = int(time.time() - _server_state["start_time"])
    status = "SERVING" if _server_state["initialized"] else "NOT_SERVING"
    return HealthResponse(
        status=status,
        uptime_seconds=uptime,
        vectorstore_size=(
            _server_state["vectorstore"].index.ntotal
            if _server_state["vectorstore"]
            else 0
        ),
        model=(
            _server_state["llm_config"].get("model", "unknown")
            if _server_state["llm_config"]
            else "unknown"
        ),
    )


@app.post(
    "/api/v1/scenario/generate", response_model=GenerateResponse, tags=["Scenarios"]
)
async def generate_scenario(request: GenerateRequest):
    """Génère un scénario VR à partir d'un sujet.

    Retourne le même format JSON que le serveur gRPC.
    """
    topic = request.topic.strip()
    if not topic:
        raise HTTPException(
            status_code=400, detail="Le sujet (topic) ne peut pas être vide."
        )

    if not _server_state["initialized"]:
        raise HTTPException(
            status_code=503, detail="Le serveur n'est pas encore initialisé."
        )

    logger.info("=" * 70)
    logger.info("REQUÊTE REST GenerateScenario REÇUE")
    logger.info("  Topic demandé    : '%s'", topic[:100])
    logger.info("  store            : %s", bool(request.store))
    logger.info(
        "  Modèle LLM       : %s", _server_state["llm_config"].get("model", "N/A")
    )
    logger.info("  Vecteurs FAISS   : %d", _server_state["vectorstore"].index.ntotal)
    if request.custom_prompt:
        logger.info("  Custom prompt    : %s", request.custom_prompt[:200])
    logger.info("=" * 70)

    start = time.monotonic()
    store_dir = _server_state["scenarios_dir"] if request.store else None

    try:
        logger.info(
            "Début run_pipeline (timeout serveur: N/A, attente génération). store_dir=%s",
            store_dir,
        )
        result = run_pipeline(
            topic=topic,
            retriever=_server_state["retriever"],
            llm_config=_server_state["llm_config"],
            custom_prompt=request.custom_prompt,
            store_dir=store_dir,
        )
        elapsed = time.monotonic() - start
        logger.info("Fin run_pipeline en %.2fs", elapsed)

        return GenerateResponse(
            success=True,
            scenario_id=result.get("scenario_id", ""),
            titre=result.get("titre", ""),
            nb_etapes=len(result.get("etapes", [])),
            scenario_json=result,
        )

    except Exception as exc:
        elapsed = time.monotonic() - start
        logger.exception("Erreur génération après %.2fs: %s", elapsed, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/v1/scenario/{scenario_id}", tags=["Scenarios"])
async def get_scenario(scenario_id: str):
    """Récupère un scénario sauvegardé par son ID."""
    try:
        session = load_session(scenario_id, _server_state["scenarios_dir"])
        return session.to_dict()
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Scénario '{scenario_id}' introuvable.",
        )


@app.get("/api/v1/scenarios", response_model=ScenarioListResponse, tags=["Scenarios"])
async def list_scenarios():
    """Liste tous les scénarios sauvegardés."""
    scenario_ids = list_sessions(_server_state["scenarios_dir"])
    summaries: list[ScenarioSummary] = []

    for sid in scenario_ids:
        try:
            session = load_session(sid, _server_state["scenarios_dir"])
            summaries.append(
                ScenarioSummary(
                    scenario_id=session.scenario_id,
                    topic=session.topic,
                    titre=session.scenario_json.get("titre", ""),
                    nb_etapes=len(session.scenario_json.get("etapes", [])),
                    created_at=session.created_at,
                    updated_at=session.updated_at,
                )
            )
        except Exception as exc:
            logger.warning("Impossible de charger le scénario %s: %s", sid, exc)

    return ScenarioListResponse(scenarios=summaries, total=len(summaries))


@app.post("/api/v1/index/refresh", response_model=RefreshResponse, tags=["System"])
async def refresh_faiss_index():
    """Reconstruit l'index FAISS depuis les documents."""
    try:
        refresh_index()
        return RefreshResponse(
            success=True,
            vectorstore_size=_server_state["vectorstore"].index.ntotal,
            message="Index reconstruit avec succès",
        )
    except Exception as exc:
        logger.error("Erreur refresh: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/v1/documents", response_model=DocumentsResponse, tags=["System"])
async def get_documents():
    """Liste les documents indexés."""
    try:
        docs: list[DocumentInfo] = []
        docs_path = Path(_server_state["docs_dir"])
        if docs_path.exists():
            for f in docs_path.rglob("*"):
                if f.suffix.lower() in (".pdf", ".docx"):
                    docs.append(
                        DocumentInfo(
                            filename=f.name,
                            path=str(f),
                            size_bytes=f.stat().st_size,
                            extension=f.suffix.lower(),
                        )
                    )
        return DocumentsResponse(documents=docs, total=len(docs))
    except Exception as exc:
        logger.error("Erreur get documents: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/v1/files/upload", response_model=FileUploadResponse, tags=["Files"])
async def upload_file(file: UploadFile = File(...)):
    """Upload un fichier vers le repertoire documents."""
    try:
        docs_path = Path(_server_state["docs_dir"])
        docs_path.mkdir(parents=True, exist_ok=True)

        file_id = str(uuid.uuid4())[:8]
        dest = docs_path / file.filename

        with dest.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = dest.stat().st_size
        logger.info(
            "Fichier uploade: %s (%d bytes, id=%s)", file.filename, file_size, file_id
        )

        return FileUploadResponse(
            success=True,
            file=FileInfo(
                id=file_id,
                filename=file.filename,
                path=str(dest),
                size_bytes=file_size,
                extension=dest.suffix.lower(),
                status="processed",
            ),
        )
    except Exception as exc:
        logger.error("Erreur upload: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/v1/files", response_model=FilesResponse, tags=["Files"])
async def list_files():
    """Liste les fichiers uploades dans le repertoire documents."""
    try:
        files: list[FileInfo] = []
        docs_path = Path(_server_state["docs_dir"])
        if docs_path.exists():
            for idx, f in enumerate(docs_path.rglob("*")):
                if f.is_file():
                    files.append(
                        FileInfo(
                            id=str(idx),
                            filename=f.name,
                            path=str(f),
                            size_bytes=f.stat().st_size,
                            extension=f.suffix.lower(),
                            status="processed",
                        )
                    )
        return FilesResponse(files=files, total=len(files))
    except Exception as exc:
        logger.error("Erreur list files: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.delete("/api/v1/files/{file_id}", tags=["Files"])
async def delete_file(file_id: str):
    """Supprime un fichier uploade par son ID (index ou nom)."""
    try:
        docs_path = Path(_server_state["docs_dir"])
        if docs_path.exists():
            for idx, f in enumerate(docs_path.rglob("*")):
                if f.is_file() and (str(idx) == file_id or f.name == file_id):
                    f.unlink()
                    logger.info("Fichier supprime: %s", f.name)
                    return {"success": True}
        raise HTTPException(status_code=404, detail=f"Fichier '{file_id}' introuvable.")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Erreur delete file: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post(
    "/api/v1/scenario/save", response_model=SaveScenarioResponse, tags=["Scenarios"]
)
async def save_scenario(request: SaveScenarioRequest):
    """Sauvegarde un scenario valide dans l'historique."""
    try:
        scenario_id = str(uuid.uuid4())[:12]
        scenario_json = {
            "titre": request.titre,
            "description": request.description,
            "difficulte": request.difficulte,
            "duree_totale": request.duree_totale,
            "environnement": request.environnement,
            "etapes": request.etapes,
            "parametres_techniques": request.parametres_techniques,
            "etat_initial": request.etat_initial,
        }

        scenarios_dir = Path(_server_state["scenarios_dir"])
        scenarios_dir.mkdir(parents=True, exist_ok=True)
        scenario_file = scenarios_dir / f"{scenario_id}.json"
        scenario_file.write_text(
            _json.dumps(scenario_json, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        logger.info("Scenario sauvegarde: %s (id=%s)", request.titre, scenario_id)

        return SaveScenarioResponse(
            success=True,
            scenario_id=scenario_id,
            message="Scenario sauvegarde avec succes",
        )
    except Exception as exc:
        logger.error("Erreur save scenario: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post(
    "/api/v1/assignments", response_model=AssignmentResponse, tags=["Assignments"]
)
async def create_assignment(request: AssignmentRequest):
    """Cree une assignation scenario-apprenant."""
    try:
        session_id = str(uuid.uuid4())[:16]
        now = time.strftime("%Y-%m-%dT%H:%M:%S")

        logger.info(
            "Assignation creee: user=%d, scenario=%d, session=%s",
            request.user_id,
            request.scenario_id,
            session_id,
        )

        return AssignmentResponse(
            success=True,
            session_id=session_id,
            scenario_id=request.scenario_id,
            qr_url="",
            config_url="",
            created_at=now,
        )
    except Exception as exc:
        logger.error("Erreur create assignment: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/v1/assignments/me", tags=["Assignments"])
async def list_my_assignments():
    """Liste les assignations de l'utilisateur courant."""
    return []


# =============================================================================
# Point d'entrée
# =============================================================================


def serve(
    host: str = DEFAULT_HOST,
    port: int = DEFAULT_PORT,
    docs_dir: str = DEFAULT_DOCS_DIR,
    faiss_dir: str = DEFAULT_FAISS_DIR,
    scenarios_dir: str = DEFAULT_SCENARIOS_DIR,
) -> None:
    """Démarre le serveur REST via uvicorn."""
    # Les variables d'environnement sont lues dans startup_event
    os.environ.setdefault("DOCS_DIR", docs_dir)
    os.environ.setdefault("FAISS_DIR", faiss_dir)
    os.environ.setdefault("SCENARIOS_DIR", scenarios_dir)

    logger.info("============================================")
    logger.info("Serveur REST démarré sur %s:%d", host, port)
    logger.info("Docs: %s", docs_dir)
    logger.info("FAISS: %s", faiss_dir)
    logger.info("Scenarios: %s", scenarios_dir)
    logger.info("API docs: http://%s:%d/docs", host, port)
    logger.info("============================================")

    uvicorn.run(
        "vr_scenario_lib.rest_server:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
        access_log=True,
    )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Serveur REST VR Scenario Library")
    parser.add_argument(
        "--host", type=str, default=DEFAULT_HOST, help="Adresse d'écoute"
    )
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port d'écoute")
    parser.add_argument(
        "--docs-dir", type=str, default=DEFAULT_DOCS_DIR, help="Dossier des documents"
    )
    parser.add_argument(
        "--faiss-dir", type=str, default=DEFAULT_FAISS_DIR, help="Dossier cache FAISS"
    )
    parser.add_argument(
        "--scenarios-dir",
        type=str,
        default=DEFAULT_SCENARIOS_DIR,
        help="Dossier scénarios",
    )

    args = parser.parse_args()

    serve(
        host=args.host,
        port=args.port,
        docs_dir=args.docs_dir,
        faiss_dir=args.faiss_dir,
        scenarios_dir=args.scenarios_dir,
    )
