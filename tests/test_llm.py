"""Tests pour le module llm.py - Appel au LLM avec fallback."""

from unittest.mock import MagicMock, patch

import pytest

from vr_scenario_lib.llm import (
    LLMError,
    LLMFallbackExhaustedError,
    _build_headers,
    _build_payload,
    _call_llm_single_model,
    _extract_content,
    call_llm,
    call_llm_messages,
    sanitize_token,
)


class TestSanitizeToken:
    """Tests pour sanitize_token."""

    def test_token_in_message(self):
        """Test que le token est masqué dans le message."""
        result = sanitize_token("Error with token abc123xyz", "abc123xyz")
        assert "abc123xyz" not in result
        assert "hf_***[REDACTED]" in result

    def test_token_not_in_message(self):
        """Test que le message est inchangé si le token n'est pas présent."""
        result = sanitize_token("Error without token", "abc123xyz")
        assert result == "Error without token"

    def test_none_token(self):
        """Test avec un token None."""
        result = sanitize_token("Error message", None)
        assert result == "Error message"

    def test_empty_token(self):
        """Test avec un token vide."""
        result = sanitize_token("Error message", "")
        assert result == "Error message"


class TestBuildHeaders:
    """Tests pour _build_headers."""

    def test_valid_token(self):
        """Test la construction des headers avec un token valide."""
        headers = _build_headers("test_token_123")
        assert headers["Authorization"] == "Bearer test_token_123"
        assert headers["Content-Type"] == "application/json"

    def test_empty_token(self):
        """Test qu'une erreur est levée avec un token vide."""
        with pytest.raises(LLMError, match="Token d'authentification manquant"):
            _build_headers("")

    def test_none_token(self):
        """Test qu'une erreur est levée avec un token None."""
        with pytest.raises(LLMError, match="Token d'authentification manquant"):
            _build_headers(None)


class TestBuildPayload:
    """Tests pour _build_payload."""

    def test_with_system_and_user_prompt(self):
        """Test la construction du payload avec system et user prompt."""
        payload = _build_payload(
            model="test-model",
            system_prompt="System prompt",
            user_prompt="User prompt",
            max_tokens=1000,
            temperature=0.5,
        )

        assert payload["model"] == "test-model"
        assert payload["max_tokens"] == 1000
        assert payload["temperature"] == 0.5
        assert len(payload["messages"]) == 2
        assert payload["messages"][0]["role"] == "system"
        assert payload["messages"][0]["content"] == "System prompt"
        assert payload["messages"][1]["role"] == "user"
        assert payload["messages"][1]["content"] == "User prompt"

    def test_with_messages(self):
        """Test la construction du payload avec des messages."""
        messages = [
            {"role": "system", "content": "System"},
            {"role": "user", "content": "User"},
            {"role": "assistant", "content": "Assistant"},
        ]
        payload = _build_payload(
            model="test-model",
            system_prompt="",
            user_prompt="",
            max_tokens=1000,
            temperature=0.5,
            messages=messages,
        )

        assert len(payload["messages"]) == 3
        assert payload["messages"][2]["role"] == "assistant"


class TestExtractContent:
    """Tests pour _extract_content."""

    def test_valid_response(self):
        """Test l'extraction du contenu d'une réponse valide."""
        response = {"choices": [{"message": {"content": "  Test response  "}}]}
        content = _extract_content(response)
        assert content == "Test response"

    def test_empty_choices(self):
        """Test qu'une erreur est levée si choices est vide."""
        response = {"choices": []}
        with pytest.raises(LLMError, match="Structure de réponse LLM inattendue"):
            _extract_content(response)

    def test_missing_choices(self):
        """Test qu'une erreur est levée si choices est manquant."""
        response = {"data": []}
        with pytest.raises(LLMError, match="Structure de réponse LLM inattendue"):
            _extract_content(response)

    def test_missing_message(self):
        """Test qu'une erreur est levée si message est manquant."""
        response = {"choices": [{"content": "test"}]}
        with pytest.raises(LLMError, match="Structure de réponse LLM inattendue"):
            _extract_content(response)


