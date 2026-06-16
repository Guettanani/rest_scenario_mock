"""Tests étendus pour le module rest_server.py - API REST FastAPI."""

import io
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Mock des variables d'environnement avant l'import
os.environ.setdefault("OPENROUTER_API_KEY", "test_token")
os.environ.setdefault("HUGGINGFACE_API_KEY", "test_token")


@pytest.fixture
def mock_server_state():
    """Fixture pour mock état du serveur."""
    with patch("vr_scenario_lib.rest_server._server_state") as mock_state:
        mock_state.__getitem__ = lambda self, key: {
            "llm_config": {"model": "test-model"},
            "embeddings": MagicMock(),
            "vectorstore": MagicMock(),
            "retriever": MagicMock(),
            "initialized": True,
            "docs_dir": "./documents",
            "faiss_dir": "faiss_index",
            "scenarios_dir": "./scenarios",
            "start_time": 0,
        }.get(key)
        mock_state.__contains__ = lambda self, key: key in [
            "llm_config",
            "embeddings",
            "vectorstore",
            "retriever",
            "initialized",
            "docs_dir",
            "faiss_dir",
            "scenarios_dir",
            "start_time",
        ]
        yield mock_state


@pytest.fixture
def client(mock_server_state):
    """Fixture pour le client de test."""
    from vr_scenario_lib.rest_server import app

    return TestClient(app)


class TestHealthEndpoint:
    """Tests pour le endpoint /health."""

    def test_health_check_returns_200(self, client):
        """Test que le health check retourne 200."""
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_check_returns_status(self, client):
        """Test que le health check retourne un statut."""
        response = client.get("/health")
        data = response.json()
        assert "status" in data
        assert data["status"] in ["SERVING", "NOT_SERVING", "healthy"]

    def test_health_check_returns_uptime(self, client):
        """Test que le health check retourne l'uptime."""
        response = client.get("/health")
        data = response.json()
        assert "uptime_seconds" in data
        assert isinstance(data["uptime_seconds"], int)

    def test_health_check_returns_model(self, client):
        """Test que le health check retourne le modèle."""
        response = client.get("/health")
        data = response.json()
        assert "model" in data


