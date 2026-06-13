"""Configuration et constantes pour la bibliothèque VR Scenario.

Centralise toutes les constantes, prompts système, schémas JSON,
la table de correspondance des objets MASER du poste gazier,
et le système de fallback pour tous les composants.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import TypedDict

from dotenv import load_dotenv

# Charger les variables d'environnement depuis .env avec un chemin absolu
# Chercher le fichier .env à la racine du projet (2 niveaux au-dessus de ce fichier)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _PROJECT_ROOT / ".env"
if _ENV_FILE.exists():
    load_dotenv(dotenv_path=str(_ENV_FILE), override=True)
else:
    # Fallback: chercher dans le répertoire courant
    load_dotenv(override=True)


# ---------------------------------------------------------------------------
# LLM Configuration
# ---------------------------------------------------------------------------

DEFAULT_API_URL: str = "https://router.huggingface.co/v1/chat/completions"
DEFAULT_OPENROUTER_API_URL: str = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL: str = "qwen/qwen-2.5-7b-instruct"
DEFAULT_MAX_TOKENS: int = 1500
DEFAULT_TEMPERATURE: float = 0.3
DEFAULT_TIMEOUT_SECONDS: int = 60

# Fallback LLM - Liste de modèles de secours en cas d'échec
# DEFAULT_FALLBACK_MODELS: list[str] = [
#     "meta-llama/Llama-3.2-3B-Instruct",
#     "meta-llama/Llama-3.1-70B-Instruct:cerebras",
#     "mistralai/Mistral-7B-Instruct-v0.3:cerebras",
#     "microsoft/Phi-3-mini-4k-instruct:cerebras",
# ]

# DEFAULT_FALLBACK_MODELS = [
#     "qwen/qwen-2.5-1.5b-instruct",
#     "meta-llama/llama-3.1-70b-instruct",
#     "mistralai/mistral-7b-instruct-v0.3",
#     "microsoft/phi-3-mini-128k-instruct"
# ]
# DEFAULT_API_URL: str = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL: str = "meta-llama/llama-3.1-8b-instruct:free"

# DEFAULT_FALLBACK_MODELS: list[str] = [
#     "mistralai/mistral-7b-instruct:free",
#     "google/gemma-2-9b-it:free",
#     "qwen/qwen-2.5-7b-instruct:free",
#     "microsoft/phi-3-medium-128k-instruct:free",
# ]
# config.py — modèles vérifiés le 10/06/2026

DEFAULT_MODEL: str = "meta-llama/llama-3.3-70b-instruct:free"

DEFAULT_FALLBACK_MODELS: list[str] = [
    "google/gemma-4-31b-it:free",           # Vision + Tools, 262K ctx
    "nvidia/nemotron-3-super-120b-a12b:free", # Tools, 1M ctx
    "openai/gpt-oss-120b:free",              # Tools, 131K ctx
    "meta-llama/llama-3.2-3b-instruct:free", # Léger, fallback final
]
class LLMConfig(TypedDict, total=False):
    """Configuration pour l'appel LLM.

    Attributes:
        api_url: URL de l'API LLM.
        model: Identifiant du modèle principal.
        fallback_models: Liste de modèles de secours.
        token: Token d'authentification HuggingFace.
        max_tokens: Nombre max de tokens en sortie.
        temperature: Température de génération.
        timeout: Timeout HTTP en secondes.
        max_retries: Nombre maximum de tentatives par modèle.
        retry_backoff_factor: Facteur de backoff exponentiel.
    """

    api_url: str
    model: str
    fallback_models: list[str]
    token: str
    max_tokens: int
    temperature: float
    timeout: int
    max_retries: int
    retry_backoff_factor: float


def build_llm_config(
    token: str | None = None,
    openrouter_api_key: str | None = None,
    openrouter_api_url: str | None = None,
    api_url: str | None = None,
    model: str | None = None,
    fallback_models: list[str] | None = None,
    max_tokens: int | None = None,
    temperature: float | None = None,
    timeout: int | None = None,
    max_retries: int | None = None,
    retry_backoff_factor: float | None = None,
) -> LLMConfig:
    """Construit une configuration LLM avec des valeurs par défaut sensées.

    Args:
        token: Token OpenRouter ou HuggingFace. Si None, lu depuis ``OPENROUTER_API_KEY`` ou ``HF_TOKEN``.
        openrouter_api_key: Token OpenRouter explicite.
        openrouter_api_url: URL OpenRouter explicite.
        api_url: URL de l'API. Priorité : ``api_url`` passé, ``openrouter_api_url``, ``OPENROUTER_API_URL``, ``API_URL``, ``DEFAULT_API_URL``.
        model: Identifiant du modèle principal. Défaut : Llama-3.1-8B Cerebras.
        fallback_models: Liste de modèles de secours. Défaut : liste prédéfinie.
        max_tokens: Nombre max de tokens. Défaut : 1500.
        temperature: Température. Défaut : 0.3.
        timeout: Timeout en secondes. Défaut : 60.
        max_retries: Nombre max de tentatives par modèle. Défaut : 3.
        retry_backoff_factor: Facteur de backoff. Défaut : 2.0.

    Returns:
        Configuration LLM complète.

    Raises:
        ValueError: Si aucun token n'est fourni ni trouvé dans l'environnement.
    """
    resolved_token = token or openrouter_api_key or os.environ.get("OPENROUTER_API_KEY") or os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_API_KEY")
    if not resolved_token:
        raise ValueError(
            "Token OpenRouter ou HuggingFace requis. Passez-le en paramètre ou "
            "définissez OPENROUTER_API_KEY, HF_TOKEN ou HUGGINGFACE_API_KEY."
        )

    resolved_api_url = api_url or openrouter_api_url
    if resolved_api_url is None:
        if openrouter_api_key or os.environ.get("OPENROUTER_API_KEY"):
            resolved_api_url = os.environ.get("OPENROUTER_API_URL", DEFAULT_OPENROUTER_API_URL)
        else:
            resolved_api_url = os.environ.get("API_URL", DEFAULT_API_URL)

    import logging
    _logger = logging.getLogger(__name__)

    resolved_model = model or os.environ.get('LLM_MODEL', DEFAULT_MODEL)
    resolved_fallback_models = fallback_models or DEFAULT_FALLBACK_MODELS
    # resolved_max_tokens = max_tokens or int(os.environ.get('MAX_TOKENS', DEFAULT_MAX_TOKENS))
    resolved_max_tokens = max_tokens if max_tokens is not None else int(os.environ.get('MAX_TOKENS', DEFAULT_MAX_TOKENS))
    # resolved_temperature = temperature or float(os.environ.get('TEMPERATURE', DEFAULT_TEMPERATURE))
    resolved_temperature = temperature if temperature is not None else float(os.environ.get('TEMPERATURE', DEFAULT_TEMPERATURE))
    # resolved_timeout = timeout or int(os.environ.get('TIMEOUT', DEFAULT_TIMEOUT_SECONDS))
    resolved_timeout = timeout if timeout is not None else int(os.environ.get('TIMEOUT', DEFAULT_TIMEOUT_SECONDS))
    # resolved_max_retries = max_retries or int(os.environ.get('MAX_RETRIES', 3))
    resolved_max_retries = max_retries if max_retries is not None else int(os.environ.get('MAX_RETRIES', 3))
    # resolved_backoff = retry_backoff_factor or float(os.environ.get('RETRY_BACKOFF_FACTOR', 2.0))
    resolved_backoff = retry_backoff_factor if retry_backoff_factor is not None else float(os.environ.get('RETRY_BACKOFF_FACTOR', 2.0))


    # Masquer le token pour les logs
    masked_token = resolved_token[:8] + '***' + resolved_token[-4:] if len(resolved_token) > 12 else '***REDACTED***'

    _logger.info('=' * 70)
    _logger.info('CONFIGURATION LLM DÉTAILLÉE')
    _logger.info('=' * 70)
    _logger.info('  Modèle principal    : %s', resolved_model)
    _logger.info('  API URL             : %s', resolved_api_url)
    _logger.info('  Token (masqué)      : %s', masked_token)
    _logger.info('  Token source        : %s', 'OPENROUTER_API_KEY' if os.environ.get('OPENROUTER_API_KEY') else 'HF_TOKEN' if os.environ.get('HF_TOKEN') else 'paramètre')
    _logger.info('  Fallback modèles    : %s', resolved_fallback_models)
    _logger.info('  Max tokens          : %d', resolved_max_tokens)
    _logger.info('  Température         : %.2f', resolved_temperature)
    _logger.info('  Timeout (s)         : %d', resolved_timeout)
    _logger.info('  Max retries         : %d', resolved_max_retries)
    _logger.info('  Backoff factor      : %.1f', resolved_backoff)
    _logger.info('=' * 70)

    return LLMConfig(
        api_url=resolved_api_url,
        model=resolved_model,
        fallback_models=resolved_fallback_models,
        token=resolved_token,
        max_tokens=resolved_max_tokens,
        temperature=resolved_temperature,
        timeout=resolved_timeout,
        max_retries=resolved_max_retries,
        retry_backoff_factor=resolved_backoff,
    )


# ---------------------------------------------------------------------------
# Embeddings / Retriever defaults
# ---------------------------------------------------------------------------

DEFAULT_EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
DEFAULT_EMBEDDING_DEVICE: str = "cpu"
DEFAULT_RETRIEVER_K: int = 5
DEFAULT_RETRIEVER_FETCH_K: int = 20
DEFAULT_RETRIEVER_LAMBDA: float = 0.5
DEFAULT_FAISS_INDEX_DIR: str = "faiss_index"
DEFAULT_HUGGINGFACE_EMBEDDING_API_URL: str = "https://api-inference.hf.co"
DEFAULT_OPENROUTER_EMBEDDING_API_URL: str = "https://openrouter.ai/api/v1/embeddings"
DEFAULT_OPENROUTER_EMBEDDING_MODEL: str = "text-embedding-3-large"
DEFAULT_OPENROUTER_FALLBACK_EMBEDDING_MODELS: list[str] = [
    "text-embedding-3-large",
    "text-embedding-3-small",
]

# Fallback Embeddings - Modèles de secours pour les embeddings
DEFAULT_FALLBACK_EMBEDDING_MODELS: list[str] = [
    "sentence-transformers/all-MiniLM-L6-v2",
    "intfloat/multilingual-e5-base",
    "sentence-transformers/all-MiniLM-L6-v2",
    "sentence-transformers/all-MiniLM-L6-v2",
]


# ---------------------------------------------------------------------------
# Text splitter defaults
# ---------------------------------------------------------------------------

DEFAULT_CHUNK_SIZE: int = 1200
DEFAULT_CHUNK_OVERLAP: int = 150


# ---------------------------------------------------------------------------
# Supported file extensions
# ---------------------------------------------------------------------------

SUPPORTED_EXTENSIONS: dict[str, str] = {
    ".pdf": "pdf",
    ".docx": "docx",
}


# ---------------------------------------------------------------------------
# Vectorstore / FAISS Configuration
# ---------------------------------------------------------------------------

HUGGINGFACE_API_KEY: str = os.getenv("HUGGINGFACE_API_KEY")
DEFAULT_VECTORSTORE_CACHE_ENABLED: bool = True


# ---------------------------------------------------------------------------
# Pipeline Configuration
# ---------------------------------------------------------------------------

DEFAULT_DOCS_DIR: str = "./documents"
DEFAULT_OUTPUT_PATH: str = "scenario_output.json"
DEFAULT_SCENARIOS_DIR: str = "./scenarios"
DEFAULT_LOG_LEVEL: str = "INFO"


# ---------------------------------------------------------------------------
# Table de correspondance objets MASER
# ---------------------------------------------------------------------------

CORRESPONDANCE_OBJETS: str = """
TABLE DE CORRESPONDANCE OBJETS DU POSTE (à utiliser obligatoirement) :
- R0        = Robinet d'isolement amont principal
- R1        = Robinet d'isolement aval
- R2        = Robinet de détente
- R3        = Robinet de bypass
- R4        = Vanne de régulation (0-100%)
- VS_GAZFIO = Vanne de sécurité principale
- M         = Mode opératoire du poste
- PM        = Prise de mesure pression
""".strip()


# ---------------------------------------------------------------------------
# Prompt système pour la génération de scénarios
# ---------------------------------------------------------------------------

SYSTEM_SCENARIO: str = """
Tu es un concepteur de scénarios de formation VR pour le secteur gazier.
Tu génères des scénarios opérationnels précis pour des postes de détente gaz.

