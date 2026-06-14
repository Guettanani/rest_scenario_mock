# import pytest

# # from vr_scenario_lib.config import Config LLMConfig
# from vr_scenario_lib.config import LLMConfig

# def test_config_loading():
#     """Test que la configuration peut être chargée correctement."""
#     # config = Config()
#     config = LLMConfig()
#     assert config is not None
#     assert hasattr(config, 'model_name')
#     assert hasattr(config, 'vector_store_path')
#     assert hasattr(config, 'scenarios_path')

import os

import pytest

from vr_scenario_lib.config import DEFAULT_FALLBACK_MODELS, build_llm_config


def test_build_llm_config_with_explicit_token():
    """Test standard de construction de la configuration LLM avec un token explicite."""
    config = build_llm_config(
        token="test_token_1234567890",
        model="test-model",
        max_tokens=500,
        temperature=0.7,
    )
    assert config["token"] == "test_token_1234567890"
    assert config["model"] == "test-model"
    assert config["max_tokens"] == 500
    assert config["temperature"] == 0.7
    assert config["fallback_models"] == DEFAULT_FALLBACK_MODELS


def test_build_llm_config_missing_token():
    """Test qu'une erreur est levée si aucun token n'est trouvé."""
    # Sauvegarder les variables d'environnement existantes
    env_keys = ["OPENROUTER_API_KEY", "HF_TOKEN", "HUGGINGFACE_API_KEY"]
    saved_env = {key: os.environ.get(key) for key in env_keys}

    # Supprimer temporairement ces variables pour le test
    for key in env_keys:
        if key in os.environ:
            del os.environ[key]

    try:
        with pytest.raises(ValueError, match="Token OpenRouter ou HuggingFace requis"):
            build_llm_config()
    finally:
        # Toujours restaurer l'environnement d'origine
        for key, value in saved_env.items():
            if value is not None:
                os.environ[key] = value


def test_build_llm_config_defaults_from_env():
    """Test que build_llm_config résout correctement les valeurs par défaut depuis l'environnement."""
    os.environ["LLM_MODEL"] = "env-model"
    os.environ["MAX_TOKENS"] = "999"
    os.environ["TEMPERATURE"] = "0.9"

    try:
        config = build_llm_config(token="dummy_token")
        assert config["model"] == "env-model"
        assert config["max_tokens"] == 999
        assert config["temperature"] == 0.9
    finally:
        # Nettoyage
        for key in ["LLM_MODEL", "MAX_TOKENS", "TEMPERATURE"]:
            if key in os.environ:
                del os.environ[key]
