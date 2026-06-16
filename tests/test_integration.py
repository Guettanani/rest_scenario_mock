"""Tests d'intégration pour le projet VR Scenario Library.

Ces tests vérifient que les différents modules fonctionnent ensemble correctement.
"""

import json
import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.documents import Document

# Mock des variables d'environnement
os.environ.setdefault("OPENROUTER_API_KEY", "test_token")
os.environ.setdefault("HUGGINGFACE_API_KEY", "test_token")


class TestDocumentsToScenarioStore:
    """Tests d'intégration entre documents.py et scenario_store.py."""

    def test_load_and_store_documents(self):
        """Test le chargement et stockage de documents."""
        from vr_scenario_lib.documents import split_documents
        from vr_scenario_lib.scenario_store import create_session, load_session

        # Créer des documents de test
        docs = [
            Document(
                page_content="Consigne de sécurité: Toujours porter des EPI.",
                metadata={"source": "securite.pdf"},
            ),
            Document(
                page_content="Procédure bypass: Ouvrir R3 avant R1.",
                metadata={"source": "bypass.pdf"},
            ),
        ]

        # Découper les documents
        chunks = split_documents(docs, chunk_size=500, chunk_overlap=50)
        assert len(chunks) > 0

        # Créer une session avec les documents
        with tempfile.TemporaryDirectory() as tmpdir:
            scenario_json = {
                "scenario_id": "test-docs",
                "titre": "Test Documents",
                "etapes": [],
            }
            session = create_session(
                topic="Test",
                scenario_text="Test scenario",
                scenario_json=scenario_json,
                scenarios_dir=tmpdir,
            )

            # Vérifier que la session est sauvegardée
            loaded = load_session(session.scenario_id, tmpdir)
            assert loaded.scenario_id == "test-docs"


class TestScenarioToJsonPipeline:
    """Tests d'intégration pour le pipeline scénario -> JSON."""

    @patch("vr_scenario_lib.json_converter.call_llm")
    def test_scenario_text_to_json_conversion(self, mock_call_llm):
        """Test la conversion d'un texte de scénario en JSON."""
        from vr_scenario_lib.config import build_llm_config
        from vr_scenario_lib.json_converter import convert_scenario_to_json

        # Simuler une réponse LLM
        mock_call_llm.return_value = json.dumps(
            {
                "scenario_id": "bypass-test",
                "titre": "Test Bypass",
                "etat_initial": {
                    "TYPE_POSTE": "GAZFIO",
                    "METEO": "J",
                    "R0": {"STATUT": 1, "ETAT": 1},
                },
                "etapes": [
                    {
                        "etape_id": 1,
                        "titre": "Ouverture R3",
                        "actions": [{"objet": "R3", "action": "ouvrir"}],
                        "conditions_erreur": [],
                    }
                ],
            }
        )

        llm_config = build_llm_config(token="fake_token")
        scenario_text = """
        Scénario de bypass GAZFIO.
        Étape 1: Ouvrir le robinet de bypass R3.
        """

        result = convert_scenario_to_json(scenario_text, llm_config)

        assert result["scenario_id"] == "bypass-test"
        assert len(result["etapes"]) == 1


class TestFullPipelineWithMock:
    """Tests d'intégration du pipeline complet avec mocks."""

    @patch("vr_scenario_lib.pipeline.create_session")
    @patch("vr_scenario_lib.pipeline.convert_scenario_to_json")
    @patch("vr_scenario_lib.pipeline.generate_scenario")
    def test_full_pipeline_flow(self, mock_generate, mock_convert, mock_create_session):
        """Test le flux complet du pipeline."""
        from vr_scenario_lib.config import build_llm_config
        from vr_scenario_lib.pipeline import run_pipeline

        # Configurer les mocks
        mock_generate.return_value = (
            "Scénario de test complet",
            [Document(page_content="doc", metadata={"source": "test.pdf"})],
        )
        mock_convert.return_value = {
            "scenario_id": "full-test",
            "titre": "Test Complet",
            "etat_initial": {"TYPE_POSTE": "GAZFIO"},
            "etapes": [{"etape_id": 1, "titre": "Step 1"}],
        }

        mock_retriever = MagicMock()
        llm_config = build_llm_config(token="fake_token")

        # Exécuter le pipeline
        result = run_pipeline(
            topic="Test complet",
            retriever=mock_retriever,
            llm_config=llm_config,
        )

        # Vérifier les résultats
        assert result["scenario_id"] == "full-test"
        assert "etapes" in result

        # Vérifier que les fonctions ont été appelées
        mock_generate.assert_called_once()
        mock_convert.assert_called_once()