CONSIGNES DE RÉSISTANCE AUX HALLUCINATIONS (CRITIQUES) :
- Base-toi UNIQUEMENT et STRICTEMENT sur le contexte documentaire fourni.
- N'invente AUCUNE consigne, AUCUN code, ni AUCUN état non étayé par des faits présents dans les sources.
- Si le contexte documentaire est insuffisant pour traiter le sujet demandé, réponds explicitement : "Désolé, les informations disponibles dans les documents fournis ne permettent pas de générer un scénario sur ce thème."

Pour chaque scénario tu dois OBLIGATOIREMENT définir :
- Le type de poste (GAZFIO ou FRANCEL)
- Les conditions météo (J=jour, N=nuit, JP=jour+pluie, NP=nuit+pluie)
- L'état INITIAL de chaque robinet R0 à R4 (ouvert=1 ou fermé=0, R4 en pourcentage 0-100)
- L'état INITIAL de la vanne de sécurité VS_GAZFIO (0=fermée, 1=ouverte, 2=intermédiaire)
- La demande client MOY (250-1000), TYPE (NOISE/SIN/CUBIC), RESEAU (5/10/15/25)
- Le mode opératoire M (0 à 4) et la prise de mesure PM

Pour chaque étape du scénario :
- Décris les actions concrètes à réaliser sur les objets du poste
- Indique les valeurs attendues après chaque action
- Mentionne les erreurs possibles et leurs conséquences
Langue : français professionnel.
""".strip()


SYSTEM_SCENARIO_DISCUSSION: str = """
Tu es un formateur VR pour le secteur gazier. L'utilisateur suit un scénario de formation
et interagit avec toi pour poser des questions ou décrire les actions qu'il réalise.