class TestCallLLMSingleModel:
    """Tests pour _call_llm_single_model."""

    def test_successful_call(self):
        """Test un appel LLM réussi."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Response text"}}]
        }

        config = {
            "token": "test_token",
            "api_url": "https://api.test.com",
            "max_tokens": 1000,
            "temperature": 0.5,
            "timeout": 30,
            "max_retries": 3,
            "retry_backoff_factor": 2.0,
        }

        with patch("vr_scenario_lib.llm.requests.post", return_value=mock_response):
            result = _call_llm_single_model(
                system_prompt="System",
                user_prompt="User",
                config=config,
                model="test-model",
            )
            assert result == "Response text"

    def test_402_error(self):
        """Test qu'une erreur 402 est levée correctement."""
        mock_response = MagicMock()
        mock_response.ok = False
        mock_response.status_code = 402
        mock_response.text = "Payment Required"

        config = {
            "token": "test_token",
            "api_url": "https://api.test.com",
            "max_tokens": 1000,
            "temperature": 0.5,
            "timeout": 30,
            "max_retries": 3,
            "retry_backoff_factor": 2.0,
        }

        with patch("vr_scenario_lib.llm.requests.post", return_value=mock_response):
            with pytest.raises(LLMError, match="402 Payment Required"):
                _call_llm_single_model(
                    system_prompt="System",
                    user_prompt="User",
                    config=config,
                    model="test-model",
                )

    def test_retry_on_429(self):
        """Test le retry sur erreur 429."""
        mock_response_429 = MagicMock()
        mock_response_429.ok = False
        mock_response_429.status_code = 429
        mock_response_429.text = "Rate limited"

        mock_response_ok = MagicMock()
        mock_response_ok.ok = True
        mock_response_ok.json.return_value = {
            "choices": [{"message": {"content": "Response after retry"}}]
        }

        config = {
            "token": "test_token",
            "api_url": "https://api.test.com",
            "max_tokens": 1000,
            "temperature": 0.5,
            "timeout": 30,
            "max_retries": 3,
            "retry_backoff_factor": 0.1,
        }

        with patch(
            "vr_scenario_lib.llm.requests.post",
            side_effect=[mock_response_429, mock_response_ok],
        ):
            with patch("vr_scenario_lib.llm.time.sleep"):
                result = _call_llm_single_model(
                    system_prompt="System",
                    user_prompt="User",
                    config=config,
                    model="test-model",
                )
                assert result == "Response after retry"


