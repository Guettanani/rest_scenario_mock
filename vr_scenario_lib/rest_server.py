#!/usr/bin/env python3
"""Serveur RESTful pour VR Scenario Library.

Expose le pipeline de génération de scénarios via une API REST FastAPI.

Usage:
    python rest_server.py [--port 8000] [--host 0.0.0.0] [--docs-dir ./documents] [--faiss-dir faiss_index]

Endpoints:
    GET  /health                       - Health check
    GET  /swagar                      - Message de bienvenue personnalisé (JSON)
    GET  /swagar/web                  - Page web de présentation Swagar
    POST /api/v1/scenario/generate     - Génère un scénario VR
    GET  /api/v1/scenario/{scenario_id} - Récupère un scénario sauvegardé
    GET  /api/v1/scenarios             - Liste tous les scénarios
    POST /api/v1/index/refresh         - Reconstruit l'index FAISS
    GET  /api/v1/documents             - Liste les documents indexés
"""

from __future__ import annotations

import logging
import os

# import signal
# import sys
import time
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException

# , Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
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


@app.get("/swagar", tags=["System"])
async def swagar():
    """Endpoint swagar - retourne un message de bienvenue personnalisé."""
    return {
        "message": "Swaggar ! Le serveur VR Scenario Library est opérationnel !",
        "status": "success",
        "timestamp": time.time(),
    }


@app.get("/swagar/web", response_class=HTMLResponse, tags=["System"])
async def swagar_web():
    """Endpoint swagar - retourne une page web de présentation."""
    html_content = (
        """<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Swagar - VR Scenario Library</title>
    <style>
        body {
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a2a6c, #b21f1f, #1a2a6c);
            color: white;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            text-align: center;
        }
        .container {
            max-width: 800px;
            padding: 2rem;
            background-color: rgba(0, 0, 0, 0.5);
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        h1 {
            color: #ffd700;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        }
        .swagar-message {
            font-size: 1.5rem;
            margin: 2rem 0;
            padding: 1rem;
            background-color: rgba(255, 215, 0, 0.2);
            border-radius: 10px;
            border: 2px solid #ffd700;
        }
        .timestamp {
            font-size: 0.9rem;
            color: #aaa;
            margin-top: 1rem;
        }
        .status {
            display: inline-block;
            padding: 0.5rem 1rem;
            background-color: #28a745;
            color: white;
            border-radius: 20px;
            margin-top: 1rem;
        }
        .vr-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        .api-info {
            margin-top: 2rem;
            padding: 1rem;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            text-align: left;
        }
        .api-info h3 {
            color: #ffd700;
            margin-top: 0;
        }
        .api-info code {
            background-color: rgba(0, 0, 0, 0.3);
            padding: 2px 5px;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="vr-icon">🥽</div>
        <h1>VR Scenario Library - Swagar</h1>
        
        <div class="swagar-message">
            <p>Swaggar ! Le serveur VR Scenario Library est opérationnel !</p>
            <div class="status">Succès</div>
            <div class="timestamp">Timestamp: """
        + str(int(time.time()))
        + """</div>
        </div>
        
        <div class="api-info">
            <h3>Informations API</h3>
            <p>Cette page est générée par le serveur VR Scenario Library.</p>
            <p>Vous pouvez accéder aux endpoints suivants:</p>
            <ul>
                <li><code>/health</code> - Vérifie l'état de santé du serveur</li>
                <li><code>/swagar</code> - Retourne les informations Swagar en JSON</li>
                <li><code>/api/v1/scenario/generate</code> - Génère un scénario VR</li>
                <li><code>/api/v1/scenarios</code> - Liste tous les scénarios</li>
            </ul>
        </div>
    </div>
</body>
</html>"""
    )
    return HTMLResponse(content=html_content)


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