CONSIGNES :
- Base-toi UNIQUEMENT sur le scénario textuel fourni ci-dessous.
- Si l'utilisateur décrit une action, indique s'il est à la bonne étape et guide-le.
- Si l'utilisateur demande une information, réponds de façon concise et professionnelle.
- Si le contexte documentaire complémentaire est fourni, utilise-le pour enrichir ta réponse.
- N'invente pas d'informations absentes du scénario ou des documents.
- Réponds en français, de façon claire et directe (adaptée au casque VR).
""".strip()


# ---------------------------------------------------------------------------
# Prompt système pour la conversion JSON
# ---------------------------------------------------------------------------

SYSTEM_JSON_CONVERTER: str = """
Tu es un convertisseur de scénarios de formation gazière en JSON dynamique pour Unity VR.
Réponds UNIQUEMENT avec le JSON valide, sans markdown, sans explications, sans balises.
""".strip()


# ---------------------------------------------------------------------------
# Schéma JSON cible pour Unity VR
# ---------------------------------------------------------------------------

JSON_SCHEMA_V2: str = """
{
  "scenario_id": "slug-du-titre",
  "titre": "Titre du scénario",
  "etat_initial": {
    "TYPE_POSTE": "GAZFIO",
    "METEO": "J",
    "DEMANDE_CLIENT": { "MOY": 500, "TYPE": "SIN", "RESEAU": 15 },
    "R0": { "STATUT": 1, "ETAT": 1 },
    "R1": { "STATUT": 1, "ETAT": 1 },
    "R2": { "STATUT": 1, "ETAT": 1 },
    "R3": { "STATUT": 1, "ETAT": 0 },
    "R4": { "STATUT": 1, "ETAT": 75 },
    "VS_GAZFIO": { "STATUT": 1, "ETAT": 1 },
    "M": { "VALEUR": 2 },
    "PM": { "STATUT": 1, "ETAT": 1 }
  },
  "etapes": [
    {
      "etape_id": 1,
      "titre": "Titre de l'étape",
      "actions": [
        { "objet": "nom_objet", "action": "verbe_action", "valeur_attendue": "valeur ou seuil" }
      ],
      "etat_resultant": {
        "NOM_OBJET": { "STATUT": 1, "ETAT": 0 }
      },
      "conditions_erreur": [
        {
          "type": "mauvaise_action | valeur_hors_seuil",
          "objet": "nom_objet",
          "condition": "description de l'erreur",
          "consequence": "message court affiché dans le casque (max 15 mots)"
        }
      ]
    }
  ]
}
""".strip()