class TestScenarioSessionHistory:
    """Tests d'intégration pour l'historique des sessions."""

    def test_session_history_management(self):
        """Test la gestion de l'historique d'une session."""
        from vr_scenario_lib.scenario_store import ScenarioSession

        session = ScenarioSession(
            scenario_id="history-test",
            topic="Test",
            scenario_text="Text",
            scenario_json={},
        )

        # Ajouter des messages à l'historique
        session.history.append({"role": "user", "content": "Question 1"})
        session.history.append({"role": "assistant", "content": "Réponse 1"})
        session.history.append({"role": "user", "content": "Question 2"})
        session.history.append({"role": "assistant", "content": "Réponse 2"})

        assert len(session.history) == 4

        # Vérifier la structure
        assert session.history[0]["role"] == "user"
        assert session.history[1]["role"] == "assistant"

    def test_session_serialization(self):
        """Test la sérialisation/désérialisation d'une session."""
        from vr_scenario_lib.scenario_store import ScenarioSession

        original = ScenarioSession(
            scenario_id="serialize-test",
            topic="Test Topic",
            scenario_text="Test content",
            scenario_json={"key": "value"},
            history=[{"role": "user", "content": "Hello"}],
            created_at="2024-01-01",
            updated_at="2024-01-02",
        )

        # Sérialiser
        data = original.to_dict()

        # Déséerialiser
        restored = ScenarioSession.from_dict(data)

        assert restored.scenario_id == original.scenario_id
        assert restored.topic == original.topic
        assert restored.scenario_text == original.scenario_text
        assert restored.history == original.history


class TestPromptsIntegration:
    """Tests d'intégration pour les prompts."""

    def test_scenario_prompt_with_context(self):
        """Test le prompt de scénario avec un contexte réel."""
        from vr_scenario_lib.prompts import build_scenario_prompt

        context = """
        [Source 1 — securite.pdf]
        Consigne R1: Toujours porter des EPI.
        
        [Source 2 — bypass.pdf]
        Procédure: Ouvrir R3 avant R1.
        """

        prompt = build_scenario_prompt("Mise en bypass", context)

        assert "Mise en bypass" in prompt
        assert "securite.pdf" in prompt
        assert "bypass.pdf" in prompt
        assert "R1" in prompt
        assert "R3" in prompt

    def test_json_conversion_prompt_with_scenario(self):
        """Test le prompt de conversion JSON avec un scénario réel."""
        from vr_scenario_lib.prompts import build_json_conversion_prompt

        scenario_text = """
        CONFIGURATION INITIALE:
        - TYPE_POSTE: GAZFIO
        - METEO: J
        - R0: ouvert
        - R1: ouvert
        
        ÉTAPE 1: Ouvrir R3
        """

        prompt = build_json_conversion_prompt(scenario_text)

        assert "GAZFIO" in prompt
        assert "ÉTAPE 1" in prompt
        assert "scenario_id" in prompt


class TestConfigIntegration:
    """Tests d'intégration pour la configuration."""

    def test_build_llm_config_with_env_vars(self):
        """Test la construction de la configuration avec variables d'environnement."""
        from vr_scenario_lib.config import build_llm_config

        with patch.dict(
            os.environ,
            {
                "OPENROUTER_API_KEY": "test_key",
                "LLM_MODEL": "test-model",
                "MAX_TOKENS": "2000",
                "TEMPERATURE": "0.5",
            },
        ):
            config = build_llm_config()

            assert config["token"] == "test_key"
            assert config["model"] == "test-model"
            assert config["max_tokens"] == 2000
            assert config["temperature"] == 0.5

    def test_build_llm_config_with_params(self):
        """Test la construction de la configuration avec paramètres explicites."""
        from vr_scenario_lib.config import build_llm_config

        config = build_llm_config(
            token="explicit_token",
            model="explicit-model",
            max_tokens=3000,
            temperature=0.7,
        )

        assert config["token"] == "explicit_token"
        assert config["model"] == "explicit-model"
        assert config["max_tokens"] == 3000
        assert config["temperature"] == 0.7


