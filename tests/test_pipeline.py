"""Tests pour le module pipeline.py - Pipeline orchestrateur."""

import json
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.documents import Document

from vr_scenario_lib.config import build_llm_config
from vr_scenario_lib.json_converter import JsonParsingError
from vr_scenario_lib.pipeline import (
    PipelineError,
    run_pipeline,
    save_json,
    validate_scenario_structure,
)


class TestSaveJson:
    """Tests pour save_json."""

    def test_save_json_creates_file(self):
        """Test que save_json crée le fichier."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "output.json"
            data = {"key": "value"}

            save_json(data, str(output_path))
            assert output_path.exists()

            with open(output_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                assert loaded == data

    def test_save_json_creates_directories(self):
        """Test que save_json crée les répertoires nécessaires."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "subdir" / "output.json"
            data = {"key": "value"}

            save_json(data, str(output_path))
            assert output_path.exists()

    def test_save_json_overwrites(self):
        """Test que save_json écrase un fichier existant."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "output.json"

            save_json({"old": "data"}, str(output_path))
            save_json({"new": "data"}, str(output_path))

            with open(output_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                assert loaded == {"new": "data"}


class TestValidateScenarioStructure:
    """Tests pour validate_scenario_structure."""

    def test_valid_structure(self):
        """Test une structure valide."""
        data = {
            "scenario_id": "test",
            "titre": "Test",
            "etat_initial": {"TYPE_POSTE": "GAZFIO"},
            "etapes": [
                {
                    "etape_id": 1,
                    "titre": "Step 1",
                    "actions": [],
                    "conditions_erreur": [],
                }
            ],
        }
        # Ne doit pas lever d'exception
        validate_scenario_structure(data)

    def test_missing_scenario_id(self):
        """Test avec scenario_id manquant."""
        data = {
            "titre": "Test",
            "etat_initial": {},
            "etapes": [],
        }
        with pytest.raises(JsonParsingError, match="Clé obligatoire manquante"):
            validate_scenario_structure(data)

    def test_missing_titre(self):
        """Test avec titre manquant."""
        data = {
            "scenario_id": "test",
            "etat_initial": {},
            "etapes": [],
        }
        with pytest.raises(JsonParsingError, match="Clé obligatoire manquante"):
            validate_scenario_structure(data)

    def test_missing_etat_initial(self):
        """Test avec etat_initial manquant."""
        data = {
            "scenario_id": "test",
            "titre": "Test",
            "etapes": [],
        }
        with pytest.raises(JsonParsingError, match="Clé obligatoire manquante"):
            validate_scenario_structure(data)

    def test_missing_etapes(self):
        """Test avec etapes manquant."""
        data = {
            "scenario_id": "test",
            "titre": "Test",
            "etat_initial": {},
        }
        with pytest.raises(JsonParsingError, match="Clé obligatoire manquante"):
            validate_scenario_structure(data)

    def test_invalid_etat_initial_type(self):
        """Test avec etat_initial de mauvais type."""
        data = {
            "scenario_id": "test",
            "titre": "Test",
            "etat_initial": "not a dict",
            "etapes": [],
        }
        with pytest.raises(
            JsonParsingError, match="etat_initial.*doit être un dictionnaire"
        ):
            validate_scenario_structure(data)

    def test_invalid_etapes_type(self):
        """Test avec etapes de mauvais type."""
        data = {
            "scenario_id": "test",
            "titre": "Test",
            "etat_initial": {},
            "etapes": "not a list",
        }
        with pytest.raises(JsonParsingError, match="etapes.*doit être une liste"):
            validate_scenario_structure(data)

    def test_etape_missing_id(self):
        """Test une étape sans etape_id."""
        data = {
            "scenario_id": "test",
            "titre": "Test",
            "etat_initial": {},
            "etapes": [{"titre": "Step 1"}],
        }
        with pytest.raises(JsonParsingError, match="etape_id.*manquante"):
            validate_scenario_structure(data)

    def test_etape_missing_titre(self):
        """Test une étape sans titre."""
        data = {
            "scenario_id": "test",
            "titre": "Test",
            "etat_initial": {},
            "etapes": [{"etape_id": 1}],
        }
        with pytest.raises(JsonParsingError, match="titre.*manquante"):
            validate_scenario_structure(data)

    def test_etape_invalid_actions_type(self):
        """Test une étape avec actions de mauvais type."""
        data = {
            "scenario_id": "test",
            "titre": "Test",
            "etat_initial": {},
            "etapes": [
                {
                    "etape_id": 1,
                    "titre": "Step 1",
                    "actions": "not a list",
                }
            ],
        }
        with pytest.raises(JsonParsingError, match="actions.*doit être une liste"):
            validate_scenario_structure(data)

    def test_etape_invalid_conditions_erreur_type(self):
        """Test une étape avec conditions_erreur de mauvais type."""
        data = {
            "scenario_id": "test",
            "titre": "Test",
            "etat_initial": {},
            "etapes": [
                {
                    "etape_id": 1,
                    "titre": "Step 1",
                    "actions": [],
                    "conditions_erreur": "not a list",
                }
            ],
        }
        with pytest.raises(
            JsonParsingError, match="conditions_erreur.*doit être une liste"
        ):
            validate_scenario_structure(data)

    def test_empty_etapes_list(self):
        """Test avec une liste d'étapes vide."""
        data = {
            "scenario_id": "test",
            "titre": "Test",
            "etat_initial": {},
            "etapes": [],
        }
        # Ne doit pas lever d'exception
        validate_scenario_structure(data)

    def test_multiple_etapes(self):
        """Test avec plusieurs étapes."""
        data = {
            "scenario_id": "test",
            "titre": "Test",
            "etat_initial": {},
            "etapes": [
                {
                    "etape_id": i,
                    "titre": f"Step {i}",
                    "actions": [],
                    "conditions_erreur": [],
                }
                for i in range(1, 6)
            ],
        }
        validate_scenario_structure(data)


