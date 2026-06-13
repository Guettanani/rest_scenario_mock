"""VR Scenario Library — Génération de scénarios de formation gazière pour Unity VR.

Bibliothèque modulaire de fonctions atomiques pour :
- Charger et découper des documents (PDF/DOCX)
- Indexer dans FAISS avec embeddings HuggingFace
- Générer des scénarios texte via RAG + LLM
- Convertir en JSON structuré pour Unity VR
- Interaction vocale avec l'agent conversationnel

Example:
    >>> from vr_scenario_lib import run_pipeline, build_llm_config
    >>> config = build_llm_config(token="hf_...")
    >>> result = run_pipeline("consignation gaz", retriever, config)
    
    >>> from vr_scenario_lib import ConversationalAgent
    >>> agent = ConversationalAgent()
    >>> agent.run_voice_session()
"""

from __future__ import annotations

# Config
from .config import (
    CORRESPONDANCE_OBJETS,
    JSON_SCHEMA_V2,
    SYSTEM_JSON_CONVERTER,
    SYSTEM_SCENARIO,
    LLMConfig,
    build_llm_config,
    # Defaults
    DEFAULT_FALLBACK_MODELS,
    DEFAULT_FALLBACK_EMBEDDING_MODELS,
    DEFAULT_FAISS_INDEX_DIR,
    DEFAULT_VECTORSTORE_CACHE_ENABLED,
    DEFAULT_DOCS_DIR,
    DEFAULT_OUTPUT_PATH,
    DEFAULT_SCENARIOS_DIR,
    DEFAULT_LOG_LEVEL,
)

# Documents
from .documents import (
    DocumentLoadError,
    DocumentLoadWarning,
    load_document,
    scan_directory,
    split_documents,
)

# JSON Converter
from .json_converter import (
    JsonParsingError,
    clean_llm_json,
    convert_scenario_to_json,
    parse_scenario_json,
)

# LLM
from .llm import (
    LLMError,
    LLMFallbackExhaustedError,
    call_llm,
    call_llm_messages,
)

# Pipeline
from .pipeline import (
    PipelineError,
    run_pipeline,
    save_json,
)

# Prompts
from .prompts import build_json_conversion_prompt, build_scenario_prompt, build_announcement_prompt

# Scenario
from .scenario import format_context, generate_narrative, generate_scenario, retrieve_context, discuss_scenario

from .scenario_store import (
    ScenarioSession,
    create_session,
    load_session,
    list_sessions,
    save_session,
)

# Vectorstore
from .vectorstore import (
    EmbeddingError,
    EmbeddingFallbackExhaustedError,
    build_vectorstore,
    create_embeddings,
    create_retriever,
    load_vectorstore,
    save_vectorstore,
)

# Voice Agent (optional - requires additional dependencies)
try:
    from .voice_agent import (
        VoiceAgent,
        VoiceAgentError,
        SpeechRecognitionError,
        TextToSpeechError,
    )
    _VOICE_AVAILABLE = True
except ImportError:
    _VOICE_AVAILABLE = False

# Conversational Agent (optional - requires additional dependencies)
try:
    from .conversational_agent import (
        ConversationalAgent,
        ConversationalAgentError,
    )
    _CONVERSATIONAL_AVAILABLE = True
except ImportError:
    _CONVERSATIONAL_AVAILABLE = False

__all__ = [
    # Config
    "LLMConfig",
    "build_llm_config",
    "CORRESPONDANCE_OBJETS",
    "JSON_SCHEMA_V2",
    "SYSTEM_SCENARIO",
    "SYSTEM_JSON_CONVERTER",
    "DEFAULT_FALLBACK_MODELS",
    "DEFAULT_FALLBACK_EMBEDDING_MODELS",
    "DEFAULT_FAISS_INDEX_DIR",
    "DEFAULT_VECTORSTORE_CACHE_ENABLED",
    "DEFAULT_DOCS_DIR",
    "DEFAULT_OUTPUT_PATH",
    "DEFAULT_SCENARIOS_DIR",
    "DEFAULT_LOG_LEVEL",
    # Documents
    "DocumentLoadError",
    "DocumentLoadWarning",
    "load_document",
    "scan_directory",
    "split_documents",
    # Vectorstore
    "EmbeddingError",
    "EmbeddingFallbackExhaustedError",
    "create_embeddings",
    "build_vectorstore",
    "create_retriever",
    "load_vectorstore",
    "save_vectorstore",
    # LLM
    "LLMError",
    "LLMFallbackExhaustedError",
    "call_llm",
    "call_llm_messages",
    # Prompts
    "build_scenario_prompt",
    "build_json_conversion_prompt",
    "build_announcement_prompt",
    # Scenario
    "retrieve_context",
    "format_context",
    "generate_scenario",
    "generate_narrative",
    "discuss_scenario",
    # Scenario Store
    "ScenarioSession",
    "create_session",
    "load_session",
    "save_session",
    "list_sessions",
    # JSON Converter
    "JsonParsingError",
    "clean_llm_json",
    "parse_scenario_json",
    "convert_scenario_to_json",
    # Pipeline
    "PipelineError",
    "run_pipeline",
    "save_json",
    # Voice (optional)
    "VoiceAgent",
    "VoiceAgentError",
    "SpeechRecognitionError",
    "TextToSpeechError",
    # Conversational Agent (optional)
    "ConversationalAgent",
    "ConversationalAgentError",
]