class TestCallLLM:
    """Tests pour call_llm."""

    def test_primary_model_success(self):
        """Test que le modèle principal est utilisé en premier."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Primary response"}}]
        }

        config = {
            "token": "test_token",
            "api_url": "https://api.test.com",
            "model": "primary-model",
            "fallback_models": ["fallback-1", "fallback-2"],
            "max_tokens": 1000,
            "temperature": 0.5,
            "timeout": 30,
            "max_retries": 3,
            "retry_backoff_factor": 2.0,
        }

        with patch("vr_scenario_lib.llm.requests.post", return_value=mock_response):
            result = call_llm(
                system_prompt="System",
                user_prompt="User",
                config=config,
            )
            assert result == "Primary response"

    def test_fallback_on_primary_failure(self):
        """Test le fallback sur le modèle principal."""
        mock_response_fail = MagicMock()
        mock_response_fail.ok = False
        mock_response_fail.status_code = 500
        mock_response_fail.text = "Server Error"

        mock_response_ok = MagicMock()
        mock_response_ok.ok = True
        mock_response_ok.json.return_value = {
            "choices": [{"message": {"content": "Fallback response"}}]
        }

        config = {
            "token": "test_token",
            "api_url": "https://api.test.com",
            "model": "primary-model",
            "fallback_models": ["fallback-model"],
            "max_tokens": 1000,
            "temperature": 0.5,
            "timeout": 30,
            "max_retries": 1,
            "retry_backoff_factor": 0.1,
        }

        with patch(
            "vr_scenario_lib.llm.requests.post",
            side_effect=[mock_response_fail, mock_response_ok],
        ):
            with patch("vr_scenario_lib.llm.time.sleep"):
                result = call_llm(
                    system_prompt="System",
                    user_prompt="User",
                    config=config,
                )
                assert result == "Fallback response"

    def test_all_models_fail(self):
        """Test qu'une erreur est levée si tous les modèles échouent."""
        mock_response_fail = MagicMock()
        mock_response_fail.ok = False
        mock_response_fail.status_code = 500
        mock_response_fail.text = "Server Error"

        config = {
            "token": "test_token",
            "api_url": "https://api.test.com",
            "model": "primary-model",
            "fallback_models": ["fallback-model"],
            "max_tokens": 1000,
            "temperature": 0.5,
            "timeout": 30,
            "max_retries": 1,
            "retry_backoff_factor": 0.1,
        }

        with patch(
            "vr_scenario_lib.llm.requests.post", return_value=mock_response_fail
        ):
            with patch("vr_scenario_lib.llm.time.sleep"):
                with pytest.raises(
                    LLMFallbackExhaustedError, match="Tous les modèles LLM ont échoué"
                ):
                    call_llm(
                        system_prompt="System",
                        user_prompt="User",
                        config=config,
                    )

    def test_max_tokens_override(self):
        """Test que max_tokens peut être overridé."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Response"}}]
        }

        config = {
            "token": "test_token",
            "api_url": "https://api.test.com",
            "model": "test-model",
            "fallback_models": [],
            "max_tokens": 1000,
            "temperature": 0.5,
            "timeout": 30,
            "max_retries": 1,
            "retry_backoff_factor": 0.1,
        }

        with patch(
            "vr_scenario_lib.llm.requests.post", return_value=mock_response
        ) as mock_post:
            call_llm(
                system_prompt="System",
                user_prompt="User",
                config=config,
                max_tokens=2000,
            )
            # Vérifier que le payload contient le bon max_tokens
            call_args = mock_post.call_args
            payload = call_args.kwargs.get("json") or call_args[1].get("json")
            assert payload["max_tokens"] == 2000


class TestCallLLMMessages:
    """Tests pour call_llm_messages."""

    def test_successful_call(self):
        """Test un appel réussi avec des messages."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Response to messages"}}]
        }

        config = {
            "token": "test_token",
            "api_url": "https://api.test.com",
            "model": "test-model",
            "fallback_models": [],
            "max_tokens": 1000,
            "temperature": 0.5,
            "timeout": 30,
            "max_retries": 1,
            "retry_backoff_factor": 0.1,
        }

        messages = [
            {"role": "system", "content": "System"},
            {"role": "user", "content": "User message"},
        ]

        with patch("vr_scenario_lib.llm.requests.post", return_value=mock_response):
            result = call_llm_messages(messages=messages, config=config)
            assert result == "Response to messages"

    def test_fallback_on_failure(self):
        """Test le fallback si le premier modèle échoue."""
        mock_response_fail = MagicMock()
        mock_response_fail.ok = False
        mock_response_fail.status_code = 500
        mock_response_fail.text = "Error"

        mock_response_ok = MagicMock()
        mock_response_ok.ok = True
        mock_response_ok.json.return_value = {
            "choices": [{"message": {"content": "Fallback response"}}]
        }

        config = {
            "token": "test_token",
            "api_url": "https://api.test.com",
            "model": "primary",
            "fallback_models": ["fallback"],
            "max_tokens": 1000,
            "temperature": 0.5,
            "timeout": 30,
            "max_retries": 1,
            "retry_backoff_factor": 0.1,
        }

        messages = [{"role": "user", "content": "Test"}]

        with patch(
            "vr_scenario_lib.llm.requests.post",
            side_effect=[mock_response_fail, mock_response_ok],
        ):
            with patch("vr_scenario_lib.llm.time.sleep"):
                result = call_llm_messages(messages=messages, config=config)
                assert result == "Fallback response"

    def test_empty_messages(self):
        """Test avec une liste de messages vide."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Response"}}]
        }

        config = {
            "token": "test_token",
            "api_url": "https://api.test.com",
            "model": "test-model",
            "fallback_models": [],
            "max_tokens": 1000,
            "temperature": 0.5,
            "timeout": 30,
            "max_retries": 1,
            "retry_backoff_factor": 0.1,
        }

        with patch("vr_scenario_lib.llm.requests.post", return_value=mock_response):
            result = call_llm_messages(messages=[], config=config)
            assert result == "Response"
