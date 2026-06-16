"""Tests pour le module scenario_store.py - Persistance des scénarios."""

import json
import tempfile
from pathlib import Path

import pytest

from vr_scenario_lib.scenario_store import (
    ScenarioSession,
    _session_path,
    create_session,
    list_sessions,
    load_session,
    save_session,
)


class TestScenarioSession:
    """Tests pour ScenarioSession."""

    def test_create_session(self):
        """Test la création d'une session."""
        session = ScenarioSession(
            scenario_id="test-id",
            topic="Test Topic",
            scenario_text="Test scenario text",
            scenario_json={"key": "value"},
        )

        assert session.scenario_id == "test-id"
        assert session.topic == "Test Topic"
        assert session.scenario_text == "Test scenario text"
        assert session.scenario_json == {"key": "value"}
        assert session.history == []

    def test_to_dict(self):
        """Test la conversion en dictionnaire."""
        session = ScenarioSession(
            scenario_id="test-id",
            topic="Test Topic",
            scenario_text="Text",
            scenario_json={"key": "value"},
            history=[{"role": "user", "content": "Hello"}],
            created_at="2024-01-01",
            updated_at="2024-01-02",
        )

        result = session.to_dict()
        assert result["scenario_id"] == "test-id"
        assert result["history"] == [{"role": "user", "content": "Hello"}]
        assert result["created_at"] == "2024-01-01"

    def test_from_dict(self):
        """Test la création depuis un dictionnaire."""
        data = {
            "scenario_id": "test-id",
            "topic": "Test Topic",
            "scenario_text": "Text",
            "scenario_json": {"key": "value"},
            "history": [{"role": "assistant", "content": "Response"}],
            "created_at": "2024-01-01",
            "updated_at": "2024-01-02",
        }

        session = ScenarioSession.from_dict(data)
        assert session.scenario_id == "test-id"
        assert session.history == [{"role": "assistant", "content": "Response"}]

    def test_from_dict_missing_optional_fields(self):
        """Test la création avec des champs optionnels manquants."""
        data = {
            "scenario_id": "test-id",
            "topic": "Test",
            "scenario_text": "Text",
            "scenario_json": {},
        }

        session = ScenarioSession.from_dict(data)
        assert session.history == []
        assert session.created_at == ""
        assert session.updated_at == ""

    def test_default_history_is_empty_list(self):
        """Test que l'historique par défaut est une liste vide."""
        session = ScenarioSession(
            scenario_id="test",
            topic="Test",
            scenario_text="Text",
            scenario_json={},
        )
        assert session.history == []

    def test_history_modification(self):
        """Test la modification de l'historique."""
        session = ScenarioSession(
            scenario_id="test",
            topic="Test",
            scenario_text="Text",
            scenario_json={},
        )

        session.history.append({"role": "user", "content": "Hello"})
        session.history.append({"role": "assistant", "content": "Hi"})

        assert len(session.history) == 2


class TestSessionPath:
    """Tests pour _session_path."""

    def test_session_path(self):
        """Test le calcul du chemin de session."""
        path = _session_path("./scenarios", "test-id")
        assert path == Path("./scenarios/test-id/session.json")

    def test_session_path_with_nested_dir(self):
        """Test avec un répertoire imbriqué."""
        path = _session_path("/data/scenarios", "abc-123")
        assert path == Path("/data/scenarios/abc-123/session.json")


class TestSaveSession:
    """Tests pour save_session."""

    def test_save_new_session(self):
        """Test la sauvegarde d'une nouvelle session."""
        with tempfile.TemporaryDirectory() as tmpdir:
            session = ScenarioSession(
                scenario_id="test-id",
                topic="Test",
                scenario_text="Text",
                scenario_json={"key": "value"},
            )

            path = save_session(session, tmpdir)
            assert Path(path).exists()

            # Vérifier le contenu
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                assert data["scenario_id"] == "test-id"
                assert data["topic"] == "Test"

    def test_save_updates_timestamp(self):
        """Test que la sauvegarde met à jour le timestamp."""
        with tempfile.TemporaryDirectory() as tmpdir:
            session = ScenarioSession(
                scenario_id="test-id",
                topic="Test",
                scenario_text="Text",
                scenario_json={},
                created_at="2024-01-01",
            )

            save_session(session, tmpdir)
            assert session.updated_at != ""

    def test_save_creates_directory(self):
        """Test que la sauvegarde crée le répertoire si nécessaire."""
        with tempfile.TemporaryDirectory() as tmpdir:
            session = ScenarioSession(
                scenario_id="new-id",
                topic="Test",
                scenario_text="Text",
                scenario_json={},
            )

            save_session(session, tmpdir)
            assert (Path(tmpdir) / "new-id").exists()

    def test_save_overwrite(self):
        """Test l'écrasement d'une session existante."""
        with tempfile.TemporaryDirectory() as tmpdir:
            session = ScenarioSession(
                scenario_id="test-id",
                topic="Original",
                scenario_text="Original text",
                scenario_json={},
            )

            save_session(session, tmpdir)

            # Modifier et sauvegarder à nouveau
            session.topic = "Modified"
            save_session(session, tmpdir)

            # Vérifier
            loaded = load_session("test-id", tmpdir)
            assert loaded.topic == "Modified"