class TestRunPipeline:
    """Tests pour run_pipeline."""

    @patch("vr_scenario_lib.pipeline.create_session")
    @patch("vr_scenario_lib.pipeline.convert_scenario_to_json")
    @patch("vr_scenario_lib.pipeline.generate_scenario")
    def test_successful_pipeline(
        self, mock_generate, mock_convert, mock_create_session
    ):
        """Test un pipeline réussi."""
        mock_generate.return_value = ("Scenario text", [Document(page_content="doc")])
        mock_convert.return_value = {
            "scenario_id": "test",
            "titre": "Test",
            "etat_initial": {},
            "etapes": [],
        }

        mock_retriever = MagicMock()
        llm_config = build_llm_config(token="fake_token")

        result = run_pipeline(
            topic="Test topic",
            retriever=mock_retriever,
            llm_config=llm_config,
        )

        assert result["scenario_id"] == "test"
        mock_generate.assert_called_once()
        mock_convert.assert_called_once()

    @patch("vr_scenario_lib.pipeline.create_session")
    @patch("vr_scenario_lib.pipeline.convert_scenario_to_json")
    @patch("vr_scenario_lib.pipeline.generate_scenario")
    def test_pipeline_with_output_path(
        self, mock_generate, mock_convert, mock_create_session
    ):
        """Test un pipeline avec output_path."""
        mock_generate.return_value = ("Text", [])
        mock_convert.return_value = {
            "scenario_id": "test",
            "titre": "Test",
            "etat_initial": {},
            "etapes": [],
        }

        mock_retriever = MagicMock()
        llm_config = build_llm_config(token="fake_token")

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = str(Path(tmpdir) / "output.json")
            _ = run_pipeline(
                topic="Test",
                retriever=mock_retriever,
                llm_config=llm_config,
                output_path=output_path,
            )
            assert Path(output_path).exists()

    @patch("vr_scenario_lib.pipeline.create_session")
    @patch("vr_scenario_lib.pipeline.convert_scenario_to_json")
    @patch("vr_scenario_lib.pipeline.generate_scenario")
    def test_pipeline_with_store_dir(
        self, mock_generate, mock_convert, mock_create_session
    ):
        """Test un pipeline avec store_dir."""
        mock_generate.return_value = ("Text", [])
        mock_convert.return_value = {
            "scenario_id": "stored-scenario",
            "titre": "Test",
            "etat_initial": {},
            "etapes": [],
        }

        mock_retriever = MagicMock()
        llm_config = build_llm_config(token="fake_token")

        with tempfile.TemporaryDirectory() as tmpdir:
            _ = run_pipeline(
                topic="Test",
                retriever=mock_retriever,
                llm_config=llm_config,
                store_dir=tmpdir,
            )
            mock_create_session.assert_called_once()

    @patch("vr_scenario_lib.pipeline.generate_scenario")
    def test_pipeline_generation_failure(self, mock_generate):
        """Test un échec de génération."""
        mock_generate.side_effect = Exception("Generation failed")

        mock_retriever = MagicMock()
        llm_config = build_llm_config(token="fake_token")

        with pytest.raises(PipelineError, match="Échec de la génération"):
            run_pipeline(
                topic="Test",
                retriever=mock_retriever,
                llm_config=llm_config,
            )

    @patch("vr_scenario_lib.pipeline.convert_scenario_to_json")
    @patch("vr_scenario_lib.pipeline.generate_scenario")
    def test_pipeline_conversion_failure(self, mock_generate, mock_convert):
        """Test un échec de conversion."""
        mock_generate.return_value = ("Text", [])
        mock_convert.side_effect = Exception("Conversion failed")

        mock_retriever = MagicMock()
        llm_config = build_llm_config(token="fake_token")

        with pytest.raises(PipelineError, match="Échec de la conversion"):
            run_pipeline(
                topic="Test",
                retriever=mock_retriever,
                llm_config=llm_config,
            )

    @patch("vr_scenario_lib.pipeline.validate_scenario_structure")
    @patch("vr_scenario_lib.pipeline.convert_scenario_to_json")
    @patch("vr_scenario_lib.pipeline.generate_scenario")
    def test_pipeline_validation_failure(
        self, mock_generate, mock_convert, mock_validate
    ):
        """Test un échec de validation."""
        mock_generate.return_value = ("Text", [])
        mock_convert.return_value = {"invalid": "structure"}
        mock_validate.side_effect = JsonParsingError("Invalid structure")

        mock_retriever = MagicMock()
        llm_config = build_llm_config(token="fake_token")

        with pytest.raises(PipelineError, match="Structure JSON invalide"):
            run_pipeline(
                topic="Test",
                retriever=mock_retriever,
                llm_config=llm_config,
            )

    @patch("vr_scenario_lib.pipeline.create_session")
    @patch("vr_scenario_lib.pipeline.convert_scenario_to_json")
    @patch("vr_scenario_lib.pipeline.generate_scenario")
    def test_pipeline_with_custom_prompt(
        self, mock_generate, mock_convert, mock_create_session
    ):
        """Test un pipeline avec custom_prompt."""
        mock_generate.return_value = ("Text", [])
        mock_convert.return_value = {
            "scenario_id": "test",
            "titre": "Test",
            "etat_initial": {},
            "etapes": [],
        }

        mock_retriever = MagicMock()
        llm_config = build_llm_config(token="fake_token")

        run_pipeline(
            topic="Test",
            retriever=mock_retriever,
            llm_config=llm_config,
            custom_prompt="Additional instructions",
        )

        # Vérifier que custom_prompt est passé à generate_scenario
        call_kwargs = mock_generate.call_args
        assert (
            call_kwargs[1].get("custom_prompt") == "Additional instructions"
            or call_kwargs[0][3] == "Additional instructions"
        )