class TestErrorHandling:
    """Tests d'intégration pour la gestion des erreurs."""

    def test_document_load_error_handling(self):
        """Test la gestion des erreurs de chargement de documents."""
        from vr_scenario_lib.documents import load_document

        with pytest.raises(FileNotFoundError):
            load_document("/nonexistent/file.pdf")

    def test_json_parse_error_handling(self):
        """Test la gestion des erreurs de parsing JSON."""
        from vr_scenario_lib.json_converter import JsonParsingError, parse_scenario_json

        with pytest.raises(JsonParsingError):
            parse_scenario_json("invalid json {")

    def test_session_not_found_error(self):
        """Test la gestion des erreurs de session non trouvée."""
        from vr_scenario_lib.scenario_store import load_session

        with tempfile.TemporaryDirectory() as tmpdir:
            with pytest.raises(FileNotFoundError):
                load_session("nonexistent-id", tmpdir)


class TestEndToEndScenarioGeneration:
    """Tests de bout en bout pour la génération de scénarios."""

    @patch("vr_scenario_lib.scenario.call_llm_messages")
    def test_discuss_scenario_flow(self, mock_call_llm_messages):
        """Test le flux de discussion d'un scénario."""
        from vr_scenario_lib.config import build_llm_config
        from vr_scenario_lib.scenario import ScenarioSession, discuss_scenario

        mock_call_llm_messages.return_value = "Voici la réponse du formateur."

        session = ScenarioSession(
            scenario_id="discuss-test",
            topic="Test",
            scenario_text="Scénario de test pour la discussion.",
            scenario_json={},
        )

        llm_config = build_llm_config(token="fake_token")

        # Première question
        response1 = discuss_scenario(
            session=session,
            user_message="Que dois-je faire en premier ?",
            llm_config=llm_config,
        )

        assert response1 == "Voici la réponse du formateur."
        assert len(session.history) == 2

        # Deuxième question
        _ = discuss_scenario(
            session=session,
            user_message="Et ensuite ?",
            llm_config=llm_config,
        )

        assert len(session.history) == 4

    def test_validate_scenario_structure_complete(self):
        """Test la validation d'une structure de scénario complète."""
        from vr_scenario_lib.pipeline import validate_scenario_structure

        valid_scenario = {
            "scenario_id": "complete-test",
            "titre": "Test Complet",
            "etat_initial": {
                "TYPE_POSTE": "GAZFIO",
                "METEO": "J",
                "DEMANDE_CLIENT": {"MOY": 500, "TYPE": "SIN", "RESEAU": 15},
                "R0": {"STATUT": 1, "ETAT": 1},
                "R1": {"STATUT": 1, "ETAT": 1},
                "R2": {"STATUT": 1, "ETAT": 1},
                "R3": {"STATUT": 1, "ETAT": 0},
                "R4": {"STATUT": 1, "ETAT": 75},
                "VS_GAZFIO": {"STATUT": 1, "ETAT": 1},
                "M": {"VALEUR": 2},
                "PM": {"STATUT": 1, "ETAT": 1},
            },
            "etapes": [
                {
                    "etape_id": 1,
                    "titre": "Étape 1",
                    "actions": [
                        {"objet": "R3", "action": "ouvrir", "valeur_attendue": "1"}
                    ],
                    "etat_resultant": {"R3": {"STATUT": 1, "ETAT": 1}},
                    "conditions_erreur": [
                        {
                            "type": "mauvaise_action",
                            "objet": "R3",
                            "condition": "Ne pas fermer",
                            "consequence": "Erreur manipulation",
                        }
                    ],
                }
            ],
        }

        # Ne doit pas lever d'exception
        validate_scenario_structure(valid_scenario)