class TestGenerateScenarioEndpoint:
    """Tests pour le endpoint /api/v1/scenario/generate."""

    @patch("vr_scenario_lib.rest_server.run_pipeline")
    def test_generate_scenario_success(self, mock_run_pipeline, client):
        """Test une génération de scénario réussie."""
        mock_run_pipeline.return_value = {
            "scenario_id": "test-scenario",
            "titre": "Test Scenario",
            "etapes": [{"etape_id": 1, "titre": "Step 1"}],
        }

        response = client.post(
            "/api/v1/scenario/generate",
            json={"topic": "Test topic", "store": False},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["scenario_id"] == "test-scenario"
        assert data["nb_etapes"] == 1

    def test_generate_scenario_empty_topic(self, client):
        """Test avec un topic vide."""
        response = client.post(
            "/api/v1/scenario/generate",
            json={"topic": "", "store": False},
        )
        # FastAPI retourne 422 pour les erreurs de validation Pydantic
        # car le topic a une contrainte min_length=1
        assert response.status_code in [400, 422]

    def test_generate_scenario_missing_topic(self, client):
        """Test sans topic."""
        response = client.post(
            "/api/v1/scenario/generate",
            json={"store": False},
        )
        assert response.status_code == 422

    @patch("vr_scenario_lib.rest_server.run_pipeline")
    def test_generate_scenario_with_custom_prompt(self, mock_run_pipeline, client):
        """Test avec un custom prompt."""
        mock_run_pipeline.return_value = {
            "scenario_id": "test",
            "titre": "Test",
            "etapes": [],
        }

        response = client.post(
            "/api/v1/scenario/generate",
            json={
                "topic": "Test",
                "custom_prompt": "Additional instructions",
                "store": False,
            },
        )

        assert response.status_code == 200

    @patch("vr_scenario_lib.rest_server.run_pipeline")
    def test_generate_scenario_pipeline_error(self, mock_run_pipeline, client):
        """Test une erreur du pipeline."""
        mock_run_pipeline.side_effect = Exception("Pipeline error")

        response = client.post(
            "/api/v1/scenario/generate",
            json={"topic": "Test", "store": False},
        )

        assert response.status_code == 500


class TestGetScenarioEndpoint:
    """Tests pour le endpoint /api/v1/scenario/{scenario_id}."""

    @patch("vr_scenario_lib.rest_server.load_session")
    def test_get_scenario_success(self, mock_load_session, client):
        """Test la récupération d'un scénario existant."""
        mock_session = MagicMock()
        mock_session.to_dict.return_value = {
            "scenario_id": "test-id",
            "topic": "Test",
            "scenario_text": "Text",
            "scenario_json": {},
            "history": [],
        }
        mock_load_session.return_value = mock_session

        response = client.get("/api/v1/scenario/test-id")
        assert response.status_code == 200

    @patch("vr_scenario_lib.rest_server.load_session")
    def test_get_scenario_not_found(self, mock_load_session, client):
        """Test la récupération d'un scénario inexistant."""
        mock_load_session.side_effect = FileNotFoundError("Not found")

        response = client.get("/api/v1/scenario/nonexistent")
        assert response.status_code == 404


class TestListScenariosEndpoint:
    """Tests pour le endpoint /api/v1/scenarios."""

    @patch("vr_scenario_lib.rest_server.list_sessions")
    def test_list_scenarios_empty(self, mock_list_sessions, client):
        """Test la liste vide."""
        mock_list_sessions.return_value = []

        response = client.get("/api/v1/scenarios")
        assert response.status_code == 200
        data = response.json()
        assert data["scenarios"] == []
        assert data["total"] == 0

    @patch("vr_scenario_lib.rest_server.load_session")
    @patch("vr_scenario_lib.rest_server.list_sessions")
    def test_list_scenarios_with_data(
        self, mock_list_sessions, mock_load_session, client
    ):
        """Test la liste avec des données."""
        mock_list_sessions.return_value = ["scenario-1", "scenario-2"]
        mock_load_session.return_value = MagicMock(
            scenario_id="scenario-1",
            topic="Test",
            scenario_json={"titre": "Test", "etapes": []},
            created_at="2024-01-01",
            updated_at="2024-01-02",
        )
        mock_load_session.return_value.to_dict = lambda: {
            "scenario_id": "scenario-1",
            "topic": "Test",
            "scenario_json": {"titre": "Test", "etapes": []},
            "created_at": "2024-01-01",
            "updated_at": "2024-01-02",
        }

        response = client.get("/api/v1/scenarios")
        assert response.status_code == 200


class TestSaveScenarioEndpoint:
    """Tests pour le endpoint /api/v1/scenario/save."""

    def test_save_scenario_success(self, client):
        """Test la sauvegarde d'un scénario."""
        scenario_data = {
            "titre": "Test Scenario",
            "description": "Description",
            "difficulte": "debutant",
            "duree_totale": 30,
            "environnement": "GAZFIO",
            "etapes": [
                {
                    "etape_id": 1,
                    "titre": "Step 1",
                    "actions": [],
                    "conditions_erreur": [],
                }
            ],
            "parametres_techniques": {},
            "etat_initial": {},
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch(
                "vr_scenario_lib.rest_server._server_state", {"scenarios_dir": tmpdir}
            ):
                response = client.post("/api/v1/scenario/save", json=scenario_data)
                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert "scenario_id" in data

    def test_save_scenario_minimal(self, client):
        """Test la sauvegarde avec données minimales."""
        scenario_data = {
            "titre": "Minimal",
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch(
                "vr_scenario_lib.rest_server._server_state", {"scenarios_dir": tmpdir}
            ):
                response = client.post("/api/v1/scenario/save", json=scenario_data)
                assert response.status_code == 200


class TestDocumentsEndpoint:
    """Tests pour le endpoint /api/v1/documents."""

    def test_get_documents_empty(self, client):
        """Test la liste des documents vide."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch(
                "vr_scenario_lib.rest_server._server_state", {"docs_dir": tmpdir}
            ):
                response = client.get("/api/v1/documents")
                assert response.status_code == 200
                data = response.json()
                assert data["documents"] == []

    def test_get_documents_with_files(self, client):
        """Test la liste des documents avec des fichiers."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Créer des fichiers
            Path(tmpdir, "doc1.pdf").write_bytes(b"%PDF-1.4 fake")
            Path(tmpdir, "doc2.docx").write_bytes(b"fake docx")

            with patch(
                "vr_scenario_lib.rest_server._server_state", {"docs_dir": tmpdir}
            ):
                response = client.get("/api/v1/documents")
                assert response.status_code == 200
                data = response.json()
                assert data["total"] == 2


class TestFilesEndpoint:
    """Tests pour les endpoints /api/v1/files."""

    def test_list_files_empty(self, client):
        """Test la liste des fichiers vide."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch(
                "vr_scenario_lib.rest_server._server_state", {"docs_dir": tmpdir}
            ):
                response = client.get("/api/v1/files")
                assert response.status_code == 200
                data = response.json()
                assert data["files"] == []

    def test_upload_file(self, client):
        """Test l'upload d'un fichier."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch(
                "vr_scenario_lib.rest_server._server_state", {"docs_dir": tmpdir}
            ):
                file_content = b"Test file content"
                response = client.post(
                    "/api/v1/files/upload",
                    files={
                        "file": ("test.txt", io.BytesIO(file_content), "text/plain")
                    },
                )
                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True

    def test_delete_file(self, client):
        """Test la suppression d'un fichier."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Créer un fichier
            test_file = Path(tmpdir, "test.txt")
            test_file.write_text("Test content")

            with patch(
                "vr_scenario_lib.rest_server._server_state", {"docs_dir": tmpdir}
            ):
                response = client.delete("/api/v1/files/test.txt")
                assert response.status_code == 200

    def test_delete_nonexistent_file(self, client):
        """Test la suppression d'un fichier inexistant."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch(
                "vr_scenario_lib.rest_server._server_state", {"docs_dir": tmpdir}
            ):
                response = client.delete("/api/v1/files/nonexistent.txt")
                assert response.status_code == 404


class TestAssignmentsEndpoint:
    """Tests pour les endpoints /api/v1/assignments."""

    def test_create_assignment(self, client):
        """Test la création d'une assignation."""
        assignment_data = {
            "user_id": 1,
            "scenario_id": 1,
        }

        response = client.post("/api/v1/assignments", json=assignment_data)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "session_id" in data

    def test_list_my_assignments(self, client):
        """Test la liste des assignations de l'utilisateur."""
        response = client.get("/api/v1/assignments/me")
        assert response.status_code == 200


class TestRefreshIndexEndpoint:
    """Tests pour le endpoint /api/v1/index/refresh."""

    @patch("vr_scenario_lib.rest_server.refresh_index")
    def test_refresh_index_success(self, mock_refresh, client):
        """Test le rafraîchissement de l'index."""
        mock_refresh.return_value = None

        with patch("vr_scenario_lib.rest_server._server_state") as mock_state:
            mock_state.__getitem__ = lambda self, key: {
                "vectorstore": MagicMock(index=MagicMock(ntotal=100)),
            }.get(key)

            response = client.post("/api/v1/index/refresh")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True


class TestRootEndpoint:
    """Tests pour le endpoint racine."""

    def test_root_redirects_to_docs(self, client):
        """Test que la racine redirige vers la documentation."""
        response = client.get("/", follow_redirects=False)
        assert response.status_code == 307
        assert "/docs" in response.headers.get("location", "")