class TestLoadSession:
    """Tests pour load_session."""

    def test_load_by_id(self):
        """Test le chargement par ID."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Créer une session
            session_dir = Path(tmpdir) / "test-id"
            session_dir.mkdir()
            session_file = session_dir / "session.json"
            session_file.write_text(
                json.dumps(
                    {
                        "scenario_id": "test-id",
                        "topic": "Test",
                        "scenario_text": "Text",
                        "scenario_json": {},
                    }
                )
            )

            loaded = load_session("test-id", tmpdir)
            assert loaded.scenario_id == "test-id"
            assert loaded.topic == "Test"

    def test_load_by_path(self):
        """Test le chargement par chemin."""
        with tempfile.TemporaryDirectory() as tmpdir:
            session_dir = Path(tmpdir) / "test-id"
            session_dir.mkdir()
            session_file = session_dir / "session.json"
            session_file.write_text(
                json.dumps(
                    {
                        "scenario_id": "test-id",
                        "topic": "Test",
                        "scenario_text": "Text",
                        "scenario_json": {},
                    }
                )
            )

            loaded = load_session(str(session_file))
            assert loaded.scenario_id == "test-id"

    def test_load_nonexistent(self):
        """Test le chargement d'une session inexistante."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with pytest.raises(FileNotFoundError, match="Session introuvable"):
                load_session("nonexistent", tmpdir)

    def test_load_preserves_history(self):
        """Test que le chargement préserve l'historique."""
        with tempfile.TemporaryDirectory() as tmpdir:
            session_dir = Path(tmpdir) / "test-id"
            session_dir.mkdir()
            session_file = session_dir / "session.json"
            session_file.write_text(
                json.dumps(
                    {
                        "scenario_id": "test-id",
                        "topic": "Test",
                        "scenario_text": "Text",
                        "scenario_json": {},
                        "history": [
                            {"role": "user", "content": "Hello"},
                            {"role": "assistant", "content": "Hi"},
                        ],
                    }
                )
            )

            loaded = load_session("test-id", tmpdir)
            assert len(loaded.history) == 2


class TestCreateSession:
    """Tests pour create_session."""

    def test_create_and_save(self):
        """Test la création et sauvegarde d'une session."""
        with tempfile.TemporaryDirectory() as tmpdir:
            session = create_session(
                topic="Test Topic",
                scenario_text="Test text",
                scenario_json={"scenario_id": "auto-id", "titre": "Test"},
                scenarios_dir=tmpdir,
            )

            assert session.scenario_id == "auto-id"
            assert (Path(tmpdir) / "auto-id" / "session.json").exists()

    def test_create_generates_id_if_missing(self):
        """Test la génération d'un ID si manquant."""
        with tempfile.TemporaryDirectory() as tmpdir:
            session = create_session(
                topic="Test",
                scenario_text="Text",
                scenario_json={"titre": "Test"},  # Pas de scenario_id
                scenarios_dir=tmpdir,
            )

            assert session.scenario_id == "scenario"


class TestListSessions:
    """Tests pour list_sessions."""

    def test_empty_directory(self):
        """Test avec un répertoire vide."""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = list_sessions(tmpdir)
            assert result == []

    def test_nonexistent_directory(self):
        """Test avec un répertoire inexistant."""
        result = list_sessions("/nonexistent/path")
        assert result == []

    def test_list_multiple_sessions(self):
        """Test la liste de plusieurs sessions."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Créer plusieurs sessions
            for sid in ["session-1", "session-2", "session-3"]:
                session_dir = Path(tmpdir) / sid
                session_dir.mkdir()
                (session_dir / "session.json").write_text("{}")

            result = list_sessions(tmpdir)
            assert len(result) == 3
            assert "session-1" in result
            assert "session-2" in result
            assert "session-3" in result

    def test_list_sorted(self):
        """Test que les sessions sont triées."""
        with tempfile.TemporaryDirectory() as tmpdir:
            for sid in ["c-session", "a-session", "b-session"]:
                session_dir = Path(tmpdir) / sid
                session_dir.mkdir()
                (session_dir / "session.json").write_text("{}")

            result = list_sessions(tmpdir)
            assert result == ["a-session", "b-session", "c-session"]

    def test_list_ignores_non_session_files(self):
        """Test que les fichiers non-session sont ignorés."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Créer une session valide
            session_dir = Path(tmpdir) / "valid-session"
            session_dir.mkdir()
            (session_dir / "session.json").write_text("{}")

            # Créer un fichier non-session
            (Path(tmpdir) / "random.txt").write_text("not a session")

            result = list_sessions(tmpdir)
            assert len(result) == 1
            assert "valid-session" in result
